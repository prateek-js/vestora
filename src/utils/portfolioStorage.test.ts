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

test('a saved USD holding loads re-denominated to INR at the pinned 86.50 rate', () => {
  store.clear();
  // A pre-change saved portfolio, written the way a legacy browser left it:
  // raw storage JSON with a 'USD' holding. At rest nothing is typed — the
  // string is the shape loadPersistedPortfolio actually has to defend against.
  store.set(
    'vestora.portfolio.v1',
    JSON.stringify({
      profileId: 'custom',
      baseCurrency: 'USD',
      mode: 'personal',
      holdings: [{
        id: 'h-us', name: 'US basket', category: 'EQUITY_STOCK', institution: 'IB',
        investedAmount: 22000, currentValue: 38500, currency: 'USD',
        purchaseDate: '2022-06-18', unrealizedGain: 16500, unrealizedGainPct: 75,
        taxTag: 'LTCG_EQUITY',
      }],
    })
  );
  const loaded = loadPersistedPortfolio()!;
  const h = loaded.holdings[0];
  assert.equal(h.currency, 'INR');
  assert.equal(h.currentValue, 3330250);
  assert.equal(h.investedAmount, 1903000);
  assert.equal(h.unrealizedGain, 1427250);
  assert.equal(h.listedVenue, 'FOREIGN');
});

test('a legacy prepayment recorded in a foreign display base loads re-denominated to INR', () => {
  store.clear();
  // Pre-change, the prepayment widget recorded amountInBase in the
  // then-active display currency (USD) with currency: 'USD' on the record.
  store.set(
    'vestora.portfolio.v1',
    JSON.stringify({
      profileId: 'custom',
      baseCurrency: 'USD',
      mode: 'personal',
      holdings: [],
      prepayments: [{
        id: 'prepay-1',
        date: '2026-01-10',
        sourceName: 'HDFC Savings Account',
        loanLabel: 'Home-loan prepayment',
        amountInBase: 100000,
        currency: 'USD',
        loanRatePct: 8.55,
        interestSaved: 45000,
        monthsSaved: 7,
      }],
    })
  );
  const loaded = loadPersistedPortfolio()!;
  const p = loaded.prepayments![0];
  assert.equal(p.currency, 'INR');
  assert.equal(p.amountInBase, 8650000, '1,00,000 USD × 86.50');
  assert.equal(p.interestSaved, 3892500, 'interest saved converts with the amount');
  assert.equal(p.monthsSaved, 7, 'month counts are denomination-free');
});

test('a legacy INR prepayment loads through untouched', () => {
  store.clear();
  store.set(
    'vestora.portfolio.v1',
    JSON.stringify({
      profileId: 'custom',
      baseCurrency: 'INR',
      mode: 'personal',
      holdings: [],
      prepayments: [{
        id: 'prepay-inr',
        date: '2026-02-10',
        sourceName: 'Savings',
        loanLabel: 'Home-loan prepayment',
        amountInBase: 200000,
        currency: 'INR',
        loanRatePct: 8.55,
        interestSaved: 90000,
        monthsSaved: 9,
      }],
    })
  );
  const loaded = loadPersistedPortfolio()!;
  const p = loaded.prepayments![0];
  assert.equal(p.amountInBase, 200000);
  assert.equal(p.interestSaved, 90000);
  assert.equal(p.currency, 'INR');
});

test('an already-INR saved holding loads through untouched', () => {
  store.clear();
  savePersistedPortfolio({
    profileId: 'custom', baseCurrency: 'INR', mode: 'personal',
    holdings: [{
      id: 'h-in', name: 'FD', category: 'FIXED_DEPOSIT', institution: 'SBI',
      investedAmount: 100000, currentValue: 107000, currency: 'INR',
      purchaseDate: '2024-01-01', unrealizedGain: 7000, unrealizedGainPct: 7,
      taxTag: 'SLAB_INCOME',
    }],
  });
  const loaded = loadPersistedPortfolio()!;
  assert.equal(loaded.holdings[0].currentValue, 107000);
  assert.equal(loaded.holdings[0].listedVenue, undefined);
});
