// Content authoring helper: a plain YAML text containing ": " or " #" must be quoted.
// Usage: node tools/quote-colons.mjs <file.yaml> ...   Wraps such one-line texts in double quotes.
import { readFileSync, writeFileSync } from 'node:fs';

for (const file of process.argv.slice(2)) {
  let fixed = 0;
  const out = readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => {
      const m = line.match(/^(\s*(?:- )?[\w-]+: )([^"'|>\[{].*)$/);
      if (!m || !/: | #|:$/.test(m[2])) return line;
      fixed++;
      return `${m[1]}"${m[2].replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    })
    .join('\n');
  writeFileSync(file, out);
  console.log(`${file}: quoted ${fixed} line(s)`);
}
