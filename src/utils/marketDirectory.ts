import { AssetCategory, CurrencyCode, TaxTag } from '../types/wealth';

const MFAPI_SEARCH_URL = 'https://api.mfapi.in/mf/search';
const MFAPI_SCHEME_URL = 'https://api.mfapi.in/mf';
const US_TREASURY_RATES_URL =
  'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/avg_interest_rates?sort=-record_date&page[size]=20';
const INDIA_GSEC_RATES_URL =
  'https://raw.githubusercontent.com/TechfaneTechnologies/risk_free_interest_rate/main/RiskFreeInterestRate.json';
const NPS_DETAILED_URL = 'https://npsnav.in/api/detailed';
const KUVERA_SCHEMES_URL = 'https://api.kuvera.in/mf/api/v4/fund_schemes/list.json';
const GOLD_INR_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=pax-gold&vs_currencies=inr';

export interface MutualFundSearchHit {
  schemeCode: number;
  schemeName: string;
}

export interface MutualFundMarketDetail {
  schemeCode: number;
  schemeName: string;
  fundHouse: string;
  schemeCategory: string;
  schemeType: string;
  latestNav: number;
  navDate: string;
  return30dPct: number | null;
  cagr1yPct: number | null;
  cagr3yPct: number | null;
  annualizedVolatilityPct: number | null;
}

export interface ListedMarketInstrument {
  id: string;
  name: string;
  category: AssetCategory;
  group: 'FD' | 'GOVT_BOND' | 'CORP_BOND' | 'GOLD' | 'STOCK_ETF';
  issuer: string;
  currency: CurrencyCode;
  rateOrYieldPct: number;
  tenureLabel: string;
  tenureDays?: number;
  rating: string;
  liquidity: string;
  taxTag: TaxTag;
  taxSummary: string;
  sourceLabel: string;
  asOf?: string;
}

export interface NpsMarketScheme {
  schemeCode: string;
  schemeName: string;
  pfmName: string;
  assetClass: 'E' | 'C' | 'G';
  nav: number;
  return1yPct: number | null;
  cagr3yPct: number | null;
  cagr5yPct: number | null;
  lastUpdated: string;
}

export interface KuveraFundEntry {
  code: string;
  name: string;
  topCategory: string;
  subCategory: string;
  cagr1y: number | null;
  cagr3y: number | null;
  cagr5y: number | null;
  volatility: number | null;
  date: string;
}

export interface HomeLoanImpactResult {
  prepayApplied: number;
  newPrincipal: number;
  monthlyEmi: number;
  monthsBefore: number;
  monthsAfter: number;
  monthsSaved: number;
  interestBefore: number;
  interestAfter: number;
  interestSaved: number;
  taxFreeReturnPct: number;
  preTaxEquivalent30Pct: number;
}

const mfDetailCache = new Map<number, MutualFundMarketDetail>();
let kuveraCache: KuveraFundEntry[] | null = null;
let npsCache: NpsMarketScheme[] | null = null;
let indiaGsecCache: ListedMarketInstrument[] | null = null;
let goldSpotCache: { inrPer10g: number; inrPerOz: number } | null = null;

function parseDdmmyyyy(dateStr: string): number | null {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [day, month, year] = parts;
  return new Date(year, month - 1, day).getTime();
}

function findHistoricalNav(
  entries: { ts: number; nav: number }[],
  latestTs: number,
  daysBack: number,
  toleranceDays: number
): number | null {
  const targetTs = latestTs - daysBack * 86_400_000;
  const maxDiffMs = toleranceDays * 86_400_000;
  let best: { diff: number; nav: number } | null = null;

  for (const item of entries) {
    const diff = Math.abs(item.ts - targetTs);
    if (diff <= maxDiffMs && (!best || diff < best.diff)) {
      best = { diff, nav: item.nav };
    }
    if (item.ts < targetTs - maxDiffMs) break;
  }
  return best && best.nav > 0 ? best.nav : null;
}

/**
 * Queries the open, keyless AMFI Mutual Fund search API across all ~40,000+ schemes.
 */
