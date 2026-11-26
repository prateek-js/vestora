/// <reference types="node" />
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Holding } from '../types/wealth';
import type { LiveMarketBenchmarks } from '../utils/smartDiversification';
import type { MutualFundMarketDetail } from '../utils/marketDirectory';
import { annualisedReturnPct, benchmarkIdFor, buildBenchmarkRows } from './benchmarkMap.ts';

const TODAY = '2026-11-24';

function holding(over: Partial<Holding>): Holding {
  return {
    id: over.id ?? over.name ?? 'h',
    name: 'Holding',
    category: 'MUTUAL_FUND',
    institution: 'Test',
    investedAmount: 100,
    currentValue: 121,
    currency: 'INR',
    purchaseDate: '2024-11-24',
    unrealizedGain: 21,
    unrealizedGainPct: 21,
    taxTag: 'LTCG_EQUITY',
    ...over,
  };
}

test('mutual funds map by name to the closest benchmark', () => {
  const id = (name: string) => benchmarkIdFor(holding({ name }));
  assert.equal(id('UTI Nifty 50 Index Fund'), 'NIFTY50');
  assert.equal(id('Parag Parikh Flexi Cap Fund'), 'FLEXI_CAP');
  assert.equal(id('Mirae Asset ELSS Tax Saver Fund'), 'FLEXI_CAP');
  assert.equal(id('HDFC Arbitrage Fund'), 'ARBITRAGE');
  assert.equal(id('SBI Liquid Fund'), 'LIQUID');
  assert.equal(id('SBI Gilt Fund'), 'GILT');
  assert.equal(id('ICICI Corporate Bond Fund'), 'CORP_BOND');
  assert.equal(id('HDFC Gold ETF Fund of Fund'), 'GOLD_FOF');
});

test('other categories map to their benchmark', () => {
  const cat = (category: Holding['category'], extra: Partial<Holding> = {}) =>
    benchmarkIdFor(holding({ category, ...extra }));
  assert.equal(cat('SOVEREIGN_GOLD_BOND'), 'GOLD_FOF');
  assert.equal(cat('CORP_BOND'), 'CORP_BOND');
  assert.equal(cat('GOVT_BOND'), 'GILT');
  assert.equal(cat('FIXED_DEPOSIT'), 'LIQUID');
  assert.equal(cat('RECURRING_DEPOSIT'), 'LIQUID');
  assert.equal(cat('SAVINGS_CASH'), 'LIQUID');
  assert.equal(cat('EQUITY_STOCK'), 'NIFTY50');
});

test('holdings without an honest benchmark map to null', () => {
  const cat = (category: Holding['category'], extra: Partial<Holding> = {}) =>
    benchmarkIdFor(holding({ category, ...extra }));
  assert.equal(cat('EPF'), null);
  assert.equal(cat('PPF'), null);
  assert.equal(cat('NPS'), null);
  assert.equal(cat('EQUITY_STOCK', { listedVenue: 'FOREIGN' }), null);
  assert.equal(cat('EQUITY_STOCK', { listedVenue: 'INDIA' }), 'NIFTY50');
  assert.equal(cat('EQUITY_STOCK'), 'NIFTY50');
});

test('annualised return compounds over the holding period', () => {
  const r = annualisedReturnPct(holding({ investedAmount: 100, currentValue: 121 }), TODAY);
  assert.ok(r !== null && Math.abs(r - 10) < 0.1, `expected about 10, got ${r}`);
});

test('holdings younger than 90 days have no annualised return', () => {
  assert.equal(annualisedReturnPct(holding({ purchaseDate: '2026-10-20' }), TODAY), null);
});

test('a holding under a year old is not annualised into a misleading return', () => {
  // 8% gained in 200 days would compound to an eye-catching ~15% a year. That is not a fair comparison.
  const young = holding({ investedAmount: 100, currentValue: 108, purchaseDate: '2026-05-08' });
  assert.equal(annualisedReturnPct(young, TODAY), null);
  const justOver = holding({ investedAmount: 100, currentValue: 108, purchaseDate: '2025-11-20' });
  assert.ok(annualisedReturnPct(justOver, TODAY) !== null);
});

test('deposits report their own rate directly', () => {
  const fd = holding({ category: 'FIXED_DEPOSIT', interestRatePct: 7.45 });
  assert.equal(annualisedReturnPct(fd, TODAY), 7.45);
});

