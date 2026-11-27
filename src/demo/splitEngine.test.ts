/// <reference types="node" />
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Holding, MacroParameters } from '../types/wealth';
import { computePortfolioAllocation, runMacroSimulation } from '../utils/simulationEngine';
import type { SmartDiversificationPlan, SuggestedDestination } from '../utils/smartDiversification';
import {
  buildDestinationCatalog,
  evaluateSplit,
  isLockedIn,
  macroAllocation,
  pickStartingPlan,
  planToSplit,
  playOutcome,
  scaleAllocations,
  segmentOf,
  type SplitInput,
} from './splitEngine.ts';

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

const sav = holding({ id: 'sav', name: 'HDFC Savings Account', category: 'SAVINGS_CASH', currentValue: 400000, investedAmount: 400000, taxTag: 'SLAB_INCOME' });
const mf = holding({ id: 'mf', name: 'Parag Parikh Flexi Cap Fund', currentValue: 600000, investedAmount: 400000 });
const us = holding({ id: 'us', name: 'US Equity Portfolio', category: 'EQUITY_STOCK', currentValue: 10000, investedAmount: 6000, listedVenue: 'FOREIGN' });
const epf = holding({ id: 'epf', name: 'EPF', category: 'EPF', currentValue: 500000, investedAmount: 400000, taxTag: 'TAX_EXEMPT_EEE' });
const holdings = [sav, mf, us, epf];

const dEq = dest({ id: 'd-eq', title: 'UTI Nifty 50 Index Fund' });
const dDebt = dest({ id: 'd-debt', title: 'ICICI Pru Corporate Bond Fund', expectedRatePct: 7.6, taxTag: 'SLAB_INCOME' });
const dFd = dest({ id: 'd-fd', kind: 'CUSTOM_ASSET', title: 'Bank FD', category: 'FIXED_DEPOSIT', expectedRatePct: 7.5, taxTag: 'SLAB_INCOME' });
const dGilt = dest({ id: 'd-gilt', kind: 'MARKET_INSTRUMENT', title: 'India 10Y G-Sec', category: 'GOVT_BOND', expectedRatePct: 6.9, taxTag: 'SLAB_INCOME' });
const dLoan = dest({ id: 'd-loan', kind: 'HOME_LOAN', title: 'Home-loan prepayment', category: undefined });
const catalog = [dEq, dDebt, dFd, dGilt, dLoan];
const loan = { principal: 4500000, ratePct: 8.55, yearsLeft: 15 };

function input(over: Partial<SplitInput> = {}): SplitInput {
  return {
    holdings,
    goal: 'BALANCED',
    sourceId: 'sav',
    moveAmountInBase: 400000,
    allocations: { 'd-eq': 400000 },
    catalog,
    loan: null,
    ...over,
  };
}

// INR-only: every amount is summed as stored; no FX conversion exists anymore.
const totalInr = (hs: Holding[]) => hs.reduce((s, h) => s + h.currentValue, 0);

// ---------------------------------------------------------------- segments

test('segmentOf groups destinations the way the app buckets them', () => {
  assert.equal(segmentOf(dLoan), 'loan');
  assert.equal(segmentOf(dFd), 'fd');
  assert.equal(segmentOf(dest({ category: 'RECURRING_DEPOSIT' })), 'fd');
  assert.equal(segmentOf(dest({ category: 'SAVINGS_CASH' })), 'savings');
  assert.equal(segmentOf(dest({ category: 'SOVEREIGN_GOLD_BOND', title: 'SGB' })), 'gold');
  assert.equal(segmentOf(dest({ category: 'CORP_BOND', title: 'L&T Finance NCD' })), 'debt');
  assert.equal(segmentOf(dest({ category: 'GOVT_BOND', title: 'India G-Sec' })), 'debt');
  assert.equal(segmentOf(dest({ category: 'EQUITY_STOCK', title: 'Reliance' })), 'equity');
});

