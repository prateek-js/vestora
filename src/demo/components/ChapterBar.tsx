import type { Chapter } from '../journeyState';

interface ChapterBarProps {
  chapters: { id: Chapter; label: string }[];
  chapter: Chapter;
  /** Chapters the visitor has already opened, in order. */
  reached: Chapter[];
  onGo: (c: Chapter) => void;
}

export function ChapterBar({ chapters, chapter, reached, onGo }: ChapterBarProps) {
  const activeIndex = chapters.findIndex((c) => c.id === chapter);
  return (
    <nav aria-label="Journey" className="min-w-0 flex-1">
      <ol className="m-0 hidden list-none justify-center gap-1 p-0 sm:flex">
        {chapters.map((c) => {
          const isActive = c.id === chapter;
          const isReached = reached.includes(c.id);
          return (
            <li key={c.id}>
              <button
                type="button"
                disabled={!isReached}
                aria-current={isActive ? 'step' : undefined}
                onClick={() => onGo(c.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-ink text-paper'
                    : isReached
                      ? 'text-ink hover:bg-ink/10'
                      : 'cursor-not-allowed text-ink/50'
                }`}
              >
                {c.label}
              </button>
            </li>
          );
        })}
      </ol>
      <div className="sm:hidden">
        <p className="m-0 text-center text-sm font-semibold">
          {(chapters[activeIndex] ?? chapters[0]).label}{' '}
          <span className="num font-normal text-ink/70">
            ({Math.max(activeIndex, 0) + 1} of {chapters.length})
          </span>
        </p>
        {/* Same semantics as the desktop bar: reached chapters jump, locked ones sit disabled. */}
        <ol className="m-0 mt-1 flex list-none gap-1 p-0">
          {chapters.map((c, i) => {
            const isReached = reached.includes(c.id);
            const passed = i <= activeIndex;
            return (
              <li key={c.id} className="min-w-0 flex-1">
                <button
                  type="button"
                  disabled={!isReached}
                  aria-current={c.id === chapter ? 'step' : undefined}
                  aria-label={`Go to ${c.label} (${Math.max(i, 0) + 1} of ${chapters.length})`}
                  onClick={() => onGo(c.id)}
                  className={`h-5 flex w-full items-center justify-center rounded-full transition-colors ${
                    !isReached ? 'bg-ink/15 cursor-not-allowed' : passed ? 'bg-ink' : 'bg-ink/40 hover:bg-ink'
                  }`}
                />
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
