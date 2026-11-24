import { useEffect, useMemo, useRef, useState } from 'react';
import { loadPersistedPortfolio } from '../utils/portfolioStorage';
import type { LiveMarketBenchmarks } from '../utils/smartDiversification';
import { ChapterBar } from './components/ChapterBar';
import { PlanSummary } from './components/PlanSummary';
import { Play } from './components/Play';
import { SeeIt } from './components/SeeIt';
import { Story } from './components/Story';
import { loadBenchmarks, pickPortfolio, type BenchmarkStatus, type DemoPortfolio } from './demoData';
import { CHAPTERS, useJourney, type Chapter } from './journeyState';
import { useSplit } from './useSplit';

export default function DemoApp() {
  const { state, set } = useJourney();
  const [maxIndex, setMaxIndex] = useState(0);
  const [useSaved, setUseSaved] = useState(false);
  const [benchmarks, setBenchmarks] = useState<LiveMarketBenchmarks | null>(null);
  const [benchmarkStatus, setBenchmarkStatus] = useState<BenchmarkStatus>('loading');

  // Read-only: the demo never writes the visitor's stored portfolio.
  const sample = useMemo<DemoPortfolio>(() => pickPortfolio(null), []);
  const saved = useMemo<DemoPortfolio>(() => pickPortfolio(loadPersistedPortfolio()), []);
  const savedAvailable = saved.source === 'saved';
  const portfolio = useSaved && savedAvailable ? saved : sample;

  const split = useSplit(portfolio, benchmarks, state);

  // A different portfolio means a different set of holdings: start the split afresh.
  useEffect(() => {
    set({ sourceId: null, moveAmountInBase: 0, allocations: {} });
  }, [portfolio, set]);

  useEffect(() => {
    let cancelled = false;
    loadBenchmarks().then((snap) => {
      if (cancelled) return;
      setBenchmarks(snap);
      setBenchmarkStatus(snap && snap.liveFundCount > 0 ? 'live' : 'sample');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // After a chapter change the button that was clicked is gone, so focus would fall to the page. Land on the new heading.
  const firstChapterRender = useRef(true);
  useEffect(() => {
    if (firstChapterRender.current) {
      firstChapterRender.current = false;
      return;
    }
    document.querySelector<HTMLElement>('main h1')?.focus();
  }, [state.chapter]);

  const reached = CHAPTERS.slice(0, maxIndex + 1).map((c) => c.id);
  const go = (chapter: Chapter) => {
    const index = CHAPTERS.findIndex((c) => c.id === chapter);
    setMaxIndex((m) => Math.max(m, index));
    set({ chapter });
    window.scrollTo({ top: 0 });
  };
  const next = () => {
    const index = CHAPTERS.findIndex((c) => c.id === state.chapter);
    if (index < CHAPTERS.length - 1) go(CHAPTERS[index + 1].id);
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-ink/10 bg-mist">
        <div className="mx-auto flex max-w-[1120px] items-center gap-4 px-5 py-3">
          <span className="font-display text-xl font-semibold">Vestora</span>
          <ChapterBar chapter={state.chapter} reached={reached} onGo={go} />
          <a href="/#overview" className="shrink-0 text-sm font-medium underline underline-offset-4">
            Full app
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-[1120px] px-5 py-8">
        {state.chapter === 'story' && (
          <Story
            portfolio={portfolio}
            savedAvailable={savedAvailable}
            onUseSaved={() => setUseSaved(true)}
            onUseSample={() => setUseSaved(false)}
            onDone={next}
          />
        )}
        {state.chapter === 'see' && (
          <SeeIt
            portfolio={portfolio}
            benchmarks={benchmarks}
            benchmarkStatus={benchmarkStatus}
            journey={state}
            set={set}
            onNext={next}
          />
        )}
        {state.chapter === 'play' && (
          <Play
            portfolio={portfolio}
            journey={state}
            split={split}
            set={set}
            onNext={next}
            onEditConditions={() => go('see')}
          />
        )}
        {state.chapter === 'plan' && (
          <PlanSummary
            portfolio={portfolio}
            journey={state}
            split={split}
            onBack={() => go('play')}
            onEditConditions={() => go('see')}
          />
        )}
      </main>
    </div>
  );
}
