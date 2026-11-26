import { useMemo } from 'react';
import {
  generateSmartDiversificationPlans,
  type LiveMarketBenchmarks,
  type SmartDiversificationPlan,
  type SuggestedDestination,
} from '../utils/smartDiversification';
import type { SimulationResult } from '../utils/simulationEngine';
import type { DemoPortfolio } from './demoData';
import type { JourneyState } from './journeyState';
import { buildDestinationCatalog, evaluateSplit, playOutcome, type SplitInput, type SplitResult } from './splitEngine';

export interface SplitView {
  plans: SmartDiversificationPlan[];
  catalog: SuggestedDestination[];
  input: SplitInput;
  result: SplitResult;
  outcome: SimulationResult;
}

/** Everything Play and the final plan derive from the portfolio and the visitor's choices. */
export function useSplit(
  portfolio: DemoPortfolio,
  benchmarks: LiveMarketBenchmarks | null,
  journey: JourneyState
): SplitView {
  const { holdings, loan } = portfolio;

  const plans = useMemo(
    () =>
      generateSmartDiversificationPlans(
        holdings,
        {
          goal: journey.goal,
          taxSlabPct: 30,
          hasHomeLoan: loan !== null,
          homeLoanRatePct: loan?.ratePct ?? 0,
          homeLoanPrincipal: loan?.principal ?? 0,
          homeLoanYearsLeft: loan?.yearsLeft ?? 0,
        },
        benchmarks
      ).plans,
    [holdings, loan, journey.goal, benchmarks]
  );

  const catalog = useMemo(
    () => buildDestinationCatalog(plans, holdings, benchmarks, loan !== null),
    [plans, holdings, benchmarks, loan]
  );

  const input = useMemo<SplitInput>(
    () => ({
      holdings,
      goal: journey.goal,
      sourceId: journey.sourceId ?? '',
      moveAmountInBase: journey.moveAmountInBase,
      allocations: journey.allocations,
      catalog,
      loan,
    }),
    [holdings, journey.goal, journey.sourceId, journey.moveAmountInBase, journey.allocations, catalog, loan]
  );

  const result = useMemo(() => evaluateSplit(input), [input]);
  const outcome = useMemo(
    () =>
      playOutcome(
        holdings,
        result.holdingsAfter,
        journey.factors,
        loan && result.loanPrepaidInBase > 0 ? { amountInBase: result.loanPrepaidInBase, ratePct: loan.ratePct } : undefined
      ),
    [holdings, result.holdingsAfter, result.loanPrepaidInBase, journey.factors, loan]
  );

  return { plans, catalog, input, result, outcome };
}
