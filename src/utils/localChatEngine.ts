import {
  AssetCategory,
  CurrencyCode,
  Holding,
  MacroParameters,
  PortfolioAllocation,
  TaxTag,
} from '../types/wealth';
import { convertCurrency, formatCurrency, formatPercent } from './currency';
import { isoFromToday, todayIso, withDerivedMaturity } from './maturity';
import { CATEGORY_META, computePortfolioSummaryMetrics } from './portfolioMetrics';
import {
  computeInputBasedShuffle,
  computePortfolioAllocation,
  runMacroSimulation,
} from './simulationEngine';
import {
  computeTaxHarvestingAudit,
  computeTaxSectionAudit,
  detectConcentrationRisks,
} from './taxAndDiversification';
import { parsePortfolioExport } from './backupRestore';
import { importExcelBuffer, importStatement, StatementFormat } from './statementImport';

export type ChatActionKind =
  | { type: 'UNDO_HOLDINGS'; snapshot: Holding[]; label?: string }
  | { type: 'APPLY_IMPORT'; holdings: Holding[]; mode: 'replace' | 'append'; fileName: string; currency?: CurrencyCode }
  | { type: 'EXPORT'; format: 'xlsx' | 'csv' | 'pdf' | 'json' }
  | { type: 'NAVIGATE'; tab: 'story' | 'overview' | 'rebalance' | 'radar' | 'tax' | 'simulator' }
  | { type: 'SET_CURRENCY'; currency: CurrencyCode }
  | { type: 'START_BLANK' }
  | { type: 'RESET_SAMPLE' }
  | { type: 'REBALANCE_HOLDING'; holdingId: string }
  | { type: 'OPEN_EDIT_MODAL'; holding: Holding }
  | { type: 'SUGGEST_PROMPT'; prompt: string };

export interface ChatActionItem {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  action: ChatActionKind;
}

export interface ChatMetricRow {
  label: string;
  value: string;
  tone?: 'emerald' | 'amber' | 'rose' | 'neutral';
}

export interface ChatEngineContext {
  holdings: Holding[];
  baseCurrency: CurrencyCode;
  portfolioMode: 'demo' | 'personal';
  profileName: string;
}

export interface ChatEngineCallbacks {
  onAddHolding: (holding: Holding) => void;
  onUpdateHolding: (holding: Holding) => void;
  onReplaceHoldings: (holdings: Holding[], detectedCurrency?: CurrencyCode) => void;
  onAppendHoldings: (holdings: Holding[]) => void;
  onDeleteHolding: (id: string) => void;
  onSetBaseCurrency: (currency: CurrencyCode) => void;
  onNavigateToTab: (tab: 'story' | 'overview' | 'rebalance' | 'radar' | 'tax' | 'simulator') => void;
  onExportExcel: () => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
  onExportJson: () => void;
}

export interface ChatReplyPayload {
  title?: string;
  text: string;
  metrics?: ChatMetricRow[];
  actions?: ChatActionItem[];
}

function parseNumericToken(rawNum: string, unitRaw?: string): number | null {
  const cleaned = rawNum.replace(/,/g, '').trim();
  const base = parseFloat(cleaned);
  if (!Number.isFinite(base) || base <= 0) return null;
  const unit = (unitRaw ?? '').toLowerCase();
  if (unit === 'cr' || unit === 'crore' || unit === 'crores') return base * 10_000_000;
  if (unit === 'l' || unit === 'lac' || unit === 'lacs' || unit === 'lakh' || unit === 'lakhs') {
    return base * 100_000;
  }
  if (unit === 'm' || unit === 'mn' || unit === 'million') return base * 1_000_000;
  if (unit === 'k' || unit === 'thousand') return base * 1_000;
  return base;
}

interface ExtractedAmounts {
  currency: CurrencyCode;
  amounts: number[];
}

function extractAmounts(input: string, fallbackCurrency: CurrencyCode): ExtractedAmounts {
  let currency = fallbackCurrency;
  if (/\bUSD\b|\$/i.test(input)) currency = 'USD';
  else if (/\bEUR\b|€/i.test(input)) currency = 'EUR';
  else if (/\bINR\b|₹|\bRS\.?\b/i.test(input)) currency = 'INR';

  // Strip rates (e.g. 7.4%) and durations (e.g. 45 days, 5 years, 12 months, YYYY-MM-DD) before scanning money amounts
  const sanitized = input
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
    .replace(/[+-]?\d+(?:\.\d+)?\s*(?:%|bps|bp)\b/gi, ' ')
    .replace(/\b\d+(?:\.\d+)?\s*(?:d|days?|mos?|months?|yrs?|years?)\b/gi, ' ')
    .replace(/\b(?:sec(?:tion)?\s*)?(?:80c|80ccd(?:\(1b\))?|ltcg|stcg|24k|50|n50)\b/gi, ' ');

  const pattern =
    /(?:₹|\$|€|\bINR\b|\bUSD\b|\bEUR\b|\bRs\.?\b)?\s*(\d[\d,]*(?:\.\d+)?)\s*(crores?|cr|lakhs?|lacs?|l|million|mn|m|k)?\b/gi;

  const amounts: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(sanitized)) !== null) {
    const val = parseNumericToken(match[1], match[2]);
    if (val !== null) {
      amounts.push(val);
    }
  }

  return { currency, amounts };
}

function inferCategoryFromText(text: string): { category: AssetCategory; taxTag: TaxTag; defaultRate?: number } {
  const lower = text.toLowerCase();
  if (/\b(fd|fixed deposit)\b/.test(lower)) return { category: 'FIXED_DEPOSIT', taxTag: 'SLAB_INCOME', defaultRate: 7.25 };
  if (/\b(rd|recurring deposit)\b/.test(lower)) return { category: 'RECURRING_DEPOSIT', taxTag: 'SLAB_INCOME', defaultRate: 7.0 };
  if (/\b(sgb|sovereign gold|gold bond|24k gold|gold etf)\b/.test(lower)) return { category: 'SOVEREIGN_GOLD_BOND', taxTag: 'TAX_EXEMPT_EEE', defaultRate: 2.5 };
  if (/\b(g-sec|gsec|govt bond|government bond|t-bill|tbill|treasury|rbi bond)\b/.test(lower)) return { category: 'GOVT_BOND', taxTag: 'SLAB_INCOME', defaultRate: 6.9 };
  if (/\b(corp bond|corporate bond|ncd|debenture)\b/.test(lower)) return { category: 'CORP_BOND', taxTag: 'SLAB_INCOME', defaultRate: 8.6 };
  if (/\b(epf|provident fund|pf)\b/.test(lower)) return { category: 'EPF', taxTag: 'TAX_EXEMPT_EEE', defaultRate: 8.25 };
  if (/\b(ppf)\b/.test(lower)) return { category: 'PPF', taxTag: 'TAX_EXEMPT_EEE', defaultRate: 7.1 };
  if (/\b(nps|national pension)\b/.test(lower)) return { category: 'NPS', taxTag: '80CCD' };
  if (/\b(savings|cash|bank balance|checking|liquid cash)\b/.test(lower)) return { category: 'SAVINGS_CASH', taxTag: 'SLAB_INCOME', defaultRate: 3.5 };
  if (/\b(elss|tax saver)\b/.test(lower)) return { category: 'MUTUAL_FUND', taxTag: '80C' };
  if (/\b(mf|mutual fund|sip|flexi cap|index fund|nifty|liquid fund|arbitrage|gilt)\b/.test(lower)) {
    return { category: 'MUTUAL_FUND', taxTag: 'LTCG_EQUITY' };
  }
  if (/\b(stock|equity|shares?|etf|tcs|reliance|infy|hdfcbank|aapl|apple|nvda|msft|voo|qqq|niftybees)\b/.test(lower)) {
    return { category: 'EQUITY_STOCK', taxTag: 'LTCG_EQUITY' };
  }
  return { category: 'MUTUAL_FUND', taxTag: 'LTCG_EQUITY' };
}

