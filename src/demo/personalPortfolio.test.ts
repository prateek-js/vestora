/// <reference types="node" />
import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import type { CurrencyCode, Holding } from '../types/wealth';
import { DEMO_PROFILES } from '../data/mockData.ts';
import { sampleHoldingsFor } from '../utils/portfolioStorage.ts';
import { buildExport } from '../utils/backupRestore.ts';
import { buildHoldingsCsv, buildHoldingsWorkbook } from '../utils/statementImport.ts';
import { parseImportedFile } from './personalPortfolio.ts';

function fixture(): Holding[] {
  return sampleHoldingsFor(DEMO_PROFILES[0]);
}

function withCurrency(currency: Holding['currency'], ...indexes: number[]): Holding[] {
  const all = fixture().slice(0, 3);
  return all.map((h, i) => (indexes.includes(i) ? { ...h, currency } : h));
}

test('reads an Excel export', () => {
  const f = fixture();
  const buf = XLSX.write(buildHoldingsWorkbook(f), { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const result = parseImportedFile('mine.xlsx', buf);
  assert.equal(result.holdings.length, f.length);
  assert.equal(result.skippedRows, 0);
});

test('reads a CSV export', () => {
  const f = fixture();
  const result = parseImportedFile('mine.csv', buildHoldingsCsv(f));
  assert.equal(result.holdings.length, f.length);
  assert.equal(result.skippedRows, 0);
});

test('reads a JSON backup', () => {
  const f = fixture();
  const text = JSON.stringify(buildExport('p', f));
  const result = parseImportedFile('backup.json', text);
  assert.equal(result.holdings.length, f.length);
  assert.equal(result.skippedRows, 0);
});

test('a pre-change backup with a USD base and USD holdings restores re-denominated to INR', () => {
  // A pre-change export, hand-written the way the old build produced it: a
  // JSON backup string whose holding is denominated in USD.
  const text = JSON.stringify({
    app: 'vestora',
    version: 1,
    exportedAt: '2026-01-15T10:00:00.000Z',
    profileId: 'p',
    baseCurrency: 'USD',
    holdings: [{
      id: 'h-106-old',
      name: 'US Equity Portfolio (Alphabet, Nvidia, Microsoft)',
      category: 'EQUITY_STOCK',
      institution: 'Interactive Brokers US',
      investedAmount: 22000,
      currentValue: 38500,
      currency: 'USD',
      purchaseDate: '2022-06-18',
      unrealizedGain: 16500,
      unrealizedGainPct: 75,
      taxTag: 'LTCG_EQUITY',
    }],
  });
  const result = parseImportedFile('backup.json', text);
  const h = result.holdings[0];
  assert.equal(h.currency, 'INR');
  assert.equal(h.investedAmount, 1903000);
  assert.equal(h.currentValue, 3330250);
  assert.equal(h.unrealizedGain, 1427250);
  assert.equal(h.listedVenue, 'FOREIGN');
});

test('a statement whose figures are all USD re-denominates at the pinned 86.50', () => {
  // Hand-built external statement: a US broker's export, stated in USD.
  const csv = [
    'Instrument Name,Category,Institution,Invested Amount,Current Value,Currency,Purchase Date',
    '"US Equity Portfolio (Alphabet, Nvidia, Microsoft)",Stock,Interactive Brokers US,22000,38500,USD,2022-06-18',
    'S&P 500 ETF,Stock,Interactive Brokers US,5000,6000,USD,2023-01-10',
  ].join('\r\n');
  const result = parseImportedFile('usd.csv', csv);
  assert.ok(result.holdings.every((h) => h.currency === 'INR'));
  const basket = result.holdings.find((h) => h.name.startsWith('US Equity Portfolio'))!;
  // 38,500 USD × 86.50 = the ₹33,30,250 the app displayed for this basket pre-change.
  assert.equal(basket.currentValue, 3330250);
  assert.equal(basket.investedAmount, 1903000);
  assert.equal(basket.unrealizedGain, 1427250);
  assert.equal(basket.listedVenue, 'FOREIGN');
});

test('a statement mixing INR and USD rows converts only the foreign rows', () => {
  const csv = [
    'Instrument Name,Category,Institution,Invested Amount,Current Value,Currency,Purchase Date',
    'Nifty 50 Index Fund,Mutual Fund,PPFAS AMC,450000,612000,INR,2022-04-12',
    'S&P 500 ETF,Stock,Interactive Brokers US,5000,6000,USD,2023-01-10',
  ].join('\r\n');
  const result = parseImportedFile('mixed.csv', csv);
  const nifty = result.holdings.find((h) => h.name === 'Nifty 50 Index Fund')!;
  const spx = result.holdings.find((h) => h.name === 'S&P 500 ETF')!;
  assert.equal(nifty.currentValue, 612000, 'INR rows pass through at face value');
  assert.equal(spx.currentValue, 519000, '6,000 USD × 86.50');
  assert.equal(spx.listedVenue, 'FOREIGN');
  assert.equal(nifty.listedVenue, undefined, 'INR rows get no invented venue');
});

test('rejects an unsupported file', () => {
  assert.throws(() => parseImportedFile('statement.pdf', ''), /Excel, CSV or Vestora JSON/);
});

test('rejects a file with no investments', () => {
  assert.throws(() => parseImportedFile('empty.csv', buildHoldingsCsv([])), /No investments found/);
});

test('rejects broken JSON', () => {
  assert.throws(() => parseImportedFile('x.json', '{oops'), /not a valid JSON/i);
});

test('reads an ODS export', () => {
  const f = fixture();
  const buf = XLSX.write(buildHoldingsWorkbook(f), { type: 'array', bookType: 'ods' }) as ArrayBuffer;
  const result = parseImportedFile('mine.ods', buf);
  assert.equal(result.holdings.length, f.length);
});

test('a corrupt workbook gets a plain message, not a library error', () => {
  const full = new Uint8Array(
    XLSX.write(buildHoldingsWorkbook(fixture()), { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  );
  const truncated = full.slice(0, 200).buffer;
  assert.throws(() => parseImportedFile('broken.xlsx', truncated), /Could not read broken\.xlsx\. Try saving it again\./);
});

test('junk bytes under an Excel name end in the no-investments message', () => {
  const junk = new TextEncoder().encode('%PDF-1.4 not a spreadsheet').buffer as ArrayBuffer;
  assert.throws(() => parseImportedFile('scan.xlsx', junk), /No investments found in scan\.xlsx/);
});
