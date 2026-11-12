import { useEffect, useRef } from 'preact/hooks';
import type { Book, Concept, ContentNode, Lang, Progress, Step } from '../engine/types';
import { advance, back, choose, currentStep, fraction, nodeOf, shuffledOptions, start, submitRetell } from '../engine/runner';
import { Lines, SourceCard } from './parts';
import { Retell } from './Retell';
import { t } from './strings';

interface Props {
  book: Book;
  concept: Concept;
  progress: Progress;
  lang: Lang;
  onProgress: (p: Progress) => void;
  onHome: () => void;
  /** Opens the lesson that follows this one, when there is one ready. */
  onNext?: () => void;
}

/**
 * One lesson, drawn as a stream: everything already passed stays above, dimmed,
 * and the step the reader is on sits at the top of the screen.
 */
export function Lesson({ book, concept, progress, lang, onProgress, onHome, onNext }: Props) {
  const active = currentStep(progress);
  const activeNode = nodeOf(concept, active);
  const activeRef = useRef<HTMLDivElement>(null);

  // Bring the current step to the top whenever the reader moves or switches language.
  useEffect(() => {
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    activeRef.current?.scrollIntoView({ block: 'start', behavior: calm ? 'auto' : 'smooth' });
  }, [progress.steps.length, lang]);

  const canContinue = activeNode.type === 'beat' || activeNode.type === 'reveal';
  const goOn = () => onProgress(advance(concept, progress));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === 'Enter' && canContinue && tag !== 'TEXTAREA' && tag !== 'BUTTON') goOn();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div class="lesson">
      <div class="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction(concept, progress) * 100)}>
        <div class="progress-fill" style={{ transform: `scaleX(${fraction(concept, progress)})` }} />
      </div>

      <header class="lesson-head">
        <div class="label">{book.title[lang]}</div>
        <h1>{concept.title[lang]}</h1>
      </header>

      <div class="stream">
        {progress.steps.slice(0, -1).map((step) => (
          <div class="step past" data-node-id={step.nodeId}>
            <PastStep step={step} node={nodeOf(concept, step)} concept={concept} lang={lang} />
          </div>
        ))}

        <div class="step active" ref={activeRef} key={`${active.nodeId}:${progress.steps.length}`} data-active data-node-id={active.nodeId} data-node-type={activeNode.type}>
          {activeNode.type === 'beat' && <Lines lines={activeNode.lines} concept={concept} lang={lang} />}

          {activeNode.type === 'reveal' && (
            <SourceCard source={activeNode.source} title={activeNode.title[lang]} body={activeNode.body[lang]} lang={lang} />
          )}

          {activeNode.type === 'choice' && (
            <div class="choice rise">
              <p class="prompt">{activeNode.prompt[lang]}</p>
              <ol class="options">
                {shuffledOptions(activeNode.options, progress.seed, active.nodeId).map((o, i) => (
                  <li>
                    <button class="option" data-option-id={o.id} onClick={() => onProgress(choose(concept, progress, o.id))}>
                      <span class="option-n" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                      <span>{o.text[lang]}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {activeNode.type === 'retell' && (
            <Retell
              node={activeNode}
              lang={lang}
              guideName={book.guideName[lang]}
              onDone={(text, ticks) => onProgress(submitRetell(concept, progress, text, ticks))}
            />
          )}

          {activeNode.type === 'end' && (
            <div data-screen="end">
              <Lines lines={activeNode.lines} concept={concept} lang={lang} />
              <section class="card card-book rise" data-source="book">
                <header class="card-head">
                  <span class="seal" aria-hidden="true" />
                  <span class="label">{t('coreTitle', lang)}</span>
                </header>
                <ol class="core">
                  {concept.core.map((c) => (
                    <li>{c[lang]}</li>
                  ))}
                </ol>
                <p class="note">{t('coreNote', lang)}</p>
              </section>
              <div class="end-actions rise">
                {onNext && (
                  <button class="btn" data-action="next-lesson" onClick={onNext}>
                    {t('nextLesson', lang)}
                  </button>
                )}
                <button class={onNext ? 'btn-quiet' : 'btn'} data-action="home" onClick={onHome}>
                  {t('toContents', lang)}
                </button>
                <button class="btn-quiet" data-action="restart" onClick={() => onProgress(start(concept))}>
                  {t('restart', lang)}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div class="dock">
        <div class="dock-inner">
          <button class="btn-quiet" data-action="back" disabled={progress.steps.length <= 1} onClick={() => onProgress(back(progress))}>
            {t('back', lang)}
          </button>
          {canContinue && (
            <button class="btn btn-wide" data-action="continue" onClick={goOn}>
              {t('continue', lang)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** A step the reader has already passed, shown as a record of what was said and what they chose. */
function PastStep({ step, node, concept, lang }: { step: Step; node: ContentNode; concept: Concept; lang: Lang }) {
  switch (node.type) {
    case 'beat':
      return <Lines lines={node.lines} concept={concept} lang={lang} />;
    case 'reveal':
      return <SourceCard source={node.source} title={node.title[lang]} body={node.body[lang]} lang={lang} />;
    case 'choice': {
      const chosen = node.options.find((o) => o.id === step.optionId);
      return (
        <div class="choice">
          <p class="prompt">{node.prompt[lang]}</p>
          <blockquote class="yours">
            <span class="label">{t('you', lang)}</span>
            <p>{chosen?.text[lang]}</p>
          </blockquote>
        </div>
      );
    }
    case 'retell':
      return (
        <div class="retell">
          <p class="prompt">{node.prompt[lang]}</p>
          <blockquote class="yours">
            <span class="label">{t('you', lang)}</span>
            <p>{step.retell?.text || t('retellEmpty', lang)}</p>
          </blockquote>
        </div>
      );
    default:
      return null;
  }
}
