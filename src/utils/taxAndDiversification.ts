import { AssetCategory, Holding } from '../types/wealth';

export interface TaxHarvestingAudit {
  eligibleLtcgGain: number; // in base currency
  annualExemptionLimit: number; // e.g. ₹1,25,000
  harvestableNow: number;
  estimatedTaxSaved: number;
  recommendation: string;
}

export interface TaxSectionAudit {
  section80cTotal: number;
  section80cLimit: number;
  section80cShortfall: number;
  nps80ccdTotal: number;
  nps80ccdLimit: number;
  nps80ccdShortfall: number;
  potentialTaxSaved: number;
}

export interface ConcentrationRisk {
  type: 'INSTRUMENT' | 'ASSET_CLASS' | 'IDLE_CASH';
  title: string;
  percentage: number;
  threshold: number;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  advice: string;
}

export interface PortfolioInsight {
  id: string;
  type: 'CRITICAL' | 'WARNING' | 'OPPORTUNITY' | 'OPTIMIZATION';
  title: string;
  description: string;
  actionableText: string;
  metric?: string;
  tabTarget?: 'radar' | 'tax' | 'simulator' | 'overview';
}

export function computeTaxHarvestingAudit(holdings: Holding[]): TaxHarvestingAudit {
  // Check equity funds & stocks for unrealized long-term gains
  let totalEquityLtcg = 0;
  holdings.forEach((h) => {
    if ((h.category === 'MUTUAL_FUND' || h.category === 'EQUITY_STOCK') && h.unrealizedGain > 0) {
      const valInBase = h.unrealizedGain;
      totalEquityLtcg += valInBase;
    }
  });

  // Statutory exemption cap on long-term equity gains reinvested in the same year.
  const annualExemptionLimit = 125000;
  const harvestableNow = Math.min(totalEquityLtcg, annualExemptionLimit);
  // Estimated 12.5% tax saved on harvested amount
  const estimatedTaxSaved = harvestableNow * 0.125;

  return {
    eligibleLtcgGain: totalEquityLtcg,
    annualExemptionLimit,
    harvestableNow,
    estimatedTaxSaved,
    recommendation:
      totalEquityLtcg > 0
        ? 'You have unrealized equity gains. Selling and immediately rebuying up to ₹1.25 Lakh before the financial year-end resets your cost basis tax-free!'
        : 'No unrealized long-term capital gains available for tax harvesting at this time.',
  };
}

export function computeTaxSectionAudit(holdings: Holding[]): TaxSectionAudit {
  // 80C applies to EPF, PPF, ELSS (MUTUAL_FUND with 80C tag)
  let section80cTotal = 0;
  let nps80ccdTotal = 0;

  holdings.forEach((h) => {
    const valInBase = h.investedAmount;
    if (h.category === 'EPF' || h.category === 'PPF' || h.taxTag === '80C') {
      section80cTotal += valInBase;
    }
    if (h.category === 'NPS' || h.taxTag === '80CCD') {
      nps80ccdTotal += valInBase;
    }
  });

  // Statutory caps for the old regime.
  const section80cLimit = 150000;
  const nps80ccdLimit = 50000;

  const section80cShortfall = Math.max(0, section80cLimit - section80cTotal);
  const nps80ccdShortfall = Math.max(0, nps80ccdLimit - nps80ccdTotal);

  // Assuming ~30% marginal bracket
  const potentialTaxSaved = (section80cShortfall + nps80ccdShortfall) * 0.312;

  return {
    section80cTotal,
    section80cLimit,
    section80cShortfall,
    nps80ccdTotal,
    nps80ccdLimit,
    nps80ccdShortfall,
    potentialTaxSaved,
  };
}

export function detectConcentrationRisks(holdings: Holding[]): ConcentrationRisk[] {
  const risks: ConcentrationRisk[] = [];
  const totalValuation = holdings.reduce(
    (acc, h) => acc + h.currentValue,
    0
  );

  if (totalValuation === 0) return risks;

  // 1. Single Holding > 20%
  holdings.forEach((h) => {
    const val = h.currentValue;
    const pct = (val / totalValuation) * 100;
    if (pct > 22 && h.category !== 'EPF') {
      risks.push({
        type: 'INSTRUMENT',
        title: `High Single-Asset Exposure: ${h.name}`,
        percentage: pct,
        threshold: 20,
        severity: pct > 35 ? 'HIGH' : 'MEDIUM',
        advice: `This single instrument represents ${pct.toFixed(1)}% of your entire net worth. Consider trimming or reallocating to avoid idiosyncratic drawdown risk.`,
      });
    }
  });

  // 2. Asset Class > 45%
  const classValuations: Record<string, number> = {};
  holdings.forEach((h) => {
    const val = h.currentValue;
    classValuations[h.category] = (classValuations[h.category] || 0) + val;
  });

  Object.entries(classValuations).forEach(([cat, val]) => {
    const pct = (val / totalValuation) * 100;
    if (pct > 48) {
      risks.push({
        type: 'ASSET_CLASS',
        title: `Heavy Category Weight in ${cat.replace('_', ' ')}`,
        percentage: pct,
        threshold: 45,
        severity: pct > 60 ? 'HIGH' : 'MEDIUM',
        advice: `${pct.toFixed(1)}% concentrated in ${cat.replace('_', ' ')}. Rebalance towards uncorrelated assets (Gold, Sovereign Bonds) to protect against sector drawdowns.`,
      });
    }
  });

  return risks;
}