export async function searchMarketMutualFunds(
  query: string
): Promise<MutualFundSearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  try {
    const res = await fetch(`${MFAPI_SEARCH_URL}?q=${encodeURIComponent(trimmed)}`);
    if (!res.ok) return [];
    const json = (await res.json()) as MutualFundSearchHit[];
    if (!Array.isArray(json)) return [];

    // Rank Direct Plan - Growth results near the top for faster discovery
    const ranked = [...json].sort((a, b) => {
      const aScore =
        (/direct/i.test(a.schemeName) ? 2 : 0) + (/growth/i.test(a.schemeName) ? 1 : 0);
      const bScore =
        (/direct/i.test(b.schemeName) ? 2 : 0) + (/growth/i.test(b.schemeName) ? 1 : 0);
      return bScore - aScore;
    });
    return ranked.slice(0, 24);
  } catch {
    return [];
  }
}

/**
 * Fetches scheme metadata and historical NAVs from api.mfapi.in and computes
 * trailing 30-day return, 1Y CAGR, and 3Y CAGR right in the browser.
 */
export async function fetchMutualFundDetails(
  schemeCode: number
): Promise<MutualFundMarketDetail | null> {
  const cached = mfDetailCache.get(schemeCode);
  if (cached) return cached;

  try {
    const res = await fetch(`${MFAPI_SCHEME_URL}/${schemeCode}`);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      meta?: {
        fund_house?: string;
        scheme_type?: string;
        scheme_category?: string;
        scheme_code?: number;
        scheme_name?: string;
      };
      data?: { date: string; nav: string }[];
    };

    const rawData = json.data ?? [];
    if (rawData.length === 0) return null;

    const parsed: { ts: number; nav: number; dateStr: string }[] = [];
    for (let i = 0; i < Math.min(rawData.length, 1300); i++) {
      const row = rawData[i];
      const nav = parseFloat(row.nav);
      const ts = parseDdmmyyyy(row.date);
      if (ts !== null && Number.isFinite(nav) && nav > 0) {
        parsed.push({ ts, nav, dateStr: row.date });
      }
    }

    if (parsed.length === 0) return null;

    const latest = parsed[0];
    const nav30d = findHistoricalNav(parsed, latest.ts, 30, 10);
    const nav1y = findHistoricalNav(parsed, latest.ts, 365, 20);
    const nav3y = findHistoricalNav(parsed, latest.ts, 1095, 30);

    // Annualized volatility over up to ~252 recent trading days (parsed is newest -> oldest)
    let annualizedVolatilityPct: number | null = null;
    const sampleWindow = parsed.slice(0, Math.min(252, parsed.length));
    if (sampleWindow.length >= 20) {
      const dailyReturns: number[] = [];
      for (let i = 0; i < sampleWindow.length - 1; i++) {
        const curr = sampleWindow[i].nav;
        const prev = sampleWindow[i + 1].nav;
        if (prev > 0 && curr > 0) {
          dailyReturns.push(Math.log(curr / prev));
        }
      }
      if (dailyReturns.length >= 15) {
        const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
        const variance =
          dailyReturns.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) /
          (dailyReturns.length - 1);
        annualizedVolatilityPct = Number((Math.sqrt(variance * 252) * 100).toFixed(1));
      }
    }

    const detail: MutualFundMarketDetail = {
      schemeCode: json.meta?.scheme_code ?? schemeCode,
      schemeName: json.meta?.scheme_name ?? `Scheme #${schemeCode}`,
      fundHouse: json.meta?.fund_house ?? 'AMFI Registered AMC',
      schemeCategory: json.meta?.scheme_category ?? 'Open-Ended Mutual Fund',
      schemeType: json.meta?.scheme_type ?? 'Open Ended',
      latestNav: latest.nav,
      navDate: latest.dateStr,
      return30dPct: nav30d ? ((latest.nav / nav30d) - 1) * 100 : null,
      cagr1yPct: nav1y ? ((latest.nav / nav1y) - 1) * 100 : null,
      cagr3yPct: nav3y ? (Math.pow(latest.nav / nav3y, 1 / 3) - 1) * 100 : null,
      annualizedVolatilityPct,
    };

    mfDetailCache.set(schemeCode, detail);
    return detail;
  } catch {
    return null;
  }
}