test('a gold bond reports its price return, not its 2.5% coupon', () => {
  const sgb = holding({ category: 'SOVEREIGN_GOLD_BOND', interestRatePct: 2.5, investedAmount: 100, currentValue: 121 });
  const r = annualisedReturnPct(sgb, TODAY);
  assert.ok(r !== null && Math.abs(r - 10) < 0.1, `expected about 10, got ${r}`);
});

function liveWith(nifty3y: number | null): LiveMarketBenchmarks {
  const detail = (cagr3yPct: number | null) =>
    ({ cagr3yPct, cagr1yPct: null }) as unknown as MutualFundMarketDetail;
  return {
    funds: {
      NIFTY50: nifty3y === null ? null : detail(nifty3y),
      FLEXI_CAP: null,
      ARBITRAGE: null,
      LIQUID: null,
      CORP_BOND: null,
      GILT: null,
      GOLD_FOF: null,
    },
    indiaGsecs: [],
    npsSchemes: [],
    goldInrPer10g: null,
    fetchedAt: TODAY,
    liveFundCount: nifty3y === null ? 0 : 1,
  };
}

function portfolio(): Holding[] {
  // 8 benchmarkable holdings with distinct values, plus EPF and a US-listed basket.
  const funds = [1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
    holding({ id: `mf${n}`, name: `Nifty 50 Index Fund ${n}`, currentValue: n * 1000, investedAmount: n * 800 })
  );
  return [
    ...funds,
    holding({ id: 'epf', name: 'EPF', category: 'EPF', currentValue: 999999 }),
    holding({ id: 'us', name: 'US Equity', category: 'EQUITY_STOCK', currency: 'USD', currentValue: 5000, listedVenue: 'FOREIGN' }),
  ];
}

test('rows are the largest benchmarkable holdings, capped at the limit', () => {
  const { rows, unbenchmarked } = buildBenchmarkRows(portfolio(), null, TODAY);
  assert.equal(rows.length, 6);
  assert.deepEqual(
    rows.map((r) => r.holding.id),
    ['mf8', 'mf7', 'mf6', 'mf5', 'mf4', 'mf3']
  );
  const ids = unbenchmarked.map((h) => h.id);
  assert.ok(ids.includes('epf'));
  assert.ok(ids.includes('us'));
});

test('without live data the benchmark yield is the stored fallback', () => {
  const { rows } = buildBenchmarkRows(portfolio(), null, TODAY);
  assert.equal(rows[0].benchmarkId, 'NIFTY50');
  assert.equal(rows[0].benchmarkPct, 12.8);
  assert.equal(rows[0].benchmarkName, 'UTI Nifty 50 Index Direct');
  assert.ok(Math.abs(rows[0].deltaPct - (rows[0].holdingPct - rows[0].benchmarkPct)) < 1e-9);
});

test('each row names its benchmark by category, so a fund is never shown against itself', () => {
  const { rows } = buildBenchmarkRows(portfolio(), null, TODAY);
  assert.equal(rows[0].benchmarkLabel, 'the Nifty 50 index');
  const label = (name: string, category: Holding['category'] = 'MUTUAL_FUND') =>
    buildBenchmarkRows([holding({ name, category })], null, TODAY).rows[0].benchmarkLabel;
  assert.equal(label('Parag Parikh Flexi Cap Fund'), 'flexi-cap funds');
  assert.equal(label('HDFC Arbitrage Fund'), 'arbitrage funds');
  assert.equal(label('SBI Liquid Fund'), 'liquid funds');
  assert.equal(label('x', 'FIXED_DEPOSIT'), 'liquid funds');
  assert.equal(label('x', 'GOVT_BOND'), 'government bond funds');
  assert.equal(label('x', 'CORP_BOND'), 'corporate bond funds');
  assert.equal(label('x', 'SOVEREIGN_GOLD_BOND'), 'gold funds');
});

test('live 3-year CAGR replaces the fallback when available', () => {
  const { rows } = buildBenchmarkRows(portfolio(), liveWith(15), TODAY);
  assert.equal(rows[0].benchmarkPct, 15);
});

test('a live fund with no CAGR still falls back to the stored yield', () => {
  const { rows } = buildBenchmarkRows(portfolio(), liveWith(null), TODAY);
  assert.equal(rows[0].benchmarkPct, 12.8);
});

test('a benchmarkable holding with no computable return is listed as unbenchmarked', () => {
  const fresh = holding({ id: 'new', name: 'Nifty 50 Index Fund new', purchaseDate: '2026-11-01' });
  const { rows, unbenchmarked } = buildBenchmarkRows([fresh], null, TODAY);
  assert.equal(rows.length, 0);
  assert.deepEqual(unbenchmarked.map((h) => h.id), ['new']);
});
