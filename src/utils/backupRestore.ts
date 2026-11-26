import { CurrencyCode, Holding } from '../types/wealth';
import { withDerivedMaturity } from './maturity';
import { renormaliseHolding } from './portfolioStorage';

/**
 * Portable JSON snapshot of the ledger. Vestora's only database is this
 * browser's localStorage, so the export file doubles as backup and a way to
 * move a portfolio between browsers or devices.
 */

const EXPORT_VERSION = 1;

export interface PortfolioExport {
  app: 'vestora';
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  profileId: string;
  /** Present in older exports; every holding is INR now, so new exports omit it. */
  baseCurrency?: CurrencyCode;
  holdings: Holding[];
}

export function buildExport(profileId: string, holdings: Holding[]): PortfolioExport {
  return {
    app: 'vestora',
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    profileId,
    holdings,
  };
}

export function downloadPortfolioExport(exportData: PortfolioExport): void {
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vestora-portfolio-${exportData.exportedAt.slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export interface RestoreResult {
  baseCurrency: CurrencyCode | null;
  profileId: string | null;
  holdings: Holding[];
}

/**
 * Parses and validates a previously exported file. Maturity fields are
 * recomputed on import so a snapshot restored months later reflects the
 * calendar. Holdings saved before Vestora was INR-only re-denominate to INR
 * at the pinned rate; the restored state is always INR (the exported
 * `baseCurrency` field stays for backward compatibility but is reported as
 * 'INR'). Throws with a user-readable message on invalid files.
 */
export function parsePortfolioExport(jsonText: string): RestoreResult {
  let data: PortfolioExport;
  try {
    data = JSON.parse(jsonText) as PortfolioExport;
  } catch {
    throw new Error('Not a valid JSON file.');
  }

  if (data.app !== 'vestora' || !Array.isArray(data.holdings)) {
    throw new Error('This file was not exported by Vestora.');
  }

  const holdings = data.holdings
    .filter((h) => h && typeof h.id === 'string' && typeof h.name === 'string' && typeof h.currentValue === 'number')
    .map((h) => withDerivedMaturity(renormaliseHolding(h)));

  if (holdings.length === 0) {
    throw new Error('The export contains no recognizable holdings.');
  }

  return {
    baseCurrency: 'INR',
    profileId: data.profileId ?? null,
    holdings,
  };
}
