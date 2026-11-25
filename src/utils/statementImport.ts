import * as XLSX from 'xlsx';
import { AssetCategory, CurrencyCode, Holding, TaxTag } from '../types/wealth';
import { todayIso, isoFromToday, withDerivedMaturity } from './maturity';

/**
 * Real client-side Excel (.xlsx/.xls) and CSV/TSV statement ingestion.
 * Supports:
 *  - Universal Portfolio Spreadsheets (custom Excel sheets with Name, Category, Invested, Value...)
 *  - CAMS / KFintech CAS exports (mutual funds: folio, scheme, units, NAV...)
 *  - Bank FD / RD registries (institution, principal, rate, maturity date)
 *  - MF Central consolidated holdings export (asset class, ISIN, units, NAV)
 *
 * All parsing happens 100% inside the browser — files never leave the user's device.
 */

const DAY_MS = 86_400_000;

export type StatementFormat = 'PORTFOLIO_SHEET' | 'CAS' | 'FD_REGISTRY' | 'MF_CENTRAL';

export interface ParsedStatement {
  format: StatementFormat;
  holdings: Holding[];
  /** Rows we couldn't confidently map, with the reason. */
  skipped: { row: number; reason: string; raw: string }[];
  sheetName?: string;
}

export interface WorkbookPreview {
  sheetNames: string[];
  activeSheet: string;
  parsed: ParsedStatement;
}

// ---------- CSV primitives ----------

/**
 * Scans CSV text into rows of trimmed cells. Quoted fields may contain commas,
 * doubled quotes and line breaks (the exporter writes multi-line notes that way).
 * Cells split on comma, semicolon or tab; rows end at LF or CRLF outside quotes.
 */
function scanCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      // A quote only opens a quoted cell at the start of a cell; mid-cell it is literal (RFC 4180),
      // so a stray inch mark like `5" pipe` cannot swallow the rest of the file.
      if (cur.trim() === '') {
        inQuotes = true;
        cur = '';
      } else {
        cur += ch;
      }
    } else if (ch === ',' || ch === ';' || ch === '\t') {
      row.push(cur.trim());
      cur = '';
    } else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
      if (ch === '\r') i++;
      row.push(cur.trim());
      rows.push(row);
      row = [];
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (inQuotes) {
    throw new Error(
      'Unterminated quote in CSV: a quoted cell was never closed, so the rest of the file cannot be read reliably. Check for a stray " character.'
    );
  }
  row.push(cur.trim());
  rows.push(row);
  return rows;
}

/** RFC-4180-ish CSV line splitter handling quoted fields and embedded commas. */
export function parseCsvLine(line: string): string[] {
  return scanCsv(line)[0];
}

/** Parses a full CSV string into rows of cells, skipping blank lines. */
export function parseCsv(text: string): string[][] {
  return scanCsv(text).filter((cells) => cells.length > 1 || cells[0] !== '');
}

/** Normalizes a header cell for sniffing: lowercase, strip non-alphanumerics. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Finds a column index whose header contains any of the given keywords. */
function findCol(headers: string[], keywords: string[]): number {
  for (const kw of keywords) {
    const exact = headers.findIndex((h) => h === kw);
    if (exact !== -1) return exact;
  }
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (keywords.some((k) => h.includes(k))) return i;
  }
  return -1;
}

// ---------- value parsing ----------

