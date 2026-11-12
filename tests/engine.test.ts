import { describe, expect, it } from 'vitest';
import { loadAll } from '../tools/content';
import { validateConcept } from '../src/engine/validate';
import { advance, allRoutes, back, choose, coveringRoutes, currentStep, detectCues, nodeOf, shuffledOptions, start, submitRetell, type Route } from '../src/engine/runner';
import type { Concept, Progress } from '../src/engine/types';

const { book, concepts } = loadAll()[0];

/** Plays a whole route through the engine and returns where it ends. */
function play(concept: Concept, route: Route): Progress {
  let p = start(concept, 1);
  const picks = [...route];
  for (let guard = 0; guard < 500 && !p.done; guard++) {
    const node = nodeOf(concept, currentStep(p));
    if (node.type === 'choice') {
      const pick = picks.shift()!;
      expect(pick.nodeId).toBe(currentStep(p).nodeId);
      p = choose(concept, p, pick.optionId);
    } else if (node.type === 'retell') p = submitRetell(concept, p, 'x', []);
    else p = advance(concept, p);
  }
  expect(picks).toHaveLength(0);
  return p;
}

describe.each(concepts)('$file', ({ concept }) => {
  it('breaks no content rule', () => {
    expect(validateConcept(concept, book).filter((i) => i.level === 'error')).toEqual([]);
  });

  it('every complete route reaches the end, passing a retell and the debate card', () => {
    const routes = allRoutes(concept);
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      const p = play(concept, route);
      expect(p.done).toBe(true);
      const kinds = p.steps.map((s) => nodeOf(concept, s));
      expect(kinds.some((n) => n.type === 'retell')).toBe(true);
      expect(kinds.some((n) => n.type === 'reveal' && n.source === 'debate')).toBe(true);
    }
  });

  it('the covering routes take every option at least once', () => {
    const taken = new Set(coveringRoutes(concept).flatMap((r) => r.map((s) => `${s.nodeId}/${s.optionId}`)));
    for (const [id, node] of Object.entries(concept.nodes)) {
      if (node.type === 'choice') for (const o of node.options) expect(taken.has(`${id}/${o.id}`)).toBe(true);
    }
  });

  it('back reopens the previous step and forgets its answer', () => {
    let p = start(concept, 1);
    while (nodeOf(concept, currentStep(p)).type !== 'choice') p = advance(concept, p);
    const atChoice = p;
    const first = nodeOf(concept, currentStep(p));
    if (first.type !== 'choice') throw new Error('expected a choice');
    p = choose(concept, p, first.options[0].id);
    p = back(p);
    expect(p).toEqual(atChoice);
    expect(back(start(concept, 1)).steps).toHaveLength(1);
  });

  it('shuffles options the same way every time for one reader, and keeps all of them', () => {
    for (const [id, node] of Object.entries(concept.nodes)) {
      if (node.type !== 'choice') continue;
      const a = shuffledOptions(node.options, 42, id).map((o) => o.id);
      expect(shuffledOptions(node.options, 42, id).map((o) => o.id)).toEqual(a);
      expect([...a].sort()).toEqual(node.options.map((o) => o.id).sort());
    }
  });

  it('the book-aligned option is not always in the same place', () => {
    const places = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      for (const [id, node] of Object.entries(concept.nodes)) {
        if (node.type === 'choice' && node.options.some((o) => o.stance === 'book')) {
          places.add(shuffledOptions(node.options, seed, id).findIndex((o) => o.stance === 'book'));
        }
      }
    }
    expect(places.size).toBeGreaterThan(2);
  });
});

describe('cue detection', () => {
  it('finds a cue regardless of case, and finds nothing in unrelated text', () => {
    expect(detectCues('Whoever lives with the Consequences', ['consequence'])).toBe(true);
    expect(detectCues('看后果由谁承担', ['后果'])).toBe(true);
    expect(detectCues('I like tea', ['consequence'])).toBe(false);
  });
});
