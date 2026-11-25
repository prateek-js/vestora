import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chapterForTab, type ChatTab } from './chatActions';
import type { Chapter } from './journeyState';

test('each chat tab maps to its demo chapter', () => {
  const expected: [ChatTab, Chapter | null][] = [
    ['overview', 'mine'],
    ['rebalance', 'play'],
    ['simulator', 'see'],
    ['radar', null],
    ['tax', null],
  ];
  for (const [tab, chapter] of expected) assert.equal(chapterForTab(tab), chapter, tab);
});
