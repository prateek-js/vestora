import {
  AssetCategory,
  Holding,
  MacroParameters,
  PortfolioAllocation,
  TaxTag,
} from '../types/wealth';
import { formatCurrency, formatPercent } from './currency';
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
  | { type: 'APPLY_IMPORT'; holdings: Holding[]; mode: 'replace' | 'append'; fileName: string }
  | { type: 'EXPORT'; format: 'xlsx' | 'csv' | 'pdf' | 'json' }
  | { type: 'NAVIGATE'; tab: 'overview' | 'rebalance' | 'radar' | 'tax' | 'simulator' }
  | { type: 'START_BLANK' }
  | { type: 'RESET_SAMPLE' }
  | { type: 'REBALANCE_HOLDING'; holdingId: string }
  | { type: 'OPEN_EDIT_MODAL'; holding: Holding }
  | { type: 'OPEN_ADD_MODAL'; draft?: Holding }
  | { type: 'CONFIRM_ADD_HOLDING'; holding: Holding }
  | { type: 'CONFIRM_UPDATE_HOLDING'; updated: Holding; snapshot: Holding[]; summary: string }
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
  portfolioMode: 'demo' | 'personal';
  profileName: string;
}

export interface ChatEngineCallbacks {
  onAddHolding: (holding: Holding) => void;
  onUpdateHolding: (holding: Holding) => void;
  onReplaceHoldings: (holdings: Holding[]) => void;
  onAppendHoldings: (holdings: Holding[]) => void;
  onDeleteHolding: (id: string) => void;
  onNavigateToTab: (tab: 'overview' | 'rebalance' | 'radar' | 'tax' | 'simulator') => void;
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
  if (
    unit === 'l' ||
    unit === 'lk' ||
    unit === 'lks' ||
    unit === 'lac' ||
    unit === 'lacs' ||
    unit === 'lakh' ||
    unit === 'lakhs'
  ) {
    return base * 100_000;
  }
  if (unit === 'm' || unit === 'mn' || unit === 'million') return base * 1_000_000;
  if (unit === 'k' || unit === 'thousand') return base * 1_000;
  return base;
}

interface ExtractedAccountRef {
  mask?: string;
  digits?: string;
  cleanedInput: string;
}

function extractAccountReference(input: string): ExtractedAccountRef {
  // 1. "ending with 1093", "ending in xxxx1093", "ends with 1093", "last 4 digits 1093"
  const endingRx =
    /\b(?:ending\s*(?:with|in)?|ends?\s*(?:with|in)?|last\s*\d*\s*digits?)\s*(?:no\.?|number|#)?\s*[xX*•-]*(\d{3,8})\b/i;
  const endingMatch = input.match(endingRx);
  if (endingMatch) {
    const digits = endingMatch[1];
    return {
      mask: `••••${digits.slice(-4)}`,
      digits,
      cleanedInput: input.replace(endingRx, ' ').replace(/\s+/g, ' ').trim(),
    };
  }

  // 2. "account no 1093", "a/c 1093", "folio #4821", "account xxxx1093"
  const acctRx =
    /\b(a\/c|ac|acct|account|folio|fd|rd|policy|demat)\s*(?:no\.?|number|num|#)?\s*(?:ending\s*(?:with|in)?\s*)?[xX*•-]*(\d{3,8})\b/i;
  const acctMatch = input.match(acctRx);
  if (acctMatch) {
    const label = acctMatch[1];
    const digits = acctMatch[2];
    const replacement = /^(?:a\/c|ac|acct|account|fd|rd)$/i.test(label) ? label : ' ';
    return {
      mask: `••••${digits.slice(-4)}`,
      digits,
      cleanedInput: input.replace(acctRx, replacement).replace(/\s+/g, ' ').trim(),
    };
  }

  // 3. Masked patterns like "xxxx1093", "••••8492", "**1093"
  const maskRx = /(?:x{2,}|•{2,}|\*{2,})[- ]?(\d{3,6})\b/i;
  const maskMatch = input.match(maskRx);
  if (maskMatch) {
    const digits = maskMatch[1];
    return {
      mask: `••••${digits.slice(-4)}`,
      digits,
      cleanedInput: input.replace(maskRx, ' ').replace(/\s+/g, ' ').trim(),
    };
  }

  // 4. "#1093" or "no. 1093"
  const hashRx = /(?:#|\bno\.?\s+)(\d{3,8})\b/i;
  const hashMatch = input.match(hashRx);
  if (hashMatch) {
    const digits = hashMatch[1];
    return {
      mask: `••••${digits.slice(-4)}`,
      digits,
      cleanedInput: input.replace(hashRx, ' ').replace(/\s+/g, ' ').trim(),
    };
  }

  return { cleanedInput: input };
}

interface ExtractedAmounts {
  amounts: number[];
}

function stripNonMoneyNumbers(input: string): string {
  return input
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
    .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, ' ')
    .replace(/\b20\d{2}[-/]\d{2,4}\b/g, ' ')
    .replace(/[+-]?\d+(?:\.\d+)?\s*(?:%|(?:bps|bp)\b)/gi, ' ')
    .replace(/\b\d+(?:\.\d+)?[\s-]*(?:d|days?|mos?|months?|yrs?|years?)\b/gi, ' ')
    .replace(/\b(?:sec(?:tion)?\s*)?(?:80c|80ccd(?:\(1b\))?|ltcg|stcg|24k|401\s*\(?k\)?)\b/gi, ' ')
    .replace(/\b(?:nifty|sensex|s&p|midcap|smallcap|largecap|next|top|bse|nse|tier|series|fy)\s*[-]?\s*\d+\b/gi, ' ')
    .replace(/\b(?:in|by|from|since|until|till)\s+(?:19|20)\d{2}\b/gi, ' ');
}

function extractAmounts(input: string): ExtractedAmounts {
  const { cleanedInput } = extractAccountReference(input);
  const sanitized = stripNonMoneyNumbers(cleanedInput);

  const pattern =
    /(?:₹|\$|€|\bINR\b|\bUSD\b|\bEUR\b|\bRs\.?\b)?\s*(\d[\d,]*(?:\.\d+)?)\s*(crores?|cr|lakhs?|lacs?|lks?|l|million|mn|m|k|thousand)?\b/gi;

  const amounts: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(sanitized)) !== null) {
    const val = parseNumericToken(match[1], match[2]);
    if (val !== null) {
      amounts.push(val);
    }
  }

  return { amounts };
}

