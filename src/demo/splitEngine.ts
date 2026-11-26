import type { Holding, MacroParameters, PortfolioAllocation } from '../types/wealth';
import { todayIso } from '../utils/maturity';
import { calculateHomeLoanPrepaymentImpact } from '../utils/marketDirectory';
import { computePortfolioAllocation, runMacroSimulation, type SimulationResult } from '../utils/simulationEngine';
import { computePortfolioRiskScore } from '../utils/taxAndDiversification';
import {
  AMFI_BENCHMARK_CONFIG,
  analyzeAllocationProfile,
  type BenchmarkKey,
  type BucketMix,
  type DiversificationGoal,
  type LiveMarketBenchmarks,
  type SmartDiversificationPlan,
  type SuggestedDestination,
  TARGET_MIX_BY_GOAL,
} from '../utils/smartDiversification';
import { balanceScore } from './balance';
import { benchmarkYieldPct } from './benchmarkMap';

export type SegmentId = 'equity' | 'debt' | 'fd' | 'savings' | 'gold' | 'loan';

export const SEGMENT_LABELS: Record<SegmentId, string> = {
  equity: 'Equity and index funds',
  debt: 'Bonds and debt funds',
  fd: 'Fixed deposits',
  savings: 'Savings and liquid',
  gold: 'Gold',
  loan: 'Home-loan prepayment',
};

export interface LoanInputs {
  principal: number;
  ratePct: number;
  yearsLeft: number;
}

export interface SplitInput {
  holdings: Holding[];
  goal: DiversificationGoal;
  sourceId: string;
  moveAmountInBase: number;
  /** Destination id to amount in base currency. */
  allocations: Record<string, number>;
  catalog: SuggestedDestination[];
  loan: LoanInputs | null;
}

export interface SplitResult {
  holdingsAfter: Holding[];
  /** Amount moved but not yet placed. Negative means more was placed than moved. */
  unallocatedInBase: number;
  mixBefore: BucketMix;
  mixAfter: BucketMix;
  riskBefore: number;
  riskAfter: number;
  postureAfter: string;
  /** What actually went to the loan: never more than is owed. */
  loanPrepaidInBase: number;
  loanInterestSaved: number;
  loanMonthsSaved: number;
}

const BUCKET_ORDER: (keyof BucketMix)[] = ['equity', 'debt', 'gold', 'cash'];
const BUCKET_TO_SEGMENT: Record<keyof BucketMix, SegmentId> = {
  equity: 'equity',
  debt: 'debt',
  gold: 'gold',
  cash: 'savings',
};
/** A source this close to fully moved is dropped instead of left as a sliver. */
const FULLY_MOVED_RATIO = 0.995;

export function isLockedIn(h: Holding): boolean {
  return h.category === 'EPF' || h.category === 'PPF' || h.category === 'NPS';
}

function destinationHolding(
  d: SuggestedDestination,
  amountInBase: number,
  id: string
): Holding {
  const value = amountInBase;
  return {
    id,
    name: d.title,
    category: d.category ?? 'MUTUAL_FUND',
    institution: d.institution ?? 'Market',
    investedAmount: value,
    currentValue: value,
    currency: d.currency,
    interestRatePct: d.expectedRatePct,
    purchaseDate: todayIso(),
    unrealizedGain: 0,
    unrealizedGainPct: 0,
    taxTag: d.taxTag ?? 'LTCG_EQUITY',
  };
}

/** Which group a destination belongs to. Funds are grouped by what the app's own bucketing says they hold. */
export function segmentOf(d: SuggestedDestination): SegmentId {
  if (d.kind === 'HOME_LOAN') return 'loan';
  const category = d.category ?? 'MUTUAL_FUND';
  if (category === 'FIXED_DEPOSIT' || category === 'RECURRING_DEPOSIT') return 'fd';
  if (category === 'SAVINGS_CASH') return 'savings';
  const probe = destinationHolding({ ...d, currency: 'INR' }, 1, 'probe');
  const { currentVal } = analyzeAllocationProfile([probe], 'BALANCED');
  let best: keyof BucketMix = 'equity';
  for (const bucket of BUCKET_ORDER) {
    if (currentVal[bucket] > currentVal[best]) best = bucket;
  }
  return BUCKET_TO_SEGMENT[best];
}

