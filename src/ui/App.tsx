import { useEffect, useState } from 'preact/hooks';
import { book, concepts } from '../content';
import type { Lang, Progress } from '../engine/types';
import { start } from '../engine/runner';
import { load, save, type Saved } from '../engine/store';
import { Home } from './Home';
import { Lesson } from './Lesson';
import { languageNames, t } from './strings';

const readRoute = () => decodeURIComponent(location.hash.replace(/^#\/?/, ''));

function firstLanguage(): Lang {
  const wanted = navigator.language.toLowerCase().split('-')[0];
  return book.languages.includes(wanted) ? wanted : book.languages[0];
}

export function App() {
  const [saved, setSaved] = useState<Saved>(load);
  const [route, setRoute] = useState(readRoute);

  const lang = saved.lang && book.languages.includes(saved.lang) ? saved.lang : firstLanguage();
  const update = (patch: Partial<Saved>) => {
    const next = { ...saved, ...patch };
    setSaved(next);
    save(next);
  };

  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : lang;
    document.title = `${book.guideName[lang]} · ${book.title[lang]}`;
  }, [lang]);

  useEffect(() => {
    if (saved.theme) document.documentElement.dataset.theme = saved.theme;
    else delete document.documentElement.dataset.theme;
  }, [saved.theme]);

  const concept = concepts[route];
  const setProgress = (p: Progress) => update({ progress: { ...saved.progress, [concept.id]: p } });
  const nextLang = book.languages[(book.languages.indexOf(lang) + 1) % book.languages.length];
  const isDark = saved.theme ? saved.theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;

  return (
    <div class="shell">
      <nav class="bar">
        {concept ? (
          <a class="bar-link" href="#/" data-action="contents">
            <span aria-hidden="true">←</span> {t('home', lang)}
          </a>
        ) : (
          <span />
        )}
        <div class="bar-tools">
          <button class="bar-link" data-action="lang" aria-label={t('langToggle', lang)} onClick={() => update({ lang: nextLang })}>
            {book.languages.map((code, i) => (
              <>
                {i > 0 && <span class="bar-sep">/</span>}
                <span class={code === lang ? 'on' : 'off'}>{languageNames[code] ?? code}</span>
              </>
            ))}
          </button>
          <button class="bar-link theme" data-action="theme" aria-label={t('themeToggle', lang)} onClick={() => update({ theme: isDark ? 'light' : 'dark' })}>
            <span class="theme-dot" aria-hidden="true" />
          </button>
        </div>
      </nav>

      {concept ? (
        <Lesson
          book={book}
          concept={concept}
          progress={saved.progress[concept.id] ?? start(concept)}
          lang={lang}
          onProgress={setProgress}
          onHome={() => (location.hash = '#/')}
        />
      ) : (
        <Home book={book} concepts={concepts} progress={saved.progress} lang={lang} onOpen={(id) => (location.hash = `#/${id}`)} />
      )}
    </div>
  );
}
