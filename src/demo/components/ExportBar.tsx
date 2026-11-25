import { useState } from 'react';
import type { CurrencyCode, Holding } from '../../types/wealth';
import { exportPortfolio, type ExportFormat } from '../exports';

interface ExportBarProps {
  holdings: Holding[];
  baseCurrency: CurrencyCode;
  formats?: ExportFormat[];
}

const FORMAT_LABEL: Record<ExportFormat, string> = {
  xlsx: 'Excel',
  pdf: 'PDF',
  csv: 'CSV',
  json: 'Vestora file',
};

export function ExportBar({ holdings, baseCurrency, formats = ['xlsx', 'pdf', 'csv'] }: ExportBarProps) {
  const [error, setError] = useState<string | null>(null);
  const empty = holdings.length === 0;

  const download = async (format: ExportFormat) => {
    setError(null);
    try {
      await exportPortfolio(format, holdings, baseCurrency);
    } catch {
      setError(`Could not make the ${FORMAT_LABEL[format]} file. Please try again.`);
    }
  };

  return (
    <div>
      <div role="group" aria-label="Download your investments" className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold" aria-hidden>
          Download
        </span>
        {formats.map((format) => (
          <button
            key={format}
            type="button"
            disabled={empty}
            onClick={() => void download(format)}
            aria-label={`Download as ${FORMAT_LABEL[format]}`}
            className="rounded-full border border-ink/30 px-4 py-1.5 text-sm font-semibold hover:border-ink disabled:opacity-40 disabled:hover:border-ink/30"
          >
            {FORMAT_LABEL[format]}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-risk">
          {error}
        </p>
      )}
    </div>
  );
}
