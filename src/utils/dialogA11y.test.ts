/// <reference types="node" />
import test from 'node:test';
import assert from 'node:assert/strict';
import { getFocusable, nextFocusIndex } from './dialogA11y.ts';

test('nextFocusIndex advances normally mid-list', () => {
  assert.equal(nextFocusIndex(0, 4, false), 1);
  assert.equal(nextFocusIndex(2, 4, false), 3);
  assert.equal(nextFocusIndex(3, 4, true), 2);
  assert.equal(nextFocusIndex(1, 4, true), 0);
});

test('nextFocusIndex wraps forward from the last element to the first', () => {
  assert.equal(nextFocusIndex(3, 4, false), 0);
});

test('nextFocusIndex wraps backward from the first element to the last', () => {
  assert.equal(nextFocusIndex(0, 4, true), 3);
});

test('nextFocusIndex holds a single-focusable container in place', () => {
  assert.equal(nextFocusIndex(0, 1, false), 0);
  assert.equal(nextFocusIndex(0, 1, true), 0);
});

interface FakeElementSpec {
  tag: string;
  disabled?: boolean;
  tabindex?: string;
  /** Defaults to true; a hidden element reports a zero layout box. */
  visible?: boolean;
}

/**
 * Minimal honest stand-in for a dialog container: the Node test runner has no
 * DOM, so the fake implements only what getFocusable reads — querySelectorAll
 * (returning candidates in DOM order, leaving all filtering to the helper,
 * exactly like the real API) and the per-element attribute/layout properties
 * the helper inspects (disabled, tabindex, offsetWidth/offsetHeight).
 */
function makeFakeDialog(candidates: FakeElementSpec[]): {
  container: HTMLElement;
  elements: HTMLElement[];
} {
  const elements = candidates.map((spec) => {
    const visible = spec.visible ?? true;
    return {
      tagName: spec.tag.toUpperCase(),
      hasAttribute: (name: string) => name === 'disabled' && Boolean(spec.disabled),
      getAttribute: (name: string) => {
        if (name === 'disabled') return spec.disabled ? '' : null;
        if (name === 'tabindex') return spec.tabindex ?? null;
        return null;
      },
      offsetWidth: visible ? 120 : 0,
      offsetHeight: visible ? 32 : 0,
    };
  });
  const container = {
    querySelectorAll: () => elements,
  } as unknown as HTMLElement;
  return { container, elements: elements as unknown as HTMLElement[] };
}

test('getFocusable skips disabled buttons and tabIndex=-1 nodes, keeping DOM order', () => {
  const { container, elements } = makeFakeDialog([
    { tag: 'button' }, // focusable
    { tag: 'button', disabled: true }, // skipped: disabled
    { tag: 'span', tabindex: '-1' }, // skipped: tabIndex -1
    { tag: 'input' }, // focusable
    { tag: 'select', visible: false }, // skipped: hidden (zero box)
  ]);

  const focusable = getFocusable(container);
  assert.equal(focusable.length, 2);
  assert.equal(focusable[0], elements[0]);
  assert.equal(focusable[1], elements[3]);
});
