import type { CurrencyCode, Holding } from '../types/wealth';
import { parsePortfolioExport } from '../utils/backupRestore.ts';
import { getExcelSheetNames, importExcelBuffer, importStatement } from '../utils/statementImport.ts';

export interface ImportedPortfolio {
  holdings: Holding[];
  baseCurrency: CurrencyCode;
  skippedRows: number;
}

const EXCEL_EXTENSIONS = ['xlsx', 'xls', 'xlsm', 'xlsb', 'ods'];
const TEXT_EXTENSIONS = ['csv', 'tsv'];

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot === -1 ? '' : fileName.slice(dot + 1).toLowerCase();
}

/** The currency every holding shares, or the fallback when they differ. */
function sharedCurrency(holdings: Holding[], fallback: CurrencyCode): CurrencyCode {
  const first = holdings[0]?.currency;
  return first && holdings.every((h) => h.currency === first) ? first : fallback;
}

function noInvestments(fileName: string): Error {
  return new Error(
    `No investments found in ${fileName}. Check that it has columns like Name, Category, Invested and Current value.`
  );
}

/** Turns an uploaded Excel, CSV or Vestora JSON file into holdings. Throws a plain, user-readable Error. */
export function parseImportedFile(
  fileName: string,
  content: ArrayBuffer | string,
  fallbackCurrency: CurrencyCode
): ImportedPortfolio {
  const ext = extensionOf(fileName);

  if (EXCEL_EXTENSIONS.includes(ext)) {
    if (typeof content === 'string') throw new Error(`Could not read ${fileName}. Try saving it again.`);
    try {
      // Fails on files that are not real workbooks (corrupt, or another format renamed to .xlsx).
      getExcelSheetNames(content);
    } catch {
      throw new Error(`Could not read ${fileName}. Try saving it again.`);
    }
    let parsed;
    try {
      parsed = importExcelBuffer(content, undefined, fallbackCurrency).parsed;
    } catch {
      // A workbook with nothing recognisable in it (blank, or no known column headers).
      throw noInvestments(fileName);
    }
    if (parsed.holdings.length === 0) throw noInvestments(fileName);
    return {
      holdings: parsed.holdings,
      baseCurrency: sharedCurrency(parsed.holdings, fallbackCurrency),
      skippedRows: parsed.skipped.length,
    };
  }

  if (TEXT_EXTENSIONS.includes(ext)) {
    if (typeof content !== 'string') throw new Error(`Could not read ${fileName}. Try saving it again.`);
    const parsed = importStatement(content, fallbackCurrency);
    if (parsed.holdings.length === 0) throw noInvestments(fileName);
    return {
      holdings: parsed.holdings,
      baseCurrency: sharedCurrency(parsed.holdings, fallbackCurrency),
      skippedRows: parsed.skipped.length,
    };
  }

  if (ext === 'json') {
    if (typeof content !== 'string') throw new Error(`Could not read ${fileName}. Try saving it again.`);
    const restored = parsePortfolioExport(content);
    if (restored.holdings.length === 0) throw noInvestments(fileName);
    return {
      holdings: restored.holdings,
      baseCurrency: restored.baseCurrency ?? sharedCurrency(restored.holdings, fallbackCurrency),
      skippedRows: 0,
    };
  }

  throw new Error('Use an Excel, CSV or Vestora JSON file.');
}

/** Reads a picked file: an ArrayBuffer for Excel, text for everything else. */
export async function readImportFile(file: File): Promise<{ fileName: string; content: ArrayBuffer | string }> {
  const isExcel = EXCEL_EXTENSIONS.includes(extensionOf(file.name));
  return { fileName: file.name, content: isExcel ? await file.arrayBuffer() : await file.text() };
}
