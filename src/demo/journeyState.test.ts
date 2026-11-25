import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextChapter, visibleChapters, type Chapter } from './journeyState';

test('without a personal portfolio the journey has four chapters', () => {
  assert.deepEqual(
    visibleChapters(false).map((c) => c.id),
    ['story', 'see', 'play', 'plan'],
  );
});

test('with one, Your numbers sits between the story and See it', () => {
  const chapters = visibleChapters(true);
  assert.deepEqual(
    chapters.map((c) => c.id),
    ['story', 'mine', 'see', 'play', 'plan'],
  );
  assert.equal(chapters[1].label, 'Your numbers');
});

test('nextChapter walks the journey and ends at the plan', () => {
  const expected: [Chapter, Chapter | null][] = [
    ['story', 'see'],
    ['mine', 'see'],
    ['see', 'play'],
    ['play', 'plan'],
    ['plan', null],
  ];
  for (const [from, to] of expected) assert.equal(nextChapter(from), to, from);
});