/**
 * Queries the keyless, CORS-open U.S. Treasury Fiscal Data API for latest
 * sovereign Treasury Bills, Notes, Bonds, and TIPS average rates.
 */
export async function fetchLiveUsTreasuryRates(): Promise<ListedMarketInstrument[]> {
  try {
    const res = await fetch(US_TREASURY_RATES_URL);
    if (!res.ok) return [];
    const json = (await res.json()) as {
      data?: Array<{
        record_date: string;
        security_desc: string;
        security_type_desc: string;
        avg_interest_rate_amt: string;
      }>;
    };

    const rows = json.data ?? [];
    if (rows.length === 0) return [];

    const latestDate = rows[0].record_date;
    const latestRows = rows.filter(
      (r) =>
        r.record_date === latestDate &&
        r.security_type_desc === 'Marketable' &&
        /Treasury (Bills|Notes|Bonds|Inflation-Protected|Floating Rate)/i.test(r.security_desc)
    );

    const seen = new Set<string>();
    const instruments: ListedMarketInstrument[] = [];

    latestRows.forEach((r) => {
      if (seen.has(r.security_desc)) return;
      const rate = parseFloat(r.avg_interest_rate_amt);
      if (!Number.isFinite(rate) || rate <= 0) return;
      seen.add(r.security_desc);

      const isBill = /Bills/i.test(r.security_desc);
      const isNote = /Notes/i.test(r.security_desc);
      instruments.push({
        id: `ust-${r.security_desc.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        name: `US ${r.security_desc}`,
        category: 'GOVT_BOND',
        group: 'GOVT_BOND',
        issuer: 'U.S. Department of the Treasury',
        currency: 'USD',
        rateOrYieldPct: Number(rate.toFixed(2)),
        tenureLabel: isBill ? '3–12 Months' : isNote ? '2–10 Years' : '10–30 Years',
        tenureDays: isBill ? 180 : isNote ? 1095 : 3650,
        rating: 'US Sovereign',
        liquidity: 'High (Secondary Market)',
        taxTag: 'SLAB_INCOME',
        taxSummary: 'Federal taxable; US state-tax exempt',
        sourceLabel: 'Live US Treasury API',
        asOf: latestDate,
      });
    });

    return instruments;
  } catch {
    return [];
  }
}

/**
 * Fetches live Indian Government Security (G-Sec) & Treasury Bill yields
 * sourced from official RBI/FBIL risk-free benchmarks.
 */
export async function fetchLiveIndiaGsecRates(): Promise<ListedMarketInstrument[]> {
  if (indiaGsecCache) return indiaGsecCache;
  try {
    const res = await fetch(INDIA_GSEC_RATES_URL);
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<{
      GovernmentSecurityName?: string;
      Percent?: number;
    }>;
    if (!Array.isArray(rows) || rows.length === 0) return [];

    const instruments: ListedMarketInstrument[] = [];
    rows.forEach((row) => {
      const name = row.GovernmentSecurityName?.trim();
      const rate = Number(row.Percent);
      if (!name || !Number.isFinite(rate) || rate <= 0) return;

      const is91 = /91\s*day/i.test(name);
      const is182 = /182\s*day/i.test(name);
      const is364 = /364\s*day/i.test(name);
      const yearMatch = name.match(/\b(20\d{2})\b/);
      const years = yearMatch ? Math.max(1, Number(yearMatch[1]) - new Date().getFullYear()) : 5;
      const tenureDays = is91 ? 91 : is182 ? 182 : is364 ? 364 : years * 365;
      const tenureLabel = is91
        ? '91 Days'
        : is182
        ? '182 Days'
        : is364
        ? '364 Days'
        : `${years} Years (G-Sec)`;

      instruments.push({
        id: `in-gsec-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        name: `GoI ${name}`,
        category: 'GOVT_BOND',
        group: 'GOVT_BOND',
        issuer: 'Government of India (RBI / CCIL)',
        currency: 'INR',
        rateOrYieldPct: Number(rate.toFixed(2)),
        tenureLabel,
        tenureDays,
        rating: '100% Sovereign',
        liquidity: is91 || is182 || is364 ? 'Zero default risk · T-Bill' : 'RBI Retail Direct / NSE',
        taxTag: is91 || is182 || is364 ? 'SLAB_INCOME' : 'LTCG_EQUITY',
        taxSummary:
          is91 || is182 || is364
            ? 'T-Bill discount taxed at slab'
            : 'Coupon at slab; LTCG 12.5% > 12m',
        sourceLabel: 'Live GoI G-Sec Yield API',
        asOf: 'Live',
      });
    });

    indiaGsecCache = instruments;
    return instruments;
  } catch {
    return [];
  }
}

