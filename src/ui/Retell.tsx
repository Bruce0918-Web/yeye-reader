import { useState } from 'preact/hooks';
import type { Lang, RetellNode } from '../engine/types';
import { detectCues } from '../engine/runner';
import { t } from './strings';

/**
 * The reader says the idea back in their own words, then checks it against the lesson.
 * The ticks are a keyword guess offered as a starting point. The reader has the final say.
 */
export function Retell(props: { node: RetellNode; lang: Lang; guideName: string; onDone: (text: string, ticks: string[]) => void }) {
  const { node, lang, guideName, onDone } = props;
  const [text, setText] = useState('');
  const [ticks, setTicks] = useState<string[] | null>(null);

  if (ticks === null) {
    const guess = () => node.checkpoints.filter((c) => detectCues(text, c.cues[lang] ?? [])).map((c) => c.id);
    return (
      <div class="retell rise">
        <p class="prompt">{node.prompt[lang]}</p>
        <textarea
          rows={5}
          value={text}
          placeholder={t('retellPlaceholder', lang)}
          onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
        />
        <div class="retell-actions">
          <button class="btn" data-action="retell-submit" disabled={text.trim().length === 0} onClick={() => setTicks(guess())}>
            {t('retellDone', lang)}
          </button>
          <button class="btn-quiet" data-action="retell-skip" onClick={() => onDone('', [])}>
            {t('retellSkip', lang)}
          </button>
        </div>
      </div>
    );
  }

  const toggle = (id: string) => setTicks(ticks.includes(id) ? ticks.filter((x) => x !== id) : [...ticks, id]);
  const missed = node.checkpoints.filter((c) => !ticks.includes(c.id));
  return (
    <div class="retell rise">
      <blockquote class="yours">
        <span class="label">{t('you', lang)}</span>
        <p>{text}</p>
      </blockquote>
      <h3 class="check-title">{t('retellCheckTitle', lang)}</h3>
      <p class="note">{t('retellCheckNote', lang).replace('{guide}', guideName)}</p>
      <ul class="checks">
        {node.checkpoints.map((c) => {
          const on = ticks.includes(c.id);
          return (
            <li>
              <button class="check" role="checkbox" aria-checked={on} data-check={c.id} onClick={() => toggle(c.id)}>
                <span class="box" aria-hidden="true" />
                <span>{c.label[lang]}</span>
              </button>
              {!on && (
                <p class="hint">
                  <span class="label">{t('retellMissed', lang)}</span>
                  {c.hint[lang]}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {missed.length === 0 && <p class="note">{t('retellAllSet', lang)}</p>}
      <div class="retell-actions">
        <button class="btn" data-action="retell-confirm" onClick={() => onDone(text, ticks)}>
          {t('continue', lang)}
        </button>
        <button class="btn-quiet" data-action="retell-edit" onClick={() => setTicks(null)}>
          {t('retellEdit', lang)}
        </button>
      </div>
    </div>
  );
}