function inferCategoryFromText(text: string): { category: AssetCategory; taxTag: TaxTag; defaultRate?: number } {
  const lower = text.toLowerCase();
  if (/\b(fd|fixed deposit|term deposit)\b/.test(lower)) return { category: 'FIXED_DEPOSIT', taxTag: 'SLAB_INCOME', defaultRate: 7.25 };
  if (/\b(rd|recurring deposit)\b/.test(lower)) return { category: 'RECURRING_DEPOSIT', taxTag: 'SLAB_INCOME', defaultRate: 7.0 };
  if (/\b(sgb|sovereign gold|gold bond|24k gold|gold etf)\b/.test(lower)) return { category: 'SOVEREIGN_GOLD_BOND', taxTag: 'TAX_EXEMPT_EEE', defaultRate: 2.5 };
  if (/\b(g-sec|gsec|govt bond|government bond|t-bill|tbill|treasury|rbi bond|frsb)\b/.test(lower)) return { category: 'GOVT_BOND', taxTag: 'SLAB_INCOME', defaultRate: 6.9 };
  if (/\b(corp bond|corporate bond|ncd|debenture)\b/.test(lower)) return { category: 'CORP_BOND', taxTag: 'SLAB_INCOME', defaultRate: 8.6 };
  if (/\b(epf|provident fund|pf)\b/.test(lower)) return { category: 'EPF', taxTag: 'TAX_EXEMPT_EEE', defaultRate: 8.25 };
  if (/\b(ppf)\b/.test(lower)) return { category: 'PPF', taxTag: 'TAX_EXEMPT_EEE', defaultRate: 7.1 };
  if (/\b(nps|national pension|401\s*\(?k\)?|pension)\b/.test(lower)) return { category: 'NPS', taxTag: '80CCD' };
  if (
    /\b(savings?|cash|bank\s*(?:account|a\/c|ac|acct|balance)|salary\s*(?:account|a\/c|ac)|current\s*(?:account|a\/c|ac)|checking|liquid\s*cash)\b/.test(
      lower
    )
  ) {
    return { category: 'SAVINGS_CASH', taxTag: 'SLAB_INCOME', defaultRate: 3.5 };
  }
  if (/\b(elss|tax saver)\b/.test(lower)) return { category: 'MUTUAL_FUND', taxTag: '80C' };
  if (/\b(mf|mutual fund|sip|flexi cap|index fund|nifty|liquid fund|arbitrage|gilt|hybrid|midcap|smallcap|largecap)\b/.test(lower)) {
    return { category: 'MUTUAL_FUND', taxTag: 'LTCG_EQUITY' };
  }
  if (/\b(stock|equity|shares?|etf|tcs|reliance|infy|hdfcbank|aapl|apple|nvda|msft|voo|qqq|s&p|niftybees)\b/.test(lower)) {
    return { category: 'EQUITY_STOCK', taxTag: 'LTCG_EQUITY' };
  }
  if (/\b(account|a\/c|acct|bank)\b/.test(lower)) {
    return { category: 'SAVINGS_CASH', taxTag: 'SLAB_INCOME', defaultRate: 3.5 };
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
    [/\bidfc\b/i, 'IDFC FIRST Bank'],
    [/\bindusind\b/i, 'IndusInd Bank'],
    [/\byes bank\b/i, 'YES Bank'],
    [/\bparag parikh|ppfas\b/i, 'PPFAS Mutual Fund'],
    [/\bnippon\b/i, 'Nippon India MF'],
    [/\bmirae\b/i, 'Mirae Asset'],
    [/\bquant\b/i, 'Quant Mutual Fund'],
    [/\bzerodha|kite|coin\b/i, 'Zerodha'],
    [/\bgroww\b/i, 'Groww'],
    [/\bvanguard\b/i, 'Vanguard'],
    [/\bfidelity\b/i, 'Fidelity'],
    [/\bchase\b/i, 'Chase Bank'],
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

const UPPERCASE_ACRONYMS = new Set([
  'HDFC',
  'SBI',
  'ICICI',
  'IDFC',
  'PPF',
  'EPF',
  'NPS',
  'FD',
  'RD',
  'SGB',
  'MF',
  'ETF',
  'ELSS',
  'NRE',
  'NRO',
  'RBI',
  'US',
  'USA',
  'UK',
  'TCS',
  'ITC',
  'NCD',
  'SIP',
  'INR',
  'S&P',
  'A/C',
  'FRSB',
  'AAA',
]);

function formatTitleWord(word: string): string {
  const upper = word.toUpperCase();
  if (UPPERCASE_ACRONYMS.has(upper)) return upper;
  if (word.includes('-')) {
    return word
      .split('-')
      .map((part) => (part ? formatTitleWord(part) : ''))
      .join('-');
  }
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function deriveCleanHoldingName(cleanedWithoutAccountRef: string, category: AssetCategory): string {
  let cleaned = cleanedWithoutAccountRef
    .replace(
      /^(?:please\s+)?(?:i\s+have|add|create|log|enter|record|buy|bought|invest(?:ed)?(?:\s+in)?|put|deposit(?:ed)?|save|track|new)\s+/i,
      ''
    )
    // Remove maturity clauses without eating unrelated nouns
    .replace(
      /\b(?:matur(?:es?|ing)|matured|due|expir(?:es?|ing)|tenure|lock-?in)\s*(?:in|on|after|of)?\s*(?:\d{4}-\d{2}-\d{2}|\d+(?:\.\d+)?\s*(?:d|days?|mos?|months?|yrs?|years?))\b/gi,
      ' '
    )
    .replace(/\balready\s+matured\b/gi, ' ')
    // Remove rate / yield clauses
    .replace(/\b(?:at|@|with|rate|yield|interest|earning|paying)?\s*\d+(?:\.\d+)?\s*%(?:\s*(?:p\.?a\.?|per\s+annum|interest|yield|rate))?/gi, ' ')
    // Remove explicit amount clauses with units (e.g. "of 8lakh", "invested 3L", "now 3.6L")
    .replace(
      /\b(?:invested(?:\s+capital|\s+amount)?|current(?:\s+val(?:ue|uation))?|worth|amount|value|cost|principal|now|today|of|for|by)?\s*(?:₹|\$|€|\bINR\b|\bUSD\b|\bEUR\b|\bRs\.?\b)?\s*\d[\d,]*(?:\.\d+)?\s*(?:crores?|cr|lakhs?|lacs?|lks?|l|million|mn|m|k|thousand)\b/gi,
      ' '
    )
    // Remove currency-prefixed bare numbers (e.g. "₹50000", "$15,000", "Rs 800000")
    .replace(/(?:₹|\$|€|\bINR\b|\bUSD\b|\bEUR\b|\bRs\.?\b)\s*\d[\d,]*(?:\.\d+)?\b/gi, ' ')
    // Remove labeled bare numbers (e.g. "invested 500000", "worth 80000", "of 50000")
    .replace(
      /\b(?:invested(?:\s+capital|\s+amount)?|current(?:\s+val(?:ue|uation))?|worth|amount|value|cost|principal|now|of|for)\s+\d[\d,]*(?:\.\d+)?\b/gi,
      ' '
    )
    // Remove leading bare number right after verb (e.g. "50000 to nifty 50 index fund"), but keep durations like "2-year"
    .replace(/^\d[\d,]*(?:\.\d+)?(?![\s-]*(?:d|days?|mos?|months?|yrs?|years?)\b)\b\s*/i, ' ')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Trim leading/trailing dangling prepositions, articles, and punctuation
  const leadingFillerRx =
    /^(?:to|into|in|on|for|of|at|@|with|from|my|a|an|the|new|worth|amount|value|balance|currently|now|today|and|&|[-,:;])+\s+/i;
  const trailingFillerRx =
    /\s+(?:to|into|in|on|for|of|at|@|with|from|my|a|an|the|worth|amount|value|currently|now|today|and|&|ending|ends|[-,:;])+$/i;

  for (let i = 0; i < 4; i++) {
    cleaned = cleaned.replace(leadingFillerRx, '').replace(trailingFillerRx, '').trim();
  }
  cleaned = cleaned.replace(/^[-,:;\s]+|[-,:;\s]+$/g, '').trim();

  if (cleaned.length < 2) {
    return CATEGORY_META[category]?.label ?? 'Custom Holding';
  }

  return cleaned
    .split(/\s+/)
    .map((w) => formatTitleWord(w))
    .join(' ')
    .slice(0, 64);
}

function extractMaturityDate(input: string): string | undefined {
  const isoMatch = input.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) return isoMatch[1];

  const daysMatch = input.match(/(?:matur(?:es?|ing)|due|tenure|for|in)\s*(?:in\s*)?(\d+)\s*(?:d|days?)\b/i);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    if (Number.isFinite(days)) return isoFromToday(days);
  }

  const monthsMatch = input.match(/(?:matur(?:es?|ing)|due|tenure|for|in)\s*(?:in\s*)?(\d+)\s*(?:mos?|months?)\b/i);
  if (monthsMatch) {
    const months = parseInt(monthsMatch[1], 10);
    if (Number.isFinite(months)) return isoFromToday(months * 30);
  }

  const yearsMatch = input.match(
    /(?:matur(?:es?|ing)|due|tenure|for|in)\s*(?:in\s*)?(\d+(?:\.\d+)?)\s*(?:yrs?|years?)\b/i
  );
  if (yearsMatch) {
    const years = parseFloat(yearsMatch[1]);
    if (Number.isFinite(years)) return isoFromToday(Math.round(years * 365));
  }

  if (/\b(?:already\s+matured|matured)\b/i.test(input)) {
    return isoFromToday(-5);
  }

  return undefined;
}

interface ParsedAddHoldingResult {
  holding: Holding;
  accountDigits?: string;
}

function parseAddHoldingCommand(input: string): ParsedAddHoldingResult | null {
  const { mask, digits, cleanedInput } = extractAccountReference(input);
  const { category, taxTag, defaultRate } = inferCategoryFromText(cleanedInput);
  const { amounts } = extractAmounts(cleanedInput);

  // Check for explicit invested / current clauses first
  const investedClause = cleanedInput.match(
    /\b(?:invested(?:\s+capital|\s+amount)?|cost|principal|bought(?:\s+for|\s+at)?)\s*(?:of|for|at|=|:)?\s*((?:₹|\$|€|\bINR\b|\bUSD\b|\bEUR\b|\bRs\.?\b)?\s*\d[\d,]*(?:\.\d+)?\s*(?:crores?|cr|lakhs?|lacs?|lks?|l|million|mn|m|k|thousand)?)/i
  );
  const currentClause = cleanedInput.match(
    /\b(?:current(?:\s+val(?:ue|uation))?|val(?:ue|uation)|worth|now|today)\s*(?:is|of|at|=|:)?\s*((?:₹|\$|€|\bINR\b|\bUSD\b|\bEUR\b|\bRs\.?\b)?\s*\d[\d,]*(?:\.\d+)?\s*(?:crores?|cr|lakhs?|lacs?|lks?|l|million|mn|m|k|thousand)?)/i
  );

  let investedAmount: number | null = investedClause ? parseAmountInText(investedClause[1]) : null;
  let currentValue: number | null = currentClause ? parseAmountInText(currentClause[1]) : null;

  if (investedAmount !== null && currentValue === null) {
    currentValue = investedAmount;
  } else if (currentValue !== null && investedAmount === null) {
    investedAmount = currentValue;
  } else if (investedAmount === null && currentValue === null) {
    if (amounts.length === 0) return null;
    if (amounts.length >= 2) {
      investedAmount = amounts[0];
      currentValue = amounts[1];
    } else {
      investedAmount = amounts[0];
      currentValue = amounts[0];
    }
  }

  if (investedAmount === null || currentValue === null) return null;

  const rateMatch = cleanedInput.match(/(\d+(?:\.\d+)?)\s*%/);
  const interestRatePct = rateMatch ? parseFloat(rateMatch[1]) : defaultRate;
  const maturityDate = extractMaturityDate(cleanedInput);
  const name = deriveCleanHoldingName(cleanedInput, category);
  const institution = inferInstitutionFromText(cleanedInput, category);

  const gain = Number((currentValue - investedAmount).toFixed(2));
  const gainPct = investedAmount > 0 ? Number(((gain / investedAmount) * 100).toFixed(2)) : 0;

  const holding = withDerivedMaturity<Holding>({
    id: `h-chat-${Date.now()}`,
    name,
    category,
    institution,
    accountNumberMask: mask ?? `CHT-${Date.now().toString().slice(-4)}`,
    investedAmount,
    currentValue,
    currency: 'INR',
    interestRatePct,
    purchaseDate: todayIso(),
    maturityDate,
    unrealizedGain: gain,
    unrealizedGainPct: gainPct,
    taxTag,
    notes: 'Added privately via on-device Chat Assistant',
  });

  return { holding, accountDigits: digits };
}

const EDIT_STOPWORDS = new Set([
  'edit',
  'update',
  'modify',
  'change',
  'rename',
  'set',
  'adjust',
  'add',
  'deposit',
  'put',
  'top',
  'up',
  'topup',
  'credit',
  'withdraw',
  'deduct',
  'subtract',
  'redeem',
  'remove',
  'delete',
  'drop',
  'please',
  'holding',
  'entry',
  'investment',
  'account',
  'bank',
  'ending',
  'ends',
  'digits',
  'last',
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
  'into',
  'at',
  'by',
  'as',
  'of',
  'for',
  'in',
  'on',
  'with',
  'from',
  'my',
  'the',
  'lakh',
  'lakhs',
  'lac',
  'lacs',
  'crore',
  'crores',
  'thousand',
  'million',
  'inr',
]);

function extractHoldingMaskDigits(holding: Holding): string | null {
  if (!holding.accountNumberMask) return null;
  const digits = holding.accountNumberMask.replace(/\D/g, '');
  return digits.length >= 3 ? digits : null;
}

function findMatchingHoldingsForEdit(input: string, holdings: Holding[]): Holding[] {
  const lower = input.toLowerCase();

  // 1. Check account number / last-4 digits match first (highest precision)
  const { digits: refDigits } = extractAccountReference(input);
  const candidateDigits = new Set<string>();
  if (refDigits) candidateDigits.add(refDigits.slice(-4));
  const standaloneDigits = input.match(/\b\d{4}\b/g);
  if (standaloneDigits) {
    standaloneDigits.forEach((d) => candidateDigits.add(d));
  }

  if (candidateDigits.size > 0) {
    const maskMatches = holdings.filter((h) => {
      const hDigits = extractHoldingMaskDigits(h);
      if (!hDigits) return false;
      for (const d of candidateDigits) {
        if (hDigits.endsWith(d) || hDigits === d) return true;
      }
      return false;
    });
    if (maskMatches.length > 0) return maskMatches;
  }

  // 2. Full holding name substring match
  const fullMatches = holdings
    .filter((h) => lower.includes(h.name.toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length);
  if (fullMatches.length > 0) return fullMatches;

  // 3. Token overlap scoring across name + institution + mask
  const queryTokens = lower
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(
      (w) =>
        w.length >= 2 &&
        !EDIT_STOPWORDS.has(w) &&
        !/^\d+(?:k|l|lk|lks|cr|m|mn|lakh|lakhs|lac|lacs|crore|crores)?$/i.test(w)
    );

  if (queryTokens.length === 0) return [];

  const scored = holdings
    .map((h) => {
      const targetLower = `${h.name} ${h.institution} ${h.accountNumberMask ?? ''}`.toLowerCase();
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
    /(?:₹|\$|€|\bINR\b|\bUSD\b|\bEUR\b|\bRs\.?\b)?\s*(\d[\d,]*(?:\.\d+)?)\s*(crores?|cr|lakhs?|lacs?|lks?|l|million|mn|m|k|thousand)?\b/i
  );
  if (!m) return null;
  return parseNumericToken(m[1], m[2]);
}

function stripTargetIdentifierNumbers(input: string, target: Holding): string {
  let cleaned = extractAccountReference(input).cleanedInput;
  const maskDigits = extractHoldingMaskDigits(target);
  if (maskDigits) {
    const tail = maskDigits.slice(-4);
    cleaned = cleaned.replace(new RegExp(`\\b${tail}\\b`, 'g'), ' ');
    if (maskDigits !== tail) {
      cleaned = cleaned.replace(new RegExp(`\\b${maskDigits}\\b`, 'g'), ' ');
    }
  }
  const nameNums = target.name.match(/\b\d+\b/g);
  if (nameNums) {
    nameNums.forEach((n) => {
      if (n.length <= 4) {
        cleaned = cleaned.replace(new RegExp(`\\b${n}\\b`, 'g'), ' ');
      }
    });
  }
  return cleaned.replace(/\s+/g, ' ').trim();
}

function parseEditHoldingPatch(
  input: string,
  target: Holding
): { updated: Holding; changedLabels: string[] } {
  const changedLabels: string[] = [];
  let investedAmount = target.investedAmount;
  let currentValue = target.currentValue;
  const currency = 'INR';
  let interestRatePct = target.interestRatePct;
  let maturityDate = target.maturityDate;
  let name = target.name;
  let accountNumberMask = target.accountNumberMask;

  const refInfo = extractAccountReference(input);
  const existingMaskDigits = extractHoldingMaskDigits(target);
  if (refInfo.mask && refInfo.digits && (!existingMaskDigits || !existingMaskDigits.endsWith(refInfo.digits.slice(-4)))) {
    // Only treat as an account mask update if user explicitly wrote ending/account/folio/mask with a new number
    if (/\b(change|set|update)\b.*\b(account|a\/c|folio|mask|ending)\b/i.test(input)) {
      accountNumberMask = refInfo.mask;
      changedLabels.push(`ref → ${refInfo.mask}`);
    }
  }

  const scrubbed = stripTargetIdentifierNumbers(input, target);

  // Extract explicit invested vs current values first
  const investedClause = scrubbed.match(
    /\b(?:invested(?:\s+capital|\s+amount)?|cost|principal)\s*(?:to|as|at|=|:)?\s*((?:₹|\$|€|\bINR\b|\bUSD\b|\bEUR\b|\bRs\.?\b)?\s*\d[\d,]*(?:\.\d+)?\s*(?:crores?|cr|lakhs?|lacs?|lks?|l|million|mn|m|k|thousand)?)/i
  );
  const currentClause = scrubbed.match(
    /\b(?:current(?:\s+val(?:ue|uation))?|val(?:ue|uation)|worth|now|balance)\s*(?:to|as|at|=|:)?\s*((?:₹|\$|€|\bINR\b|\bUSD\b|\bEUR\b|\bRs\.?\b)?\s*\d[\d,]*(?:\.\d+)?\s*(?:crores?|cr|lakhs?|lacs?|lks?|l|million|mn|m|k|thousand)?)/i
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
    const { amounts } = extractAmounts(scrubbed);
    if (amounts.length >= 2) {
      investedAmount = amounts[0];
      currentValue = amounts[1];
      changedLabels.push('invested & current value');
    } else if (amounts.length === 1) {
      currentValue = amounts[0];
      changedLabels.push('current value');
    }
  }

  const rateMatch = scrubbed.match(/(\d+(?:\.\d+)?)\s*%/);
  if (rateMatch) {
    const nextRate = parseFloat(rateMatch[1]);
    if (Number.isFinite(nextRate)) {
      interestRatePct = nextRate;
      changedLabels.push(`rate → ${nextRate}%`);
    }
  }

  if (/\b(?:open[- ]?ended|clear maturity|no maturity|remove maturity)\b/i.test(scrubbed)) {
    maturityDate = undefined;
    changedLabels.push('maturity cleared');
  } else {
    const nextMaturity = extractMaturityDate(scrubbed);
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
    accountNumberMask,
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

export async function parseFileForChat(file: File): Promise<ChatReplyPayload> {
  const lower = file.name.toLowerCase();
  const isExcel = /\.(xlsx|xls|xlsm|xlsb|ods)$/i.test(lower);

  if (isExcel) {
    const buf = await file.arrayBuffer();
    const preview = importExcelBuffer(buf);
    if (preview.parsed.holdings.length === 0) {
      return {
        title: `Could not read holdings from ${file.name}`,
        text: 'No recognizable holdings rows were found in that workbook. Try exporting a template from Import or checking column headers (Name, Category, Invested, Value).',
      };
    }
    const totalVal = preview.parsed.holdings.reduce(
      (sum, h) => sum + h.currentValue,
      0
    );
    return {
      title: `Ready to import ${file.name}`,
      text: `Parsed ${preview.parsed.holdings.length} holdings locally (${formatFormatLabel(preview.parsed.format)}${preview.parsed.sheetName ? ` · Sheet "${preview.parsed.sheetName}"` : ''}). Nothing left your device.`,
      metrics: [
        { label: 'Parsed Holdings', value: `${preview.parsed.holdings.length}`, tone: 'emerald' },
        { label: 'Skipped Rows', value: `${preview.parsed.skipped.length}`, tone: 'neutral' },
        { label: 'Total Value', value: formatCurrency(totalVal, { compact: true }), tone: 'emerald' },
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
    const totalVal = parsed.holdings.reduce(
      (sum, h) => sum + h.currentValue,
      0
    );
    return {
      title: `Ready to restore JSON backup (${file.name})`,
      text: `Validated ${parsed.holdings.length} holdings locally from your portable JSON backup.`,
      metrics: [
        { label: 'Holdings', value: `${parsed.holdings.length}`, tone: 'emerald' },
        { label: 'Base Currency', value: 'INR', tone: 'neutral' },
        { label: 'Total Value', value: formatCurrency(totalVal, { compact: true }), tone: 'emerald' },
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

  const parsedCsv = importStatement(text);
  if (parsedCsv.holdings.length === 0) {
    return {
      title: `No holdings found in ${file.name}`,
      text: 'Ensure your CSV/TSV includes columns like Name/Scheme, Invested/Cost, and Current Value.',
    };
  }
  const totalVal = parsedCsv.holdings.reduce(
    (sum, h) => sum + h.currentValue,
    0
  );
  return {
    title: `Ready to import ${file.name}`,
    text: `Detected ${formatFormatLabel(parsedCsv.format)} and parsed ${parsedCsv.holdings.length} holdings entirely in your browser.`,
    metrics: [
      { label: 'Parsed Holdings', value: `${parsedCsv.holdings.length}`, tone: 'emerald' },
      { label: 'Skipped Rows', value: `${parsedCsv.skipped.length}`, tone: 'neutral' },
      { label: 'Total Value', value: formatCurrency(totalVal, { compact: true }), tone: 'emerald' },
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
  const { holdings } = ctx;

  // 1. Multiline CSV / TSV text pasted directly into chat
  const lines = input.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length >= 2 && (input.includes(',') || input.includes('\t'))) {
    try {
      const parsed = importStatement(input);
      if (parsed.holdings.length > 0) {
        const totalVal = parsed.holdings.reduce(
          (sum, h) => sum + h.currentValue,
          0
        );
        return {
          title: 'Pasted CSV / Statement Detected',
          text: `Parsed ${parsed.holdings.length} holdings locally (${formatFormatLabel(parsed.format)}). Choose how to apply them:`,
          metrics: [
            { label: 'Parsed Rows', value: `${parsed.holdings.length}`, tone: 'emerald' },
            { label: 'Total Value', value: formatCurrency(totalVal, { compact: true }), tone: 'emerald' },
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

  // 4. Currency requests. Vestora is INR-only: any switch/set-currency ask —
  // "switch to USD", "make <holding> EUR" — just acknowledges; nothing changes.
  // The gate requires a currency token AND a currency verb AND no digit: every
  // holding-edit command carries an amount ("set X value to ₹6L"), while the
  // currency asks never do ("make X USD"), so edits fall through untouched.
  if (
    /\b(usd|inr|eur|dollar|euro|rupee)|\$|₹|€/i.test(lower) &&
    /\b(currency|switch|convert|show|use|make|set|change|denominate|track)\b/i.test(lower) &&
    !/\d/.test(lower)
  ) {
    return {
      title: 'Currency Is Locked to INR',
      text: 'Vestora tracks holdings in INR.',
      metrics: [
        { label: 'Total Net Worth', value: formatCurrency(holdings.reduce((s, h) => s + h.currentValue, 0)), tone: 'emerald' },
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
    const matches = findMatchingHoldingsForEdit(input, holdings);
    if (matches.length === 0) {
      return {
        title: 'Holding Not Found',
        text: `No active holding matched "${query}". Try asking "List holdings" to see exact names or account numbers.`,
      };
    }
    if (matches.length === 1) {
      const target = matches[0];
      const snapshot = [...holdings];
      cb.onDeleteHolding(target.id);
      return {
        title: `Removed ${target.name}`,
        text: `Deleted ${target.name} (${formatCurrency(target.currentValue)}) from your local ledger.`,
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
      text: `Found ${matches.length} holdings matching "${query}": ${matches.slice(0, 4).map((m) => m.name).join(', ')}. Specify a fuller name or account digits to remove one.`,
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
        text: 'Your portfolio is blank right now. Add a holding via form or type "Add 8 lakh to HDFC bank account ending with 1093".',
        actions: [
          { label: 'Open Add Form', variant: 'primary', action: { type: 'OPEN_ADD_MODAL' } },
        ],
      };
    }

    const matches = findMatchingHoldingsForEdit(input, holdings);
    if (matches.length === 0) {
      const topQuickActions: ChatActionItem[] = holdings.slice(0, 6).map((h) => ({
        label: `Edit ${h.name.slice(0, 20)}`,
        variant: 'secondary',
        action: { type: 'OPEN_EDIT_MODAL', holding: h },
      }));
      return {
        title: 'Select a Holding to Edit',
        text: 'Click any holding below to open the edit form, or type a command like "Update HDFC 1093 value to 10L":',
        actions: topQuickActions,
      };
    }

    if (matches.length > 1) {
      return {
        title: `Multiple Matches (${matches.length})`,
        text: `Matched: ${matches.slice(0, 4).map((m) => m.name).join(', ')}. Pick one below to open the edit form:`,
        actions: matches.slice(0, 4).map((h) => ({
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
        text: `Current values are shown below. Click "Open Edit Form" to modify any field, or reply like: "Update ${target.name} value to 6L".`,
        metrics: [
          { label: 'Invested', value: formatCurrency(target.investedAmount), tone: 'neutral' },
          { label: 'Current Value', value: formatCurrency(target.currentValue), tone: 'emerald' },
          ...(target.accountNumberMask
            ? [{ label: 'Account Ref', value: target.accountNumberMask, tone: 'neutral' as const }]
            : []),
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
        { label: 'Invested', value: formatCurrency(updated.investedAmount), tone: 'neutral' },
        { label: 'Current Value', value: formatCurrency(updated.currentValue), tone: 'emerald' },
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

  // 6c. Withdraw / Deduct from an existing holding
  if (/^(?:please\s+)?(?:withdraw|deduct|subtract|take\s+out|redeem)\b/i.test(lower)) {
    const matches = findMatchingHoldingsForEdit(input, holdings);
    if (matches.length === 1) {
      const target = matches[0];
      const scrubbed = stripTargetIdentifierNumbers(input, target);
      const { amounts } = extractAmounts(scrubbed);
      if (amounts.length > 0) {
        const delta = amounts[0];
        const nextCurrent = Math.max(0, Number((target.currentValue - delta).toFixed(2)));
        const nextInvested = Math.max(0, Number((target.investedAmount - delta).toFixed(2)));
        const gain = Number((nextCurrent - nextInvested).toFixed(2));
        const gainPct = nextInvested > 0 ? Number(((gain / nextInvested) * 100).toFixed(2)) : 0;
        const updated: Holding = {
          ...target,
          investedAmount: nextInvested,
          currentValue: nextCurrent,
          unrealizedGain: gain,
          unrealizedGainPct: gainPct,
        };
        const snapshot = [...holdings];
        return {
          title: `Confirm Withdrawal from ${target.name}`,
          text: `Subtract ${formatCurrency(delta)} from ${target.name}${target.accountNumberMask ? ` (${target.accountNumberMask})` : ''}?`,
          metrics: [
            { label: 'Current Balance', value: formatCurrency(target.currentValue), tone: 'neutral' },
            { label: 'New Balance', value: formatCurrency(nextCurrent), tone: 'amber' },
          ],
          actions: [
            {
              label: `Confirm (-${formatCurrency(delta, { compact: true })})`,
              variant: 'primary',
              action: {
                type: 'CONFIRM_UPDATE_HOLDING',
                updated,
                snapshot,
                summary: `Withdrew ${formatCurrency(delta)} from ${target.name}.`,
              },
            },
            {
              label: 'Edit in Form',
              variant: 'secondary',
              action: { type: 'OPEN_EDIT_MODAL', holding: target },
            },
          ],
        };
      }
    }
  }

  // 7. Add / Deposit / Entry command (with safe 1-click confirmation & top-up detection)
  if (
    /^(?:please\s+)?(?:i\s+have\s+|add|create|log|enter|record|buy|bought|invest(?:ed)?|put|deposit(?:ed)?|top\s*up|credit|save|track)\b/i.test(
      lower
    )
  ) {
    const parsedResult = parseAddHoldingCommand(input);
    if (!parsedResult) {
      return {
        title: 'Add Holding — Form or Plain Text',
        text: 'Include an amount and instrument—for example: "Add 8 lakh to HDFC bank account ending with 1093" or "Add HDFC FD 5L at 7.4% maturing in 45 days"—or open the structured form directly:',
        actions: [
          {
            label: 'Open Add Holding Form',
            variant: 'primary',
            action: { type: 'OPEN_ADD_MODAL' },
          },
          {
            label: 'Try Sample FD Entry',
            variant: 'secondary',
            action: { type: 'SUGGEST_PROMPT', prompt: 'Add HDFC FD of 5L at 7.4% maturing in 45 days' },
          },
        ],
      };
    }

    const { holding: parsed, accountDigits } = parsedResult;
    const catLabel = CATEGORY_META[parsed.category]?.shortLabel ?? parsed.category;

    // Check if the user is topping up an already existing holding (via account digits or "add X to <existing>")
    const existingByDigits = accountDigits
      ? holdings.find((h) => {
          const d = extractHoldingMaskDigits(h);
          return Boolean(d && d.endsWith(accountDigits.slice(-4)));
        })
      : undefined;

    const existingByName =
      !existingByDigits && /\b(?:to|into|top\s*up|credit|deposit)\b/i.test(lower)
        ? (() => {
            const matches = findMatchingHoldingsForEdit(input, holdings);
            if (matches.length !== 1) return undefined;
            const candidate = matches[0];
            // Only treat as top-up if category matches or name strongly overlaps
            return candidate.category === parsed.category ||
              lower.includes(candidate.name.toLowerCase())
              ? candidate
              : undefined;
          })()
        : undefined;

    const matchedExisting = existingByDigits ?? existingByName;
    if (matchedExisting) {
      const addedInTargetCcy = Number(
        parsed.currentValue.toFixed(2)
      );
      const nextInvested = Number((matchedExisting.investedAmount + addedInTargetCcy).toFixed(2));
      const nextCurrent = Number((matchedExisting.currentValue + addedInTargetCcy).toFixed(2));
      const gain = Number((nextCurrent - nextInvested).toFixed(2));
      const gainPct = nextInvested > 0 ? Number(((gain / nextInvested) * 100).toFixed(2)) : 0;
      const toppedUp: Holding = {
        ...matchedExisting,
        investedAmount: nextInvested,
        currentValue: nextCurrent,
        unrealizedGain: gain,
        unrealizedGainPct: gainPct,
      };
      const snapshot = [...holdings];

      return {
        title: `Existing Holding Matched: ${matchedExisting.name}`,
        text: `Found ${matchedExisting.name}${matchedExisting.accountNumberMask ? ` (${matchedExisting.accountNumberMask})` : ''} in your portfolio. Do you want to add ${formatCurrency(addedInTargetCcy)} to it, or create a separate entry?`,
        metrics: [
          {
            label: 'Current Balance',
            value: formatCurrency(matchedExisting.currentValue),
            tone: 'neutral',
          },
          {
            label: 'New Balance',
            value: formatCurrency(nextCurrent),
            tone: 'emerald',
          },
          ...(matchedExisting.accountNumberMask
            ? [{ label: 'Account Ref', value: matchedExisting.accountNumberMask, tone: 'neutral' as const }]
            : []),
          { label: 'Category', value: CATEGORY_META[matchedExisting.category]?.shortLabel ?? matchedExisting.category, tone: 'neutral' },
        ],
        actions: [
          {
            label: `Top Up (+${formatCurrency(addedInTargetCcy, { compact: true })})`,
            variant: 'primary',
            action: {
              type: 'CONFIRM_UPDATE_HOLDING',
              updated: toppedUp,
              snapshot,
              summary: `Added ${formatCurrency(addedInTargetCcy)} to ${matchedExisting.name}. New balance: ${formatCurrency(nextCurrent)}.`,
            },
          },
          {
            label: 'Add as New Entry',
            variant: 'secondary',
            action: { type: 'CONFIRM_ADD_HOLDING', holding: parsed },
          },
          {
            label: 'Edit in Form',
            variant: 'secondary',
            action: { type: 'OPEN_EDIT_MODAL', holding: matchedExisting },
          },
        ],
      };
    }

    // New holding: present a clean 1-click confirmation preview so plain text is always verified before saving
    const previewMetrics: ChatMetricRow[] = [
      { label: 'Instrument', value: parsed.name, tone: 'neutral' },
      { label: 'Category', value: catLabel, tone: 'neutral' },
      ...(parsed.investedAmount !== parsed.currentValue
        ? [{ label: 'Invested', value: formatCurrency(parsed.investedAmount), tone: 'neutral' as const }]
        : []),
      { label: 'Amount / Value', value: formatCurrency(parsed.currentValue), tone: 'emerald' },
      ...(parsed.accountNumberMask && !parsed.accountNumberMask.startsWith('CHT-')
        ? [{ label: 'Account Ref', value: parsed.accountNumberMask, tone: 'neutral' as const }]
        : []),
      ...(parsed.interestRatePct !== undefined
        ? [{ label: 'Rate / Yield', value: `${parsed.interestRatePct}% p.a.`, tone: 'emerald' as const }]
        : []),
      ...(parsed.maturityDate
        ? [{ label: 'Maturity', value: parsed.maturityDate, tone: 'amber' as const }]
        : []),
    ];

    return {
      title: `Confirm New Holding`,
      text: `Parsed locally from your message (${parsed.institution}). Confirm to save to your device ledger, or open the form to adjust any field:`,
      metrics: previewMetrics,
      actions: [
        {
          label: 'Confirm & Save',
          variant: 'primary',
          action: { type: 'CONFIRM_ADD_HOLDING', holding: parsed },
        },
        {
          label: 'Adjust in Form',
          variant: 'secondary',
          action: { type: 'OPEN_ADD_MODAL', draft: parsed },
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
      (s, h) => s + h.currentValue,
      0
    );
    const currentAlloc = computePortfolioAllocation(holdings);
    const calibrated = computeInputBasedShuffle(params, currentAlloc);
    const sim = runMacroSimulation(totalWorth, currentAlloc, calibrated.allocation, params);

    return {
      title: `${params.projectionHorizonYears}-Year Macro Simulation`,
      text: `${calibrated.rationale} ${sim.macroDiagnosis} Recommended mix: ${formatAllocLine(calibrated.allocation)}.`,
      metrics: [
        {
          label: 'Starting Net Worth',
          value: formatCurrency(totalWorth, { compact: true }),
          tone: 'neutral',
        },
        {
          label: `Stress Outcome (${params.projectionHorizonYears}Y)`,
          value: formatCurrency(sim.finalScenarioNetWorth, { compact: true }),
          tone: sim.scenarioAlphaVsBaselinePct >= 0 ? 'emerald' : 'amber',
        },
        {
          label: 'Shuffled Advantage',
          value: `+${formatCurrency(Math.max(0, sim.shuffledAdvantageVsScenario), { compact: true })}`,
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
    const metrics = computePortfolioSummaryMetrics(holdings);
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
      .map((h) => `${h.name} (${formatCurrency(h.currentValue, { compact: true })})`)
      .join(', ');

    const firstTarget = urgent[0];
    return {
      title: `${urgent.length} Matured / Maturing Holdings`,
      text: `Priority items: ${previewNames}. Moving idle or matured capital early avoids savings-rate drag.`,
      metrics: [
        {
          label: 'Matured Now',
          value: `${metrics.maturedHoldings.length} (${formatCurrency(metrics.totalMaturedAmount, { compact: true })})`,
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
    const harvest = computeTaxHarvestingAudit(holdings);
    const sec = computeTaxSectionAudit(holdings);
    const conc = detectConcentrationRisks(holdings);
    const topConc = conc[0]?.title ?? 'Well-diversified across positions';

    return {
      title: 'On-Device Tax & Risk Audit',
      text: `${harvest.recommendation} Top concentration note: ${topConc}.`,
      metrics: [
        {
          label: 'Harvestable LTCG',
          value: formatCurrency(harvest.harvestableNow, { compact: true }),
          tone: harvest.harvestableNow > 0 ? 'emerald' : 'neutral',
        },
        {
          label: '80C + 80CCD Gap',
          value: formatCurrency(sec.section80cShortfall + sec.nps80ccdShortfall, { compact: true }),
          tone: sec.section80cShortfall + sec.nps80ccdShortfall > 0 ? 'amber' : 'emerald',
        },
        {
          label: 'Est. Tax Savings',
          value: formatCurrency(harvest.estimatedTaxSaved + sec.potentialTaxSaved, { compact: true }),
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
      text: 'Break partial or full capital from any Savings, FD, Bond, or Equity holding and compare live AMFI Mutual Funds, NPS Tier-I, GoI G-Secs & T-Bills, or Home Loan prepayments.',
      actions: [{ label: 'Open Rebalance Engine', variant: 'primary', action: { type: 'NAVIGATE', tab: 'rebalance' } }],
    };
  }

  // 12. Direct Navigation shortcuts
  if (/\b(overview|dashboard)\b/i.test(lower) && lower.split(/\s+/).length <= 4) {
    cb.onNavigateToTab('overview');
    return { title: 'Opened Overview', text: 'Switched to your Portfolio Overview & Ledger.' };
  }
  if (/\b(story|game)\b/i.test(lower) && lower.split(/\s+/).length <= 4) {
    return {
      title: 'Guided tour',
      text: 'The street game has been replaced by a short guided tour. Open /demo/ to walk through how a rebalance works.',
    };
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
          b.currentValue -
          a.currentValue
      )
      .slice(0, 5);
    return {
      title: `Top ${top5.length} of ${holdings.length} Holdings (INR)`,
      text: top5
        .map(
          (h, i) =>
            `${i + 1}. ${h.name} — ${formatCurrency(h.currentValue, { compact: true })} (${formatPercent(h.unrealizedGainPct, 1)})`
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

    const metrics = computePortfolioSummaryMetrics(holdings);
    return {
      title: `Portfolio Snapshot (${ctx.portfolioMode === 'demo' ? ctx.profileName : 'Personal'})`,
      text: `All calculations run locally in your browser. ${metrics.maturedHoldings.length} matured positions and ${metrics.maturingSoonHoldings.length} due within 30 days.`,
      metrics: [
        { label: 'Net Worth', value: formatCurrency(metrics.totalValuation, { compact: true }), tone: 'emerald' },
        {
          label: 'Total Gain',
          value: `${metrics.totalGain >= 0 ? '+' : ''}${formatCurrency(metrics.totalGain, { compact: true })} (${formatPercent(metrics.totalGainPct, 1)})`,
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
