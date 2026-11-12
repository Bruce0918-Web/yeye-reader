import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { Book, Concept } from '../src/engine/types';

/** Reads every book and its concepts straight from the content folder, for the tools and tests. */
export interface Loaded {
  book: Book;
  concepts: { file: string; concept: Concept }[];
}

export function loadAll(root = join(process.cwd(), 'content', 'books')): Loaded[] {
  return readdirSync(root).map((dir) => {
    const book = parse(readFileSync(join(root, dir, 'book.yaml'), 'utf8')) as Book;
    const conceptDir = join(root, dir, 'concepts');
    const files = existsSync(conceptDir) ? readdirSync(conceptDir).filter((f) => f.endsWith('.yaml')) : [];
    const concepts = files.map((f) => ({
      file: `${dir}/concepts/${f}`,
      concept: parse(readFileSync(join(conceptDir, f), 'utf8')) as Concept,
    }));
    return { book, concepts };
  });
}
