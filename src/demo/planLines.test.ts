/// <reference types="node" />
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Holding } from '../types/wealth';
import type { SuggestedDestination } from '../utils/smartDiversification';
import { placedTotal, planLines } from './planLines.ts';
import { evaluateSplit, type SplitInput } from './splitEngine.ts';

function holding(over: Partial<Holding>): Holding {
  return {
    id: 'h',
    name: 'Holding',
    category: 'MUTUAL_FUND',
    institution: 'Test',
    investedAmount: 100000,
    currentValue: 100000,
    currency: 'INR',
    purchaseDate: '2024-01-01',
    unrealizedGain: 0,
    unrealizedGainPct: 0,
    taxTag: 'LTCG_EQUITY',
    ...over,
  };
}

function dest(over: Partial<SuggestedDestination>): SuggestedDestination {
  return {
    id: 'd',
    kind: 'MUTUAL_FUND',
    title: 'Fund',
    subtitle: '',
    category: 'MUTUAL_FUND',
    institution: 'Test',
    currency: 'INR',
    allocatedInBase: 0,
    expectedRatePct: 10,
    taxTag: 'LTCG_EQUITY',
    ...over,
  };
}

const sav = holding({ id: 'sav', name: 'HDFC Savings Account', category: 'SAVINGS_CASH', currentValue: 400000, investedAmount: 400000 });
const mf = holding({ id: 'mf', name: 'Parag Parikh Flexi Cap Fund', currentValue: 600000, investedAmount: 400000 });
const dEq = dest({ id: 'd-eq', title: 'UTI Nifty 50 Index Fund' });
const dDebt = dest({ id: 'd-debt', title: 'ICICI Corporate Bond Fund' });
const dLoan = dest({ id: 'd-loan', kind: 'HOME_LOAN', title: 'Home-loan prepayment', category: undefined });
const loan = { principal: 4500000, ratePct: 8.55, yearsLeft: 15 };
const money = (n: number) => `Rs${Math.round(n)}`;

function build(allocations: Record<string, number>, over: Partial<SplitInput> = {}) {
  const input: SplitInput = {
    holdings: [sav, mf],
    baseCurrency: 'INR',
    goal: 'BALANCED',
    sourceId: 'sav',
    moveAmountInBase: 400000,
    allocations,
    catalog: [dEq, dDebt, dLoan],
    loan: null,
    ...over,
  };
  return { input, result: evaluateSplit(input) };
}

test('one line per placed amount, biggest first', () => {
  const { input, result } = build({ 'd-eq': 100000, 'd-debt': 300000 });
  const lines = planLines(sav, input, result, money);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].text, 'Move Rs300000 from HDFC Savings Account into ICICI Corporate Bond Fund');
  assert.equal(lines[1].text, 'Move Rs100000 from HDFC Savings Account into UTI Nifty 50 Index Fund');
});

test('the reason says how the destination group moves against the target', () => {
  const { input, result } = build({ 'd-eq': 400000 });
  const [line] = planLines(sav, input, result, money);
  assert.ok(line.reason.startsWith('Equity goes from '), line.reason);
  assert.ok(line.reason.includes('against a target of 50%'), line.reason);
});

test('a debt destination reports the debt group, not equity', () => {
  const { input, result } = build({ 'd-debt': 400000 });
  const [line] = planLines(sav, input, result, money);
  assert.ok(line.reason.startsWith('Debt goes from '), line.reason);
});

test('zero amounts and unknown destinations produce no lines', () => {
  const { input, result } = build({ 'd-eq': 0, nope: 50000 });
  assert.deepEqual(planLines(sav, input, result, money), []);
});

test('nothing placed gives an empty plan', () => {
  const { input, result } = build({});
  assert.deepEqual(planLines(sav, input, result, money), []);
});

test('a loan allocation reads as a prepayment and names the interest and months saved', () => {
  const { input, result } = build({ 'd-loan': 200000 }, { moveAmountInBase: 200000, loan });
  const [line] = planLines(sav, input, result, money);
  assert.equal(line.text, 'Prepay Rs200000 of your home loan');
  assert.ok(line.reason.includes('months'), line.reason);
  assert.ok(line.reason.startsWith('Saves Rs'), line.reason);
});

test('placedTotal adds up only what can actually be placed', () => {
  const { input } = build({ 'd-eq': 100000, 'd-debt': 300000, 'd-loan': 50000, nope: 999 }, { loan: null });
  assert.equal(placedTotal(input), 400000);
  const withLoan = build({ 'd-eq': 100000, 'd-loan': 50000 }, { loan }).input;
  assert.equal(placedTotal(withLoan), 150000);
  assert.equal(placedTotal(build({}).input), 0);
});

test('a loan allocation is ignored when no loan is known', () => {
  const { input, result } = build({ 'd-loan': 200000 }, { moveAmountInBase: 200000, loan: null });
  assert.deepEqual(planLines(sav, input, result, money), []);
});
