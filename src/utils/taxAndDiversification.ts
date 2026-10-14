import { CurrencyCode, Holding } from '../types/wealth';
import { convertCurrency } from './currency';

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

export function computeTaxHarvestingAudit(
  holdings: Holding[],
  baseCurrency: CurrencyCode
): TaxHarvestingAudit {
  // Check equity funds & stocks for unrealized long-term gains
  let totalEquityLtcg = 0;
  holdings.forEach((h) => {
    if ((h.category === 'MUTUAL_FUND' || h.category === 'EQUITY_STOCK') && h.unrealizedGain > 0) {
      const valInBase = convertCurrency(h.unrealizedGain, h.currency, baseCurrency);
      totalEquityLtcg += valInBase;
    }
  });

  // Thresholds: ₹1,25,000 INR or ~$1,500 USD or ~€1,350 EUR
  const annualExemptionLimit = baseCurrency === 'INR' ? 125000 : baseCurrency === 'USD' ? 1500 : 1350;
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
        ? `You have unrealized equity gains. Selling and immediately rebuying up to ${baseCurrency === 'INR' ? '₹1.25 Lakh' : '$1,500'} before the financial year-end resets your cost basis tax-free!`
        : 'No unrealized long-term capital gains available for tax harvesting at this time.',
  };
}

export function computeTaxSectionAudit(
  holdings: Holding[],
  baseCurrency: CurrencyCode
): TaxSectionAudit {
  // 80C applies to EPF, PPF, ELSS (MUTUAL_FUND with 80C tag)
  let section80cTotal = 0;
  let nps80ccdTotal = 0;

  holdings.forEach((h) => {
    const valInBase = convertCurrency(h.investedAmount, h.currency, baseCurrency);
    if (h.category === 'EPF' || h.category === 'PPF' || h.taxTag === '80C') {
      section80cTotal += valInBase;
    }
    if (h.category === 'NPS' || h.taxTag === '80CCD') {
      nps80ccdTotal += valInBase;
    }
  });

  const section80cLimit = baseCurrency === 'INR' ? 150000 : baseCurrency === 'USD' ? 1800 : 1600;
  const nps80ccdLimit = baseCurrency === 'INR' ? 50000 : baseCurrency === 'USD' ? 600 : 530;

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

export function detectConcentrationRisks(
  holdings: Holding[],
  baseCurrency: CurrencyCode
): ConcentrationRisk[] {
  const risks: ConcentrationRisk[] = [];
  const totalValuation = holdings.reduce(
    (acc, h) => acc + convertCurrency(h.currentValue, h.currency, baseCurrency),
    0
  );

  if (totalValuation === 0) return risks;

  // 1. Single Holding > 20%
  holdings.forEach((h) => {
    const val = convertCurrency(h.currentValue, h.currency, baseCurrency);
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
    const val = convertCurrency(h.currentValue, h.currency, baseCurrency);
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

export function generateAutomatedInsights(
  holdings: Holding[],
  baseCurrency: CurrencyCode
): PortfolioInsight[] {
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
      (acc, h) => acc + convertCurrency(h.currentValue, h.currency, baseCurrency),
      0
    );
    insights.push({
      id: 'ins-matured-urgent',
      type: 'CRITICAL',
      title: `${maturedHoldings.length} Maturing Instrument${maturedHoldings.length > 1 ? 's' : ''} Ready for Reinvestment`,
      description: `${maturedHoldings.map((h) => h.name).join(', ')} has already matured. Keeping these funds idle causes immediate cash drag vs. 7.5% - 10.8% compounding alternatives.`,
      actionableText: 'Review 8 Curated Reinvestment Solutions',
      metric: `${convertCurrency(totalMatured, baseCurrency, baseCurrency).toLocaleString(undefined, { maximumFractionDigits: 0 })} Idle`,
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
  const taxAudit = computeTaxHarvestingAudit(holdings, baseCurrency);
  if (taxAudit.harvestableNow > 0) {
    insights.push({
      id: 'ins-tax-harvesting',
      type: 'OPPORTUNITY',
      title: 'Tax-Gain Harvesting Opportunity Available',
      description: `Harvest up to ${baseCurrency === 'INR' ? '₹1.25 Lakh' : '$1,500'} in LTCG to reset capital gains basis tax-free before March 31st.`,
      actionableText: 'View Tax Optimization Breakdown',
      metric: `Save ~${taxAudit.estimatedTaxSaved.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      tabTarget: 'tax',
    });
  }

  // 3. Tax Section 80C & 80CCD
  const sectionAudit = computeTaxSectionAudit(holdings, baseCurrency);
  if (sectionAudit.nps80ccdShortfall > 0) {
    insights.push({
      id: 'ins-nps-deduction',
      type: 'OPTIMIZATION',
      title: 'Unclaimed Section 80CCD(1B) NPS Tax Benefit',
      description: `You have not maxed out the dedicated ${baseCurrency === 'INR' ? '₹50,000' : '$600'} NPS tax deduction. Investing saves up to 31.2% in direct income tax.`,
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
