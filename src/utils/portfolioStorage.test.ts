/// <reference types="node" />
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_PROFILES } from '../data/mockData.ts';
import {
  loadPersistedPortfolio,
  savePersistedPortfolio,
  sampleHoldingsFor,
} from './portfolioStorage.ts';

// portfolioStorage reads window.localStorage at call time — stub it in memory.
const store = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  },
};

test('exactly one sample persona survives, byte-identical to the demo journey', () => {
  assert.equal(DEMO_PROFILES.length, 1);
  assert.equal(DEMO_PROFILES[0].id, 'profile-nri-tech');
  assert.equal(DEMO_PROFILES[0].name, 'Vikram Malhotra');
  assert.equal(DEMO_PROFILES[0].baseCurrency, 'INR');
  const sample = sampleHoldingsFor(DEMO_PROFILES[0]);
  assert.deepEqual(sample.map((h) => h.id), [
    'h-101', 'h-102', 'h-103', 'h-104', 'h-105',
    'h-106', 'h-107', 'h-108', 'h-109',
  ]);
  assert.equal(sample[0].isMatured, true); // h-101 rebased 15 days past maturity
});

test('a portfolio saved under a removed persona id still loads (no data loss on upgrade)', () => {
  store.clear();
  savePersistedPortfolio({
    profileId: 'profile-growth-builder',
    baseCurrency: 'INR',
    holdings: [],
    mode: 'personal',
  });
  const loaded = loadPersistedPortfolio();
  assert.ok(loaded);
  assert.equal(loaded.profileId, 'profile-growth-builder');
});

test('an unknown profile id is still rejected', () => {
  store.clear();
  savePersistedPortfolio({
    profileId: 'profile-zzz',
    baseCurrency: 'INR',
    holdings: [],
    mode: 'personal',
  });
  assert.equal(loadPersistedPortfolio(), null);
});

test('corrupt JSON in storage returns null instead of throwing', () => {
  store.clear();
  store.set('vestora.portfolio.v1', '{not json');
  assert.equal(loadPersistedPortfolio(), null);
});
