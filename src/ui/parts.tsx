import type { Concept, Lang, Line, RevealNode } from '../engine/types';
import { Guide } from './Guide';
import { t } from './strings';

/** Lines of a beat, grouped so the guide's avatar and the scene label each appear once per run. */
export function Lines({ lines, concept, lang }: { lines: Line[]; concept: Concept; lang: Lang }) {
  const groups: { speaker: string; lines: Line[] }[] = [];
  for (const line of lines) {
    const last = groups[groups.length - 1];
    if (last && last.speaker === line.speaker) last.lines.push(line);
    else groups.push({ speaker: line.speaker, lines: [line] });
  }
  return (
    <>
      {groups.map((group) => {
        if (group.speaker === 'narrator') {
          return (
            <div class="scene rise">
              <div class="label">{t('scene', lang)}</div>
              {group.lines.map((line) => (
                <p>{line.text[lang]}</p>
              ))}
            </div>
          );
        }
        const name = group.speaker === 'guide' ? null : concept.cast[group.speaker]?.name[lang];
        return (
          <div class={name ? 'said said-named rise' : 'said rise'}>
            <div class="said-mark">{name ? <span class="label">{name}</span> : <Guide />}</div>
            <div class="said-lines">
              {group.lines.map((line) => (
                <p>{line.text[lang]}</p>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

/** Body text with three block kinds: paragraph, "- " list, and "> " the one line to remember. */
export function Body({ text }: { text: string }) {
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return (
    <>
      {blocks.map((block) => {
        const rows = block.split('\n').map((r) => r.trim());
        if (rows.every((r) => r.startsWith('- '))) {
          return (
            <ul>
              {rows.map((r) => (
                <li>{r.slice(2)}</li>
              ))}
            </ul>
          );
        }
        if (block.startsWith('> ')) return <p class="keyline">{block.slice(2)}</p>;
        return <p>{rows.join(' ')}</p>;
      })}
    </>
  );
}

const sourceLabels = {
  book: ['sourceBook', 'sourceBookNote'],
  ours: ['sourceOurs', 'sourceOursNote'],
  debate: ['sourceDebate', 'sourceDebateNote'],
} as const;

/** A card that always says where its content comes from: the book, us, or the debate around it. */
export function SourceCard({ source, title, body, lang }: { source: RevealNode['source']; title: string; body: string; lang: Lang }) {
  const [label, note] = sourceLabels[source];
  return (
    <section class={`card card-${source} rise`} data-source={source}>
      <header class="card-head">
        <span class="seal" aria-hidden="true" />
        <span class="label">{t(label, lang)}</span>
        <span class="label label-quiet">{t(note, lang)}</span>
      </header>
      <h2 class="card-title">{title}</h2>
      <div class="card-body">
        <Body text={body} />
      </div>
    </section>
  );
}
