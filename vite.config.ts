import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { parse } from 'yaml';

/** Turns each content .yaml file into a plain JS module, so the app never parses YAML at runtime. */
function yamlContent(): Plugin {
  return {
    name: 'yaml-content',
    transform(source, id) {
      if (!id.endsWith('.yaml')) return null;
      return { code: `export default ${JSON.stringify(parse(source))};`, map: null };
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [preact(), yamlContent()],
  test: { include: ['tests/**/*.test.ts'] },
} as never);