const VERIFIED_NPS_CODES: Array<{ code: string; assetClass: 'E' | 'C' | 'G' }> = [
  { code: 'SM007001', assetClass: 'E' }, // ICICI Pru E Tier I
  { code: 'SM005001', assetClass: 'E' }, // Kotak E Tier I
  { code: 'SM008001', assetClass: 'E' }, // HDFC E Tier I
  { code: 'SM010001', assetClass: 'E' }, // Aditya Birla E Tier I
  { code: 'SM001003', assetClass: 'E' }, // SBI E Tier I
  { code: 'SM008002', assetClass: 'C' }, // HDFC Corporate Bond C Tier I
  { code: 'SM005002', assetClass: 'C' }, // Kotak Corporate Bond C Tier I
  { code: 'SM007002', assetClass: 'C' }, // ICICI Corporate Bond C Tier I
  { code: 'SM001001', assetClass: 'G' }, // SBI Central Govt G
  { code: 'SM007003', assetClass: 'G' }, // ICICI Govt G Tier I
  { code: 'SM008003', assetClass: 'G' }, // HDFC Govt G Tier I
];

/**
 * Fetches live Tier-I NPS scheme NAVs & 1Y/3Y/5Y CAGRs via open npsnav.in API.
 */
export async function fetchLiveNpsSchemes(): Promise<NpsMarketScheme[]> {
  if (npsCache) return npsCache;
  try {
    const results = await Promise.all(
      VERIFIED_NPS_CODES.map(async ({ code, assetClass }) => {
        try {
          const res = await fetch(`${NPS_DETAILED_URL}/${code}`);
          if (!res.ok) return null;
          const j = (await res.json()) as Record<string, string>;
          const nav = parseFloat(j.NAV);
          if (!Number.isFinite(nav) || nav <= 0) return null;
          const numOrNull = (val?: string) => {
            if (!val) return null;
            const n = parseFloat(val);
            return Number.isFinite(n) ? n : null;
          };
          return {
            schemeCode: j['Scheme Code'] || code,
            schemeName: j['Scheme Name'] || `NPS Scheme ${code}`,
            pfmName: j['PFM Name'] || 'PFRDA Pension Fund',
            assetClass,
            nav,
            return1yPct: numOrNull(j['1Y']),
            cagr3yPct: numOrNull(j['3Y']),
            cagr5yPct: numOrNull(j['5Y']),
            lastUpdated: j['Last Updated'] || 'Latest',
          } satisfies NpsMarketScheme;
        } catch {
          return null;
        }
      })
    );

    const valid = results.filter((x): x is NpsMarketScheme => x !== null);
    if (valid.length > 0) npsCache = valid;
    return valid;
  } catch {
    return [];
  }
}

/**
 * Fetches live 24K Gold price in INR (per 10g & per troy oz) via CoinGecko PAX-Gold INR feed.
 */
export async function fetchLiveGoldInrSpot(): Promise<{ inrPer10g: number; inrPerOz: number } | null> {
  if (goldSpotCache) return goldSpotCache;
  try {
    const res = await fetch(GOLD_INR_URL);
    if (!res.ok) return null;
    const json = (await res.json()) as { 'pax-gold'?: { inr?: number } };
    const inrPerOz = Number(json['pax-gold']?.inr);
    if (!Number.isFinite(inrPerOz) || inrPerOz <= 0) return null;
    const inrPer10g = Math.round((inrPerOz / 31.1034768) * 10);
    goldSpotCache = { inrPer10g, inrPerOz: Math.round(inrPerOz) };
    return goldSpotCache;
  } catch {
    return null;
  }
}

