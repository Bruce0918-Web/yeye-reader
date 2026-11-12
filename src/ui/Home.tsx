import type { Book, Concept, Lang, Progress } from '../engine/types';
import { Guide } from './Guide';
import { t } from './strings';

interface Props {
  book: Book;
  concepts: Record<string, Concept>;
  progress: Record<string, Progress>;
  lang: Lang;
  onOpen: (conceptId: string) => void;
}

/** The contents page: the book, and the path through it. */
export function Home({ book, concepts, progress, lang, onOpen }: Props) {
  let stage = '';
  return (
    <main class="home">
      <header class="masthead rise">
        <div class="masthead-mark">
          <Guide size={34} />
          <span class="label">{book.guideName[lang]}</span>
        </div>
        <h1 class="book-title">{book.title[lang]}</h1>
        <p class="book-authors">{book.authors[lang]}</p>
        <p class="book-intro">{book.intro[lang]}</p>
      </header>

      <ol class="path rise">
        {book.path.map((item, i) => {
          const playable = Boolean(concepts[item.id]);
          const saved = progress[item.id];
          const status = !playable ? 'soon' : saved?.done ? 'done' : saved && saved.steps.length > 1 ? 'resume' : 'start';
          const newStage = item.stage[lang] !== stage;
          stage = item.stage[lang];
          return (
            <>
              {newStage && <li class="path-stage label">{stage}</li>}
              <li>
                <button class="path-item" disabled={!playable} data-concept={item.id} data-status={status} onClick={() => onOpen(item.id)}>
                  <span class="path-n">{String(i + 1).padStart(2, '0')}</span>
                  <span class="path-title">{item.title[lang]}</span>
                  <span class="path-status label">{t(status, lang)}</span>
                </button>
              </li>
            </>
          );
        })}
      </ol>

      <p class="note home-note">{t('disclaimer', lang)}</p>
    </main>
  );
}
