/// <reference types="node" />
import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import type { Holding } from '../types/wealth';
import { DEMO_PROFILES } from '../data/mockData.ts';
import { sampleHoldingsFor } from '../utils/portfolioStorage.ts';
import { buildExport, parsePortfolioExport } from '../utils/backupRestore.ts';
import {
  buildHoldingsCsv,
  buildHoldingsWorkbook,
  importExcelBuffer,
  importStatement,
} from '../utils/statementImport.ts';

const AWKWARD_NAME = 'Axis "Bluechip", Direct – Growth';
const AWKWARD_NOTES = 'line one\nline two, with comma';

function extraHolding(): Holding {
  return {
    id: 'extra-1',
    name: AWKWARD_NAME,
    category: 'MUTUAL_FUND',
    institution: 'Axis AMC',
    investedAmount: 1234.56,
    currentValue: 1500.25,
    currency: 'USD',
    purchaseDate: '2023-06-15',
    maturityDate: '2031-03-31',
    units: 42.5,
    navOrPrice: 35.3,
    schemeCode: 120503,
    unrealizedGain: 265.69,
    unrealizedGainPct: 21.52,
    taxTag: 'LTCG_EQUITY',
    notes: AWKWARD_NOTES,
  };
}

function fixture(): Holding[] {
  return [...sampleHoldingsFor(DEMO_PROFILES[0]), extraHolding()];
}

function core(h: Holding) {
  return {
    name: h.name,
    category: h.category,
    institution: h.institution,
    investedAmount: h.investedAmount,
    currentValue: h.currentValue,
    currency: h.currency,
    interestRatePct: h.interestRatePct,
    purchaseDate: h.purchaseDate,
    maturityDate: h.maturityDate,
  };
}

function viaExcel(holdings: Holding[]): Holding[] {
  const buf = XLSX.write(buildHoldingsWorkbook(holdings, 'INR'), { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return importExcelBuffer(buf, 'Portfolio', 'INR').parsed.holdings;
}

function viaCsv(holdings: Holding[]): Holding[] {
  return importStatement(buildHoldingsCsv(holdings), 'INR').holdings;
}

test('excel export re-imports with the same holdings', () => {
  const f = fixture();
  assert.deepEqual(viaExcel(f).map(core), f.map(core));
});

test('csv export re-imports with the same holdings', () => {
  const f = fixture();
  assert.deepEqual(viaCsv(f).map(core), f.map(core));
});

test('json backup re-imports exactly', () => {
  const f = fixture();
  const restored = parsePortfolioExport(JSON.stringify(buildExport('p', 'INR', f))).holdings;
  assert.deepEqual(restored.map((h) => h.id), f.map((h) => h.id));
  assert.deepEqual(restored.map(core), f.map(core));
});

test('awkward text survives', () => {
  const f = fixture();
  for (const imported of [viaExcel(f), viaCsv(f)]) {
    const h = imported.find((x) => x.name === AWKWARD_NAME);
    assert.ok(h, 'awkward holding found by name');
    assert.equal(h.name, AWKWARD_NAME);
    assert.equal(h.notes, AWKWARD_NOTES);
  }
});

test('a header-only export imports as nothing', () => {
  let holdings: Holding[] = [];
  assert.doesNotThrow(() => {
    holdings = importStatement(buildHoldingsCsv([]), 'INR').holdings;
  });
  assert.equal(holdings.length, 0);
});
