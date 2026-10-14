export type CurrencyCode = 'INR' | 'USD' | 'EUR';

export type AssetCategory =
  | 'MUTUAL_FUND'
  | 'EQUITY_STOCK'
  | 'FIXED_DEPOSIT'
  | 'RECURRING_DEPOSIT'
  | 'SOVEREIGN_GOLD_BOND'
  | 'GOVT_BOND'
  | 'CORP_BOND'
  | 'EPF'
  | 'PPF'
  | 'NPS'
  | 'SAVINGS_CASH';

export type RiskProfile = 'GUARANTEED' | 'LOW' | 'MODERATE' | 'HIGH';

export type TaxTag = '80C' | '80CCD' | 'LTCG_EQUITY' | 'STCG' | 'TAX_EXEMPT_EEE' | 'SLAB_INCOME';

export interface Holding {
  id: string;
  name: string;
  category: AssetCategory;
  institution: string;
  accountNumberMask?: string;
  investedAmount: number;
  currentValue: number;
  currency: CurrencyCode;
  interestRatePct?: number; // e.g. 7.4% for FD, 8.25% for EPF
  units?: number;
  navOrPrice?: number;
  purchaseDate: string; // YYYY-MM-DD
  maturityDate?: string; // YYYY-MM-DD (null for perpetual stocks/MF)
  isMatured?: boolean;
  daysToMaturity?: number;
  unrealizedGain: number;
  unrealizedGainPct: number;
  taxTag: TaxTag;
  notes?: string;
}

export interface ReinvestmentSolution {
  id: string;
  solutionName: string;
  riskTier: RiskProfile;
  instrumentType: string;
  expectedAnnualYieldPct: number;
  recommendedAllocationPct: number;
  lockInPeriod: string;
  taxImplication: string;
  liquidity: 'HIGH' | 'MODERATE' | 'LOCKED';
  whyRecommended: string;
  suitability: string;
  actionTag: string;
}

export interface MacroParameters {
  inflationRatePct: number; // e.g. 5.5%
  interestRateHikeBps: number; // e.g. +100 bps
  geopoliticalShockIndex: number; // 0 (Peaceful) to 10 (War/Oil Embargo)
  equityMarketShockPct: number; // -30% to +20%
  projectionHorizonYears: number; // 1 to 10 years
}

export interface PortfolioAllocation {
  equities: number; // percentage
  fixedIncome: number;
  goldCommodity: number;
  retirementPensions: number;
  liquidCash: number;
}

export interface UserProfile {
  id: string;
  name: string;
  personaTitle: string;
  description: string;
  baseCurrency: CurrencyCode;
  riskProfile: RiskProfile;
  holdings: Holding[];
}
