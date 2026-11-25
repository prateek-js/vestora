import type { CurrencyCode, Holding } from '../../types/wealth';
import { ExportBar } from './ExportBar';

interface PersonalBannerProps {
  holdings: Holding[];
  baseCurrency: CurrencyCode;
}

export function PersonalBanner({ holdings, baseCurrency }: PersonalBannerProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-ink/15 bg-paper px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="m-0 text-sm">Your numbers live only on this screen. Download a file to keep them.</p>
      <ExportBar holdings={holdings} baseCurrency={baseCurrency} />
    </div>
  );
}
