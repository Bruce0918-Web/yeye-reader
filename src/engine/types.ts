/**
 * The content model. The engine knows only these shapes; it knows nothing about any particular book.
 * Every piece of reader-facing text is an LText: one string per language code.
 */
export type Lang = string;
export type LText = Record<Lang, string>;

/** Who is speaking: the guide character, the scene narrator, or a cast member id. */
export type Speaker = 'guide' | 'narrator' | string;

export interface Line {
  speaker: Speaker;
  text: LText;
}

/** A short run of lines shown together, then "continue". */
export interface BeatNode {
  type: 'beat';
  lines: Line[];
  next: string;
}

/**
 * book   = the option closest to the book's position; leads one layer deeper.
 * detour = a real, common way of thinking that differs from the book; must have its own branch.
 * open   = no better or worse answer; each still gets its own reply.
 */
export type Stance = 'book' | 'detour' | 'open';

export interface Option {
  id: string;
  text: LText;
  stance: Stance;
  next: string;
}

export interface ChoiceNode {
  type: 'choice';
  prompt: LText;
  options: Option[];
}

/** book = the authors' view. ours = our own example or practice. debate = limits and criticism. */
export type Source = 'book' | 'ours' | 'debate';

export interface RevealNode {
  type: 'reveal';
  source: Source;
  title: LText;
  /** Paragraphs separated by a blank line. "- " starts a list item; "> " marks the one line to remember. */
  body: LText;
  next: string;
}

export interface Checkpoint {
  id: string;
  label: LText;
  /** Shown when the reader leaves this point unticked. */
  hint: LText;
  /** Words that suggest the reader covered this point. Only used to pre-tick; the reader decides. */
  cues: Record<Lang, string[]>;
}

export interface RetellNode {
  type: 'retell';
  prompt: LText;
  checkpoints: Checkpoint[];
  next: string;
}

export interface EndNode {
  type: 'end';
  lines: Line[];
}

export type ContentNode = BeatNode | ChoiceNode | RevealNode | RetellNode | EndNode;

export interface Concept {
  id: string;
  title: LText;
  question: LText;
  /** Core statements, listed separately so they can be checked against the book. */
  core: LText[];
  cast: Record<string, { name: LText }>;
  start: string;
  nodes: Record<string, ContentNode>;
}

export interface Book {
  id: string;
  languages: Lang[];
  title: LText;
  authors: LText;
  intro: LText;
  guideName: LText;
  /** Every concept on the path, in order. Only those with a content file are playable. */
  path: { id: string; title: LText; stage: LText }[];
}

/** One step the reader has reached. The reader's whole position is a list of these. */
export interface Step {
  nodeId: string;
  optionId?: string;
  retell?: { text: string; ticks: string[] };
}

export interface Progress {
  seed: number;
  steps: Step[];
  done: boolean;
}
