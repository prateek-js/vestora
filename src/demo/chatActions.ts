import type { Chapter } from './journeyState';

/** The tabs a chat reply can point at inside the demo. */
export type ChatTab = 'overview' | 'rebalance' | 'radar' | 'tax' | 'simulator';

/** Where each tab lands the visitor. Radar and tax have no demo chapter. */
const CHAPTER_FOR_TAB: Record<ChatTab, Chapter | null> = {
  overview: 'mine',
  rebalance: 'play',
  radar: null,
  tax: null,
  simulator: 'see',
};

export function chapterForTab(tab: ChatTab): Chapter | null {
  return CHAPTER_FOR_TAB[tab];
}