/** Strips currency symbols, commas, and footnotes from a numeric cell. */
function parseAmount(raw: string | number | undefined | null): number | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const cleaned = String(raw)
    .replace(/[₹$€£,\s"]/g, '')
    .replace(/(INR|USD|EUR|CR|DR)/gi, '')
    .trim();
  if (!cleaned || cleaned === '-') return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseCurrencyCode(raw: string | undefined, fallback: CurrencyCode): CurrencyCode {
  if (!raw) return fallback;
  const up = raw.trim().toUpperCase();
  if (up.includes('USD') || up.includes('$')) return 'USD';
  if (up.includes('EUR') || up.includes('€')) return 'EUR';
  if (up.includes('INR') || up.includes('₹') || up.includes('RS')) return 'INR';
  return fallback;
}

/** Accepts YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, MM/DD/YYYY, DD-MMM-YYYY, or Excel serial numbers. */
export function parseFlexibleDate(raw: string | number | Date | undefined | null): string | null {
  if (raw === undefined || raw === null) return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }
  const s = String(raw).trim().replace(/"/g, '');
  if (!s || /^-+$/.test(s)) return null;

  // ISO YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    const [, first, second, y] = dmy;
    const p1 = Number(first);
    const p2 = Number(second);
    // Handle MM/DD/YYYY when second number > 12
    if (p2 > 12 && p1 <= 12) {
      return `${y}-${first.padStart(2, '0')}-${second.padStart(2, '0')}`;
    }
    return `${y}-${second.padStart(2, '0')}-${first.padStart(2, '0')}`;
  }

  // DD-MMM-YYYY or DD MMM YYYY or DD-MMM-YY
  const dmmmyyyy = s.match(/^(\d{1,2})[-/.\s]([A-Za-z]{3,})[-/.\s](\d{2,4})$/);
  if (dmmmyyyy) {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const mi = months.indexOf(dmmmyyyy[2].slice(0, 3).toLowerCase());
    if (mi >= 0) {
      const year = dmmmyyyy[3].length === 2 ? `20${dmmmyyyy[3]}` : dmmmyyyy[3];
      return `${year}-${String(mi + 1).padStart(2, '0')}-${dmmmyyyy[1].padStart(2, '0')}`;
    }
  }

  // Excel-style serial number
  const serial = Number(s);
  if (Number.isFinite(serial) && serial > 25569 && serial < 80000) {
    return new Date(Math.round((serial - 25569) * DAY_MS)).toISOString().slice(0, 10);
  }

  return null;
}

function matchCategoryKeyword(text: string): AssetCategory | null {
  const lower = text.toLowerCase().trim();
  if (!lower) return null;
  if (/sgb|sovereign\s*gold|gold\s*bond|gold\s*etf|\bgold\b/.test(lower)) return 'SOVEREIGN_GOLD_BOND';
  if (/recurring\s*deposit|\brd\b/.test(lower)) return 'RECURRING_DEPOSIT';
  if (/fixed\s*deposit|term\s*deposit|\bfd\b/.test(lower)) return 'FIXED_DEPOSIT';
  if (/govt\s*bond|g-?sec|treasury|sovereign\s*bond|rbi\s*floating|tbill|t-bill/.test(lower)) return 'GOVT_BOND';
  if (/corp\s*bond|corporate\s*bond|debenture|\bncd\b/.test(lower)) return 'CORP_BOND';
  if (/\bepf\b|employee\s*provident|vpf/.test(lower)) return 'EPF';
  if (/\bppf\b|public\s*provident/.test(lower)) return 'PPF';
  if (/\bnps\b|national\s*pension/.test(lower)) return 'NPS';
  if (/savings|liquid\s*cash|\bcash\b|sweep\s*account|checking/.test(lower)) return 'SAVINGS_CASH';
  if (/mutual\s*fund|mutual_fund|\bmf\b|elss|flexi\s*cap/.test(lower)) return 'MUTUAL_FUND';
  if (/stock|equity|demat|share|nasdaq|nyse|nse|bse|etf/.test(lower)) return 'EQUITY_STOCK';
  if (/\bbond\b/.test(lower)) return 'CORP_BOND';
  return null;
}

function mapCategoryString(raw: string | undefined, fallbackName = ''): AssetCategory {
  if (raw) {
    const explicit = matchCategoryKeyword(raw);
    if (explicit) return explicit;
  }
  const combined = `${raw ?? ''} ${fallbackName}`.toLowerCase();
  if (/stock|equity|demat|share|nasdaq|nyse|nse|bse|etf/.test(combined) && !/mutual|fund|elss|flexi|nifty.*index/.test(combined)) {
    return 'EQUITY_STOCK';
  }
  return matchCategoryKeyword(fallbackName) ?? 'MUTUAL_FUND';
}

function guessCategory(format: StatementFormat, row: string[], col: Record<string, number>): AssetCategory {
  if (format === 'FD_REGISTRY') {
    const typeCol = col.type ?? col.name ?? -1;
    const typeText = typeCol >= 0 ? (row[typeCol] ?? '').toLowerCase() : '';
    return typeText.includes('recurring') ? 'RECURRING_DEPOSIT' : 'FIXED_DEPOSIT';
  }
  return 'MUTUAL_FUND';
}

function guessTaxTag(category: AssetCategory, rawTag?: string): TaxTag {
  if (rawTag) {
    const u = rawTag.toUpperCase();
    if (u.includes('80CCD')) return '80CCD';
    if (u.includes('80C') || u.includes('ELSS')) return '80C';
    if (u.includes('EEE') || u.includes('EXEMPT')) return 'TAX_EXEMPT_EEE';
    if (u.includes('STCG')) return 'STCG';
    if (u.includes('SLAB')) return 'SLAB_INCOME';
    if (u.includes('LTCG')) return 'LTCG_EQUITY';
  }
  switch (category) {
    case 'FIXED_DEPOSIT':
    case 'RECURRING_DEPOSIT':
    case 'CORP_BOND':
    case 'GOVT_BOND':
    case 'SAVINGS_CASH':
      return 'SLAB_INCOME';
    case 'SOVEREIGN_GOLD_BOND':
    case 'EPF':
    case 'PPF':
      return 'TAX_EXEMPT_EEE';
    case 'NPS':
      return '80CCD';
    default:
      return 'LTCG_EQUITY';
  }
}

function id4(): string {
  return Math.random().toString(36).slice(2, 6);
}

// ---------- format detection ----------

/** Scans the first few rows to skip title/blank header lines often found in Excel exports. */
function findHeaderRowIndex(rows: string[][]): number {
  const limit = Math.min(rows.length, 8);
  for (let i = 0; i < limit; i++) {
    const joined = rows[i].map(norm).join('|');
    if (
      /(scheme|instrument|holding|asset|security|deposit|fund|name)/.test(joined) &&
      /(value|amount|principal|nav|invested|cost|maturity|balance)/.test(joined)
    ) {
      return i;
    }
  }
  return 0;
}

export function detectFormat(rows: string[][]): StatementFormat | null {
  if (rows.length === 0) return null;
  const header = rows[0].map(norm).join('|');

  if (
    /(instrumentname|category)/.test(header) &&
    /(name|instrument|asset|holding|security|scheme|stock|fund|description|particulars)/.test(header) &&
    /(currentvalue|marketvalue|valuation|presentvalue|value|invested|cost|principal|amount|balance)/.test(header)
  ) {
    return 'PORTFOLIO_SHEET';
  }
  if (/assetclass|mfcentral|isin.*nav.*units|scheme.*isin/.test(header)) return 'MF_CENTRAL';
  if (/maturitydate|rateofinterest|depositname|depositamount|principal/.test(header) && !/category|assettype|instrument/.test(header)) {
    return 'FD_REGISTRY';
  }
  if (/scheme|folio/.test(header) && /nav|units/.test(header)) return 'CAS';
  if (
    /(name|instrument|asset|holding|security|scheme|stock|fund|description|particulars)/.test(header) &&
    /(currentvalue|marketvalue|valuation|presentvalue|value|invested|cost|principal|amount|balance)/.test(header)
  ) {
    return 'PORTFOLIO_SHEET';
  }
  if (/maturity|deposit/.test(header)) return 'FD_REGISTRY';
  if (/scheme|folio|nav|units/.test(header)) return 'CAS';
  return null;
}

// ---------- per-format mappers ----------

function parsePortfolioSheet(
  rows: string[][],
  skipped: ParsedStatement['skipped'],
  defaultCurrency: CurrencyCode
): Holding[] {
  const headers = rows[0].map(norm);
  const col = {
    name: findCol(headers, ['instrumentname', 'holdingname', 'assetname', 'securityname', 'schemename', 'name', 'instrument', 'holding', 'asset', 'security', 'scheme', 'fund', 'stock', 'particulars', 'description']),
    category: findCol(headers, ['category', 'assetcategory', 'assetclass', 'assettype', 'type', 'class']),
    institution: findCol(headers, ['institution', 'bank', 'broker', 'platform', 'amc', 'custodian', 'provider', 'advisor']),
    account: findCol(headers, ['account', 'accountno', 'folio', 'foliono', 'mask', 'id']),
    invested: findCol(headers, ['investedamount', 'invested', 'costvalue', 'cost', 'principal', 'buyvalue', 'purchasevalue', 'capital']),
    value: findCol(headers, ['currentvalue', 'marketvalue', 'valuation', 'presentvalue', 'closingvalue', 'value', 'amount', 'balance']),
    currency: findCol(headers, ['currency', 'ccy', 'curr']),
    rate: findCol(headers, ['interestrate', 'ratepct', 'rate', 'yield', 'coupon', 'roi']),
    purchaseDate: findCol(headers, ['purchasedate', 'startdate', 'openingdate', 'buydate', 'date']),
    maturityDate: findCol(headers, ['maturitydate', 'maturity', 'duedate', 'enddate']),
    units: findCol(headers, ['units', 'qty', 'quantity', 'shares']),
    nav: findCol(headers, ['nav', 'price', 'ltp', 'currentnav']),
    gain30d: findCol(headers, ['30dgain', 'gain30d', '30dreturn', 'return30d']),
    schemeCode: findCol(headers, ['amfischemecode', 'schemecode', 'amficode']),
    taxTag: findCol(headers, ['taxtag', 'tax', 'taxclassification']),
    notes: findCol(headers, ['notes', 'remarks', 'comment']),
  };

  if (col.name === -1 && col.value === -1 && col.invested === -1) return [];

  return rows.slice(1).flatMap((row, i) => {
    const rawName = col.name >= 0 ? row[col.name]?.trim() : '';
    if (!rawName || /^(total|grand\s*total|subtotal|summary)$/i.test(rawName)) {
      return [];
    }

    const units = col.units >= 0 ? parseAmount(row[col.units]) : null;
    const nav = col.nav >= 0 ? parseAmount(row[col.nav]) : null;
    const valParsed = col.value >= 0 ? parseAmount(row[col.value]) : null;
    const invParsed = col.invested >= 0 ? parseAmount(row[col.invested]) : null;

    const currentValue = valParsed ?? (units !== null && nav !== null ? units * nav : invParsed);
    const investedAmount = invParsed ?? currentValue;

    if (currentValue === null || investedAmount === null || (currentValue === 0 && investedAmount === 0)) {
      skipped.push({
        row: i + 2,
        reason: 'Missing or invalid numeric value for Current Value / Invested Amount',
        raw: rawName,
      });
      return [];
    }

    const rawCat = col.category >= 0 ? row[col.category] : undefined;
    const category = mapCategoryString(rawCat, rawName);
    const currency = col.currency >= 0 ? parseCurrencyCode(row[col.currency], defaultCurrency) : defaultCurrency;
    const rate = col.rate >= 0 ? parseAmount(row[col.rate]) : null;
    const gain30d = col.gain30d >= 0 ? parseAmount(row[col.gain30d]) : null;
    const schemeCode = col.schemeCode >= 0 ? parseAmount(row[col.schemeCode]) : null;
    const purchaseDate = (col.purchaseDate >= 0 ? parseFlexibleDate(row[col.purchaseDate]) : null) ?? todayIso();
    const maturityDate = col.maturityDate >= 0 ? parseFlexibleDate(row[col.maturityDate]) ?? undefined : undefined;
    const taxTag = guessTaxTag(category, col.taxTag >= 0 ? row[col.taxTag] : undefined);
    const unrealizedGain = currentValue - investedAmount;
    const unrealizedGainPct = investedAmount > 0 ? (unrealizedGain / investedAmount) * 100 : 0;

    const holding: Holding = {
      id: `h-xl-${id4()}-${Date.now()}`,
      name: rawName,
      category,
      institution: col.institution >= 0 && row[col.institution] ? row[col.institution].trim() : 'Spreadsheet Import',
      accountNumberMask: col.account >= 0 && row[col.account] ? row[col.account].trim() : undefined,
      investedAmount,
      currentValue,
      currency,
      interestRatePct: rate ?? undefined,
      units: units ?? undefined,
      schemeCode: schemeCode !== null ? Math.round(schemeCode) : undefined,
      navOrPrice: nav ?? undefined,
      purchaseDate,
      maturityDate,
      unrealizedGain,
      unrealizedGainPct,
      gain30dPct: gain30d ?? undefined,
      taxTag,
      notes: col.notes >= 0 && row[col.notes] ? row[col.notes].trim() : `Imported from spreadsheet on ${todayIso()}`,
    };

    return [holding];
  });
}

function parseCas(rows: string[][], skipped: ParsedStatement['skipped']): Holding[] {
  const headers = rows[0].map(norm);
  const col = {
    scheme: findCol(headers, ['schemename', 'scheme']),
    folio: findCol(headers, ['folio']),
    advisor: findCol(headers, ['advisor']),
    units: findCol(headers, ['units', 'balanceunits', 'closingunits']),
    nav: findCol(headers, ['nav', 'navon', 'currentnav']),
    value: findCol(headers, ['marketvalue', 'currentvalue', 'valuation']),
    invested: findCol(headers, ['costvalue', 'invested', 'purchasecost', 'totalcost']),
    isin: findCol(headers, ['isin']),
    date: findCol(headers, ['purchasedate', 'dateofinvestment', 'openingdate', 'date']),
  };

  if (col.scheme === -1) return [];

  return rows.slice(1).flatMap((row, i) => {
    const name = row[col.scheme];
    if (!name || /total|opening|closing|grand/i.test(name)) return [];

    const units = parseAmount(row[col.units]);
    const nav = parseAmount(row[col.nav]);
    const value = col.value >= 0 ? parseAmount(row[col.value]) : null;
    const invested = col.invested >= 0 ? parseAmount(row[col.invested]) : null;

    const currentValue = value ?? (units !== null && nav !== null ? units * nav : null);
    if (currentValue === null) {
      skipped.push({ row: i + 2, reason: 'No market value or units×NAV derivable', raw: name });
      return [];
    }

    const purchaseDate = col.date >= 0 ? parseFlexibleDate(row[col.date]) : null;
    const holding: Holding = {
      id: `h-cas-${id4()}-${Date.now()}`,
      name,
      category: 'MUTUAL_FUND',
      institution: col.advisor >= 0 && row[col.advisor] ? row[col.advisor] : 'Imported from CAS',
      accountNumberMask: col.folio >= 0 && row[col.folio] ? `Folio: ${row[col.folio]}` : undefined,
      investedAmount: invested ?? currentValue,
      currentValue,
      currency: 'INR',
      units: units ?? undefined,
      navOrPrice: nav ?? undefined,
      purchaseDate: purchaseDate ?? todayIso(),
      unrealizedGain: invested !== null ? currentValue - invested : 0,
      unrealizedGainPct:
        invested !== null && invested > 0 ? ((currentValue - invested) / invested) * 100 : 0,
      taxTag: 'LTCG_EQUITY',
      notes: 'Imported from CAMS/KFintech CAS on ' + todayIso(),
    };
    return [holding];
  });
}

function parseFdRegistry(rows: string[][], skipped: ParsedStatement['skipped']): Holding[] {
  const headers = rows[0].map(norm);
  const col = {
    name: findCol(headers, ['depositname', 'description', 'particulars', 'schemename', 'deposittype']),
    account: findCol(headers, ['accountno', 'depositno', 'rdno', 'fdno', 'accountnumber']),
    institution: findCol(headers, ['bank', 'institution', 'bankname']),
    principal: findCol(headers, ['principal', 'depositamount', 'amount', 'investedamount']),
    value: findCol(headers, ['maturityvalue', 'currentvalue', 'closingvalue']),
    rate: findCol(headers, ['rateofinterest', 'interestrate', 'rate']),
    maturity: findCol(headers, ['maturitydate', 'maturity']),
    start: findCol(headers, ['startdate', 'openingdate', 'depositdate', 'date']),
  };

  if (col.principal === -1) return [];

  return rows.slice(1).flatMap((row, i) => {
    const principal = parseAmount(row[col.principal]);
    if (principal === null) return [];

    const name = col.name >= 0 && row[col.name] ? row[col.name] : `${row[col.institution] ?? 'Bank'} Term Deposit`;
    const category = guessCategory('FD_REGISTRY', row, col);
    const maturityDate = col.maturity >= 0 ? parseFlexibleDate(row[col.maturity]) : null;
    const value = col.value >= 0 ? parseAmount(row[col.value]) : null;

    if (!maturityDate) {
      skipped.push({ row: i + 2, reason: 'Missing maturity date — cannot track on radar', raw: name });
      return [];
    }

    const holding: Holding = {
      id: `h-fd-${id4()}-${Date.now()}`,
      name,
      category,
      institution: col.institution >= 0 && row[col.institution] ? row[col.institution] : 'Imported deposit',
      accountNumberMask: col.account >= 0 && row[col.account] ? `A/c: ${row[col.account]}` : undefined,
      investedAmount: principal,
      currentValue: value ?? principal,
      currency: 'INR',
      interestRatePct: col.rate >= 0 ? parseAmount(row[col.rate]) ?? undefined : undefined,
      purchaseDate: (col.start >= 0 ? parseFlexibleDate(row[col.start]) : null) ?? todayIso(),
      maturityDate,
      unrealizedGain: value !== null ? value - principal : 0,
      unrealizedGainPct: value !== null && principal > 0 ? ((value - principal) / principal) * 100 : 0,
      taxTag: guessTaxTag(category),
      notes: 'Imported from bank deposit registry on ' + todayIso(),
    };
    return [withDerivedMaturity(holding)];
  });
}

function parseMfCentral(rows: string[][], skipped: ParsedStatement['skipped']): Holding[] {
  const headers = rows[0].map(norm);
  const col = {
    scheme: findCol(headers, ['schemename', 'scheme']),
    folio: findCol(headers, ['folio']),
    units: findCol(headers, ['units', 'balanceunits', 'closingunits']),
    nav: findCol(headers, ['nav', 'currentnav']),
    value: findCol(headers, ['marketvalue', 'currentvalue', 'valuation', 'value']),
    invested: findCol(headers, ['costvalue', 'invested', 'purchasecost']),
    isin: findCol(headers, ['isin']),
    assetclass: findCol(headers, ['assetclass', 'assettype', 'category']),
    date: findCol(headers, ['date', 'openingdate']),
  };

  if (col.scheme === -1) return [];

  return rows.slice(1).flatMap((row, i) => {
    const name = row[col.scheme];
    if (!name || /total|grand/i.test(name)) return [];

    const assetClass = col.assetclass >= 0 ? (row[col.assetclass] ?? '').toLowerCase() : '';
    if (assetClass && /equity|etf|debenture|bond|nps|sgb|stock/.test(assetClass) && !/mutualfund|mf\b/.test(assetClass)) {
      // Fall back to mapping generically instead of discarding!
      const mappedCat = mapCategoryString(assetClass, name);
      const val = col.value >= 0 ? parseAmount(row[col.value]) : null;
      const inv = col.invested >= 0 ? parseAmount(row[col.invested]) : null;
      const units = parseAmount(row[col.units]);
      const nav = parseAmount(row[col.nav]);
      const currentValue = val ?? (units !== null && nav !== null ? units * nav : null);
      if (currentValue !== null) {
        const investedAmount = inv ?? currentValue;
        const holding: Holding = {
          id: `h-mfc-${id4()}-${Date.now()}`,
          name,
          category: mappedCat,
          institution: 'MF Central consolidated holdings',
          accountNumberMask: col.folio >= 0 && row[col.folio] ? `Folio: ${row[col.folio]}` : undefined,
          investedAmount,
          currentValue,
          currency: 'INR',
          units: units ?? undefined,
          navOrPrice: nav ?? undefined,
          purchaseDate: (col.date >= 0 ? parseFlexibleDate(row[col.date]) : null) ?? todayIso(),
          unrealizedGain: currentValue - investedAmount,
          unrealizedGainPct: investedAmount > 0 ? ((currentValue - investedAmount) / investedAmount) * 100 : 0,
          taxTag: guessTaxTag(mappedCat),
          notes: 'Imported from MF Central holdings export on ' + todayIso(),
        };
        return [holding];
      }
    }

    const units = parseAmount(row[col.units]);
    const nav = parseAmount(row[col.nav]);
    const value = col.value >= 0 ? parseAmount(row[col.value]) : null;
    const invested = col.invested >= 0 ? parseAmount(row[col.invested]) : null;
    const currentValue = value ?? (units !== null && nav !== null ? units * nav : null);

    if (currentValue === null) {
      skipped.push({ row: i + 2, reason: 'No market value or units×NAV derivable', raw: name });
      return [];
    }

    const purchaseDate = col.date >= 0 ? parseFlexibleDate(row[col.date]) : null;
    const holding: Holding = {
      id: `h-mfc-${id4()}-${Date.now()}`,
      name,
      category: 'MUTUAL_FUND',
      institution: 'MF Central consolidated holdings',
      accountNumberMask: col.folio >= 0 && row[col.folio] ? `Folio: ${row[col.folio]}` : undefined,
      investedAmount: invested ?? currentValue,
      currentValue,
      currency: 'INR',
      units: units ?? undefined,
      navOrPrice: nav ?? undefined,
      purchaseDate: purchaseDate ?? todayIso(),
      unrealizedGain: invested !== null ? currentValue - invested : 0,
      unrealizedGainPct:
        invested !== null && invested > 0 ? ((currentValue - invested) / invested) * 100 : 0,
      taxTag: 'LTCG_EQUITY',
      notes: 'Imported from MF Central holdings export on ' + todayIso(),
    };
    return [holding];
  });
}

// ---------- public API ----------

function parseRowsToStatement(
  rawRows: string[][],
  defaultCurrency: CurrencyCode = 'INR',
  sheetName?: string
): ParsedStatement {
  const nonEmptyRows = rawRows.filter((r) => r.some((cell) => String(cell ?? '').trim() !== ''));
  if (nonEmptyRows.length === 0) {
    throw new Error('Spreadsheet appears empty — need a header row plus at least one data row.');
  }

  const headerIdx = findHeaderRowIndex(nonEmptyRows);
  const rows = nonEmptyRows.slice(headerIdx);

  const format = detectFormat(rows);
  if (!format && nonEmptyRows.length < 2) {
    throw new Error('Spreadsheet appears empty — need a header row plus at least one data row.');
  }
  if (!format) {
    throw new Error(
      'Could not recognize column headers. Include columns like "Instrument Name", "Category", "Invested Amount", and "Current Value" (or use our Excel template).'
    );
  }

  const skipped: ParsedStatement['skipped'] = [];
  const holdings =
    format === 'PORTFOLIO_SHEET'
      ? parsePortfolioSheet(rows, skipped, defaultCurrency)
      : format === 'CAS'
        ? parseCas(rows, skipped)
        : format === 'FD_REGISTRY'
          ? parseFdRegistry(rows, skipped)
          : parseMfCentral(rows, skipped);

  return { format, holdings: holdings.map(withDerivedMaturity), skipped, sheetName };
}

/**
 * Parses a raw CSV/TSV string into holdings.
 */
export function importStatement(
  text: string,
  defaultCurrency: CurrencyCode = 'INR'
): ParsedStatement {
  const rows = parseCsv(text);
  return parseRowsToStatement(rows, defaultCurrency);
}

/** Extracts sheet names from an Excel ArrayBuffer (.xlsx / .xls / .xlsm). */
export function getExcelSheetNames(buffer: ArrayBuffer): string[] {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  return wb.SheetNames.filter((n) => n.toLowerCase() !== 'instructions');
}

/** Converts a specific Excel sheet into a normalized string[][] matrix and parses it. */
export function importExcelBuffer(
  buffer: ArrayBuffer,
  sheetName?: string,
  defaultCurrency: CurrencyCode = 'INR'
): WorkbookPreview {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetNames = wb.SheetNames;
  if (sheetNames.length === 0) {
    throw new Error('This Excel file has no worksheets.');
  }

  const targetSheet =
    sheetName && sheetNames.includes(sheetName)
      ? sheetName
      : sheetNames.find((n) => n.toLowerCase() !== 'instructions') ?? sheetNames[0];

  const ws = wb.Sheets[targetSheet];
  const rawMatrix = XLSX.utils.sheet_to_json<(string | number | Date | null | undefined)[]>(ws, {
    header: 1,
    raw: false,
    defval: '',
  });

  const strRows: string[][] = rawMatrix.map((row) =>
    row.map((cell) => {
      if (cell === null || cell === undefined) return '';
      if (cell instanceof Date) return cell.toISOString().slice(0, 10);
      return String(cell).trim();
    })
  );

  const parsed = parseRowsToStatement(strRows, defaultCurrency, targetSheet);
  return {
    sheetNames,
    activeSheet: targetSheet,
    parsed,
  };
}

/** Generates and downloads a clean, ready-to-edit .xlsx Excel template right in the browser. */
export function downloadPortfolioExcelTemplate(currency: CurrencyCode = 'INR'): void {
  const sampleRows =
    currency === 'USD'
      ? [
          ['Instrument Name', 'Category', 'Institution', 'Invested Amount', 'Current Value', 'Currency', 'Interest Rate %', 'Purchase Date', 'Maturity Date'],
          ['Vanguard S&P 500 ETF (VOO)', 'Mutual Fund', 'Vanguard', 45000, 56200, 'USD', '', '2023-03-15', ''],
          ['Apple Inc. (AAPL)', 'Stock', 'Fidelity', 18000, 24400, 'USD', '', '2024-01-10', ''],
          ['High-Yield 12M Treasury CD', 'Fixed Deposit', 'Marcus / Goldman', 25000, 26150, 'USD', 4.6, '2025-11-20', isoFromToday(22)],
          ['SPDR Gold Shares (GLD)', 'Gold', 'Fidelity', 10000, 12800, 'USD', '', '2023-09-01', ''],
        ]
      : [
          ['Instrument Name', 'Category', 'Institution', 'Invested Amount', 'Current Value', 'Currency', 'Interest Rate %', 'Purchase Date', 'Maturity Date'],
          ['Parag Parikh Flexi Cap Fund', 'Mutual Fund', 'PPFAS AMC', 450000, 612000, 'INR', '', '2022-04-12', ''],
          ['HDFC Bank Equity Shares', 'Stock', 'Zerodha Demat', 220000, 268000, 'INR', '', '2023-08-19', ''],
          ['SBI Special Term Deposit', 'Fixed Deposit', 'State Bank of India', 500000, 537500, 'INR', 7.5, '2025-11-20', isoFromToday(18)],
          ['Sovereign Gold Bond 2028', 'SGB', 'RBI / HDFC', 150000, 214000, 'INR', 2.5, '2021-05-10', '2029-05-10'],
          ['Employees Provident Fund', 'EPF', 'EPFO', 640000, 745000, 'INR', 8.25, '2020-01-01', ''],
        ];

  const guideRows = [
    ['Vestora Portfolio Excel Import Guide'],
    ['Privacy Guarantee: This file is parsed 100% locally in your browser. Nothing is uploaded to any server.'],
    [''],
    ['Column Name', 'Required?', 'Notes & Accepted Values'],
    ['Instrument Name', 'Yes', 'Name of fund, stock, FD, bond, or account'],
    ['Category', 'Recommended', 'Mutual Fund, Stock, Fixed Deposit (FD), Recurring Deposit (RD), SGB / Gold, Govt Bond, Corp Bond, EPF, PPF, NPS, Cash'],
    ['Institution', 'Optional', 'Bank, AMC, or broker name'],
    ['Invested Amount', 'Yes', 'Original cost / principal amount'],
    ['Current Value', 'Yes', 'Latest market value or maturity value'],
    ['Currency', 'Optional', 'INR, USD, or EUR (defaults to your active currency)'],
    ['Interest Rate %', 'Optional', 'Annual rate for FD, RD, Bonds, EPF, PPF'],
    ['Purchase Date', 'Optional', 'YYYY-MM-DD or DD-MM-YYYY'],
    ['Maturity Date', 'Optional', 'YYYY-MM-DD or DD-MM-YYYY (used for Maturity Radar)'],
  ];

  const wb = XLSX.utils.book_new();
  const wsHoldings = XLSX.utils.aoa_to_sheet(sampleRows);
  wsHoldings['!cols'] = [
    { wch: 30 },
    { wch: 16 },
    { wch: 22 },
    { wch: 16 },
    { wch: 16 },
    { wch: 10 },
    { wch: 15 },
    { wch: 14 },
    { wch: 14 },
  ];
  const wsGuide = XLSX.utils.aoa_to_sheet(guideRows);
  wsGuide['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 70 }];

  XLSX.utils.book_append_sheet(wb, wsHoldings, 'Portfolio');
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Instructions');
  XLSX.writeFile(wb, 'vestora-portfolio-template.xlsx');
}

const CATEGORY_EXPORT_LABELS: Record<AssetCategory, string> = {
  MUTUAL_FUND: 'Mutual Fund',
  EQUITY_STOCK: 'Stock',
  FIXED_DEPOSIT: 'Fixed Deposit',
  RECURRING_DEPOSIT: 'Recurring Deposit',
  SOVEREIGN_GOLD_BOND: 'SGB',
  GOVT_BOND: 'Govt Bond',
  CORP_BOND: 'Corp Bond',
  EPF: 'EPF',
  PPF: 'PPF',
  NPS: 'NPS',
  SAVINGS_CASH: 'Savings Cash',
};

const EXPORT_HEADERS = [
  'Instrument Name',
  'Category',
  'Institution',
  'Account / Folio',
  'Invested Amount',
  'Current Value',
  'Currency',
  'Interest Rate %',
  'Units',
  'NAV / Price',
  'Purchase Date',
  'Maturity Date',
  '30d Gain %',
  'AMFI Scheme Code',
  'Tax Tag',
  'Notes',
];

function holdingToExportRow(h: Holding): (string | number)[] {
  return [
    h.name,
    CATEGORY_EXPORT_LABELS[h.category] ?? h.category,
    h.institution,
    h.accountNumberMask ?? '',
    h.investedAmount,
    h.currentValue,
    h.currency,
    h.interestRatePct ?? '',
    h.units ?? '',
    h.navOrPrice ?? '',
    h.purchaseDate,
    h.maturityDate ?? '',
    h.gain30dPct ?? '',
    h.schemeCode ?? '',
    h.taxTag,
    h.notes ?? '',
  ];
}

/** Builds the lossless, re-importable export workbook without touching the filesystem or DOM. */
export function buildHoldingsWorkbook(
  holdings: Holding[],
  baseCurrency: CurrencyCode = 'INR'
): XLSX.WorkBook {
  const rows: (string | number)[][] = [EXPORT_HEADERS, ...holdings.map(holdingToExportRow)];
  const wsPortfolio = XLSX.utils.aoa_to_sheet(rows);
  wsPortfolio['!cols'] = [
    { wch: 36 },
    { wch: 16 },
    { wch: 24 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 10 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 13 },
    { wch: 13 },
    { wch: 12 },
    { wch: 16 },
    { wch: 16 },
    { wch: 38 },
  ];

  const summaryRows = [
    ['Vestora Portfolio Export'],
    ['Export Date', todayIso()],
    ['Active Display Currency', baseCurrency],
    ['Holdings Count', holdings.length],
    ['How to Restore', 'Upload this .xlsx file in Vestora via Import Excel Portfolio to resume your simulation anytime.'],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 24 }, { wch: 76 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsPortfolio, 'Portfolio');
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
  return wb;
}

/** Exports the active portfolio to a lossless, re-importable .xlsx Excel workbook. */
export function exportHoldingsToExcel(
  holdings: Holding[],
  baseCurrency: CurrencyCode = 'INR'
): void {
  XLSX.writeFile(buildHoldingsWorkbook(holdings, baseCurrency), `vestora-portfolio-${todayIso()}.xlsx`);
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Builds the RFC-4180 CSV text (BOM-prefixed) for the export without triggering a download. */
export function buildHoldingsCsv(holdings: Holding[]): string {
  const lines = [
    EXPORT_HEADERS.map(escapeCsvCell).join(','),
    ...holdings.map((h) => holdingToExportRow(h).map(escapeCsvCell).join(',')),
  ];
  return '\uFEFF' + lines.join('\r\n');
}

/** Exports the active portfolio to an RFC-4180 CSV file ready for spreadsheet viewing or re-import. */
export function exportHoldingsToCsv(holdings: Holding[]): void {
  const csvContent = buildHoldingsCsv(holdings);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vestora-portfolio-${todayIso()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Downloadable starter templates so users know exactly what Vestora expects. */
export const STATEMENT_TEMPLATES: Record<StatementFormat, { label: string; csv: string }> = {
  PORTFOLIO_SHEET: {
    label: 'Universal Portfolio Sheet (All Asset Classes)',
    csv: [
      'Instrument Name,Category,Institution,Invested Amount,Current Value,Currency,Interest Rate %,Purchase Date,Maturity Date',
      `Parag Parikh Flexi Cap Fund,Mutual Fund,PPFAS AMC,450000,612000,INR,,2022-04-12,`,
      `SBI Special Term Deposit,Fixed Deposit,State Bank of India,500000,537500,INR,7.5,2025-11-20,${isoFromToday(18)}`,
      `Sovereign Gold Bond Tranche,SGB,RBI,150000,214000,INR,2.5,2021-05-10,2029-05-10`,
    ].join('\n'),
  },
  CAS: {
    label: 'CAMS / KFintech CAS template',
    csv: [
      'Scheme Name,Folio No,Advisor,Units,NAV on Date,Market Value,Cost Value,Purchase Date',
      'Parag Parikh Flexi Cap Fund - Direct Plan - Growth,1289410,PPFAS,310.45,91.42,28400.55,180000.00,12-04-2021',
      'Mirae Asset ELSS Tax Saver Fund - Direct Plan - Growth,3918204,Mirae AMC,523.10,132.85,69494.94,450000.00,15-01-2022',
    ].join('\n'),
  },
  FD_REGISTRY: {
    label: 'Bank deposit registry template',
    csv: [
      'Deposit Name,Bank Name,Account No,Deposit Amount,Rate of Interest,Start Date,Maturity Date,Maturity Value',
      'Axis Bank 1-Year Special Term Deposit,Axis Bank,FD-3391,500000,7.60,10-11-2025,' + isoFromToday(28) + ',538000',
    ].join('\n'),
  },
  MF_CENTRAL: {
    label: 'MF Central holdings template',
    csv: [
      'Asset Class,Scheme Name,ISIN,Folio No,Units,Current NAV,Market Value,Cost Value,Opening Date',
      'Mutual Fund,Quant Small Cap Fund - Direct Plan - Growth,INF966L01AB4,9940129,262.85,184.48,48488.53,300000.00,10-08-2022',
    ].join('\n'),
  },
};
