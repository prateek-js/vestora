import { Holding, MacroParameters, PortfolioAllocation, CurrencyCode } from '../types/wealth';
import { convertCurrency } from './currency';

export interface TrajectoryPoint {
  year: number;
  label: string;
  baselineNominal: number;
  baselineReal: number;
  scenarioNominal: number;
  scenarioReal: number;
  shuffledNominal: number;
  shuffledReal: number;
}

export interface SimulationResult {
  currentAllocation: PortfolioAllocation;
  shuffledAllocation: PortfolioAllocation;
  trajectory: TrajectoryPoint[];
  finalBaselineNetWorth: number;
  finalScenarioNetWorth: number;
  finalShuffledNetWorth: number;
  scenarioAlphaVsBaselinePct: number;
  shuffledAdvantageVsScenario: number;
  macroDiagnosis: string;
  recommendedShuffleAdvice: string[];
}

export function computePortfolioAllocation(
  holdings: Holding[],
  baseCurrency: CurrencyCode
): PortfolioAllocation {
  let equitiesVal = 0;
  let fixedIncomeVal = 0;
  let goldVal = 0;
  let retirementVal = 0;
  let cashVal = 0;

  holdings.forEach((h) => {
    const val = convertCurrency(h.currentValue, h.currency, baseCurrency);
    switch (h.category) {
      case 'MUTUAL_FUND':
      case 'EQUITY_STOCK':
        equitiesVal += val;
        break;
      case 'FIXED_DEPOSIT':
      case 'RECURRING_DEPOSIT':
      case 'GOVT_BOND':
      case 'CORP_BOND':
        fixedIncomeVal += val;
        break;
      case 'SOVEREIGN_GOLD_BOND':
        goldVal += val;
        break;
      case 'EPF':
      case 'PPF':
      case 'NPS':
        retirementVal += val;
        break;
      case 'SAVINGS_CASH':
      default:
        cashVal += val;
        break;
    }
  });

  const total = equitiesVal + fixedIncomeVal + goldVal + retirementVal + cashVal;
  if (total === 0) {
    return {
      equities: 40,
      fixedIncome: 30,
      goldCommodity: 10,
      retirementPensions: 15,
      liquidCash: 5,
    };
  }

  return {
    equities: Math.round((equitiesVal / total) * 100),
    fixedIncome: Math.round((fixedIncomeVal / total) * 100),
    goldCommodity: Math.round((goldVal / total) * 100),
    retirementPensions: Math.round((retirementVal / total) * 100),
    liquidCash: Math.round((cashVal / total) * 100),
  };
}