function inferInstitutionFromText(text: string, category: AssetCategory): string {
  const brands: [RegExp, string][] = [
    [/\bhdfc\b/i, 'HDFC Bank'],
    [/\bsbi\b/i, 'State Bank of India'],
    [/\bicici\b/i, 'ICICI Bank'],
    [/\baxis\b/i, 'Axis Bank'],
    [/\bkotak\b/i, 'Kotak Mahindra'],
    [/\bparag parikh|ppfas\b/i, 'PPFAS Mutual Fund'],
    [/\bnippon\b/i, 'Nippon India MF'],
    [/\bmirae\b/i, 'Mirae Asset'],
    [/\bquant\b/i, 'Quant Mutual Fund'],
    [/\bzerodha|kite|coin\b/i, 'Zerodha'],
    [/\bgroww\b/i, 'Groww'],
    [/\bvanguard\b/i, 'Vanguard'],
    [/\bfidelity\b/i, 'Fidelity'],
    [/\brbi\b/i, 'Reserve Bank of India'],
    [/\bepfo\b/i, 'EPFO India'],
    [/\bnps|pfrda\b/i, 'PFRDA NPS Trust'],
  ];
  for (const [rx, label] of brands) {
    if (rx.test(text)) return label;
  }
  switch (category) {
    case 'FIXED_DEPOSIT':
    case 'RECURRING_DEPOSIT':
    case 'SAVINGS_CASH':
      return 'Primary Bank';
    case 'GOVT_BOND':
    case 'SOVEREIGN_GOLD_BOND':
      return 'Sovereign / RBI Direct';
    case 'EPF':
    case 'PPF':
    case 'NPS':
      return 'Retirement Trust';
    default:
      return 'Direct Brokerage / AMC';
  }
}

function deriveCleanHoldingName(rawInput: string, category: AssetCategory): string {
  let cleaned = rawInput
    .replace(/^(?:please\s+)?(?:add|create|log|enter|record|buy|invest(?:\s+in)?|new)\s+(?:a|an|the)?\s*/i, '')
    .replace(/\b(?:worth|of|for|amount|value|invested|current(?:ly)?|now|at|rate|yield|maturing|mature[sd]?|in|over|on)\b[^,.;]*/gi, ' ')
    .replace(/[₹$€]\s*\d[\d,]*(?:\.\d+)?\s*(?:crores?|cr|lakhs?|lacs?|l|million|mn|m|k)?/gi, ' ')
    .replace(/\b\d[\d,]*(?:\.\d+)?\s*(?:crores?|cr|lakhs?|lacs?|l|million|mn|m|k)\b/gi, ' ')
    .replace(/\d+(?:\.\d+)?\s*%/g, ' ')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // If stripping was too aggressive, try taking words before "of / worth / @"
  if (cleaned.length < 3) {
    const preClause = rawInput
      .replace(/^(?:please\s+)?(?:add|create|log|enter|record|buy|invest(?:\s+in)?|new)\s+/i, '')
      .split(/\b(?:of|worth|@|at|invested|maturing|for)\b|[₹$€]/i)[0]
      .trim();
    cleaned = preClause;
  }

  if (cleaned.length < 2) {
    return CATEGORY_META[category]?.label ?? 'Custom Holding';
  }
  return cleaned
    .split(' ')
    .map((w) => (w.length <= 4 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
    .slice(0, 64);
}

function extractMaturityDate(input: string): string | undefined {
  const isoMatch = input.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) return isoMatch[1];

  const daysMatch = input.match(/(?:matur(?:es?|ing)|due|tenure|in)\s*(?:in\s*)?(\d+)\s*(?:d|days?)\b/i);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    if (Number.isFinite(days)) return isoFromToday(days);
  }

  const monthsMatch = input.match(/(?:matur(?:es?|ing)|due|tenure|in)\s*(?:in\s*)?(\d+)\s*(?:mos?|months?)\b/i);
  if (monthsMatch) {
    const months = parseInt(monthsMatch[1], 10);
    if (Number.isFinite(months)) return isoFromToday(months * 30);
  }

  const yearsMatch = input.match(/(?:matur(?:es?|ing)|due|tenure|in)\s*(?:in\s*)?(\d+(?:\.\d+)?)\s*(?:yrs?|years?)\b/i);
  if (yearsMatch) {
    const years = parseFloat(yearsMatch[1]);
    if (Number.isFinite(years)) return isoFromToday(Math.round(years * 365));
  }

  if (/\b(?:already\s+matured|matured)\b/i.test(input)) {
    return isoFromToday(-5);
  }

  return undefined;
}

function parseAddHoldingCommand(input: string, fallbackCurrency: CurrencyCode): Holding | null {
  const { category, taxTag, defaultRate } = inferCategoryFromText(input);
  const { currency, amounts } = extractAmounts(input, fallbackCurrency);

  if (amounts.length === 0) return null;

  // Determine invested vs current value if two amounts were provided
  let investedAmount = amounts[0];
  let currentValue = amounts[0];
  if (amounts.length >= 2) {
    investedAmount = amounts[0];
    currentValue = amounts[1];
  }

  const rateMatch = input.match(/(\d+(?:\.\d+)?)\s*%/);
  const interestRatePct = rateMatch ? parseFloat(rateMatch[1]) : defaultRate;
  const maturityDate = extractMaturityDate(input);
  const name = deriveCleanHoldingName(input, category);
  const institution = inferInstitutionFromText(input, category);

  const gain = Number((currentValue - investedAmount).toFixed(2));
  const gainPct = investedAmount > 0 ? Number(((gain / investedAmount) * 100).toFixed(2)) : 0;

  return withDerivedMaturity<Holding>({
    id: `h-chat-${Date.now()}`,
    name,
    category,
    institution,
    accountNumberMask: `CHT-${Date.now().toString().slice(-4)}`,
    investedAmount,
    currentValue,
    currency,
    interestRatePct,
    purchaseDate: todayIso(),
    maturityDate,
    unrealizedGain: gain,
    unrealizedGainPct: gainPct,
    taxTag,
    notes: 'Added privately via on-device Chat Assistant',
  });
}