export const KUVERA_SUBCATEGORIES = [
  'Flexi Cap Fund',
  'Index Funds',
  'Large Cap Fund',
  'Mid Cap Fund',
  'Small Cap Fund',
  'ELSS',
  'Arbitrage Fund',
  'Liquid Fund',
  'Corporate Bond Fund',
  'Gilt Fund',
  'Multi Asset Allocation',
] as const;

/**
 * Fetches & indexes Kuvera's open categorized Mutual Fund Direct-Growth tree
 * with pre-computed 1Y/3Y/5Y CAGR & volatility per category.
 */
export async function fetchKuveraCategoryDirectory(): Promise<KuveraFundEntry[]> {
  if (kuveraCache) return kuveraCache;
  try {
    const res = await fetch(KUVERA_SCHEMES_URL);
    if (!res.ok) return [];
    const tree = (await res.json()) as Record<
      string,
      Record<
        string,
        Record<
          string,
          Array<{
            c?: string;
            n?: string;
            v?: number;
            r?: { '1'?: number; '3'?: number; '5'?: number; date?: string };
          }>
        >
      >
    >;

    const entries: KuveraFundEntry[] = [];
    Object.entries(tree).forEach(([topCategory, subMap]) => {
      if (!subMap || typeof subMap !== 'object') return;
      Object.entries(subMap).forEach(([subCategory, amcMap]) => {
        if (!amcMap || typeof amcMap !== 'object') return;
        Object.values(amcMap).forEach((arr) => {
          if (!Array.isArray(arr)) return;
          arr.forEach((item) => {
            if (!item.n || !/growth/i.test(item.n) || /idcw|dividend|bonus/i.test(item.n)) return;
            entries.push({
              code: item.c || item.n,
              name: item.n,
              topCategory,
              subCategory,
              cagr1y: typeof item.r?.['1'] === 'number' ? item.r['1'] : null,
              cagr3y: typeof item.r?.['3'] === 'number' ? item.r['3'] : null,
              cagr5y: typeof item.r?.['5'] === 'number' ? item.r['5'] : null,
              volatility: typeof item.v === 'number' ? item.v : null,
              date: item.r?.date || 'Latest',
            });
          });
        });
      });
    });

    kuveraCache = entries;
    return entries;
  } catch {
    return [];
  }
}

