import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { build, preview } from 'vite';
import { chromium, type Browser, type Page } from 'playwright-core';
import { loadAll } from './content';
import { coveringRoutes, type Route } from '../src/engine/runner';
import type { Concept, ContentNode, Lang } from '../src/engine/types';

/**
 * Walks the built app in a real (headless) browser, the way a reader would:
 * every option of every choice, in every language, on a phone-sized screen.
 * At each step it checks that the screen shows exactly the text the content file holds
 * for that node and language, that the choice led where the content says, and that nothing overflows.
 */

const OUT = join(process.cwd(), 'walk-output');
const PHONE = { width: 390, height: 844 };
const htmlLang = (lang: Lang) => (lang === 'zh' ? 'zh-Hans' : lang);
const squash = (s: string) => s.replace(/\s+/g, '');

let checks = 0;
const failures: string[] = [];
const check = (ok: boolean, message: string) => {
  checks++;
  if (!ok) failures.push(message);
};

/** The pieces of text a node must show in a given language. */
function expectedTexts(node: ContentNode, lang: Lang): string[] {
  switch (node.type) {
    case 'beat':
    case 'end':
      return node.lines.map((l) => l.text[lang]);
    case 'choice':
      return [node.prompt[lang], ...node.options.map((o) => o.text[lang])];
    case 'reveal':
      return [node.title[lang], ...node.body[lang].split('\n').map((r) => r.replace(/^(- |> )/, '').trim()).filter(Boolean)];
    case 'retell':
      return [node.prompt[lang]];
  }
}

async function setLang(page: Page, lang: Lang) {
  for (let i = 0; i < 4; i++) {
    const now = await page.getAttribute('html', 'lang');
    if (now === htmlLang(lang)) return;
    await page.click('[data-action=lang]');
    // The page updates its language a moment after the click; wait for it before looking again.
    await page.waitForFunction((before) => document.documentElement.lang !== before, now);
  }
}

async function activeId(page: Page) {
  return page.getAttribute('[data-active]', 'data-node-id');
}

async function checkStep(page: Page, concept: Concept, nodeId: string, lang: Lang, tag: string) {
  const shown = await activeId(page);
  check(shown === nodeId, `${tag}: expected node "${nodeId}", screen shows "${shown}"`);
  const text = squash(await page.innerText('[data-active]'));
  for (const piece of expectedTexts(concept.nodes[nodeId], lang)) {
    check(text.includes(squash(piece)), `${tag} ${nodeId}: missing text "${piece.slice(0, 40)}…"`);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 0, `${tag} ${nodeId}: page is ${overflow}px wider than the screen`);
}

interface WalkOptions {
  /** Flip to the other language and back at every step, checking the reader stays put. */
  flipTo?: Lang;
  /** Reload the page at every step, checking progress survives. */
  reload?: boolean;
}

/** Walks one route from the first screen to the end. Returns the number of screens passed. */
async function walk(page: Page, concept: Concept, route: Route, lang: Lang, tag: string, opts: WalkOptions = {}): Promise<number> {
  const picks = [...route];
  let nodeId = concept.start;
  let screens = 0;
  for (let guard = 0; guard < 400; guard++) {
    screens++;
    const node = concept.nodes[nodeId];
    await checkStep(page, concept, nodeId, lang, tag);

    if (opts.flipTo) {
      await setLang(page, opts.flipTo);
      await checkStep(page, concept, nodeId, opts.flipTo, `${tag} (flipped to ${opts.flipTo})`);
      await setLang(page, lang);
      await checkStep(page, concept, nodeId, lang, `${tag} (flipped back)`);
    }
    if (opts.reload) {
      await page.reload();
      await page.waitForSelector('[data-active]');
      await checkStep(page, concept, nodeId, lang, `${tag} (after reload)`);
    }

    if (node.type === 'end') {
      const coreShown = squash(await page.innerText('[data-screen=end]'));
      for (const c of concept.core) check(coreShown.includes(squash(c[lang])), `${tag}: core statement missing on the end screen`);
      return screens;
    }
    if (node.type === 'choice') {
      const pick = picks.shift()!;
      check(pick.nodeId === nodeId, `${tag}: route expected a choice at "${pick.nodeId}" but reached "${nodeId}"`);
      await page.click(`[data-active] [data-option-id="${pick.optionId}"]`);
      nodeId = node.options.find((o) => o.id === pick.optionId)!.next;
    } else if (node.type === 'retell') {
      await page.fill('[data-active] textarea', lang === 'zh' ? '看后果由谁承担。' : 'Whoever lives with the consequences.');
      await page.click('[data-action=retell-submit]');
      await page.click('[data-action=retell-confirm]');
      nodeId = node.next;
    } else {
      await page.click('[data-action=continue]');
      nodeId = node.next;
    }
    await page.waitForFunction((id) => document.querySelector('[data-active]')?.getAttribute('data-node-id') === id, nodeId);
  }
  failures.push(`${tag}: never reached the end`);
  return screens;
}