test('mutual-fund destinations are grouped by what the fund holds, not its category', () => {
  assert.equal(segmentOf(dest({ title: 'UTI Nifty 50 Index Fund - Direct' })), 'equity');
  assert.equal(segmentOf(dest({ title: 'HDFC Arbitrage Fund - Direct' })), 'debt');
  assert.equal(segmentOf(dest({ title: 'ICICI Pru Corporate Bond Fund' })), 'debt');
  assert.equal(segmentOf(dest({ title: 'HDFC Gold ETF Fund of Fund' })), 'gold');
  assert.equal(segmentOf(dest({ title: 'SBI Liquid Fund - Direct' })), 'savings');
});

test('only retirement money is locked in', () => {
  assert.equal(isLockedIn(epf), true);
  assert.equal(isLockedIn(holding({ category: 'PPF' })), true);
  assert.equal(isLockedIn(holding({ category: 'NPS' })), true);
  assert.equal(isLockedIn(mf), false);
});

// ---------------------------------------------------------------- evaluateSplit

test('moving a whole savings account into an equity fund shifts the mix and keeps total value', () => {
  const r = evaluateSplit(input());
  assert.equal(r.holdingsAfter.some((h) => h.id === 'sav'), false);
  const added = r.holdingsAfter.filter((h) => !holdings.some((o) => o.id === h.id));
  assert.equal(added.length, 1);
  assert.equal(added[0].currentValue, 400000);
  assert.equal(r.unallocatedInBase, 0);
  assert.ok(Math.abs(totalInr(r.holdingsAfter) - totalInr(holdings)) < 1);
  assert.ok(r.mixAfter.equity > r.mixBefore.equity);
  assert.ok(r.mixAfter.cash < r.mixBefore.cash);
  assert.notEqual(r.riskAfter, r.riskBefore);
  assert.ok(r.postureAfter.length > 0);
});

test('a partial move scales the source holding and its invested amount by the same ratio', () => {
  const r = evaluateSplit(input({ sourceId: 'mf', moveAmountInBase: 300000, allocations: { 'd-debt': 300000 } }));
  const left = r.holdingsAfter.find((h) => h.id === 'mf')!;
  assert.equal(left.currentValue, 300000);
  assert.equal(left.investedAmount, 200000);
});

test('money not yet allocated stays in the source and is reported', () => {
  const r = evaluateSplit(input({ moveAmountInBase: 400000, allocations: { 'd-eq': 100000 } }));
  assert.equal(r.unallocatedInBase, 300000);
  assert.equal(r.holdingsAfter.find((h) => h.id === 'sav')!.currentValue, 300000);
});

test('mixes are in base currency even with a foreign-listed holding', () => {
  const r = evaluateSplit(input());
  const sum = (m: typeof r.mixBefore) => m.equity + m.debt + m.gold + m.cash;
  assert.ok(Math.abs(sum(r.mixBefore) - 100) <= 2, `before sums to ${sum(r.mixBefore)}`);
  assert.ok(Math.abs(sum(r.mixAfter) - 100) <= 2, `after sums to ${sum(r.mixAfter)}`);
});

test('a destination amount is stored exactly as given', () => {
  const r = evaluateSplit(input({ allocations: { 'd-gilt': 69000 }, moveAmountInBase: 69000 }));
  const added = r.holdingsAfter.find((h) => h.name === 'India 10Y G-Sec')!;
  assert.equal(added.currency, 'INR');
  assert.equal(added.currentValue, 69000);
});

test('allocating more than the amount moved is flagged, not silently trimmed', () => {
  const r = evaluateSplit(input({ moveAmountInBase: 400000, allocations: { 'd-eq': 300000, 'd-debt': 200000 } }));
  assert.equal(r.unallocatedInBase, -100000);
});

test('an amount above the source value is clamped to the source value', () => {
  const r = evaluateSplit(input({ moveAmountInBase: 900000, allocations: { 'd-eq': 400000 } }));
  assert.equal(r.unallocatedInBase, 0);
  assert.equal(r.holdingsAfter.some((h) => h.id === 'sav'), false);
});

test('a zero move changes nothing', () => {
  const r = evaluateSplit(input({ moveAmountInBase: 0, allocations: {} }));
  assert.deepEqual(r.holdingsAfter, holdings);
  assert.equal(r.riskAfter, r.riskBefore);
  assert.deepEqual(r.mixAfter, r.mixBefore);
});

