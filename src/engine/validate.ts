import type { Book, Concept, ContentNode, LText } from './types';

/**
 * Content rules. These are the quality promises of the product written as checks,
 * so a concept that breaks one cannot be built or shipped.
 */
export interface Issue {
  level: 'error' | 'warn';
  where: string;
  message: string;
}

export function validateConcept(concept: Concept, book: Book): Issue[] {
  const issues: Issue[] = [];
  const err = (where: string, message: string) => issues.push({ level: 'error', where, message });
  const warn = (where: string, message: string) => issues.push({ level: 'warn', where, message });
  const langs = book.languages;

  const text = (where: string, t: LText | undefined) => {
    for (const lang of langs) {
      if (!t || typeof t[lang] !== 'string' || t[lang].trim() === '') err(where, `missing "${lang}" text`);
    }
  };

  text('title', concept.title);
  text('question', concept.question);
  if (!concept.core?.length) err('core', 'a concept needs its core statements listed for checking against the book');
  concept.core?.forEach((c, i) => text(`core[${i}]`, c));
  for (const [id, member] of Object.entries(concept.cast ?? {})) text(`cast.${id}`, member.name);

  const nodes = concept.nodes ?? {};
  if (!nodes[concept.start]) err('start', `start node "${concept.start}" does not exist`);

  const target = (where: string, id: string) => {
    if (!nodes[id]) err(where, `points to "${id}", which does not exist`);
  };
  const speaker = (where: string, s: string) => {
    if (s !== 'guide' && s !== 'narrator' && !concept.cast?.[s]) err(where, `unknown speaker "${s}"`);
  };

  const sources = new Set<string>();
  let retells = 0;
  let ends = 0;

  for (const [id, node] of Object.entries(nodes)) {
    switch (node.type) {
      case 'beat':
      case 'end':
        if (!node.lines?.length) err(id, 'has no lines');
        node.lines?.forEach((line, i) => {
          speaker(`${id}.lines[${i}]`, line.speaker);
          text(`${id}.lines[${i}]`, line.text);
        });
        if (node.type === 'beat') target(id, node.next);
        else ends++;
        break;
      case 'choice': {
        text(`${id}.prompt`, node.prompt);
        if ((node.options?.length ?? 0) < 2) err(id, 'a choice needs at least two options');
        const seenNext = new Map<string, string>();
        const seenIds = new Set<string>();
        for (const o of node.options ?? []) {
          const where = `${id}/${o.id}`;
          if (seenIds.has(o.id)) err(where, 'duplicate option id');
          seenIds.add(o.id);
          text(where, o.text);
          target(where, o.next);
          if (!['book', 'detour', 'open'].includes(o.stance)) err(where, 'stance must be book, detour or open');
          // The central promise: no two answers share a reply.
          const twin = seenNext.get(o.next);
          if (twin) err(where, `shares its reply with option "${twin}"; every option needs a branch written for it`);
          seenNext.set(o.next, o.id);
          // A reply has to be something said to the reader, not a jump straight to the shared path.
          const first = nodes[o.next];
          if (first && first.type !== 'beat') err(where, 'the reply to an option must start with a beat');
        }
        for (const lang of langs) {
          const lengths = (node.options ?? []).map((o) => [...(o.text?.[lang] ?? '')].length);
          const book = (node.options ?? []).findIndex((o) => o.stance === 'book');
          if (lengths.length > 1 && Math.max(...lengths) > Math.min(...lengths) * 2.2) {
            warn(id, `[${lang}] option lengths differ a lot (${lengths.join(', ')})`);
          }
          if (book >= 0 && lengths.length > 2 && lengths[book] === Math.max(...lengths) && lengths[book] > Math.min(...lengths) * 1.5) {
            warn(id, `[${lang}] the book-aligned option is the longest; it can be picked by length alone`);
          }
        }
        break;
      }
      case 'reveal':
        if (!['book', 'ours', 'debate'].includes(node.source)) err(id, 'a reveal must say its source: book, ours or debate');
        sources.add(node.source);
        text(`${id}.title`, node.title);
        text(`${id}.body`, node.body);
        target(id, node.next);
        break;
      case 'retell':
        retells++;
        text(`${id}.prompt`, node.prompt);
        if (!node.checkpoints?.length) err(id, 'a retell needs checkpoints');
        for (const c of node.checkpoints ?? []) {
          text(`${id}.${c.id}.label`, c.label);
          text(`${id}.${c.id}.hint`, c.hint);
          for (const lang of langs) if (!c.cues?.[lang]?.length) err(`${id}.${c.id}`, `no "${lang}" cue words`);
        }
        target(id, node.next);
        break;
      default:
        err(id, `unknown node type "${(node as ContentNode).type}"`);
    }
  }

  if (ends === 0) err('nodes', 'no end node');
  if (retells === 0) err('nodes', 'no retell: every concept ends with the reader saying it back');
  if (!sources.has('book')) err('nodes', 'no reveal marked as the book\'s view');
  if (!sources.has('debate')) err('nodes', 'no limits-and-debate card');

  issues.push(...graphIssues(concept));
  return issues;
}

