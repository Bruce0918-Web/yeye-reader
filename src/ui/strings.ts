import type { Lang, LText } from '../engine/types';

/** Interface wording (buttons, labels). Lesson content lives in the content files, not here. */
const strings = {
  continue: { zh: '继续', 'zh-Hant': '繼續', en: 'Continue' },
  back: { zh: '上一步', 'zh-Hant': '上一步', en: 'Back' },
  home: { zh: '目录', 'zh-Hant': '目錄', en: 'Contents' },
  you: { zh: '你', 'zh-Hant': '你', en: 'You' },
  scene: { zh: '情境 · 我们编的', 'zh-Hant': '情境 · 我們編的', en: 'A scene · made up by us' },
  sourceBook: { zh: '书的观点', 'zh-Hant': '書的觀點', en: 'The book’s view' },
  sourceBookNote: { zh: '阿德勒心理学，经由本书', 'zh-Hant': '阿德勒心理學，經由本書', en: 'Adlerian psychology, as told in this book' },
  sourceOurs: { zh: '我们的补充', 'zh-Hant': '我們的補充', en: 'Our addition' },
  sourceOursNote: { zh: '不是书里的内容', 'zh-Hant': '不是書裡的內容', en: 'Not from the book' },
  sourceDebate: { zh: '边界与争议', 'zh-Hant': '邊界與爭議', en: 'Limits and debate' },
  sourceDebateNote: { zh: '我们整理的', 'zh-Hant': '我們整理的', en: 'Gathered by us' },
  retellPlaceholder: { zh: '用你自己的话写在这里……', 'zh-Hant': '用你自己的話寫在這裡……', en: 'In your own words…' },
  retellDone: { zh: '我讲完了', 'zh-Hant': '我講完了', en: 'That’s my version' },
  retellEdit: { zh: '改一改', 'zh-Hant': '改一改', en: 'Edit my answer' },
  retellSkip: { zh: '先跳过', 'zh-Hant': '先跳過', en: 'Skip for now' },
  retellCheckTitle: { zh: '对照一下', 'zh-Hant': '對照一下', en: 'Check it against the lesson' },
  retellCheckNote: {
    zh: '打勾是{guide}按关键词猜的，很可能猜错。以你自己的判断为准，点一下就能改。', 'zh-Hant': '打勾是{guide}按關鍵字猜的，很可能猜錯。以你自己的判斷為準，點一下就能改。',
    en: '{guide} ticked these by spotting keywords, and may well be wrong. You’re the judge. Tap to change any of them.',
  },
  retellMissed: { zh: '这一点可以再想想', 'zh-Hant': '這一點可以再想想', en: 'Worth another thought' },
  retellAllSet: { zh: '都讲到了。这已经是你自己的话了。', 'zh-Hant': '都講到了。這已經是你自己的話了。', en: 'It’s all there. It’s yours now.' },
  retellEmpty: { zh: '（跳过了）', 'zh-Hant': '（跳過了）', en: '(skipped)' },
  coreTitle: { zh: '这一课的核心', 'zh-Hant': '這一課的核心', en: 'The core of this lesson' },
  coreNote: { zh: '书的观点，用我们的话转述。欢迎对照原书。', 'zh-Hant': '書的觀點，用我們的話轉述。歡迎對照原書。', en: 'The book’s view, in our words. Check it against the book.' },
  nextLesson: { zh: '下一课', 'zh-Hant': '下一課', en: 'Next lesson' },
  restart: { zh: '重走一遍', 'zh-Hant': '重走一遍', en: 'Walk it again' },
  toContents: { zh: '回到目录', 'zh-Hant': '回到目錄', en: 'Back to contents' },
  start: { zh: '开始', 'zh-Hant': '開始', en: 'Begin' },
  resume: { zh: '继续', 'zh-Hant': '繼續', en: 'Resume' },
  done: { zh: '已读完', 'zh-Hant': '已讀完', en: 'Finished' },
  soon: { zh: '即将推出', 'zh-Hant': '即將推出', en: 'Coming soon' },
  disclaimer: {
    zh: '这里的情境和人物都是我们自己编的，不含原书文字。书的观点会单独标出。', 'zh-Hant': '這裡的情境和人物都是我們自己編的，不含原書文字。書的觀點會單獨標出。',
    en: 'Every scene and person here is our own invention, with no text from the book. The book’s views are marked as such.',
  },
  themeToggle: { zh: '切换深浅色', 'zh-Hant': '切換深淺色', en: 'Switch light or dark' },
  langToggle: { zh: '切换语言', 'zh-Hant': '切換語言', en: 'Switch language' },
} satisfies Record<string, LText>;

export type StringKey = keyof typeof strings;

export function t(key: StringKey, lang: Lang): string {
  const entry: LText = strings[key];
  return entry[lang] ?? entry.en;
}

/** Short names shown on the language switch. */
export const languageNames: Record<Lang, string> = { zh: '简', 'zh-Hant': '繁', en: 'EN' };
