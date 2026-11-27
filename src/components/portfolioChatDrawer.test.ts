/// <reference types="node" />
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// The drawer has no DOM harness (Node test runner, repo rule), so the
// Escape-to-close contract is pinned at the wiring level: the a11y hook's
// onEscape must call the drawer's own closeDrawer — a bare `close()` here
// resolves to the DOM global window.close (a silent no-op in a normal tab),
// which is exactly the regression this test exists to catch.

const drawerSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'PortfolioChatDrawer.tsx'),
  'utf-8'
);

test('the drawer wires Escape to closeDrawer, never to the window.close global', () => {
  const onEscapeLine = drawerSource
    .split('\n')
    .find((l) => l.includes('onEscape:'));
  assert.ok(onEscapeLine, 'drawer passes an onEscape handler to useDialogA11y');
  assert.match(onEscapeLine, /onEscape:\s*\(\)\s*=>\s*closeDrawer\(\)/, `Escape must call closeDrawer, got: ${onEscapeLine.trim()}`);
  assert.doesNotMatch(onEscapeLine, /(?<![\w.])close\(\)/, 'a bare close() is the window.close global — a silent no-op');
});
