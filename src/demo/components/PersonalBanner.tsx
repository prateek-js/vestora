import type { Holding } from '../../types/wealth';
import { ExportBar } from './ExportBar';

interface PersonalBannerProps {
  holdings: Holding[];
  /** When set, shows a way back to the editor. */
  onEdit?: () => void;
}

export function PersonalBanner({ holdings, onEdit }: PersonalBannerProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-ink/15 bg-paper px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="m-0 text-sm">Your numbers live only on this screen. Download a file to keep them.</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <ExportBar holdings={holdings} />
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="rounded-full border border-ink px-4 py-1.5 text-sm font-semibold text-ink hover:bg-ink/5"
          >
            Edit my investments
          </button>
        )}
      </div>
    </div>
  );
}
