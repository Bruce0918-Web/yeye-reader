# 页页读书 · Yeye Reader

An interactive way into a book: one idea at a time, through branching conversation rather than summary.
First book: *The Courage to Be Disliked* (Ichiro Kishimi and Fumitake Koga). Simplified Chinese, Traditional Chinese, English.

No account, no AI at runtime, progress stays in the reader's browser.
All scenes and wording are our own; nothing is quoted from the book.

## How it is put together

- `content/books/<book>/concepts/*.yaml` — one conversation tree per concept. Every text is stored per language.
- `src/engine/` — walks a tree, keeps progress, checks content rules. Knows nothing about any particular book.
- `src/ui/` — draws it.
- `tools/` — content checks, Traditional Chinese conversion, and a headless-browser walk of every branch.

Adding a book or a concept means adding a content file. The engine and UI stay as they are.

## Commands

| | |
|---|---|
| `npm run dev` | run locally |
| `npm run lint:content` | check every content file against the content rules |
| `npm test` | engine tests, including every complete route through every concept |
| `npm run walk` | click through every option in every language in a headless browser |
| `npm run scan:hant` | list generated Traditional Chinese text worth a human look |
| `npm run build` | build the site into `dist/` |

Pushing to `main` builds and publishes the site.
