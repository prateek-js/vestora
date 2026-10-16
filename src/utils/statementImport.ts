import { AssetCategory, Holding, TaxTag } from '../types/wealth';
import { todayIso, isoFromToday, withDerivedMaturity } from './maturity';

/**
 * Real client-side CSV statement ingestion. Handles three real-world formats:
 *  - CAMS/KFintech CAS exports (mutual funds: folio, scheme, units, NAV...)
 *  - Bank FD/RD registries (institution, principal, rate, maturity date)
 *  - MF Central consolidated holdings export (asset class, ISIN, units, NAV)
 *
 * Column mapping is header-sniffing based: statements vary between AMCs and
 * banks, so we match normalized header names rather than fixed positions.
 */

const DAY_MS = 86_400_000;

export type StatementFormat = 'CAS' | 'FD_REGISTRY' | 'MF_CENTRAL';

export interface ParsedStatement {
  format: StatementFormat;
  holdings: Holding[];
  /** Rows we couldn't confidently map, with the reason. */
  skipped: { row: number; reason: string; raw: string }[];
}

// ---------- CSV primitives ----------

/** RFC-4180-ish CSV line splitter handling quoted fields and embedded commas. */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',' || ch === ';' || ch === '\t') {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

/** Parses a full CSV string into rows of cells, skipping blank lines. */
export function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map(parseCsvLine);
}

/** Normalizes a header cell for sniffing: lowercase, strip non-alphanumerics. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Finds a column index whose header contains any of the given keywords. */
function findCol(headers: string[], keywords: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (keywords.some((k) => h.includes(k))) return i;
  }
  return -1;
}

// ---------- value parsing ----------

/** Strips currency symbols, commas, and footnotes from a numeric cell. */
function parseAmount(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[₹$€,\s"]/g, '').replace(/[A-Za-z]/g, '');
  if (!cleaned || cleaned === '-') return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Accepts YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, DD-MMM-YYYY (e.g. 15-Oct-2026). */
export function parseFlexibleDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().replace(/"/g, '');
  if (!s || /^-+$/.test(s)) return null;

  // ISO
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // DD-MM-YYYY or DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // DD-MMM-YYYY
  const dmmmyyyy = s.match(/^(\d{1,2})[-/.]([A-Za-z]{3,})[-/.](\d{4})$/);
  if (dmmmyyyy) {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const mi = months.indexOf(dmmmyyyy[2].slice(0, 3).toLowerCase());
    if (mi >= 0) {
      return `${dmmmyyyy[3]}-${String(mi + 1).padStart(2, '0')}-${dmmmyyyy[1].padStart(2, '0')}`;
    }
  }

  // Excel-style serial number
  const serial = Number(s);
  if (Number.isFinite(serial) && serial > 25569 && serial < 80000) {
    return new Date(Math.round((serial - 25569) * DAY_MS)).toISOString().slice(0, 10);
  }

  return null;
}

function guessCategory(format: StatementFormat, row: string[], col: Record<string, number>): AssetCategory {
  if (format === 'FD_REGISTRY') {
    // Distinguish RD from FD by name/type columns when present.
    const typeCol = col.type ?? col.name ?? -1;
    const typeText = typeCol >= 0 ? (row[typeCol] ?? '').toLowerCase() : '';
    return typeText.includes('recurring') ? 'RECURRING_DEPOSIT' : 'FIXED_DEPOSIT';
  }
  return 'MUTUAL_FUND';
}

function guessTaxTag(category: AssetCategory): TaxTag {
  switch (category) {
    case 'FIXED_DEPOSIT':
    case 'RECURRING_DEPOSIT':
      return 'SLAB_INCOME';
    case 'SOVEREIGN_GOLD_BOND':
      return 'TAX_EXEMPT_EEE';
    default:
      return 'LTCG_EQUITY';
  }
}

function id4(): string {
  return Math.random().toString(36).slice(2, 6);
}

// ---------- format detection ----------

export function detectFormat(rows: string[][]): StatementFormat | null {
  if (rows.length === 0) return null;
  const header = rows[0].map(norm).join('|');

  if (/assetclass|mfcentral|isin.*nav.*units|scheme.*isin/.test(header)) return 'MF_CENTRAL';
  if (/maturitydate|maturity|principal|rateofinterest|deposit/.test(header)) return 'FD_REGISTRY';
  if (/scheme|folio|nav|units/.test(header)) return 'CAS';
  return null;
}

// ---------- per-format mappers ----------

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

    // Prefer explicit market value; fall back to units × NAV.
    const currentValue = value ?? (units !== null && nav !== null ? units * nav : null);
    if (currentValue === null) {
      skipped.push({ row: i + 2, reason: 'No market value or units×NAV derivable', raw: name });
      return [];
    }

    const purchaseDate = col.date >= 0 ? parseFlexibleDate(row[col.date]) : null;
    const holdings: Holding = {
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
    return [holdings];
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

    // Skip non-MF asset classes we can't reliably value from this export.
    const assetClass = col.assetclass >= 0 ? (row[col.assetclass] ?? '').toLowerCase() : '';
    if (assetClass && /equity|etf|debenture|bond|nps|sgb|stock/.test(assetClass) && !/mutualfund|mf\b/.test(assetClass)) {
      skipped.push({
        row: i + 2,
        reason: `Asset class "${row[col.assetclass]}" not supported yet — add manually`,
        raw: name,
      });
      return [];
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

/**
 * Parses a raw statement string into holdings. Throws only when the format is
 * entirely unrecognized — row-level problems are reported via `skipped`.
 */
export function importStatement(text: string): ParsedStatement {
  const rows = parseCsv(text);
  if (rows.length < 2) {
    throw new Error('Statement appears empty — need a header row plus at least one data row.');
  }

  const format = detectFormat(rows);
  if (!format) {
    throw new Error(
      'Could not recognize the statement format. Expected CAS (CAMS/KFintech), a bank deposit registry, or an MF Central holdings export.'
    );
  }

  const skipped: ParsedStatement['skipped'] = [];
  const holdings =
    format === 'CAS'
      ? parseCas(rows, skipped)
      : format === 'FD_REGISTRY'
        ? parseFdRegistry(rows, skipped)
        : parseMfCentral(rows, skipped);

  return { format, holdings: holdings.map(withDerivedMaturity), skipped };
}

/** Downloadable starter templates so users know exactly what Vestora expects. */
export const STATEMENT_TEMPLATES: Record<StatementFormat, { label: string; csv: string }> = {
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
