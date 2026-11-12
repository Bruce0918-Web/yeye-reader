import type { Concept, ContentNode, Option, Progress, Step } from './types';

/** Pure functions that move a reader through a concept. No UI, no storage, no language. */

export function start(concept: Concept, seed = Math.floor(Math.random() * 1e9)): Progress {
  return { seed, steps: [{ nodeId: concept.start }], done: concept.nodes[concept.start].type === 'end' };
}

export function currentStep(p: Progress): Step {
  return p.steps[p.steps.length - 1];
}

export function nodeOf(concept: Concept, step: Step): ContentNode {
  const node = concept.nodes[step.nodeId];
  if (!node) throw new Error(`Unknown node "${step.nodeId}" in concept "${concept.id}"`);
  return node;
}

function push(concept: Concept, p: Progress, last: Step, nextId: string): Progress {
  const steps = [...p.steps.slice(0, -1), last, { nodeId: nextId }];
  return { ...p, steps, done: concept.nodes[nextId]?.type === 'end' };
}

/** Move on from a beat or a reveal. */
export function advance(concept: Concept, p: Progress): Progress {
  const step = currentStep(p);
  const node = nodeOf(concept, step);
  if (node.type !== 'beat' && node.type !== 'reveal') return p;
  return push(concept, p, step, node.next);
}

export function choose(concept: Concept, p: Progress, optionId: string): Progress {
  const step = currentStep(p);
  const node = nodeOf(concept, step);
  if (node.type !== 'choice') return p;
  const option = node.options.find((o) => o.id === optionId);
  if (!option) return p;
  return push(concept, p, { ...step, optionId }, option.next);
}

export function submitRetell(concept: Concept, p: Progress, text: string, ticks: string[]): Progress {
  const step = currentStep(p);
  const node = nodeOf(concept, step);
  if (node.type !== 'retell') return p;
  return push(concept, p, { ...step, retell: { text, ticks } }, node.next);
}

/** Step back one node and reopen it, forgetting the answer given there. */
export function back(p: Progress): Progress {
  if (p.steps.length <= 1) return p;
  const steps = p.steps.slice(0, -1);
  const last = steps[steps.length - 1];
  steps[steps.length - 1] = { nodeId: last.nodeId };
  return { ...p, steps, done: false };
}

/** Rough share of the way through, by counting main choice points passed. Used for the progress line. */
export function fraction(concept: Concept, p: Progress): number {
  if (p.done) return 1;
  const longest = longestRemaining(concept);
  const here = longest.get(currentStep(p).nodeId) ?? 0;
  const total = longest.get(concept.start) ?? 1;
  return Math.min(1, Math.max(0, 1 - here / total));
}

function nextIds(node: ContentNode): string[] {
  if (node.type === 'choice') return node.options.map((o) => o.next);
  if (node.type === 'end') return [];
  return [node.next];
}

const remainingCache = new WeakMap<Concept, Map<string, number>>();

/** Longest number of nodes from each node to the end. Assumes no cycles (the validator enforces that). */
function longestRemaining(concept: Concept): Map<string, number> {
  const cached = remainingCache.get(concept);
  if (cached) return cached;
  const memo = new Map<string, number>();
  const visit = (id: string): number => {
    const known = memo.get(id);
    if (known !== undefined) return known;
    memo.set(id, 0);
    const node = concept.nodes[id];
    const best = node ? Math.max(0, ...nextIds(node).map((n) => 1 + visit(n))) : 0;
    memo.set(id, best);
    return best;
  };
  visit(concept.start);
  remainingCache.set(concept, memo);
  return memo;
}

/** Options in a stable shuffled order: the same reader sees the same order after a reload or language switch. */
export function shuffledOptions(options: Option[], seed: number, nodeId: string): Option[] {
  let state = seed;
  for (const ch of nodeId) state = (Math.imul(state, 31) + ch.charCodeAt(0)) | 0;
  const rand = () => {
    state = (Math.imul(state ^ (state >>> 15), 2246822507) + 0x9e3779b9) | 0;
    return ((state >>> 0) % 100000) / 100000;
  };
  const out = [...options];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Which checkpoints the reader's own words seem to touch. A hint only: plain word search, easily wrong. */
export function detectCues(text: string, cues: string[]): boolean {
  const hay = text.toLowerCase();
  return cues.some((cue) => hay.includes(cue.toLowerCase()));
}

/** A route through a concept, as the option chosen at each choice node in order. */
export type Route = { nodeId: string; optionId: string }[];

/** Every complete route from start to end. */
export function allRoutes(concept: Concept): Route[] {
  const routes: Route[] = [];
  const walk = (id: string, taken: Route) => {
    const node = concept.nodes[id];
    if (node.type === 'end') return void routes.push(taken);
    if (node.type === 'choice') {
      for (const o of node.options) walk(o.next, [...taken, { nodeId: id, optionId: o.id }]);
      return;
    }
    walk(node.next, taken);
  };
  walk(concept.start, []);
  return routes;
}

/** A small set of routes that together take every option of every choice node at least once. */
export function coveringRoutes(concept: Concept): Route[] {
  const uncovered = new Set<string>();
  for (const [id, node] of Object.entries(concept.nodes)) {
    if (node.type === 'choice') for (const o of node.options) uncovered.add(`${id}/${o.id}`);
  }
  const routes: Route[] = [];
  while (uncovered.size > 0) {
    const route: Route = [];
    let id = concept.start;
    for (;;) {
      const node = concept.nodes[id];
      if (node.type === 'end') break;
      if (node.type !== 'choice') {
        id = node.next;
        continue;
      }
      const pick = bestOption(concept, id, uncovered);
      uncovered.delete(`${id}/${pick.id}`);
      route.push({ nodeId: id, optionId: pick.id });
      id = pick.next;
    }
    routes.push(route);
  }
  return routes;
}

/** The option whose branch still holds the most untaken options. */
function bestOption(concept: Concept, choiceId: string, uncovered: Set<string>): Option {
  const node = concept.nodes[choiceId];
  if (node.type !== 'choice') throw new Error('not a choice');
  const reach = (id: string, seen: Set<string>): number => {
    if (seen.has(id)) return 0;
    seen.add(id);
    const n = concept.nodes[id];
    if (n.type === 'end') return 0;
    if (n.type !== 'choice') return reach(n.next, seen);
    return Math.max(...n.options.map((o) => (uncovered.has(`${id}/${o.id}`) ? 1 : 0) + reach(o.next, new Set(seen))));
  };
  let best = node.options[0];
  let bestScore = -1;
  for (const o of node.options) {
    const score = (uncovered.has(`${choiceId}/${o.id}`) ? 1000 : 0) + reach(o.next, new Set());
    if (score > bestScore) [best, bestScore] = [o, score];
  }
  return best;
}
