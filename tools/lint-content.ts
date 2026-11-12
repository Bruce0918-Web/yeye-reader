import { loadAll } from './content';
import { validateBook, validateConcept, type Issue } from '../src/engine/validate';
import { allRoutes } from '../src/engine/runner';

/** Checks every content file against the content rules. Any error stops the build. */
let errors = 0;
const print = (file: string, issues: Issue[]) => {
  for (const i of issues) {
    if (i.level === 'error') errors++;
    console.log(`${i.level === 'error' ? 'ERROR' : 'warn '}  ${file}  ${i.where}: ${i.message}`);
  }
};

for (const { book, concepts } of loadAll()) {
  print(`${book.id}/book.yaml`, validateBook(book));
  for (const { file, concept } of concepts) {
    const issues = validateConcept(concept, book);
    print(file, issues);
    if (!issues.some((i) => i.level === 'error')) {
      const nodes = Object.values(concept.nodes);
      const options = nodes.flatMap((n) => (n.type === 'choice' ? n.options : []));
      console.log(
        `ok     ${file}  ${nodes.length} nodes, ${options.length} options ` +
          `(${options.filter((o) => o.stance === 'detour').length} detours), ${allRoutes(concept).length} routes`,
      );
    }
  }
}

if (errors > 0) {
  console.log(`\n${errors} error(s). Content is not ready.`);
  process.exit(1);
}
console.log('\nContent passes every rule.');