test('locked-in and unknown sources cannot be moved', () => {
  const locked = evaluateSplit(input({ sourceId: 'epf', moveAmountInBase: 500000, allocations: { 'd-eq': 500000 } }));
  assert.deepEqual(locked.holdingsAfter, holdings);
  const unknown = evaluateSplit(input({ sourceId: 'nope' }));
  assert.deepEqual(unknown.holdingsAfter, holdings);
});

test('loan prepayment leaves the source without adding a holding and reports interest saved', () => {
  const r = evaluateSplit(input({ moveAmountInBase: 200000, allocations: { 'd-loan': 200000 }, loan }));
  assert.equal(r.holdingsAfter.length, holdings.length);
  assert.equal(r.holdingsAfter.find((h) => h.id === 'sav')!.currentValue, 200000);
  assert.ok(r.loanInterestSaved > 0);
  assert.ok(r.loanMonthsSaved > 0);
});

test('without a known loan a loan allocation is ignored and stays unallocated', () => {
  const r = evaluateSplit(input({ moveAmountInBase: 200000, allocations: { 'd-loan': 200000 }, loan: null }));
  assert.deepEqual(r.holdingsAfter, holdings);
  assert.equal(r.unallocatedInBase, 200000);
  assert.equal(r.loanInterestSaved, 0);
});

const smallLoan = { principal: 100000, ratePct: 8.55, yearsLeft: 15 };

test('prepaying more than is owed is capped at the loan, and the rest stays to be placed', () => {
  const r = evaluateSplit(input({ moveAmountInBase: 200000, allocations: { 'd-loan': 200000 }, loan: smallLoan }));
  assert.equal(r.loanPrepaidInBase, 100000);
  assert.equal(r.holdingsAfter.find((h) => h.id === 'sav')!.currentValue, 300000);
  assert.equal(r.unallocatedInBase, 100000);
  const exact = evaluateSplit(input({ moveAmountInBase: 100000, allocations: { 'd-loan': 100000 }, loan: smallLoan }));
  assert.equal(r.loanInterestSaved, exact.loanInterestSaved, 'interest saved is for what was actually owed');
});

test('loanPrepaidInBase reports what went to the loan, and zero when nothing did', () => {
  const some = evaluateSplit(input({ moveAmountInBase: 200000, allocations: { 'd-loan': 200000 }, loan }));
  assert.equal(some.loanPrepaidInBase, 200000);
  assert.equal(evaluateSplit(input()).loanPrepaidInBase, 0);
  const noLoan = evaluateSplit(input({ moveAmountInBase: 200000, allocations: { 'd-loan': 200000 }, loan: null }));
  assert.equal(noLoan.loanPrepaidInBase, 0);
});

// ---------------------------------------------------------------- catalog

const planWith = (destinations: SuggestedDestination[]) =>
  ({ destinations }) as unknown as SmartDiversificationPlan;

test('the catalog dedupes plan destinations and zeroes their planned amounts', () => {
  const planned = { ...dEq, allocatedInBase: 55555 };
  const c = buildDestinationCatalog([planWith([planned]), planWith([planned])], [], null, false);
  const eq = c.filter((d) => d.id === 'd-eq');
  assert.equal(eq.length, 1);
  assert.equal(eq[0].allocatedInBase, 0);
});

test('the catalog fills missing segments from the stored benchmark funds', () => {
  const c = buildDestinationCatalog([], [], null, false);
  const segs = new Set(c.map(segmentOf));
  assert.deepEqual([...segs].sort(), ['debt', 'equity', 'gold', 'savings']);
  const eq = c.find((d) => segmentOf(d) === 'equity')!;
  assert.equal(eq.expectedRatePct, 12.8);
});

test('there is no loan segment unless a loan is known', () => {
  const withLoanPlan = [planWith([dLoan, dEq])];
  const without = buildDestinationCatalog(withLoanPlan, [], null, false);
  assert.equal(without.some((d) => segmentOf(d) === 'loan'), false);
  const withLoan = buildDestinationCatalog([], [], null, true);
  assert.equal(withLoan.filter((d) => segmentOf(d) === 'loan').length, 1);
});