const EDIT_STOPWORDS = new Set([
  'edit',
  'update',
  'modify',
  'change',
  'rename',
  'set',
  'adjust',
  'please',
  'holding',
  'entry',
  'investment',
  'value',
  'valuation',
  'amount',
  'invested',
  'current',
  'worth',
  'now',
  'rate',
  'yield',
  'interest',
  'maturity',
  'maturing',
  'to',
  'at',
  'by',
  'as',
  'of',
  'for',
  'in',
  'on',
  'with',
  'my',
  'the',
]);

function findMatchingHoldingsForEdit(input: string, holdings: Holding[]): Holding[] {
  const lower = input.toLowerCase();
  const fullMatches = holdings
    .filter((h) => lower.includes(h.name.toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length);
  if (fullMatches.length > 0) return fullMatches;

  const queryTokens = lower
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !EDIT_STOPWORDS.has(w) && !/^\d+$/.test(w));

  if (queryTokens.length === 0) return [];

  const scored = holdings
    .map((h) => {
      const targetLower = `${h.name} ${h.institution}`.toLowerCase();
      let score = 0;
      for (const tok of queryTokens) {
        if (targetLower.includes(tok)) score += tok.length;
      }
      return { holding: h, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return [];
  const topScore = scored[0].score;
  return scored.filter((item) => item.score === topScore).map((item) => item.holding);
}

function parseAmountInText(fragment: string): number | null {
  const m = fragment.match(
    /(?:₹|\$|€|\bINR\b|\bUSD\b|\bEUR\b|\bRs\.?\b)?\s*(\d[\d,]*(?:\.\d+)?)\s*(crores?|cr|lakhs?|lacs?|l|million|mn|m|k)?\b/i
  );
  if (!m) return null;
  return parseNumericToken(m[1], m[2]);
}

function parseEditHoldingPatch(
  input: string,
  target: Holding
): { updated: Holding; changedLabels: string[] } {
  const changedLabels: string[] = [];
  let investedAmount = target.investedAmount;
  let currentValue = target.currentValue;
  let currency = target.currency;
  let interestRatePct = target.interestRatePct;
  let maturityDate = target.maturityDate;
  let name = target.name;

  if (/\bUSD\b|\$/i.test(input)) currency = 'USD';
  else if (/\bEUR\b|€/i.test(input)) currency = 'EUR';
  else if (/\bINR\b|₹|\bRS\.?\b/i.test(input)) currency = 'INR';
  if (currency !== target.currency) {
    changedLabels.push(`currency → ${currency}`);
  }

  // Extract explicit invested vs current values first
  const investedClause = input.match(
    /\b(?:invested(?:\s+capital|\s+amount)?|cost|principal)\s*(?:to|as|at|=|:)?\s*((?:₹|\$|€|\bINR\b|\bUSD\b|\bEUR\b|\bRs\.?\b)?\s*\d[\d,]*(?:\.\d+)?\s*(?:crores?|cr|lakhs?|lacs?|l|million|mn|m|k)?)/i
  );
  const currentClause = input.match(
    /\b(?:current(?:\s+val(?:ue|uation))?|val(?:ue|uation)|worth|now)\s*(?:to|as|at|=|:)?\s*((?:₹|\$|€|\bINR\b|\bUSD\b|\bEUR\b|\bRs\.?\b)?\s*\d[\d,]*(?:\.\d+)?\s*(?:crores?|cr|lakhs?|lacs?|l|million|mn|m|k)?)/i
  );

  let matchedExplicitInvested = false;
  let matchedExplicitCurrent = false;

  if (investedClause) {
    const val = parseAmountInText(investedClause[1]);
    if (val !== null) {
      investedAmount = val;
      matchedExplicitInvested = true;
      changedLabels.push('invested amount');
    }
  }
  if (currentClause) {
    const val = parseAmountInText(currentClause[1]);
    if (val !== null) {
      currentValue = val;
      matchedExplicitCurrent = true;
      changedLabels.push('current value');
    }
  }

  if (!matchedExplicitInvested && !matchedExplicitCurrent) {
    const { amounts } = extractAmounts(input, currency);
    if (amounts.length >= 2) {
      investedAmount = amounts[0];
      currentValue = amounts[1];
      changedLabels.push('invested & current value');
    } else if (amounts.length === 1) {
      currentValue = amounts[0];
      changedLabels.push('current value');
    }
  }

  const rateMatch = input.match(/(\d+(?:\.\d+)?)\s*%/);
  if (rateMatch) {
    const nextRate = parseFloat(rateMatch[1]);
    if (Number.isFinite(nextRate)) {
      interestRatePct = nextRate;
      changedLabels.push(`rate → ${nextRate}%`);
    }
  }

  if (/\b(?:open[- ]?ended|clear maturity|no maturity|remove maturity)\b/i.test(input)) {
    maturityDate = undefined;
    changedLabels.push('maturity cleared');
  } else {
    const nextMaturity = extractMaturityDate(input);
    if (nextMaturity) {
      maturityDate = nextMaturity;
      changedLabels.push(`maturity → ${nextMaturity}`);
    }
  }

  const renameQuoted = input.match(/\brename\b.*?\bto\s+["']([^"']{2,64})["']/i);
  if (renameQuoted) {
    name = renameQuoted[1].trim();
    changedLabels.push(`name → ${name}`);
  } else if (/^\s*(?:please\s+)?rename\b/i.test(input) && changedLabels.length === 0) {
    const afterTo = input.split(/\bto\b/i).slice(1).join('to').trim();
    if (afterTo.length >= 2) {
      name = afterTo.slice(0, 64);
      changedLabels.push(`name → ${name}`);
    }
  }

  const gain = Number((currentValue - investedAmount).toFixed(2));
  const gainPct = investedAmount > 0 ? Number(((gain / investedAmount) * 100).toFixed(2)) : 0;

  const updated = withDerivedMaturity<Holding>({
    ...target,
    name,
    investedAmount,
    currentValue,
    currency,
    interestRatePct,
    maturityDate,
    daysToMaturity: maturityDate ? target.daysToMaturity : undefined,
    isMatured: maturityDate ? target.isMatured : false,
    unrealizedGain: gain,
    unrealizedGainPct: gainPct,
  });

  return { updated, changedLabels };
}

function parseSimulationParams(input: string): MacroParameters {
  const inflationMatch = input.match(/(\d+(?:\.\d+)?)\s*%\s*inflation|inflation\s*(?:of|at|to)?\s*(\d+(?:\.\d+)?)\s*%?/i);
  const inflationRatePct = inflationMatch
    ? Math.min(20, Math.max(1, parseFloat(inflationMatch[1] ?? inflationMatch[2])))
    : 6.5;

  const bpsMatch = input.match(/([+-]?\d+)\s*bps/i);
  const ratePctMatch = input.match(/rate\s*(?:hike|cut|change)?\s*(?:of|by)?\s*([+-]?\d+(?:\.\d+)?)\s*%/i);
  let interestRateHikeBps = 100;
  if (bpsMatch) {
    interestRateHikeBps = Math.min(500, Math.max(-300, parseInt(bpsMatch[1], 10)));
  } else if (ratePctMatch) {
    interestRateHikeBps = Math.min(500, Math.max(-300, Math.round(parseFloat(ratePctMatch[1]) * 100)));
  } else if (/rate cut|easing/i.test(input)) {
    interestRateHikeBps = -100;
  }

  const eqMatch = input.match(
    /([+-]?\d+(?:\.\d+)?)\s*%\s*(?:equity|market|stock|crash|drawdown|rally)|(?:equity|market|crash|shock)\s*(?:of|by)?\s*([+-]?\d+(?:\.\d+)?)\s*%/i
  );
  let equityMarketShockPct = -10;
  if (eqMatch) {
    equityMarketShockPct = Math.min(30, Math.max(-45, parseFloat(eqMatch[1] ?? eqMatch[2])));
    if (/crash|drop|fall|drawdown/i.test(input) && equityMarketShockPct > 0) {
      equityMarketShockPct = -equityMarketShockPct;
    }
  } else if (/crash|bear/i.test(input)) {
    equityMarketShockPct = -20;
  } else if (/bull|rally/i.test(input)) {
    equityMarketShockPct = 15;
  }

  const geoMatch = input.match(/(?:geo(?:political)?(?:\s*shock|\s*risk)?)\s*(?:of|at)?\s*(\d+(?:\.\d+)?)/i);
  const geopoliticalShockIndex = geoMatch
    ? Math.min(10, Math.max(0, parseFloat(geoMatch[1])))
    : /war|oil|crisis|geopolitical/i.test(input)
    ? 8
    : 4;

  const horizonMatch = input.match(/(\d+)\s*(?:years?|yrs?)\b/i);
  const projectionHorizonYears = horizonMatch
    ? Math.min(10, Math.max(1, parseInt(horizonMatch[1], 10)))
    : 5;

  return {
    inflationRatePct,
    interestRateHikeBps,
    geopoliticalShockIndex,
    equityMarketShockPct,
    projectionHorizonYears,
  };
}

function formatAllocLine(alloc: PortfolioAllocation): string {
  return `Eq ${alloc.equities}% · Debt ${alloc.fixedIncome}% · Gold ${alloc.goldCommodity}% · Ret. ${alloc.retirementPensions}% · Cash ${alloc.liquidCash}%`;
}

function formatFormatLabel(fmt: StatementFormat): string {
  switch (fmt) {
    case 'CAS':
      return 'CAMS / KFintech CAS';
    case 'FD_REGISTRY':
      return 'FD / Bond Registry';
    case 'MF_CENTRAL':
      return 'MF Central Export';
    default:
      return 'Portfolio Spreadsheet';
  }
}

export async function parseFileForChat(
  file: File,
  baseCurrency: CurrencyCode
): Promise<ChatReplyPayload> {
  const lower = file.name.toLowerCase();
  const isExcel = /\.(xlsx|xls|xlsm|xlsb|ods)$/i.test(lower);

  if (isExcel) {
    const buf = await file.arrayBuffer();
    const preview = importExcelBuffer(buf, undefined, baseCurrency);
    if (preview.parsed.holdings.length === 0) {
      return {
        title: `Could not read holdings from ${file.name}`,
        text: 'No recognizable holdings rows were found in that workbook. Try exporting a template from Import or checking column headers (Name, Category, Invested, Value).',
      };
    }
    const totalVal = preview.parsed.holdings.reduce(
      (sum, h) => sum + convertCurrency(h.currentValue, h.currency, baseCurrency),
      0
    );
    return {
      title: `Ready to import ${file.name}`,
      text: `Parsed ${preview.parsed.holdings.length} holdings locally (${formatFormatLabel(preview.parsed.format)}${preview.parsed.sheetName ? ` · Sheet "${preview.parsed.sheetName}"` : ''}). Nothing left your device.`,
      metrics: [
        { label: 'Parsed Holdings', value: `${preview.parsed.holdings.length}`, tone: 'emerald' },
        { label: 'Skipped Rows', value: `${preview.parsed.skipped.length}`, tone: 'neutral' },
        { label: 'Total Value', value: formatCurrency(totalVal, baseCurrency, { compact: true }), tone: 'emerald' },
      ],
      actions: [
        {
          label: 'Replace Portfolio',
          variant: 'primary',
          action: {
            type: 'APPLY_IMPORT',
            holdings: preview.parsed.holdings,
            mode: 'replace',
            fileName: file.name,
          },
        },
        {
          label: 'Append to Current',
          variant: 'secondary',
          action: {
            type: 'APPLY_IMPORT',
            holdings: preview.parsed.holdings,
            mode: 'append',
            fileName: file.name,
          },
        },
      ],
    };
  }

  const text = await file.text();
  if (lower.endsWith('.json')) {
    const parsed = parsePortfolioExport(text);
    const targetCurrency = parsed.baseCurrency ?? baseCurrency;
    const totalVal = parsed.holdings.reduce(
      (sum, h) => sum + convertCurrency(h.currentValue, h.currency, targetCurrency),
      0
    );
    return {
      title: `Ready to restore JSON backup (${file.name})`,
      text: `Validated ${parsed.holdings.length} holdings locally from your portable JSON backup.`,
      metrics: [
        { label: 'Holdings', value: `${parsed.holdings.length}`, tone: 'emerald' },
        { label: 'Base Currency', value: targetCurrency, tone: 'neutral' },
        { label: 'Total Value', value: formatCurrency(totalVal, targetCurrency, { compact: true }), tone: 'emerald' },
      ],
      actions: [
        {
          label: 'Restore & Replace',
          variant: 'primary',
          action: {
            type: 'APPLY_IMPORT',
            holdings: parsed.holdings,
            mode: 'replace',
            fileName: file.name,
            currency: parsed.baseCurrency ?? undefined,
          },
        },
        {
          label: 'Append Holdings',
          variant: 'secondary',
          action: {
            type: 'APPLY_IMPORT',
            holdings: parsed.holdings,
            mode: 'append',
            fileName: file.name,
          },
        },
      ],
    };
  }

  const parsedCsv = importStatement(text, baseCurrency);
  if (parsedCsv.holdings.length === 0) {
    return {
      title: `No holdings found in ${file.name}`,
      text: 'Ensure your CSV/TSV includes columns like Name/Scheme, Invested/Cost, and Current Value.',
    };
  }
  const totalVal = parsedCsv.holdings.reduce(
    (sum, h) => sum + convertCurrency(h.currentValue, h.currency, baseCurrency),
    0
  );
  return {
    title: `Ready to import ${file.name}`,
    text: `Detected ${formatFormatLabel(parsedCsv.format)} and parsed ${parsedCsv.holdings.length} holdings entirely in your browser.`,
    metrics: [
      { label: 'Parsed Holdings', value: `${parsedCsv.holdings.length}`, tone: 'emerald' },
      { label: 'Skipped Rows', value: `${parsedCsv.skipped.length}`, tone: 'neutral' },
      { label: 'Total Value', value: formatCurrency(totalVal, baseCurrency, { compact: true }), tone: 'emerald' },
    ],
    actions: [
      {
        label: 'Replace Portfolio',
        variant: 'primary',
        action: {
          type: 'APPLY_IMPORT',
          holdings: parsedCsv.holdings,
          mode: 'replace',
          fileName: file.name,
        },
      },
      {
        label: 'Append to Current',
        variant: 'secondary',
        action: {
          type: 'APPLY_IMPORT',
          holdings: parsedCsv.holdings,
          mode: 'append',
          fileName: file.name,
        },
      },
    ],
  };
}

export function processLocalChatMessage(
  rawMessage: string,
  ctx: ChatEngineContext,
  cb: ChatEngineCallbacks
): ChatReplyPayload {
  const input = rawMessage.trim();
  const lower = input.toLowerCase();
  const { holdings, baseCurrency } = ctx;

  // 1. Multiline CSV / TSV text pasted directly into chat
  const lines = input.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length >= 2 && (input.includes(',') || input.includes('\t'))) {
    try {
      const parsed = importStatement(input, baseCurrency);
      if (parsed.holdings.length > 0) {
        const totalVal = parsed.holdings.reduce(
          (sum, h) => sum + convertCurrency(h.currentValue, h.currency, baseCurrency),
          0
        );
        return {
          title: 'Pasted CSV / Statement Detected',
          text: `Parsed ${parsed.holdings.length} holdings locally (${formatFormatLabel(parsed.format)}). Choose how to apply them:`,
          metrics: [
            { label: 'Parsed Rows', value: `${parsed.holdings.length}`, tone: 'emerald' },
            { label: 'Total Value', value: formatCurrency(totalVal, baseCurrency, { compact: true }), tone: 'emerald' },
          ],
          actions: [
            {
              label: 'Replace Portfolio',
              variant: 'primary',
              action: {
                type: 'APPLY_IMPORT',
                holdings: parsed.holdings,
                mode: 'replace',
                fileName: 'pasted-statement.csv',
              },
            },
            {
              label: 'Append to Current',
              variant: 'secondary',
              action: {
                type: 'APPLY_IMPORT',
                holdings: parsed.holdings,
                mode: 'append',
                fileName: 'pasted-statement.csv',
              },
            },
          ],
        };
      }
    } catch {
      // Fall through to natural-language commands
    }
  }

  // 2. Import trigger
  if (/\b(import|upload|restore|load file|spreadsheet|cas)\b/i.test(lower) && !/\b(demo|sample)\b/i.test(lower)) {
    return {
      title: 'Import Privately via Chat',
      text: 'Drop any Excel (.xlsx/.xls), CSV, CAS, or JSON backup file directly onto this chat window—or click Attach File below. You can also paste CSV rows directly into the message box.',
      actions: [
        {
          label: 'Open Import Modal',
          variant: 'secondary',
          action: { type: 'NAVIGATE', tab: 'overview' },
        },
      ],
    };
  }

  // 3. Export triggers
  if (/\b(export|download|backup|save report|pdf report)\b/i.test(lower)) {
    if (holdings.length === 0) {
      return {
        title: 'Nothing to Export Yet',
        text: 'Your portfolio currently has 0 holdings. Add a holding in chat (e.g., "Add HDFC FD 5L at 7.4%") or import a file first.',
      };
    }
    if (/\b(excel|xlsx|sheet)\b/i.test(lower)) {
      cb.onExportExcel();
      return {
        title: 'Excel Exported (.xlsx)',
        text: `Generated and downloaded your ${holdings.length}-holding Excel workbook locally.`,
        actions: [{ label: 'Also Export PDF', variant: 'secondary', action: { type: 'EXPORT', format: 'pdf' } }],
      };
    }
    if (/\bpdf|report\b/i.test(lower)) {
      cb.onExportPdf();
      return {
        title: 'PDF Wealth Report Downloaded',
        text: `Generated a printable A4 Vestora wealth summary for your ${holdings.length} holdings on-device.`,
        actions: [{ label: 'Also Export Excel', variant: 'secondary', action: { type: 'EXPORT', format: 'xlsx' } }],
      };
    }
    if (/\bcsv\b/i.test(lower)) {
      cb.onExportCsv();
      return {
        title: 'CSV Exported',
        text: `Downloaded ${holdings.length} holdings as CSV.`,
      };
    }
    if (/\bjson|backup\b/i.test(lower)) {
      cb.onExportJson();
      return {
        title: 'JSON Backup Saved',
        text: `Saved a portable JSON backup of ${holdings.length} holdings.`,
      };
    }
    return {
      title: 'Choose Export Format',
      text: `All ${holdings.length} holdings are ready to export directly from your browser:`,
      actions: [
        { label: 'Excel (.xlsx)', variant: 'primary', action: { type: 'EXPORT', format: 'xlsx' } },
        { label: 'PDF Report (.pdf)', variant: 'secondary', action: { type: 'EXPORT', format: 'pdf' } },
        { label: 'CSV (.csv)', variant: 'secondary', action: { type: 'EXPORT', format: 'csv' } },
        { label: 'JSON Backup', variant: 'secondary', action: { type: 'EXPORT', format: 'json' } },
      ],
    };
  }

  // 4. Currency switching
  if (/\b(currency|switch|convert|show|use)\b/i.test(lower) && /\b(usd|inr|eur|\$|₹|€)\b/i.test(lower)) {
    const nextCcy: CurrencyCode = /\busd|\$/i.test(lower) ? 'USD' : /\beur|€/i.test(lower) ? 'EUR' : 'INR';
    cb.onSetBaseCurrency(nextCcy);
    const metrics = computePortfolioSummaryMetrics(holdings, nextCcy);
    return {
      title: `Switched Display Currency to ${nextCcy}`,
      text: `All valuations, charts, and chat readouts are now normalized to ${nextCcy}.`,
      metrics: [
        { label: 'Total Net Worth', value: formatCurrency(metrics.totalValuation, nextCcy, { compact: true }), tone: 'emerald' },
        { label: 'Holdings', value: `${holdings.length}`, tone: 'neutral' },
      ],
    };
  }

  // 5. Clear / Blank / Sample Reset
  if (/\b(clear all|start blank|wipe portfolio|delete all)\b/i.test(lower)) {
    return {
      title: 'Confirm Clear Portfolio',
      text: 'This removes all current holdings from local browser storage so you can start from 0.',
      actions: [
        { label: 'Confirm Start Blank', variant: 'danger', action: { type: 'START_BLANK' } },
        { label: 'Export Backup First', variant: 'secondary', action: { type: 'EXPORT', format: 'json' } },
      ],
    };
  }

  if (/\b(reset|load demo|sample profile|sample portfolio)\b/i.test(lower)) {
    return {
      title: 'Restore Sample Portfolio?',
      text: 'Resetting loads the default multi-asset sample profile so you can test simulations immediately.',
      actions: [
        { label: 'Reset to Sample Profile', variant: 'primary', action: { type: 'RESET_SAMPLE' } },
      ],
    };
  }

  // 6. Delete / Remove specific holding
  if (/^(?:please\s+)?(?:delete|remove|drop)\s+/i.test(lower)) {
    const query = lower.replace(/^(?:please\s+)?(?:delete|remove|drop)\s+(?:holding\s+)?/i, '').trim();
    const matches = holdings.filter((h) => h.name.toLowerCase().includes(query));
    if (matches.length === 0) {
      return {
        title: 'Holding Not Found',
        text: `No active holding matched "${query}". Try asking "List holdings" to see exact names.`,
      };
    }
    if (matches.length === 1) {
      const target = matches[0];
      const snapshot = [...holdings];
      cb.onDeleteHolding(target.id);
      return {
        title: `Removed ${target.name}`,
        text: `Deleted ${target.name} (${formatCurrency(target.currentValue, target.currency)}) from your local ledger.`,
        actions: [
          {
            label: 'Undo Delete',
            variant: 'secondary',
            action: { type: 'UNDO_HOLDINGS', snapshot, label: `Restored ${target.name}` },
          },
        ],
      };
    }
    return {
      title: `Multiple matches for "${query}"`,
      text: `Found ${matches.length} holdings matching "${query}": ${matches.slice(0, 4).map((m) => m.name).join(', ')}. Specify a fuller name to remove one.`,
    };
  }

  // 6b. Edit / Update existing holding
  if (
    /^(?:please\s+)?(?:edit|update|modify|change|rename|set|adjust)\b/i.test(lower) &&
    !/\b(inflation|macro|simulation|stress|shock)\b/i.test(lower)
  ) {
    if (holdings.length === 0) {
      return {
        title: 'No Holdings to Edit',
        text: 'Your portfolio is blank right now. Add a holding first (e.g., "Add HDFC FD 5L at 7.4%") or import a spreadsheet.',
      };
    }

    const matches = findMatchingHoldingsForEdit(input, holdings);
    if (matches.length === 0) {
      const topQuickActions: ChatActionItem[] = holdings.slice(0, 3).map((h) => ({
        label: `Edit ${h.name.slice(0, 18)}`,
        variant: 'secondary',
        action: { type: 'OPEN_EDIT_MODAL', holding: h },
      }));
      return {
        title: 'Select a Holding to Edit',
        text: 'Tell me which holding to update (e.g., "Update HDFC FD value to 6L" or "Edit Parag Parikh invested 3.5L current 4.2L"), or click a holding below to open the edit form:',
        actions: topQuickActions,
      };
    }

    if (matches.length > 1) {
      return {
        title: `Multiple Matches (${matches.length})`,
        text: `Matched: ${matches.slice(0, 4).map((m) => m.name).join(', ')}. Pick one below to open the edit form, or specify a fuller name:`,
        actions: matches.slice(0, 3).map((h) => ({
          label: `Edit ${h.name.slice(0, 20)}`,
          variant: 'primary',
          action: { type: 'OPEN_EDIT_MODAL', holding: h },
        })),
      };
    }

    const target = matches[0];
    const { updated, changedLabels } = parseEditHoldingPatch(input, target);

    if (changedLabels.length === 0) {
      return {
        title: `Edit ${target.name}`,
        text: `Current values are shown below. Click "Open Edit Form" to modify any field, or reply like: "Update ${target.name} value to 6L" or "Set ${target.name} invested 4L current 4.8L at 7.5%".`,
        metrics: [
          { label: 'Invested', value: formatCurrency(target.investedAmount, target.currency), tone: 'neutral' },
          { label: 'Current Value', value: formatCurrency(target.currentValue, target.currency), tone: 'emerald' },
          ...(target.interestRatePct !== undefined
            ? [{ label: 'Rate', value: `${target.interestRatePct}% p.a.`, tone: 'neutral' as const }]
            : []),
        ],
        actions: [
          {
            label: 'Open Edit Form',
            variant: 'primary',
            action: { type: 'OPEN_EDIT_MODAL', holding: target },
          },
        ],
      };
    }

    const snapshot = [...holdings];
    cb.onUpdateHolding(updated);

    return {
      title: `Updated ${updated.name}`,
      text: `Applied changes (${changedLabels.join(', ')}) locally on your device.`,
      metrics: [
        { label: 'Invested', value: formatCurrency(updated.investedAmount, updated.currency), tone: 'neutral' },
        { label: 'Current Value', value: formatCurrency(updated.currentValue, updated.currency), tone: 'emerald' },
        {
          label: 'Net Return',
          value: formatPercent(updated.unrealizedGainPct, 1),
          tone: updated.unrealizedGain >= 0 ? 'emerald' : 'rose',
        },
        ...(updated.interestRatePct !== undefined
          ? [{ label: 'Rate', value: `${updated.interestRatePct}% p.a.`, tone: 'neutral' as const }]
          : []),
      ],
      actions: [
        {
          label: 'Open Edit Form',
          variant: 'primary',
          action: { type: 'OPEN_EDIT_MODAL', holding: updated },
        },
        {
          label: 'View in Overview',
          variant: 'secondary',
          action: { type: 'NAVIGATE', tab: 'overview' },
        },
        {
          label: 'Undo Edit',
          variant: 'secondary',
          action: { type: 'UNDO_HOLDINGS', snapshot, label: `Reverted edit to ${target.name}` },
        },
      ],
    };
  }

  // 7. Add / Entry command
  if (/^(?:please\s+)?(?:add|create|log|enter|record|buy|invest)\b/i.test(lower)) {
    const parsed = parseAddHoldingCommand(input, baseCurrency);
    if (!parsed) {
      return {
        title: 'Specify an Amount to Add Holding',
        text: 'Include an instrument name and amount—for example: "Add HDFC FD of 5L at 7.4% maturing in 45 days" or "Add Parag Parikh MF invested 3L now 3.6L".',
        actions: [
          {
            label: 'Try Sample FD Entry',
            variant: 'primary',
            action: { type: 'SUGGEST_PROMPT', prompt: 'Add HDFC FD of 5L at 7.4% maturing in 45 days' },
          },
          {
            label: 'Try Sample MF Entry',
            variant: 'secondary',
            action: { type: 'SUGGEST_PROMPT', prompt: 'Add Parag Parikh Flexi Cap MF invested 3L now 3.6L' },
          },
        ],
      };
    }

    const snapshot = [...holdings];
    cb.onAddHolding(parsed);

    const catLabel = CATEGORY_META[parsed.category]?.shortLabel ?? parsed.category;
    return {
      title: `Added ${parsed.name}`,
      text: `Saved locally to your ${catLabel} holdings${parsed.maturityDate ? ` · Maturing ${parsed.maturityDate}` : ''}.`,
      metrics: [
        { label: 'Current Value', value: formatCurrency(parsed.currentValue, parsed.currency), tone: 'emerald' },
        { label: 'Category', value: catLabel, tone: 'neutral' },
        ...(parsed.interestRatePct
          ? [{ label: 'Rate / Yield', value: `${parsed.interestRatePct}% p.a.`, tone: 'emerald' as const }]
          : []),
      ],
      actions: [
        {
          label: 'View in Overview',
          variant: 'primary',
          action: { type: 'NAVIGATE', tab: 'overview' },
        },
        {
          label: 'Edit Details',
          variant: 'secondary',
          action: { type: 'OPEN_EDIT_MODAL', holding: parsed },
        },
        {
          label: 'Undo Entry',
          variant: 'secondary',
          action: { type: 'UNDO_HOLDINGS', snapshot, label: `Reverted adding ${parsed.name}` },
        },
      ],
    };
  }

  // 8. Macro Simulation / Stress Test
  if (/\b(simulat|stress|inflation|crash|recession|rate hike|rate cut|shock|scenario|project)\b/i.test(lower)) {
    if (holdings.length === 0) {
      return {
        title: 'Add Holdings Before Simulating',
        text: 'You have 0 holdings right now. Add an asset (e.g., "Add Nifty 50 MF 10L") or load a sample profile to run stress simulations.',
        actions: [{ label: 'Load Sample Profile', variant: 'primary', action: { type: 'RESET_SAMPLE' } }],
      };
    }

    const params = parseSimulationParams(input);
    const totalWorth = holdings.reduce(
      (s, h) => s + convertCurrency(h.currentValue, h.currency, baseCurrency),
      0
    );
    const currentAlloc = computePortfolioAllocation(holdings, baseCurrency);
    const calibrated = computeInputBasedShuffle(params, currentAlloc);
    const sim = runMacroSimulation(totalWorth, currentAlloc, calibrated.allocation, params);

    return {
      title: `${params.projectionHorizonYears}-Year Macro Simulation`,
      text: `${calibrated.rationale} ${sim.macroDiagnosis} Recommended mix: ${formatAllocLine(calibrated.allocation)}.`,
      metrics: [
        {
          label: 'Starting Net Worth',
          value: formatCurrency(totalWorth, baseCurrency, { compact: true }),
          tone: 'neutral',
        },
        {
          label: `Stress Outcome (${params.projectionHorizonYears}Y)`,
          value: formatCurrency(sim.finalScenarioNetWorth, baseCurrency, { compact: true }),
          tone: sim.scenarioAlphaVsBaselinePct >= 0 ? 'emerald' : 'amber',
        },
        {
          label: 'Shuffled Advantage',
          value: `+${formatCurrency(Math.max(0, sim.shuffledAdvantageVsScenario), baseCurrency, { compact: true })}`,
          tone: 'emerald',
        },
        {
          label: 'Inputs',
          value: `${params.inflationRatePct}% inf · ${params.equityMarketShockPct}% eq`,
          tone: 'neutral',
        },
      ],
      actions: [
        {
          label: 'Open Macro Stress Lab',
          variant: 'primary',
          action: { type: 'NAVIGATE', tab: 'simulator' },
        },
        {
          label: 'Open Rebalance Engine',
          variant: 'secondary',
          action: { type: 'NAVIGATE', tab: 'rebalance' },
        },
      ],
    };
  }

  // 9. Maturity / Cash Drag query
  if (/\b(matur|due|expir|radar|idle cash)\b/i.test(lower)) {
    const metrics = computePortfolioSummaryMetrics(holdings, baseCurrency);
    const urgent = [...metrics.maturedHoldings, ...metrics.maturingSoonHoldings];
    if (urgent.length === 0) {
      return {
        title: 'No Immediate Maturities (≤30d)',
        text: 'None of your holdings have matured or expire within the next 30 days.',
        actions: [{ label: 'Open Maturity Radar', variant: 'secondary', action: { type: 'NAVIGATE', tab: 'radar' } }],
      };
    }

    const previewNames = urgent
      .slice(0, 3)
      .map((h) => `${h.name} (${formatCurrency(h.currentValue, h.currency, { compact: true })})`)
      .join(', ');

    const firstTarget = urgent[0];
    return {
      title: `${urgent.length} Matured / Maturing Holdings`,
      text: `Priority items: ${previewNames}. Moving idle or matured capital early avoids savings-rate drag.`,
      metrics: [
        {
          label: 'Matured Now',
          value: `${metrics.maturedHoldings.length} (${formatCurrency(metrics.totalMaturedAmount, baseCurrency, { compact: true })})`,
          tone: metrics.maturedHoldings.length > 0 ? 'amber' : 'neutral',
        },
        {
          label: 'Due ≤ 30 Days',
          value: `${metrics.maturingSoonHoldings.length}`,
          tone: 'amber',
        },
      ],
      actions: [
        { label: 'Open Maturity Radar', variant: 'primary', action: { type: 'NAVIGATE', tab: 'radar' } },
        ...(firstTarget
          ? [
              {
                label: `Rebalance ${firstTarget.name.slice(0, 18)}`,
                variant: 'secondary' as const,
                action: { type: 'REBALANCE_HOLDING' as const, holdingId: firstTarget.id },
              },
            ]
          : []),
      ],
    };
  }

  // 10. Tax & Concentration query
  if (/\b(tax|80c|80ccd|nps|ltcg|harvest|concentrat|audit)\b/i.test(lower)) {
    const harvest = computeTaxHarvestingAudit(holdings, baseCurrency);
    const sec = computeTaxSectionAudit(holdings, baseCurrency);
    const conc = detectConcentrationRisks(holdings, baseCurrency);
    const topConc = conc[0]?.title ?? 'Well-diversified across positions';

    return {
      title: 'On-Device Tax & Risk Audit',
      text: `${harvest.recommendation} Top concentration note: ${topConc}.`,
      metrics: [
        {
          label: 'Harvestable LTCG',
          value: formatCurrency(harvest.harvestableNow, baseCurrency, { compact: true }),
          tone: harvest.harvestableNow > 0 ? 'emerald' : 'neutral',
        },
        {
          label: '80C + 80CCD Gap',
          value: formatCurrency(sec.section80cShortfall + sec.nps80ccdShortfall, baseCurrency, { compact: true }),
          tone: sec.section80cShortfall + sec.nps80ccdShortfall > 0 ? 'amber' : 'emerald',
        },
        {
          label: 'Est. Tax Savings',
          value: formatCurrency(harvest.estimatedTaxSaved + sec.potentialTaxSaved, baseCurrency, { compact: true }),
          tone: 'emerald',
        },
      ],
      actions: [
        { label: 'Open Tax & Insights', variant: 'primary', action: { type: 'NAVIGATE', tab: 'tax' } },
      ],
    };
  }

  // 11. Rebalance / Market navigation
  if (/\b(rebalanc|diversif|home loan|amfi|g-sec|treasury)\b/i.test(lower)) {
    return {
      title: 'Rebalance & Market Explorer',
      text: 'Break partial or full capital from any Savings, FD, Bond, or Equity holding and compare live AMFI Mutual Funds, NPS Tier-I, GoI G-Secs, U.S. Treasuries, or Home Loan prepayments.',
      actions: [{ label: 'Open Rebalance Engine', variant: 'primary', action: { type: 'NAVIGATE', tab: 'rebalance' } }],
    };
  }

  // 12. Direct Navigation shortcuts
  if (/\b(overview|dashboard)\b/i.test(lower) && lower.split(/\s+/).length <= 4) {
    cb.onNavigateToTab('overview');
    return { title: 'Opened Overview', text: 'Switched to your Portfolio Overview & Ledger.' };
  }
  if (/\b(story|game)\b/i.test(lower) && lower.split(/\s+/).length <= 4) {
    cb.onNavigateToTab('story');
    return { title: 'Opened Interactive Story', text: 'Switched to the Street Story experience.' };
  }

  // 13. List holdings or Summary / Net worth / Default overview
  if (/\b(list|show|holdings|positions)\b/i.test(lower)) {
    if (holdings.length === 0) {
      return {
        title: 'No Active Holdings',
        text: 'Your portfolio is blank. Type "Add HDFC FD 5L at 7.4%" or attach an Excel/CSV statement.',
      };
    }
    const top5 = [...holdings]
      .sort(
        (a, b) =>
          convertCurrency(b.currentValue, b.currency, baseCurrency) -
          convertCurrency(a.currentValue, a.currency, baseCurrency)
      )
      .slice(0, 5);
    return {
      title: `Top ${top5.length} of ${holdings.length} Holdings (${baseCurrency})`,
      text: top5
        .map(
          (h, i) =>
            `${i + 1}. ${h.name} — ${formatCurrency(h.currentValue, h.currency, { compact: true })} (${formatPercent(h.unrealizedGainPct, 1)})`
        )
        .join('\n'),
      actions: [{ label: 'Open Full Ledger', variant: 'primary', action: { type: 'NAVIGATE', tab: 'overview' } }],
    };
  }

  if (/\b(summary|net worth|portfolio|status|how|risk|help|what can you do)\b/i.test(lower) || holdings.length > 0) {
    if (/\b(help|what can you do|commands)\b/i.test(lower)) {
      return {
        title: 'What You Can Do Here (100% On-Device)',
        text: [
          '• Entry: "Add HDFC FD 5L at 7.4% maturing in 45 days" or "Remove HDFC FD"',
          '• Edit: "Update HDFC FD value to 6L" or "Edit Parag Parikh invested 3.5L current 4.2L"',
          '• Simulate: "Simulate 8% inflation and -20% crash over 5 years"',
          '• Import: Attach any .xlsx, .csv, CAS, or .json file—or paste CSV rows',
          '• Export: "Export PDF report" or "Export Excel"',
          '• Audit: "Portfolio summary", "Check maturities", or "Tax insights"',
        ].join('\n'),
        actions: [
          { label: 'Portfolio Summary', variant: 'primary', action: { type: 'SUGGEST_PROMPT', prompt: 'Portfolio summary' } },
          { label: 'Run 5Y Stress Test', variant: 'secondary', action: { type: 'SUGGEST_PROMPT', prompt: 'Simulate 8% inflation and -15% crash over 5 years' } },
        ],
      };
    }

    if (holdings.length === 0) {
      return {
        title: 'Start Your Private Simulation',
        text: 'You have 0 holdings. Type an entry like "Add HDFC FD 5L at 7.4%", drop an Excel/CSV file here, or load a sample profile.',
        actions: [
          { label: 'Add Sample FD', variant: 'primary', action: { type: 'SUGGEST_PROMPT', prompt: 'Add HDFC FD 5L at 7.4% maturing in 45 days' } },
          { label: 'Load Sample Profile', variant: 'secondary', action: { type: 'RESET_SAMPLE' } },
        ],
      };
    }

    const metrics = computePortfolioSummaryMetrics(holdings, baseCurrency);
    return {
      title: `Portfolio Snapshot (${ctx.portfolioMode === 'demo' ? ctx.profileName : 'Personal'})`,
      text: `All calculations run locally in your browser. ${metrics.maturedHoldings.length} matured positions and ${metrics.maturingSoonHoldings.length} due within 30 days.`,
      metrics: [
        { label: 'Net Worth', value: formatCurrency(metrics.totalValuation, baseCurrency, { compact: true }), tone: 'emerald' },
        {
          label: 'Total Gain',
          value: `${metrics.totalGain >= 0 ? '+' : ''}${formatCurrency(metrics.totalGain, baseCurrency, { compact: true })} (${formatPercent(metrics.totalGainPct, 1)})`,
          tone: metrics.totalGain >= 0 ? 'emerald' : 'rose',
        },
        {
          label: 'Risk Score',
          value: `${metrics.riskScore.score}/100 (${metrics.riskScore.posture})`,
          tone: 'neutral',
        },
        {
          label: 'Fixed Yield',
          value: metrics.weightedYieldPct !== null ? `${metrics.weightedYieldPct.toFixed(2)}% p.a.` : 'N/A',
          tone: 'neutral',
        },
      ],
      actions: [
        { label: 'Simulate 5Y Crash', variant: 'secondary', action: { type: 'SUGGEST_PROMPT', prompt: 'Simulate 8% inflation and -15% crash over 5 years' } },
        { label: 'Export PDF', variant: 'secondary', action: { type: 'EXPORT', format: 'pdf' } },
      ],
    };
  }

  return {
    title: 'On-Device Portfolio Assistant',
    text: 'Try asking for a "Portfolio summary", adding an asset ("Add HDFC FD 5L at 7.4%"), running a simulation ("Simulate 8% inflation over 5 years"), attaching an Excel/CSV file, or exporting a PDF/Excel report.',
  };
}
