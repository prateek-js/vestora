/// <reference types="node" />
import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import type { Holding } from '../types/wealth';
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
  const usd: Holding = {
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
  };
  const text = JSON.stringify(buildExport('p', [usd]));
  const result = parseImportedFile('backup.json', text);
  const h = result.holdings[0];
  assert.equal(h.currency, 'INR');
  assert.equal(h.investedAmount, 1903000);
  assert.equal(h.currentValue, 3330250);
  assert.equal(h.unrealizedGain, 1427250);
  assert.equal(h.listedVenue, 'FOREIGN');
});

test('a statement whose figures are all USD imports as INR holdings', () => {
  const csv = buildHoldingsCsv(withCurrency('USD', 0, 1, 2));
  const result = parseImportedFile('usd.csv', csv);
  assert.ok(result.holdings.every((h) => h.currency === 'INR'));
});

test('a statement mixing currencies imports as INR too', () => {
  const csv = buildHoldingsCsv(withCurrency('USD', 0));
  const result = parseImportedFile('mixed.csv', csv);
  assert.ok(result.holdings.every((h) => h.currency === 'INR'));
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