test('the FD option uses the median rate of the portfolio FDs, and is omitted without any', () => {
  const fds = [7, 8, 7.5].map((r, i) =>
    holding({ id: `fd${i}`, category: 'FIXED_DEPOSIT', interestRatePct: r })
  );
  const c = buildDestinationCatalog([], fds, null, false);
  const fd = c.find((d) => segmentOf(d) === 'fd')!;
  assert.equal(fd.expectedRatePct, 7.5);
  const none = buildDestinationCatalog([], [mf], null, false);
  assert.equal(none.some((d) => segmentOf(d) === 'fd'), false);
});

test('catalog ids are unique', () => {
  const c = buildDestinationCatalog([planWith([dEq, dDebt])], [], null, true);
  assert.equal(new Set(c.map((d) => d.id)).size, c.length);
});

// ---------------------------------------------------------------- starting split

test('planToSplit turns a suggested plan into a starting split, leaving out zero amounts', () => {
  const plan = {
    sourceHolding: sav,
    moveAmountInBase: 300000,
    destinations: [
      { ...dEq, allocatedInBase: 200000 },
      { ...dDebt, allocatedInBase: 100000 },
      { ...dFd, allocatedInBase: 0 },
    ],
  } as unknown as SmartDiversificationPlan;
  assert.deepEqual(planToSplit(plan), {
    sourceId: 'sav',
    moveAmountInBase: 300000,
    allocations: { 'd-eq': 200000, 'd-debt': 100000 },
  });
});

const planFrom = (source: Holding, move: number, ...ds: [SuggestedDestination, number][]) =>
  ({
    id: `plan-${source.id}-${ds[0][0].id}`,
    sourceHolding: source,
    moveAmountInBase: move,
    destinations: ds.map(([d, amount]) => ({ ...d, allocatedInBase: amount })),
  }) as unknown as SmartDiversificationPlan;

test('pickStartingPlan chooses the suggested plan that gets the mix closest to target', () => {
  // The foreign-listed fixture is an INR figure like every other, so equity is
  // under target: moving savings into equity helps, trimming the fund into debt overshoots debt.
  const helpful = planFrom(sav, 400000, [dEq, 400000]);
  const harmful = planFrom(mf, 300000, [dDebt, 300000]);
  assert.equal(pickStartingPlan([harmful, helpful], input()), helpful);
  assert.equal(pickStartingPlan([helpful, harmful], input()), helpful);
});

test('pickStartingPlan keeps the first plan on a tie and returns null when there are none', () => {
  const a = planFrom(mf, 300000, [dDebt, 300000]);
  const b = planFrom(mf, 300000, [dFd, 300000]);
  assert.equal(pickStartingPlan([a, b], input()), a);
  assert.equal(pickStartingPlan([], input()), null);
});

test('scaleAllocations shrinks a split proportionally when the amount moved drops below it', () => {
  assert.deepEqual(scaleAllocations({ a: 300, b: 100 }, 200), { a: 150, b: 50 });
});

test('scaleAllocations leaves a split alone when it already fits, and empties it at zero', () => {
  const fits = { a: 100, b: 50 };
  assert.deepEqual(scaleAllocations(fits, 150), fits);
  assert.deepEqual(scaleAllocations(fits, 400), fits);
  assert.deepEqual(scaleAllocations(fits, 0), {});
});

test('scaleAllocations never rounds the split above the new total', () => {
  const scaled = scaleAllocations({ a: 1, b: 1, c: 1 }, 2);
  const sum = Object.values(scaled).reduce((s, v) => s + v, 0);
  assert.ok(sum <= 2, `sum ${sum}`);
});

// ---------------------------------------------------------------- simulation allocation

test('macroAllocation counts a bond fund as fixed income, unlike the simulator’s own category-only rule', () => {
  const bondFund = holding({ id: 'b', name: 'ICICI Pru Corporate Bond Fund', currentValue: 100000 });
  assert.equal(macroAllocation([bondFund]).fixedIncome, 100);
  assert.equal(computePortfolioAllocation([bondFund]).fixedIncome, 0, 'the app treats it as equity');
});

