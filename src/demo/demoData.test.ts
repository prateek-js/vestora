/// <reference types="node" />
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Holding } from '../types/wealth';
import type { PersistedPortfolio } from '../utils/portfolioStorage';
import type { LiveMarketBenchmarks } from '../utils/smartDiversification';
import {
  DEFAULT_LOAN,
  loadBenchmarks,
  personalPortfolio,
  pickPortfolio,
  portfolioTotal,
  withTimeout,
} from './demoData.ts';

function holding(over: Partial<Holding> = {}): Holding {
  return {
    id: 'h1',
    name: 'My fund',
    category: 'MUTUAL_FUND',
    institution: 'Test',
    investedAmount: 80000,
    currentValue: 100000,
    currency: 'INR',
    purchaseDate: '2024-01-01',
    unrealizedGain: 20000,
    unrealizedGainPct: 25,
    taxTag: 'LTCG_EQUITY',
    ...over,
  };
}

function saved(over: Partial<PersistedPortfolio> = {}): PersistedPortfolio {
  return { profileId: 'custom', baseCurrency: 'INR', holdings: [holding()], mode: 'personal', ...over };
}

test('with nothing saved the sample portfolio and its default loan are used', () => {
  const p = pickPortfolio(null);
  assert.equal(p.source, 'sample');
  assert.equal(p.holdings.length, 9);
  assert.equal(p.baseCurrency, 'INR');
  assert.deepEqual(p.loan, DEFAULT_LOAN);
});

test('the default loan matches the full app defaults', () => {
  assert.deepEqual(DEFAULT_LOAN, { principal: 4500000, ratePct: 8.55, yearsLeft: 15 });
});

test('a saved personal portfolio is used and carries no invented loan', () => {
  const p = pickPortfolio(saved());
  assert.equal(p.source, 'saved');
  assert.equal(p.holdings.length, 1);
  assert.equal(p.loan, null);
});

test('a saved foreign portfolio is treated as INR', () => {
  // A foreign-currency saved portfolio re-denominates on load; pickPortfolio is always INR.
  const p = pickPortfolio(saved({ baseCurrency: 'USD', holdings: [holding({ currency: 'USD' })] }));
  assert.equal(p.baseCurrency, 'INR');
});

test('an empty saved portfolio falls back to the sample', () => {
  assert.equal(pickPortfolio(saved({ holdings: [] })).source, 'sample');
});

test('a saved portfolio worth nothing falls back to the sample', () => {
  const zero = holding({ currentValue: 0, investedAmount: 0 });
  assert.equal(pickPortfolio(saved({ holdings: [zero] })).source, 'sample');
});

test('saved sample-mode data counts as the sample, not as the visitor’s own', () => {
  assert.equal(pickPortfolio(saved({ mode: 'demo' })).source, 'sample');
});

test('a personal portfolio has no loan and its own source', () => {
  const p = personalPortfolio([holding()]);
  assert.equal(p.source, 'personal');
  assert.equal(p.loan, null);
  assert.equal(p.baseCurrency, 'INR');
  assert.equal(p.holdings.length, 1);
});

test('portfolioTotal sums holdings as stored', () => {
  const inr = holding({ id: 'a', currency: 'INR', currentValue: 100000 });
  const usd = holding({ id: 'b', currency: 'USD', currentValue: 1000 });
  assert.equal(
    portfolioTotal({ holdings: [inr, usd] }),
    100000 + 1000 // the USD fixture is a raw number; no conversion exists anymore
  );
});

test('portfolioTotal of nothing is 0', () => {
  assert.equal(portfolioTotal({ holdings: [] }), 0);
});

test('withTimeout gives the fallback when the promise never settles', async () => {
  assert.equal(await withTimeout(new Promise<string>(() => {}), 20, 'fallback'), 'fallback');
});

test('withTimeout gives the real value when it arrives in time', async () => {
  const quick = new Promise<string>((resolve) => setTimeout(() => resolve('real'), 5));
  assert.equal(await withTimeout(quick, 200, 'fallback'), 'real');
});

test('loadBenchmarks resolves null when the fetch rejects', async () => {
  assert.equal(await loadBenchmarks(200, () => Promise.reject(new Error('CORS'))), null);
});

test('loadBenchmarks resolves null when the fetch hangs past the timeout', async () => {
  const started = Date.now();
  const result = await loadBenchmarks(30, () => new Promise<LiveMarketBenchmarks>(() => {}));
  assert.equal(result, null);
  assert.ok(Date.now() - started < 500, 'returned promptly after the timeout');
});

test('loadBenchmarks passes the live snapshot through', async () => {
  const snap = { liveFundCount: 3 } as unknown as LiveMarketBenchmarks;
  assert.equal(await loadBenchmarks(200, () => Promise.resolve(snap)), snap);
});