async function freshPage(browser: Browser, url: string, lang: Lang, extra: Record<string, unknown> = {}) {
  const context = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, ...extra });
  const page = await context.newPage();
  page.on('console', (m) => m.type() === 'error' && failures.push(`console error: ${m.text()}`));
  page.on('pageerror', (e) => failures.push(`page error: ${e.message}`));
  await page.goto(url);
  await page.waitForSelector('.shell');
  await setLang(page, lang);
  return { context, page };
}

/** Moves forward until the given node is on screen, taking the route's choices on the way. */
async function goTo(page: Page, concept: Concept, route: Route, target: string) {
  const picks = [...route];
  let nodeId = concept.start;
  while (nodeId !== target) {
    const node = concept.nodes[nodeId];
    if (node.type === 'choice') {
      const pick = picks.shift()!;
      await page.click(`[data-active] [data-option-id="${pick.optionId}"]`);
      nodeId = node.options.find((o) => o.id === pick.optionId)!.next;
    } else if (node.type === 'retell' || node.type === 'end') {
      throw new Error(`cannot pass ${nodeId}`);
    } else {
      await page.click('[data-action=continue]');
      nodeId = node.next;
    }
    await page.waitForFunction((id) => document.querySelector('[data-active]')?.getAttribute('data-node-id') === id, nodeId);
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  await build({ logLevel: 'error' });
  const server = await preview({ preview: { port: 4317, strictPort: true }, logLevel: 'error' });
  const base = 'http://localhost:4317/';
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  try {
    for (const { book, concepts } of loadAll()) {
      for (const { concept } of concepts) {
        const url = `${base}#/${concept.id}`;
        const routes = coveringRoutes(concept);
        const optionCount = Object.values(concept.nodes).flatMap((n) => (n.type === 'choice' ? n.options : [])).length;
        console.log(`\n${concept.id}: ${routes.length} routes cover all ${optionCount} options`);

        // 1. Every option, in every language.
        for (const lang of book.languages) {
          let screens = 0;
          for (const [i, route] of routes.entries()) {
            const { context, page } = await freshPage(browser, url, lang);
            screens += await walk(page, concept, route, lang, `[${lang} route ${i + 1}]`);
            await context.close();
          }
          console.log(`  ${lang}: walked ${routes.length} routes, ${screens} screens`);
        }

        // 2. Switching language at every step keeps the reader on the same step.
        {
          const [a, b] = book.languages;
          const { context, page } = await freshPage(browser, url, a);
          const screens = await walk(page, concept, routes[0], a, '[language flip]', { flipTo: b });
          console.log(`  language flip at each of ${screens} screens: checked`);
          await context.close();
        }

        // 3. Reloading at every step keeps progress.
        {
          const lang = book.languages[1] ?? book.languages[0];
          const { context, page } = await freshPage(browser, url, lang);
          const screens = await walk(page, concept, routes[1] ?? routes[0], lang, '[reload]', { reload: true });
          console.log(`  reload at each of ${screens} screens: checked`);
          await context.close();
        }

        // 4. Back: undo a choice, see the options again, pick a different one.
        {
          const { context, page } = await freshPage(browser, url, book.languages[0]);
          const firstChoice = routes[0][0];
          const node = concept.nodes[firstChoice.nodeId];
          if (node.type !== 'choice') throw new Error('expected a choice');
          await goTo(page, concept, routes[0], firstChoice.nodeId);
          await page.click(`[data-active] [data-option-id="${node.options[0].id}"]`);
          await page.waitForFunction((id) => document.querySelector('[data-active]')?.getAttribute('data-node-id') === id, node.options[0].next);
          await page.click('[data-action=back]');
          check((await activeId(page)) === firstChoice.nodeId, '[back] did not return to the choice');
          check((await page.locator('[data-active] [data-option-id]').count()) === node.options.length, '[back] options not shown again');
          await page.click(`[data-active] [data-option-id="${node.options[1].id}"]`);
          await page.waitForFunction((id) => document.querySelector('[data-active]')?.getAttribute('data-node-id') === id, node.options[1].next);
          check((await activeId(page)) === node.options[1].next, '[back] second pick went to the wrong reply');
          console.log('  back and re-choose: checked');
          await context.close();
        }

        // 5. Retell: the keyword guess pre-ticks, the reader can overrule it, an empty answer cannot be sent.
        for (const lang of book.languages) {
          const { context, page } = await freshPage(browser, url, lang);
          const retellId = Object.entries(concept.nodes).find(([, n]) => n.type === 'retell')![0];
          const retell = concept.nodes[retellId];
          if (retell.type !== 'retell') throw new Error('expected a retell');
          await goTo(page, concept, routes[0], retellId);
          check(await page.isDisabled('[data-action=retell-submit]'), `[retell ${lang}] empty answer can be sent`);
          const firstPoint = retell.checkpoints[0];
          await page.fill('[data-active] textarea', `… ${firstPoint.cues[lang][0]} …`);
          await page.click('[data-action=retell-submit]');
          for (const c of retell.checkpoints) {
            const on = (await page.getAttribute(`[data-check="${c.id}"]`, 'aria-checked')) === 'true';
            check(on === (c.id === firstPoint.id), `[retell ${lang}] checkpoint "${c.id}" pre-tick is wrong`);
          }
          const text = squash(await page.innerText('[data-active]'));
          for (const c of retell.checkpoints.slice(1)) check(text.includes(squash(c.hint[lang])), `[retell ${lang}] hint for unticked "${c.id}" not shown`);
          await page.click(`[data-check="${firstPoint.id}"]`);
          check((await page.getAttribute(`[data-check="${firstPoint.id}"]`, 'aria-checked')) === 'false', `[retell ${lang}] reader cannot untick`);
          await page.screenshot({ path: join(OUT, `retell-${lang}.png`) });
          await context.close();
        }
        console.log('  retell guess, overrule and empty-answer guard: checked');

        // 6. Reduced motion: no animation runs.
        {
          const { context, page } = await freshPage(browser, url, book.languages[0], { reducedMotion: 'reduce' });
          const name = await page.evaluate(() => getComputedStyle(document.querySelector('[data-active] .rise')!).animationName);
          check(name === 'none', `[reduced motion] animation still runs (${name})`);
          console.log('  reduced motion: checked');
          await context.close();
        }

        // 7. Pictures, to be looked at by a person: both languages, both themes, phone and desktop.
        const firstChoiceId = routes[0][0].nodeId;
        const firstBook = Object.entries(concept.nodes).find(([, n]) => n.type === 'reveal' && n.source === 'book')![0];
        for (const lang of book.languages) {
          for (const scheme of ['light', 'dark'] as const) {
            const { context, page } = await freshPage(browser, base, lang, { colorScheme: scheme });
            const shot = async (name: string) => {
              await page.waitForTimeout(900);
              await page.screenshot({ path: join(OUT, `${name}-${lang}-${scheme}.png`) });
            };
            await page.evaluate(() => document.fonts.ready);
            await shot('home');
            await page.click(`[data-concept="${concept.id}"]`);
            await page.waitForSelector('[data-active]');
            const opening = concept.nodes[concept.start];
            await goTo2(page, concept, routes[0], opening.type === 'beat' ? opening.next : concept.start);
            await shot('scene');
            await goTo2(page, concept, routes[0], firstChoiceId);
            await shot('choice');
            await goTo2(page, concept, routes[0], firstBook);
            await shot('book-card');
            await context.close();
          }
        }
        {
          const { context, page } = await freshPage(browser, url, book.languages[0], { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
          await goTo(page, concept, routes[0], firstChoiceId);
          await page.waitForTimeout(900);
          await page.screenshot({ path: join(OUT, 'choice-desktop.png') });
          await context.close();
        }
        console.log(`  screenshots saved to ${OUT}`);
      }
    }
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));
  }

  console.log(`\n${checks} checks, ${failures.length} failed.`);
  for (const f of failures.slice(0, 40)) console.log(`  FAIL ${f}`);
  process.exit(failures.length ? 1 : 0);
}

/** Like goTo, but starts from wherever the page already is. */
async function goTo2(page: Page, concept: Concept, route: Route, target: string) {
  let nodeId = (await activeId(page))!;
  const picks = route;
  while (nodeId !== target) {
    const node = concept.nodes[nodeId];
    if (node.type === 'choice') {
      const pick = picks.find((p) => p.nodeId === nodeId)!;
      await page.click(`[data-active] [data-option-id="${pick.optionId}"]`);
      nodeId = node.options.find((o) => o.id === pick.optionId)!.next;
    } else if (node.type === 'retell' || node.type === 'end') {
      throw new Error(`cannot pass ${nodeId}`);
    } else {
      await page.click('[data-action=continue]');
      nodeId = node.next;
    }
    await page.waitForFunction((id) => document.querySelector('[data-active]')?.getAttribute('data-node-id') === id, nodeId);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