export function runMacroSimulation(
  currentTotalNetWorth: number,
  currentAllocation: PortfolioAllocation,
  shuffledAllocation: PortfolioAllocation,
  params: MacroParameters
): SimulationResult {
  const years = params.projectionHorizonYears;
  const trajectory: TrajectoryPoint[] = [];

  // Baseline Annual Expected Returns in steady state
  const baselineRates = {
    equities: 0.125, // 12.5%
    fixedIncome: 0.073, // 7.3%
    gold: 0.090, // 9.0%
    retirement: 0.082, // 8.2% (EPF/PPF blend)
    cash: 0.035, // 3.5%
  };
  const baselineInflation = 0.05; // 5% baseline inflation

  // Macro Adjustments
  // 1. Rate Hike impact on Debt: Bond price drops by (Average Modified Duration * ΔRate)
  // Average bond portfolio duration ~ 3.5 years
  const rateHikeDecimal = params.interestRateHikeBps / 10000; // e.g. 150 bps = 0.015
  const durationDrag = -3.2 * rateHikeDecimal; // immediate capital loss or gain
  const newDebtYield = Math.max(0.04, baselineRates.fixedIncome + rateHikeDecimal * 0.7);

  // 2. Rate hike on Equity: multiple compression + market shock
  const equityShockFactor = (params.equityMarketShockPct / 100) - (rateHikeDecimal * 2.0);
  const newEquityRate = Math.max(-0.05, baselineRates.equities + equityShockFactor * 0.2);

  // 3. Geopolitical shock on Gold: Gold serves as safe haven
  const goldShockBoost = (params.geopoliticalShockIndex / 10) * 0.08; // up to +8% per year
  const newGoldRate = baselineRates.gold + goldShockBoost + (params.inflationRatePct / 100) * 0.4;

  // 4. Inflation drag
  const scenarioInflation = params.inflationRatePct / 100;

  // Calculate annual blended rates for current allocation
  const calcBlendedRate = (alloc: PortfolioAllocation, isScenario: boolean, yearIdx: number) => {
    const eqWeight = alloc.equities / 100;
    const fiWeight = alloc.fixedIncome / 100;
    const goldWeight = alloc.goldCommodity / 100;
    const retWeight = alloc.retirementPensions / 100;
    const cashWeight = alloc.liquidCash / 100;

    if (!isScenario) {
      return (
        eqWeight * baselineRates.equities +
        fiWeight * baselineRates.fixedIncome +
        goldWeight * baselineRates.gold +
        retWeight * baselineRates.retirement +
        cashWeight * baselineRates.cash
      );
    }

    // Year 1 absorbs the immediate duration/market shock
    const firstYearShock = yearIdx === 1 ? (fiWeight * durationDrag + eqWeight * equityShockFactor) : 0;

    const ongoingYield = (
      eqWeight * newEquityRate +
      fiWeight * newDebtYield +
      goldWeight * newGoldRate +
      retWeight * baselineRates.retirement +
      cashWeight * Math.min(0.045, baselineRates.cash + rateHikeDecimal * 0.3)
    );

    return ongoingYield + firstYearShock;
  };

  let bNominal = currentTotalNetWorth;
  let bReal = currentTotalNetWorth;

  let sNominal = currentTotalNetWorth;
  let sReal = currentTotalNetWorth;

  let shNominal = currentTotalNetWorth;
  let shReal = currentTotalNetWorth;

  const currentYear = 2026;

  trajectory.push({
    year: 0,
    label: `${currentYear}`,
    baselineNominal: Math.round(bNominal),
    baselineReal: Math.round(bReal),
    scenarioNominal: Math.round(sNominal),
    scenarioReal: Math.round(sReal),
    shuffledNominal: Math.round(shNominal),
    shuffledReal: Math.round(shReal),
  });

  for (let y = 1; y <= years; y++) {
    // Baseline compounding
    const bRate = calcBlendedRate(currentAllocation, false, y);
    bNominal *= (1 + bRate);
    bReal = bNominal / Math.pow(1 + baselineInflation, y);

    // Scenario compounding on current portfolio
    const sRate = calcBlendedRate(currentAllocation, true, y);
    sNominal *= (1 + sRate);
    sReal = sNominal / Math.pow(1 + scenarioInflation, y);

    // Scenario compounding on shuffled portfolio
    const shRate = calcBlendedRate(shuffledAllocation, true, y);
    shNominal *= (1 + shRate);
    shReal = shNominal / Math.pow(1 + scenarioInflation, y);

    trajectory.push({
      year: y,
      label: `${currentYear + y}`,
      baselineNominal: Math.round(bNominal),
      baselineReal: Math.round(bReal),
      scenarioNominal: Math.round(sNominal),
      scenarioReal: Math.round(sReal),
      shuffledNominal: Math.round(shNominal),
      shuffledReal: Math.round(shReal),
    });
  }

  const finalBaselineNetWorth = bNominal;
  const finalScenarioNetWorth = sNominal;
  const finalShuffledNetWorth = shNominal;
  const scenarioAlphaVsBaselinePct = ((finalScenarioNetWorth - finalBaselineNetWorth) / finalBaselineNetWorth) * 100;
  const shuffledAdvantageVsScenario = finalShuffledNetWorth - finalScenarioNetWorth;

  // Diagnosis logic
  let macroDiagnosis = 'Under baseline parameters, your portfolio compounds steadily.';
  if (params.inflationRatePct > 7) {
    macroDiagnosis = `High inflation (${params.inflationRatePct}%) will severely erode real purchasing power unless shielded by Sovereign Gold Bonds and inflation-adjusted equities.`;
  } else if (params.interestRateHikeBps > 150) {
    macroDiagnosis = `Aggressive central bank rate hikes (+${params.interestRateHikeBps} bps) trigger mark-to-market bond losses and equity valuation compression. Shortening debt duration is critical.`;
  } else if (params.equityMarketShockPct < -15) {
    macroDiagnosis = `Severe equity drawdown (${params.equityMarketShockPct}%) stresses high-beta holdings. Multi-asset arbitrage and sovereign guaranteed cashflows cushion the shock.`;
  }

  const recommendedShuffleAdvice: string[] = [];
  if (params.interestRateHikeBps > 100) {
    recommendedShuffleAdvice.push('Shift fixed-income allocation towards Floating Rate Bonds (FRSB) or Ultra-Short Term Debt to eliminate bond duration capital losses.');
  }
  if (params.inflationRatePct > 6.5) {
    recommendedShuffleAdvice.push('Increase Gold/SGB allocation by 5%–10% to preserve purchasing power against currency debasement.');
  }
  if (params.geopoliticalShockIndex >= 6) {
    recommendedShuffleAdvice.push('Maintain a higher 10%–12% cash & liquid arbitrage buffer to capitalize on discounted equity tranches during peak volatility.');
  }
  if (params.equityMarketShockPct < -10) {
    recommendedShuffleAdvice.push('Deploy matured RD/FD capital into Balanced Advantage or Flexi-Cap funds via systematic tranche transfers.');
  }

  return {
    currentAllocation,
    shuffledAllocation,
    trajectory,
    finalBaselineNetWorth,
    finalScenarioNetWorth,
    finalShuffledNetWorth,
    scenarioAlphaVsBaselinePct,
    shuffledAdvantageVsScenario,
    macroDiagnosis,
    recommendedShuffleAdvice:
      recommendedShuffleAdvice.length > 0
        ? recommendedShuffleAdvice
        : ['Your current allocation maintains healthy resilience across standard economic cycles.'],
  };
}