test('macroAllocation puts each kind of holding in its own bucket', () => {
  const a = macroAllocation(
    [
      holding({ id: '1', name: 'Nifty 50 Index Fund', currentValue: 100000 }),
      holding({ id: '2', name: 'Corporate Bond Fund', currentValue: 100000 }),
      holding({ id: '3', name: 'HDFC Gold ETF Fund of Fund', currentValue: 100000 }),
      holding({ id: '4', name: 'SBI Liquid Fund', currentValue: 100000 }),
      holding({ id: '5', name: 'EPF', category: 'EPF', currentValue: 100000 }),
    ]
  );
  assert.deepEqual(a, { equities: 20, fixedIncome: 20, goldCommodity: 20, retirementPensions: 20, liquidCash: 20 });
});

test('macroAllocation agrees with the app when no debt, gold or liquid funds are involved', () => {
  const mine = macroAllocation(holdings);
  const apps = computePortfolioAllocation(holdings);
  for (const key of Object.keys(apps) as (keyof typeof apps)[]) {
    assert.ok(Math.abs(mine[key] - apps[key]) <= 1, `${key}: ${mine[key]} vs ${apps[key]}`);
  }
});

test('macroAllocation falls back to the app’s default for an empty portfolio', () => {
  assert.deepEqual(macroAllocation([]), computePortfolioAllocation([]));
});

// ---------------------------------------------------------------- outcome

const params5: MacroParameters = {
  inflationRatePct: 6.5,
  interestRateHikeBps: 150,
  geopoliticalShockIndex: 5,
  equityMarketShockPct: -12,
  projectionHorizonYears: 5,
};

test('money used to prepay a loan is counted as earning the loan rate, not as still invested', () => {
  const split = evaluateSplit(input({ moveAmountInBase: 200000, allocations: { 'd-loan': 200000 }, loan }));
  const prepay = { amountInBase: split.loanPrepaidInBase, ratePct: loan.ratePct };
  const out = playOutcome(holdings, split.holdingsAfter, params5, prepay);
  const total = totalInr(holdings);

  // Paying down a loan does not change net worth on day one.
  assert.ok(Math.abs(out.trajectory[0].shuffledNominal - total) < 1, `day one: ${out.trajectory[0].shuffledNominal} vs ${total}`);

  // Afterwards: what remains invested grows under the chosen conditions, the prepaid part grows at the loan rate.
  const remaining = runMacroSimulation(total - 200000, macroAllocation(holdings), macroAllocation(split.holdingsAfter), params5);
  const expected = remaining.trajectory[5].shuffledNominal + 200000 * Math.pow(1 + loan.ratePct / 100, 5);
  assert.ok(Math.abs(out.trajectory[5].shuffledNominal - expected) < 1, `year five: ${out.trajectory[5].shuffledNominal} vs ${expected}`);
  assert.ok(Math.abs(out.finalShuffledNetWorth - out.trajectory[5].shuffledNominal) <= 1, 'final matches the last point, to rounding');
  assert.ok(Math.abs(out.shuffledAdvantageVsScenario - (out.finalShuffledNetWorth - out.finalScenarioNetWorth)) < 1e-6);
});

test('crediting a loan prepayment leaves the "change nothing" line alone', () => {
  const split = evaluateSplit(input({ moveAmountInBase: 200000, allocations: { 'd-loan': 200000 }, loan }));
  const plain = playOutcome(holdings, split.holdingsAfter, params5);
  const credited = playOutcome(holdings, split.holdingsAfter, params5, { amountInBase: 200000, ratePct: loan.ratePct });
  assert.equal(credited.finalScenarioNetWorth, plain.finalScenarioNetWorth);
  assert.equal(credited.finalBaselineNetWorth, plain.finalBaselineNetWorth);
});

test('playOutcome runs the macro simulation over the chosen horizon', () => {
  const params: MacroParameters = {
    inflationRatePct: 6.5,
    interestRateHikeBps: 150,
    geopoliticalShockIndex: 5,
    equityMarketShockPct: -12,
    projectionHorizonYears: 5,
  };
  const after = evaluateSplit(input()).holdingsAfter;
  const out = playOutcome(holdings, after, params);
  assert.equal(out.trajectory.length, 6);
  assert.notEqual(out.finalShuffledNetWorth, out.finalScenarioNetWorth);
});
