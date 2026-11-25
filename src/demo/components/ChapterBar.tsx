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
        <div className="mt-1 flex gap-1" aria-hidden>
          {chapters.map((c, i) => (
            <span key={c.id} className={`h-1 flex-1 rounded-full ${i <= activeIndex ? 'bg-ink' : 'bg-ink/15'}`} />
          ))}
        </div>
      </div>
    </nav>
  );
}
