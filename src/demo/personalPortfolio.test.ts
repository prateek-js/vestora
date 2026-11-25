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
  const buf = XLSX.write(buildHoldingsWorkbook(f, 'INR'), { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const result = parseImportedFile('mine.xlsx', buf, 'INR');
  assert.equal(result.holdings.length, f.length);
  assert.equal(result.skippedRows, 0);
});

test('reads a CSV export', () => {
  const f = fixture();
  const result = parseImportedFile('mine.csv', buildHoldingsCsv(f), 'INR');
  assert.equal(result.holdings.length, f.length);
  assert.equal(result.skippedRows, 0);
});

test('reads a JSON backup and takes the base currency from the file', () => {
  const f = fixture();
  const text = JSON.stringify(buildExport('p', 'USD', f));
  const result = parseImportedFile('backup.json', text, 'INR');
  assert.equal(result.holdings.length, f.length);
  assert.equal(result.baseCurrency, 'USD');
  assert.equal(result.skippedRows, 0);
});

test('uses the shared currency as base when every holding has one', () => {
  const csv = buildHoldingsCsv(withCurrency('USD', 0, 1, 2));
  assert.equal(parseImportedFile('usd.csv', csv, 'INR').baseCurrency, 'USD');
});

test('falls back to the given currency when holdings mix currencies', () => {
  const csv = buildHoldingsCsv(withCurrency('USD', 0));
  assert.equal(parseImportedFile('mixed.csv', csv, 'EUR').baseCurrency, 'EUR');
});

test('rejects an unsupported file', () => {
  assert.throws(() => parseImportedFile('statement.pdf', '', 'INR'), /Excel, CSV or Vestora JSON/);
});

test('rejects a file with no investments', () => {
  assert.throws(() => parseImportedFile('empty.csv', buildHoldingsCsv([]), 'INR'), /No investments found/);
});

test('rejects broken JSON', () => {
  assert.throws(() => parseImportedFile('x.json', '{oops', 'INR'), /not a valid JSON/i);
});
