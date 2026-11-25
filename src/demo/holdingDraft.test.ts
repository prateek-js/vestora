/// <reference types="node" />
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Holding } from '../types/wealth';
import { todayIso } from '../utils/maturity.ts';
import {
  STARTER_CATEGORIES,
  defaultTaxTag,
  draftFromHolding,
  emptyDraft,
  holdingFromDraft,
  type HoldingDraft,
} from './holdingDraft.ts';

function draft(over: Partial<HoldingDraft> = {}): HoldingDraft {
  return {
    ...emptyDraft('MUTUAL_FUND', 'INR'),
    name: 'Index fund',
    investedAmount: '100000',
    currentValue: '125000.5',
    ...over,
  };
}

function failure(d: HoldingDraft): string {
  const result = holdingFromDraft(d);
  if (result.ok) throw new Error('expected the draft to be refused');
  return result.error;
}

function success(d: HoldingDraft, existing?: Holding): Holding {
  const result = holdingFromDraft(d, existing);
  if (!result.ok) throw new Error(result.error);
  return result.holding;
}

test('starter categories offer the three simplest kinds of holding', () => {
  assert.deepEqual(STARTER_CATEGORIES, [
    { label: 'Mutual fund', category: 'MUTUAL_FUND' },
    { label: 'Fixed deposit', category: 'FIXED_DEPOSIT' },
    { label: 'Savings account', category: 'SAVINGS_CASH' },
  ]);
});

test('an empty draft starts blank with today as the purchase date', () => {
  const d = emptyDraft('FIXED_DEPOSIT', 'USD');
  assert.equal(d.category, 'FIXED_DEPOSIT');
  assert.equal(d.currency, 'USD');
  assert.equal(d.purchaseDate, todayIso());
  assert.equal(d.name, '');
  assert.equal(d.investedAmount, '');
  assert.equal(d.maturityDate, '');
});

test('default tax tags follow the category', () => {
  assert.equal(defaultTaxTag('MUTUAL_FUND'), 'LTCG_EQUITY');
  assert.equal(defaultTaxTag('EQUITY_STOCK'), 'LTCG_EQUITY');
  assert.equal(defaultTaxTag('PPF'), 'TAX_EXEMPT_EEE');
  assert.equal(defaultTaxTag('EPF'), 'TAX_EXEMPT_EEE');
  assert.equal(defaultTaxTag('NPS'), '80CCD');
  assert.equal(defaultTaxTag('FIXED_DEPOSIT'), 'SLAB_INCOME');
  assert.equal(defaultTaxTag('SAVINGS_CASH'), 'SLAB_INCOME');
});

test('a blank name is refused', () => {
  assert.equal(failure(draft({ name: '   ' })), 'Please provide a name for the investment.');
});

test('invested amount must be a number above zero', () => {
  for (const bad of ['0', '-5', 'abc', '']) {
    assert.equal(failure(draft({ investedAmount: bad })), 'Please enter a valid invested amount.');
  }
});

test('current value must be a number, zero allowed', () => {
  assert.equal(failure(draft({ currentValue: '-1' })), 'Please enter a valid current valuation.');
  assert.equal(failure(draft({ currentValue: 'x' })), 'Please enter a valid current valuation.');
  assert.equal(success(draft({ currentValue: '0' })).currentValue, 0);
});

test('a rate that is not a number is refused, a blank rate is left out', () => {
  assert.equal(failure(draft({ interestRatePct: 'abc' })), 'Please enter a valid annual rate %.');
  assert.equal(success(draft({ interestRatePct: '  ' })).interestRatePct, undefined);
  assert.equal(success(draft({ interestRatePct: '7.1' })).interestRatePct, 7.1);
});

test('a valid draft becomes a holding with gain worked out', () => {
  const h = success(draft({ name: '  Index fund  ', institution: '   ' }));
  assert.equal(h.name, 'Index fund');
  assert.equal(h.institution, 'Direct Account');
  assert.equal(h.investedAmount, 100000);
  assert.equal(h.currentValue, 125000.5);
  assert.equal(h.unrealizedGain, 25000.5);
  assert.equal(h.unrealizedGainPct, 25);
  assert.equal(h.taxTag, defaultTaxTag('MUTUAL_FUND'));
  assert.equal(h.maturityDate, undefined);
  assert.equal(h.isMatured, false);
  assert.equal(h.notes, undefined);
});

test('a maturity date in the past marks the holding as matured', () => {
  const h = success(draft({ category: 'FIXED_DEPOSIT', maturityDate: '2020-01-01' }));
  assert.equal(h.isMatured, true);
  assert.ok(h.daysToMaturity !== undefined && h.daysToMaturity <= 0);
  assert.equal(h.taxTag, 'SLAB_INCOME');
});

test('a maturity date in the future leaves the holding open', () => {
  const h = success(draft({ category: 'FIXED_DEPOSIT', maturityDate: '2999-01-01' }));
  assert.equal(h.isMatured, false);
  assert.ok(h.daysToMaturity !== undefined && h.daysToMaturity > 0);
});

test('new holdings get distinct ids even when made back to back', () => {
  const a = success(draft());
  const b = success(draft());
  assert.match(a.id, /^h-custom-\d+-.+/);
  assert.notEqual(a.id, b.id);
});

test('editing keeps the id and the fields the form does not show', () => {
  const existing = success(draft({ notes: 'keep me' }));
  const withExtras: Holding = { ...existing, units: 42, schemeCode: 1234, accountNumberMask: 'XX99' };
  const edited = success({ ...draftFromHolding(withExtras), currentValue: '150000' }, withExtras);
  assert.equal(edited.id, existing.id);
  assert.equal(edited.units, 42);
  assert.equal(edited.schemeCode, 1234);
  assert.equal(edited.accountNumberMask, 'XX99');
  assert.equal(edited.notes, 'keep me');
  assert.equal(edited.currentValue, 150000);
  assert.equal(edited.unrealizedGain, 50000);
});

test('a draft made from a holding round-trips back to the same numbers', () => {
  const h = success(draft({ category: 'FIXED_DEPOSIT', interestRatePct: '7.25', maturityDate: '2999-01-01', notes: 'n' }));
  const d = draftFromHolding(h);
  assert.equal(d.investedAmount, '100000');
  assert.equal(d.interestRatePct, '7.25');
  assert.equal(d.maturityDate, '2999-01-01');
  assert.equal(d.notes, 'n');
  const again = success(d, h);
  assert.equal(again.investedAmount, h.investedAmount);
  assert.equal(again.interestRatePct, 7.25);
});
