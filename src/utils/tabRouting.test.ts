/// <reference types="node" />
import test from 'node:test';
import assert from 'node:assert/strict';
import { planUrlSync, tabFromHash } from './tabRouting.ts';

test('tabFromHash maps known hashes, any case', () => {
  assert.equal(tabFromHash('#radar'), 'radar');
  assert.equal(tabFromHash('#RADAR'), 'radar');
  assert.equal(tabFromHash('#tax'), 'tax');
  assert.equal(tabFromHash('#simulator'), 'simulator');
  assert.equal(tabFromHash('#rebalance'), 'rebalance');
  assert.equal(tabFromHash('#overview'), 'overview');
});

test('tabFromHash sends empty, old and unknown hashes to overview', () => {
  for (const hash of ['', '#story', '#Story', '#street-stage', '#why-vestora', '#nonsense']) {
    assert.equal(tabFromHash(hash), 'overview', hash);
  }
});

test('the landing page keeps its own SEO and URL', () => {
  assert.deepEqual(planUrlSync('overview', ''), { seoView: 'home', nextHash: null });
});

test('an old #story link is rewritten to #overview', () => {
  assert.deepEqual(planUrlSync('overview', '#story'), { seoView: 'overview', nextHash: '#overview' });
});

test('a tab already in the URL needs no rewrite', () => {
  assert.deepEqual(planUrlSync('radar', '#RADAR'), { seoView: 'radar', nextHash: null });
  assert.deepEqual(planUrlSync('overview', '#overview'), { seoView: 'overview', nextHash: null });
});

test('a tab opened from a bare URL gets its hash', () => {
  assert.deepEqual(planUrlSync('radar', ''), { seoView: 'radar', nextHash: '#radar' });
});
