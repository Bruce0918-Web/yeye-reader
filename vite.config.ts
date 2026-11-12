import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { parse } from 'yaml';
import { deriveLanguages } from './tools/derive';

/** Turns each content .yaml file into a plain JS module, so the app never parses YAML at runtime.
 * Traditional Chinese text is added here too (see tools/derive.ts). */
function yamlContent(): Plugin {
  return {
    name: 'yaml-content',
    transform(source, id) {
      if (!id.endsWith('.yaml')) return null;
      return { code: `export default ${JSON.stringify(deriveLanguages(parse(source)))};`, map: null };
    },
  };
}

/**
 * `npm run build` makes the normal site in dist/.
 * `npm run build:single` packs everything into one HTML file in dist-single/,
 * which is the form the current host (Floot) serves.
 */
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: './',
    plugins: [preact(), yamlContent(), ...(single ? [viteSingleFile()] : [])],
    build: { outDir: single ? 'dist-single' : 'dist' },
    test: { include: ['tests/**/*.test.ts'] },
  } as never;
});
