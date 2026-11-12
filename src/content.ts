import type { Book, Concept } from './engine/types';

/**
 * Picks up every content file at build time. Adding a book or a concept means adding a file;
 * nothing in the engine or the UI changes.
 */
const bookFiles = import.meta.glob('../content/books/*/book.yaml', { eager: true, import: 'default' }) as Record<string, Book>;
const conceptFiles = import.meta.glob('../content/books/*/concepts/*.yaml', { eager: true, import: 'default' }) as Record<string, Concept>;

export const book: Book = Object.values(bookFiles)[0];

export const concepts: Record<string, Concept> = Object.fromEntries(
  Object.entries(conceptFiles)
    .filter(([path]) => path.includes(`/books/${book.id}/`))
    .map(([, concept]) => [concept.id, concept]),
);
