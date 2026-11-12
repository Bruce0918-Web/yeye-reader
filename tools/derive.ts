import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import * as OpenCC from 'opencc-js';

/**
 * Traditional Chinese is not written by hand. Wherever a text has a `zh` version and no
 * `zh-Hant` version, one is made from the Simplified text at build time: characters and
 * common Taiwan wording by OpenCC, then our own word list in content/terms.zh-Hant.yaml.
 * To word one line differently for Traditional readers, give that text its own `zh-Hant:`.
 */
const FROM = 'zh';
const TO = 'zh-Hant';

const convert = OpenCC.Converter({ from: 'cn', to: 'twp' });

let terms: [string, string][] | undefined;
function loadTerms(): [string, string][] {
  terms ??= parse(readFileSync(join(process.cwd(), 'content', 'terms.zh-Hant.yaml'), 'utf8')) as [string, string][];
  return terms;
}

export function toTraditional(text: string): string {
  let out = convert(text);
  for (const [from, to] of loadTerms()) out = out.split(from).join(to);
  // Taiwan typesetting uses corner brackets for quotation.
  return out.replace(/\u201c/g, '\u300c').replace(/\u201d/g, '\u300d').replace(/\u2018/g, '\u300e').replace(/\u2019/g, '\u300f');
}

/** Returns the same data with a Traditional version added beside every Simplified one. */
export function deriveLanguages<T>(data: T): T {
  if (Array.isArray(data)) return data.map(deriveLanguages) as T;
  if (data === null || typeof data !== 'object') return data;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) out[key] = deriveLanguages(value);
  const source = out[FROM];
  if (source !== undefined && out[TO] === undefined) {
    if (typeof source === 'string') out[TO] = toTraditional(source);
    else if (Array.isArray(source) && source.every((s) => typeof s === 'string')) out[TO] = source.map(toTraditional);
  }
  return out as T;
}
