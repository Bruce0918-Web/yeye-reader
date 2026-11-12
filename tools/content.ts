import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { Book, Concept } from '../src/engine/types';
import { deriveLanguages } from './derive';

/** Reads every book and its concepts straight from the content folder, for the tools and tests. */
export interface Loaded {
  book: Book;
  concepts: { file: string; concept: Concept }[];
}

const read = <T>(path: string): T => deriveLanguages(parse(readFileSync(path, 'utf8')) as T);

export function loadAll(root = join(process.cwd(), 'content', 'books')): Loaded[] {
  return readdirSync(root).map((dir) => {
    const book = read<Book>(join(root, dir, 'book.yaml'));
    const conceptDir = join(root, dir, 'concepts');
    const files = existsSync(conceptDir) ? readdirSync(conceptDir).filter((f) => f.endsWith('.yaml')) : [];
    const concepts = files.map((f) => ({ file: `${dir}/concepts/${f}`, concept: read<Concept>(join(conceptDir, f)) }));
    // Play concepts in the order the book's path lists them.
    const order = (c: Concept) => book.path.findIndex((p) => p.id === c.id);
    concepts.sort((a, b) => order(a.concept) - order(b.concept));
    return { book, concepts };
  });
}