export function generateAutomatedInsights(holdings: Holding[]): PortfolioInsight[] {
  const insights: PortfolioInsight[] = [];

  // 1. Check for Matured or Maturing Instruments
  const maturedHoldings = holdings.filter(
    (h) => h.isMatured || (h.daysToMaturity !== undefined && h.daysToMaturity <= 0)
  );
  const imminentHoldings = holdings.filter(
    (h) => !h.isMatured && h.daysToMaturity !== undefined && h.daysToMaturity > 0 && h.daysToMaturity <= 30
  );

  if (maturedHoldings.length > 0) {
    const totalMatured = maturedHoldings.reduce(
      (acc, h) => acc + h.currentValue,
      0
    );
    insights.push({
      id: 'ins-matured-urgent',
      type: 'CRITICAL',
      title: `${maturedHoldings.length} Maturing Instrument${maturedHoldings.length > 1 ? 's' : ''} Ready for Reinvestment`,
      description: `${maturedHoldings.map((h) => h.name).join(', ')} has already matured. Keeping these funds idle causes immediate cash drag vs. 7.5% - 10.8% compounding alternatives.`,
      actionableText: 'Review 8 Curated Reinvestment Solutions',
      metric: `${totalMatured.toLocaleString(undefined, { maximumFractionDigits: 0 })} Idle`,
      tabTarget: 'radar',
    });
  } else if (imminentHoldings.length > 0) {
    insights.push({
      id: 'ins-imminent-maturity',
      type: 'WARNING',
      title: `${imminentHoldings.length} Instrument${imminentHoldings.length > 1 ? 's' : ''} Maturing Within 30 Days`,
      description: `${imminentHoldings[0].name} matures in ${imminentHoldings[0].daysToMaturity} days. Pre-plan your deployment across Guaranteed, Low, or Moderate risk tiers now.`,
      actionableText: 'Prepare Reinvestment Radar',
      metric: `${imminentHoldings[0].daysToMaturity} Days Left`,
      tabTarget: 'radar',
    });
  }

  // 2. Tax Harvesting Opportunity
  const taxAudit = computeTaxHarvestingAudit(holdings);
  if (taxAudit.harvestableNow > 0) {
    insights.push({
      id: 'ins-tax-harvesting',
      type: 'OPPORTUNITY',
      title: 'Tax-Gain Harvesting Opportunity Available',
      description: 'Harvest up to ₹1.25 Lakh in LTCG to reset capital gains basis tax-free before March 31st.',
      actionableText: 'View Tax Optimization Breakdown',
      metric: `Save ~${taxAudit.estimatedTaxSaved.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      tabTarget: 'tax',
    });
  }

  // 3. Tax Section 80C & 80CCD
  const sectionAudit = computeTaxSectionAudit(holdings);
  if (sectionAudit.nps80ccdShortfall > 0) {
    insights.push({
      id: 'ins-nps-deduction',
      type: 'OPTIMIZATION',
      title: 'Unclaimed Section 80CCD(1B) NPS Tax Benefit',
      description: 'You have not maxed out the dedicated ₹50,000 NPS tax deduction. Investing saves up to 31.2% in direct income tax.',
      actionableText: 'Explore NPS Allocation',
      metric: `Save ${Math.round(sectionAudit.nps80ccdShortfall * 0.312).toLocaleString()} Tax`,
      tabTarget: 'tax',
    });
  }

  // 4. Macro Stress Resistance
  insights.push({
    id: 'ins-macro-stress',
    type: 'OPTIMIZATION',
    title: 'Macro Sensitivity Stress Test',
    description: 'Interest rate hikes and inflation shifts will impact bond durations and equity multiples. Simulate and test portfolio shuffle resilience.',
    actionableText: 'Launch Macro Simulator',
    tabTarget: 'simulator',
  });

  return insights;
}

export type RiskPostureLabel = 'No Holdings' | 'Conservative' | 'Moderate' | 'Growth' | 'Aggressive';

export interface PortfolioRiskScore {
  score: number; // 1-100 (0 when empty)
  posture: RiskPostureLabel;
  annualizedVolatilityPct: number;
  equityExposurePct: number;
  topHoldingSharePct: number;
  concentrationHhi: number;
}

const CATEGORY_VOLATILITY_PCT: Record<AssetCategory, number> = {
  EQUITY_STOCK: 24.0,
  MUTUAL_FUND: 15.5,
  SOVEREIGN_GOLD_BOND: 13.0,
  NPS: 10.5,
  CORP_BOND: 6.0,
  GOVT_BOND: 4.5,
  FIXED_DEPOSIT: 1.0,
  RECURRING_DEPOSIT: 1.0,
  EPF: 0.8,
  PPF: 0.8,
  SAVINGS_CASH: 0.5,
};

export function computePortfolioRiskScore(holdings: Holding[]): PortfolioRiskScore {
  if (holdings.length === 0) {
    return {
      score: 0,
      posture: 'No Holdings',
      annualizedVolatilityPct: 0,
      equityExposurePct: 0,
      topHoldingSharePct: 0,
      concentrationHhi: 0,
    };
  }

  const valued = holdings.map((h) => ({
    holding: h,
    val: Math.max(0, h.currentValue),
  }));

  const totalValuation = valued.reduce((sum, item) => sum + item.val, 0);
  if (totalValuation <= 0) {
    return {
      score: 0,
      posture: 'No Holdings',
      annualizedVolatilityPct: 0,
      equityExposurePct: 0,
      topHoldingSharePct: 0,
      concentrationHhi: 0,
    };
  }

  let weightedVolPct = 0;
  let equityExposureVal = 0;
  let hhi = 0;
  let topHoldingShare = 0;

  valued.forEach(({ holding, val }) => {
    const weight = val / totalValuation;
    if (weight <= 0) return;

    hhi += weight * weight;
    if (weight > topHoldingShare) topHoldingShare = weight;

    if (holding.category === 'MUTUAL_FUND' || holding.category === 'EQUITY_STOCK') {
      equityExposureVal += val;
    }

    const baseVol = CATEGORY_VOLATILITY_PCT[holding.category] ?? 5.0;
    const isMarketLinked =
      holding.category === 'EQUITY_STOCK' ||
      holding.category === 'MUTUAL_FUND' ||
      holding.category === 'SOVEREIGN_GOLD_BOND' ||
      holding.category === 'NPS';

    const swingPremium = isMarketLinked
      ? Math.min(3.5, Math.max(0, (Math.abs(holding.unrealizedGainPct) - 20) * 0.08))
      : 0;
    const drawdownPremium =
      holding.unrealizedGainPct < -5
        ? Math.min(2.5, Math.abs(holding.unrealizedGainPct) * 0.1)
        : 0;

    weightedVolPct += weight * (baseVol + swingPremium + drawdownPremium);
  });

  const volScore = (weightedVolPct / 24) * 74 + 6;
  const concentrationPenalty =
    holdings.length <= 1 ? 15 : Math.min(18, Math.max(0, (hhi - 0.14) * 24));

  const score = Math.max(1, Math.min(100, Math.round(volScore + concentrationPenalty)));

  let posture: RiskPostureLabel = 'Conservative';
  if (score >= 75) posture = 'Aggressive';
  else if (score >= 55) posture = 'Growth';
  else if (score >= 30) posture = 'Moderate';

  return {
    score,
    posture,
    annualizedVolatilityPct: Number(weightedVolPct.toFixed(1)),
    equityExposurePct: Math.round((equityExposureVal / totalValuation) * 100),
    topHoldingSharePct: Math.round(topHoldingShare * 100),
    concentrationHhi: Number(hhi.toFixed(2)),
  };
}

export function getHolding30DayGainPct(holding: Holding): number | undefined {
  if (typeof holding.gain30dPct === 'number' && !Number.isNaN(holding.gain30dPct)) {
    return holding.gain30dPct;
  }
  if (holding.purchaseDate) {
    const purchasedMs = Date.parse(holding.purchaseDate);
    if (!Number.isNaN(purchasedMs)) {
      const daysHeld = (Date.now() - purchasedMs) / 86_400_000;
      if (daysHeld >= -1 && daysHeld <= 30) {
        return holding.unrealizedGainPct;
      }
    }
  }
  return undefined;
}
