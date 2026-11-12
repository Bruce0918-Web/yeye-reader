import { loadAll } from './content';

/**
 * Lists generated Traditional Chinese text that contains characters the automatic conversion
 * is known to get wrong sometimes (one Simplified character with several Traditional forms).
 * It cannot tell right from wrong; it only shortens what a person has to read.
 * A wrong one is fixed by adding an entry to content/terms.zh-Hant.yaml.
 */
const risky = /幹|麵|髮|瞭|鬥|隻|闆|薑|捲|穀|鬱|颳|籤|噁|齣|鹹|佈|檯|纔|併|餘|遊|癒|嚮|鬍|鬚|儘|甦|註|弔|傢|夥|颱|衝|製|係/g;
// Combinations already read and known to be right, so they are not listed again.
const fine = /關係|衝動|衝突|合併|沒關係/g;

const seen = new Set<string>();
const collect = (value: unknown) => {
  if (Array.isArray(value)) return value.forEach(collect);
  if (value && typeof value === 'object') {
    const text = (value as Record<string, unknown>)['zh-Hant'];
    if (typeof text === 'string') seen.add(text);
    Object.values(value).forEach(collect);
  }
};
collect(loadAll());

let listed = 0;
for (const text of seen) {
  const hits = text.replace(fine, '').match(risky);
  if (!hits) continue;
  listed++;
  for (const line of text.split('\n')) {
    if (line.replace(fine, '').match(risky)) console.log(`${[...new Set(hits)].join('')}  ${line.trim()}`);
  }
}
console.log(`\n${seen.size} Traditional texts, ${listed} worth a look.`);