export const LISTED_MARKET_INSTRUMENTS: ListedMarketInstrument[] = [
  // Fixed Deposits
  {
    id: 'fd-sbi-amrit',
    name: 'SBI 444-Day Special Term Deposit',
    category: 'FIXED_DEPOSIT',
    group: 'FD',
    issuer: 'State Bank of India',
    currency: 'INR',
    rateOrYieldPct: 7.25,
    tenureLabel: '444 Days',
    tenureDays: 444,
    rating: 'AAA / DICGC ₹5L',
    liquidity: 'Premature exit allowed',
    taxTag: 'SLAB_INCOME',
    taxSummary: 'Interest taxed at income slab',
    sourceLabel: 'Listed Bank Schedule',
  },
  {
    id: 'fd-hdfc-18m',
    name: 'HDFC Bank 18-Month Fixed Deposit',
    category: 'FIXED_DEPOSIT',
    group: 'FD',
    issuer: 'HDFC Bank',
    currency: 'INR',
    rateOrYieldPct: 7.25,
    tenureLabel: '18 Months',
    tenureDays: 548,
    rating: 'AAA / DICGC ₹5L',
    liquidity: 'Premature exit allowed',
    taxTag: 'SLAB_INCOME',
    taxSummary: 'Interest taxed at income slab',
    sourceLabel: 'Listed Bank Schedule',
  },
  {
    id: 'fd-bajaj-corp',
    name: 'Bajaj Finance 24-Month Corporate FD',
    category: 'FIXED_DEPOSIT',
    group: 'FD',
    issuer: 'Bajaj Finance Ltd',
    currency: 'INR',
    rateOrYieldPct: 8.15,
    tenureLabel: '24 Months',
    tenureDays: 730,
    rating: 'CRISIL AAA/Stable',
    liquidity: '3-month initial lock-in',
    taxTag: 'SLAB_INCOME',
    taxSummary: 'Interest taxed at income slab',
    sourceLabel: 'NBFC Deposit Registry',
  },
  {
    id: 'fd-shriram-36m',
    name: 'Shriram Finance 36-Month Term Deposit',
    category: 'FIXED_DEPOSIT',
    group: 'FD',
    issuer: 'Shriram Finance Ltd',
    currency: 'INR',
    rateOrYieldPct: 8.45,
    tenureLabel: '36 Months',
    tenureDays: 1095,
    rating: 'ICRA AA+/Stable',
    liquidity: '3-month lock-in',
    taxTag: 'SLAB_INCOME',
    taxSummary: 'Interest taxed at income slab',
    sourceLabel: 'NBFC Deposit Registry',
  },
  {
    id: 'fd-us-marcus-12m',
    name: 'High-Yield 12-Month USD Certificate of Deposit',
    category: 'FIXED_DEPOSIT',
    group: 'FD',
    issuer: 'FDIC Insured Bank CD',
    currency: 'USD',
    rateOrYieldPct: 4.55,
    tenureLabel: '12 Months',
    tenureDays: 365,
    rating: 'FDIC $250k Insured',
    liquidity: 'Fixed term (penalty on early exit)',
    taxTag: 'SLAB_INCOME',
    taxSummary: 'Taxed as ordinary interest income',
    sourceLabel: 'US Deposit Market',
  },

  // Government Bonds & T-Bills
  {
    id: 'gb-rbi-frsb',
    name: 'RBI Floating Rate Savings Bond (FRSB)',
    category: 'GOVT_BOND',
    group: 'GOVT_BOND',
    issuer: 'Reserve Bank of India (GoI)',
    currency: 'INR',
    rateOrYieldPct: 8.05,
    tenureLabel: '7 Years',
    tenureDays: 2555,
    rating: '100% Sovereign',
    liquidity: 'Semi-annual coupon payout',
    taxTag: 'SLAB_INCOME',
    taxSummary: 'Half-yearly interest taxed at slab',
    sourceLabel: 'RBI Retail Direct',
  },
  {
    id: 'gb-tbill-182d',
    name: 'GoI 182-Day Sovereign Treasury Bill',
    category: 'GOVT_BOND',
    group: 'GOVT_BOND',
    issuer: 'Government of India (RBI)',
    currency: 'INR',
    rateOrYieldPct: 6.72,
    tenureLabel: '182 Days',
    tenureDays: 182,
    rating: '100% Sovereign',
    liquidity: 'Zero default risk · T-Bill',
    taxTag: 'SLAB_INCOME',
    taxSummary: 'Discount gain taxed at slab',
    sourceLabel: 'RBI Retail Direct',
  },
  {
    id: 'gb-tbill-364d',
    name: 'GoI 364-Day Sovereign Treasury Bill',
    category: 'GOVT_BOND',
    group: 'GOVT_BOND',
    issuer: 'Government of India (RBI)',
    currency: 'INR',
    rateOrYieldPct: 6.84,
    tenureLabel: '364 Days',
    tenureDays: 364,
    rating: '100% Sovereign',
    liquidity: 'Listed on NDS-OM / Exchanges',
    taxTag: 'SLAB_INCOME',
    taxSummary: 'Discount gain taxed at slab',
    sourceLabel: 'RBI Retail Direct',
  },
  {
    id: 'gb-ind-10y',
    name: 'India 10-Year Benchmark G-Sec (2036)',
    category: 'GOVT_BOND',
    group: 'GOVT_BOND',
    issuer: 'Government of India',
    currency: 'INR',
    rateOrYieldPct: 6.88,
    tenureLabel: '10 Years',
    tenureDays: 3650,
    rating: '100% Sovereign',
    liquidity: 'High · Exchange tradable',
    taxTag: 'LTCG_EQUITY',
    taxSummary: 'Coupon at slab; LTCG 12.5% > 12m',
    sourceLabel: 'NSE/BSE G-Sec Market',
  },

  // Corporate Bonds & NCDs
  {
    id: 'cb-rec-54ec',
    name: 'REC / NHAI 54EC Capital Gain Bond',
    category: 'CORP_BOND',
    group: 'CORP_BOND',
    issuer: 'REC Ltd (PSU AAA)',
    currency: 'INR',
    rateOrYieldPct: 5.25,
    tenureLabel: '5 Years',
    tenureDays: 1825,
    rating: 'CRISIL AAA (PSU)',
    liquidity: '5-year statutory lock-in',
    taxTag: 'TAX_EXEMPT_EEE',
    taxSummary: 'Exempts property LTCG up to ₹50L',
    sourceLabel: 'Listed PSU Bond',
  },
  {
    id: 'cb-nabard-2029',
    name: 'NABARD 2029 AAA Taxable Bond',
    category: 'CORP_BOND',
    group: 'CORP_BOND',
    issuer: 'NABARD (GoI Owned)',
    currency: 'INR',
    rateOrYieldPct: 7.72,
    tenureLabel: '3 Years',
    tenureDays: 1095,
    rating: 'CRISIL AAA',
    liquidity: 'Dematerialized · Listed',
    taxTag: 'SLAB_INCOME',
    taxSummary: 'Annual coupon taxed at slab',
    sourceLabel: 'NSE/BSE Debt Segment',
  },
  {
    id: 'cb-ntpc-ncd',
    name: 'NTPC Ltd Senior Secured AAA NCD',
    category: 'CORP_BOND',
    group: 'CORP_BOND',
    issuer: 'NTPC Limited',
    currency: 'INR',
    rateOrYieldPct: 7.85,
    tenureLabel: '4 Years',
    tenureDays: 1460,
    rating: 'CRISIL AAA/Stable',
    liquidity: 'Exchange listed',
    taxTag: 'SLAB_INCOME',
    taxSummary: 'Coupon at slab; LTCG on listed sale',
    sourceLabel: 'NSE/BSE Debt Segment',
  },
  {
    id: 'cb-piramal-aa',
    name: 'L&T Finance Senior Secured Bond',
    category: 'CORP_BOND',
    group: 'CORP_BOND',
    issuer: 'L&T Finance Ltd',
    currency: 'INR',
    rateOrYieldPct: 8.65,
    tenureLabel: '30 Months',
    tenureDays: 912,
    rating: 'CRISIL AAA',
    liquidity: 'Exchange listed',
    taxTag: 'SLAB_INCOME',
    taxSummary: 'Interest taxed at slab',
    sourceLabel: 'Listed Bond Desk',
  },

  // Gold / SGB
  {
    id: 'gold-sgb-secondary',
    name: 'Sovereign Gold Bond (Secondary Tranche)',
    category: 'SOVEREIGN_GOLD_BOND',
    group: 'GOLD',
    issuer: 'Reserve Bank of India',
    currency: 'INR',
    rateOrYieldPct: 10.5,
    tenureLabel: 'Remaining 4–6 Yrs',
    tenureDays: 1825,
    rating: 'Sovereign Gold + 2.5%',
    liquidity: 'NSE/BSE secondary liquidity',
    taxTag: 'TAX_EXEMPT_EEE',
    taxSummary: 'Capital gains tax-free on RBI maturity',
    sourceLabel: 'NSE/BSE Secondary Market',
  },

  // Popular Stocks & ETFs
  {
    id: 'eq-niftybees',
    name: 'Nippon India ETF Nifty 50 BeES (NIFTYBEES)',
    category: 'EQUITY_STOCK',
    group: 'STOCK_ETF',
    issuer: 'NSE Exchange ETF',
    currency: 'INR',
    rateOrYieldPct: 13.2,
    tenureLabel: 'Open-Ended ETF',
    rating: 'Large-Cap Index',
    liquidity: 'Instant NSE/BSE T+1',
    taxTag: 'LTCG_EQUITY',
    taxSummary: 'LTCG 12.5% above ₹1.25L/yr (>12m)',
    sourceLabel: 'NSE Listed ETF',
  },
  {
    id: 'eq-bankbees',
    name: 'Nippon India ETF Bank BeES (BANKBEES)',
    category: 'EQUITY_STOCK',
    group: 'STOCK_ETF',
    issuer: 'NSE Exchange ETF',
    currency: 'INR',
    rateOrYieldPct: 12.8,
    tenureLabel: 'Open-Ended ETF',
    rating: 'Nifty Bank Index',
    liquidity: 'Instant NSE/BSE T+1',
    taxTag: 'LTCG_EQUITY',
    taxSummary: 'LTCG 12.5% above ₹1.25L/yr (>12m)',
    sourceLabel: 'NSE Listed ETF',
  },
  {
    id: 'eq-voo-us',
    name: 'Vanguard S&P 500 ETF (VOO)',
    category: 'EQUITY_STOCK',
    group: 'STOCK_ETF',
    issuer: 'NYSE Arca',
    currency: 'USD',
    rateOrYieldPct: 11.4,
    tenureLabel: 'Open-Ended ETF',
    rating: 'US Large-Cap S&P 500',
    liquidity: 'US Market T+1',
    taxTag: 'LTCG_EQUITY',
    taxSummary: 'Foreign equity LTCG after 24m (India)',
    sourceLabel: 'US Listed ETF',
  },
  {
    id: 'eq-qqq-us',
    name: 'Invesco QQQ Trust (Nasdaq-100 ETF)',
    category: 'EQUITY_STOCK',
    group: 'STOCK_ETF',
    issuer: 'NASDAQ',
    currency: 'USD',
    rateOrYieldPct: 14.5,
    tenureLabel: 'Open-Ended ETF',
    rating: 'US Growth Tech',
    liquidity: 'US Market T+1',
    taxTag: 'LTCG_EQUITY',
    taxSummary: 'Foreign equity LTCG after 24m (India)',
    sourceLabel: 'US Listed ETF',
  },
];