const FALLBACK_FUNDS: { id: BenchmarkKey['id']; segment: SegmentId }[] = [
  { id: 'NIFTY50', segment: 'equity' },
  { id: 'CORP_BOND', segment: 'debt' },
  { id: 'GOLD_FOF', segment: 'gold' },
  { id: 'LIQUID', segment: 'savings' },
];

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Every place the money can go, one entry per destination, with every group represented where we have a rate. */
export function buildDestinationCatalog(
  plans: SmartDiversificationPlan[],
  holdings: Holding[],
  benchmarks: LiveMarketBenchmarks | null,
  hasLoan: boolean
): SuggestedDestination[] {
  const byId = new Map<string, SuggestedDestination>();
  for (const plan of plans) {
    for (const d of plan.destinations) {
      if (d.kind === 'HOME_LOAN' && !hasLoan) continue;
      if (!byId.has(d.id)) byId.set(d.id, { ...d, allocatedInBase: 0 });
    }
  }
  const catalog = [...byId.values()];
  const present = new Set(catalog.map(segmentOf));

  for (const fb of FALLBACK_FUNDS) {
    if (present.has(fb.segment)) continue;
    const cfg = AMFI_BENCHMARK_CONFIG.find((c) => c.id === fb.id)!;
    catalog.push({
      id: `fallback-${cfg.id}`,
      kind: 'MUTUAL_FUND',
      title: cfg.shortName,
      subtitle: 'Typical yield',
      category: 'MUTUAL_FUND',
      institution: 'AMFI',
      currency: 'INR',
      allocatedInBase: 0,
      expectedRatePct: benchmarkYieldPct(cfg.id, benchmarks),
      schemeCode: cfg.schemeCode,
      taxTag: cfg.taxTag,
    });
  }

  if (!present.has('fd')) {
    const rates = holdings
      .filter((h) => h.category === 'FIXED_DEPOSIT' && h.interestRatePct !== undefined)
      .map((h) => h.interestRatePct as number);
    if (rates.length > 0) {
      catalog.push({
        id: 'fallback-fd',
        kind: 'CUSTOM_ASSET',
        title: 'Bank fixed deposit',
        subtitle: 'Based on your current FDs',
        category: 'FIXED_DEPOSIT',
        institution: 'Bank',
        currency: 'INR',
        allocatedInBase: 0,
        expectedRatePct: median(rates),
        taxTag: 'SLAB_INCOME',
      });
    }
  }

  if (hasLoan && !present.has('loan')) {
    catalog.push({
      id: 'fallback-loan',
      kind: 'HOME_LOAN',
      title: 'Home-loan prepayment',
      subtitle: 'Pay down principal',
      currency: 'INR',
      allocatedInBase: 0,
    });
  }
  return catalog;
}

export function evaluateSplit(input: SplitInput): SplitResult {
  const { holdings, goal, allocations, catalog, loan } = input;
  const before = analyzeAllocationProfile(holdings, goal);
  const riskBefore = computePortfolioRiskScore(holdings);

  const source = holdings.find((h) => h.id === input.sourceId);
  const sourceValue = source ? Math.max(0, source.currentValue) : 0;
  const movable = source && !isLockedIn(source) ? sourceValue : 0;
  const effectiveMove = Math.min(Math.max(0, input.moveAmountInBase), movable);

  const applicable = catalog.filter(
    (d) => (allocations[d.id] ?? 0) > 0 && (d.kind !== 'HOME_LOAN' || loan !== null)
  );
  // A loan can only take what is owed; anything above that is left to place elsewhere.
  const amountFor = (d: SuggestedDestination) =>
    d.kind === 'HOME_LOAN' && loan ? Math.min(allocations[d.id], loan.principal) : allocations[d.id];
  const applied = applicable.reduce((sum, d) => sum + amountFor(d), 0);
  const movedOut = Math.min(effectiveMove, applied);
  const unallocatedInBase = effectiveMove - applied;

  let holdingsAfter = [...holdings];
  let loanPrepaidInBase = 0;
  let loanInterestSaved = 0;
  let loanMonthsSaved = 0;

  if (source && movedOut > 0) {
    const ratio = movedOut / sourceValue;
    holdingsAfter = [];
    for (const h of holdings) {
      if (h.id !== source.id) {
        holdingsAfter.push(h);
      } else if (ratio < FULLY_MOVED_RATIO) {
        holdingsAfter.push({
          ...h,
          currentValue: h.currentValue * (1 - ratio),
          investedAmount: h.investedAmount * (1 - ratio),
        });
      }
    }
    for (const d of applicable) {
      if (d.kind === 'HOME_LOAN') {
        const prepay = amountFor(d);
        const impact = calculateHomeLoanPrepaymentImpact(loan!.principal, loan!.ratePct, loan!.yearsLeft * 12, prepay);
        loanPrepaidInBase = prepay;
        loanInterestSaved = impact.interestSaved;
        loanMonthsSaved = impact.monthsSaved;
      } else {
        holdingsAfter.push(destinationHolding(d, amountFor(d), `split-${d.id}`));
      }
    }
  }

  const after = analyzeAllocationProfile(holdingsAfter, goal);
  const riskAfter = computePortfolioRiskScore(holdingsAfter);
  return {
    holdingsAfter,
    unallocatedInBase,
    mixBefore: before.currentPct,
    mixAfter: after.currentPct,
    riskBefore: riskBefore.score,
    riskAfter: riskAfter.score,
    postureAfter: riskAfter.posture,
    loanPrepaidInBase,
    loanInterestSaved,
    loanMonthsSaved,
  };
}

