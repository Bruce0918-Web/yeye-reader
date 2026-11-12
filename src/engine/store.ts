import type { Lang, Progress } from './types';

/** Everything the app remembers, kept in the browser. No account, nothing leaves the device. */
export interface Saved {
  lang?: Lang;
  theme?: 'light' | 'dark';
  progress: Record<string, Progress>;
}

const KEY = 'yeye-reader:v1';

export function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    const data = raw ? (JSON.parse(raw) as Saved) : null;
    if (data && typeof data === 'object' && data.progress) return data;
  } catch {
    // Private windows and blocked storage land here; the app simply starts fresh.
  }
  return { progress: {} };
}

export function save(data: Saved): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Nothing to do: the app keeps working for this visit.
  }
}