function nextIds(node: ContentNode): string[] {
  if (node.type === 'choice') return node.options.map((o) => o.next);
  if (node.type === 'end') return [];
  return [node.next];
}

/** Unreachable nodes, loops, and routes that skip the retell or the debate card. */
function graphIssues(concept: Concept): Issue[] {
  const issues: Issue[] = [];
  const nodes = concept.nodes ?? {};
  if (!nodes[concept.start]) return issues;

  const reached = new Set<string>();
  const onPath = new Set<string>();
  let looped = false;
  const visit = (id: string) => {
    if (!nodes[id]) return;
    if (onPath.has(id)) {
      looped = true;
      issues.push({ level: 'error', where: id, message: 'is part of a loop' });
      return;
    }
    if (reached.has(id)) return;
    reached.add(id);
    onPath.add(id);
    nextIds(nodes[id]).forEach(visit);
    onPath.delete(id);
  };
  visit(concept.start);

  for (const id of Object.keys(nodes)) {
    if (!reached.has(id)) issues.push({ level: 'error', where: id, message: 'can never be reached' });
  }
  if (looped) return issues;

  // Can the end be reached from the start without passing a node of this kind?
  const skippable = (kind: (n: ContentNode) => boolean): boolean => {
    const seen = new Set<string>();
    const go = (id: string): boolean => {
      const node = nodes[id];
      if (!node || seen.has(id) || kind(node)) return false;
      seen.add(id);
      if (node.type === 'end') return true;
      return nextIds(node).some(go);
    };
    return go(concept.start);
  };
  if (skippable((n) => n.type === 'retell')) issues.push({ level: 'error', where: 'nodes', message: 'some route reaches the end without a retell' });
  if (skippable((n) => n.type === 'reveal' && n.source === 'debate')) {
    issues.push({ level: 'error', where: 'nodes', message: 'some route reaches the end without the limits-and-debate card' });
  }
  return issues;
}

export function validateBook(book: Book): Issue[] {
  const issues: Issue[] = [];
  const text = (where: string, t: LText | undefined) => {
    for (const lang of book.languages ?? []) {
      if (!t || typeof t[lang] !== 'string' || t[lang].trim() === '') issues.push({ level: 'error', where, message: `missing "${lang}" text` });
    }
  };
  if (!book.languages?.length) issues.push({ level: 'error', where: 'languages', message: 'no languages listed' });
  text('title', book.title);
  text('authors', book.authors);
  text('intro', book.intro);
  text('guideName', book.guideName);
  book.path?.forEach((p, i) => {
    text(`path[${i}].title`, p.title);
    text(`path[${i}].stage`, p.stage);
  });
  return issues;
}