/** A suggested plan as a starting split: its source, the amount, and what goes where. */
export function planToSplit(plan: SmartDiversificationPlan): {
  sourceId: string;
  moveAmountInBase: number;
  allocations: Record<string, number>;
} {
  const allocations: Record<string, number> = {};
  for (const d of plan.destinations) {
    if (d.allocatedInBase > 0) allocations[d.id] = d.allocatedInBase;
  }
  return { sourceId: plan.sourceHolding.id, moveAmountInBase: plan.moveAmountInBase, allocations };
}

/** Of the suggested plans, the one that leaves the mix closest to the goal. The first wins a tie. */
export function pickStartingPlan(plans: SmartDiversificationPlan[], base: SplitInput): SmartDiversificationPlan | null {
  const target = TARGET_MIX_BY_GOAL[base.goal].weights;
  let best: SmartDiversificationPlan | null = null;
  let bestScore = -1;
  for (const plan of plans) {
    const result = evaluateSplit({ ...base, ...planToSplit(plan) });
    const score = balanceScore(result.mixAfter, target);
    if (score > bestScore) {
      best = plan;
      bestScore = score;
    }
  }
  return best;
}

/** Shrinks a split proportionally so it never adds up to more than `newTotal`. A split that already fits is returned as is. */
export function scaleAllocations(allocations: Record<string, number>, newTotal: number): Record<string, number> {
  const sum = Object.values(allocations).reduce((s, v) => s + v, 0);
  if (sum <= newTotal) return allocations;
  const scaled: Record<string, number> = {};
  if (newTotal <= 0) return scaled;
  const factor = newTotal / sum;
  for (const [id, amount] of Object.entries(allocations)) {
    const next = Math.floor(amount * factor);
    if (next > 0) scaled[id] = next;
  }
  return scaled;
}

/**
 * The simulator's five-bucket allocation, but fund-aware. The app's own `computePortfolioAllocation` counts every
 * mutual fund as equity, so a bond fund would look identical to an equity fund in a five-year outcome. Here a fund
 * is placed by what it holds, the same way the mix bars place it. Retirement money (EPF, PPF, NPS) stays its own bucket.
 */
export function macroAllocation(holdings: Holding[]): PortfolioAllocation {
  const sums: PortfolioAllocation = { equities: 0, fixedIncome: 0, goldCommodity: 0, retirementPensions: 0, liquidCash: 0 };
  for (const h of holdings) {
    if (isLockedIn(h)) {
      sums.retirementPensions += Math.max(0, h.currentValue);
      continue;
    }
    const { currentVal } = analyzeAllocationProfile([h], 'BALANCED');
    sums.equities += currentVal.equity;
    sums.fixedIncome += currentVal.debt;
    sums.goldCommodity += currentVal.gold;
    sums.liquidCash += currentVal.cash;
  }
  const total = sums.equities + sums.fixedIncome + sums.goldCommodity + sums.retirementPensions + sums.liquidCash;
  if (total <= 0) return computePortfolioAllocation([]);
  const pct = (v: number) => Math.round((v / total) * 1000) / 10;
  return {
    equities: pct(sums.equities),
    fixedIncome: pct(sums.fixedIncome),
    goldCommodity: pct(sums.goldCommodity),
    retirementPensions: pct(sums.retirementPensions),
    liquidCash: pct(sums.liquidCash),
  };
}

/**
 * Outcome with today's mix against the mix after the split, under the chosen economic conditions.
 *
 * Money used to prepay a loan leaves the investments, so it must not keep compounding with them. It is instead
 * counted as earning the loan's rate, tax-free: paying down a loan is a guaranteed return of that rate. Net worth
 * is unchanged on day one. Only the nominal "after" series is adjusted; the real-terms series is left as the
 * simulator computed it, because nothing in the demo reads it.
 */
export function playOutcome(
  before: Holding[],
  after: Holding[],
  params: MacroParameters,
  loanPrepay?: { amountInBase: number; ratePct: number }
): SimulationResult {
  const total = before.reduce((sum, h) => sum + h.currentValue, 0);
  const allocBefore = macroAllocation(before);
  const allocAfter = macroAllocation(after);
  const sim = runMacroSimulation(total, allocBefore, allocAfter, params);
  if (!loanPrepay || loanPrepay.amountInBase <= 0) return sim;

  const { amountInBase, ratePct } = loanPrepay;
  const invested = runMacroSimulation(Math.max(0, total - amountInBase), allocBefore, allocAfter, params);
  const prepaidAt = (year: number) => amountInBase * Math.pow(1 + ratePct / 100, year);
  const trajectory = sim.trajectory.map((point, i) => ({
    ...point,
    shuffledNominal: Math.round(invested.trajectory[i].shuffledNominal + prepaidAt(point.year)),
  }));
  const finalShuffledNetWorth = invested.finalShuffledNetWorth + prepaidAt(params.projectionHorizonYears);
  return {
    ...sim,
    trajectory,
    finalShuffledNetWorth,
    shuffledAdvantageVsScenario: finalShuffledNetWorth - sim.finalScenarioNetWorth,
  };
}