/**
 * Exact month-by-month reducing-balance amortization calculator for Home Loan prepayment.
 * Shows exact interest saved and months shaved off the loan tenure while keeping EMI constant.
 */
export function calculateHomeLoanPrepaymentImpact(
  outstandingPrincipal: number,
  annualRatePct: number,
  remainingMonths: number,
  prepayAmount: number
): HomeLoanImpactResult {
  const principal = Math.max(0, outstandingPrincipal);
  const monthsBefore = Math.max(1, Math.round(remainingMonths));
  const prepayApplied = Math.min(principal, Math.max(0, prepayAmount));
  const newPrincipal = Math.max(0, principal - prepayApplied);
  const r = Math.max(0, annualRatePct) / 12 / 100;

  if (principal <= 0) {
    return {
      prepayApplied: 0,
      newPrincipal: 0,
      monthlyEmi: 0,
      monthsBefore: 0,
      monthsAfter: 0,
      monthsSaved: 0,
      interestBefore: 0,
      interestAfter: 0,
      interestSaved: 0,
      taxFreeReturnPct: annualRatePct,
      preTaxEquivalent30Pct: annualRatePct / 0.7,
    };
  }

  const emi =
    r === 0
      ? principal / monthsBefore
      : (principal * r * Math.pow(1 + r, monthsBefore)) / (Math.pow(1 + r, monthsBefore) - 1);

  const simulatePayoff = (startBal: number) => {
    let bal = startBal;
    let totalInterest = 0;
    let m = 0;
    while (bal > 0.5 && m < 600) {
      const interest = bal * r;
      const principalPaid = Math.min(bal, Math.max(0.01, emi - interest));
      totalInterest += interest;
      bal -= principalPaid;
      m += 1;
    }
    return { months: m, totalInterest };
  };

  const before = simulatePayoff(principal);
  const after = newPrincipal > 0 ? simulatePayoff(newPrincipal) : { months: 0, totalInterest: 0 };

  return {
    prepayApplied,
    newPrincipal,
    monthlyEmi: Math.round(emi),
    monthsBefore: before.months,
    monthsAfter: after.months,
    monthsSaved: Math.max(0, before.months - after.months),
    interestBefore: Math.round(before.totalInterest),
    interestAfter: Math.round(after.totalInterest),
    interestSaved: Math.max(0, Math.round(before.totalInterest - after.totalInterest)),
    taxFreeReturnPct: annualRatePct,
    preTaxEquivalent30Pct: Number((annualRatePct / 0.7).toFixed(2)),
  };
}
