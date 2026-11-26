import type { Holding } from '../types/wealth';
import { buildExport, downloadPortfolioExport } from '../utils/backupRestore';

export type ExportFormat = 'xlsx' | 'csv' | 'pdf' | 'json';

/**
 * Downloads the visitor's portfolio as a file. The PDF and Excel writers are heavy, so they load
 * only when asked for; the returned promise settles once the file has been handed to the browser.
 */
export function exportPortfolio(format: ExportFormat, holdings: Holding[]): void | Promise<void> {
  switch (format) {
    case 'xlsx':
      return import('../utils/statementImport').then((m) => m.exportHoldingsToExcel(holdings));
    case 'csv':
      return import('../utils/statementImport').then((m) => m.exportHoldingsToCsv(holdings));
    case 'pdf':
      return import('../utils/pdfReport').then((m) => {
        m.generatePortfolioPdfReport({
          holdings,
          portfolioMode: 'personal',
          profileName: 'My portfolio',
        });
      });
    case 'json':
      downloadPortfolioExport(buildExport('demo-personal', holdings));
      return;
  }
}
