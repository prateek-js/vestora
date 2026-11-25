import { useCallback, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { VestoraLogo } from '../components/VestoraLogo';
import type { CurrencyCode, Holding } from '../types/wealth';
import { convertCurrency } from '../utils/currency';
import { loadPersistedPortfolio } from '../utils/portfolioStorage';
import type { LiveMarketBenchmarks } from '../utils/smartDiversification';
import { ChapterBar } from './components/ChapterBar';
import { PersonalBanner } from './components/PersonalBanner';
import { PlanSummary } from './components/PlanSummary';
import { Play } from './components/Play';
import { SeeIt } from './components/SeeIt';
import { Story } from './components/Story';
import {
  loadBenchmarks,
  personalPortfolio,
  pickPortfolio,
  portfolioTotal,
  type BenchmarkStatus,
  type DemoPortfolio,
} from './demoData';
import { nextChapter, useJourney, visibleChapters, type Chapter } from './journeyState';
import { useSplit } from './useSplit';

// The spreadsheet code and the chat panel stay out of the first load.
const Editor = lazy(() => import('./components/Editor').then((m) => ({ default: m.Editor })));
const ChatPanelLazy = lazy(() => import('./components/ChatPanel').then((m) => ({ default: m.ChatPanel })));

type Choice = 'sample' | 'saved' | 'personal';
interface PersonalData {
  holdings: Holding[];
  baseCurrency: CurrencyCode;
}

/** Ask the editor, from anywhere, to open its add or edit form. */
type OpenRequest = { mode: 'add'; draft?: Holding } | { mode: 'edit'; holding: Holding };

/** Lands on the page heading once a lazily loaded chapter has appeared. */
function FocusHeading() {
  useEffect(() => {
    document.querySelector<HTMLElement>('main h1')?.focus();
  }, []);
  return null;
}

export default function DemoApp() {
  const { state, set } = useJourney();
  const [reached, setReached] = useState<Chapter[]>(['story']);
  const [choice, setChoice] = useState<Choice>('sample');
  // The visitor's own investments. Once created it is never reset to null, so 'mine' is always a visible chapter.
  const [personal, setPersonal] = useState<PersonalData | null>(null);
  const [benchmarks, setBenchmarks] = useState<LiveMarketBenchmarks | null>(null);
  const [benchmarkStatus, setBenchmarkStatus] = useState<BenchmarkStatus>('loading');
  const [chatOpen, setChatOpen] = useState(false);
  // Stays true after the first open, so the lazily loaded panel (and its history) is kept.
  const [chatOpened, setChatOpened] = useState(false);
  const [openRequest, setOpenRequest] = useState<OpenRequest | null>(null);

  // Read-only: the demo never writes the visitor's stored portfolio.
  const sample = useMemo<DemoPortfolio>(() => pickPortfolio(null), []);
  const saved = useMemo<DemoPortfolio>(() => pickPortfolio(loadPersistedPortfolio()), []);
  const savedAvailable = saved.source === 'saved';
  const portfolio = useMemo<DemoPortfolio>(() => {
    if (choice === 'personal' && personal) return personalPortfolio(personal.holdings, personal.baseCurrency);
    if (choice === 'saved' && savedAvailable) return saved;
    return sample;
  }, [choice, personal, sample, saved, savedAvailable]);

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
  const chatLauncherRef = useRef<HTMLButtonElement>(null);
  const chapterAtOpenRef = useRef<Chapter>(state.chapter);
  useEffect(() => {
    if (firstChapterRender.current) {
      firstChapterRender.current = false;
      chapterAtOpenRef.current = state.chapter;
      return;
    }
    document.querySelector<HTMLElement>('main h1')?.focus();
    chapterAtOpenRef.current = state.chapter;
  }, [state.chapter]);

  // The chat panel closes without changing chapters: hand focus back to its launcher.
  // Never opened (or a chapter change, which has its own focus target) means the launcher
  // has nothing to hand focus back to, so stay out of the initial page load's way.
  useEffect(() => {
    if (!chatOpened || chatOpen || state.chapter !== chapterAtOpenRef.current) return;
    if (document.activeElement === document.body) chatLauncherRef.current?.focus();
  }, [chatOpened, chatOpen, state.chapter]);

  // A personal portfolio with nothing in it has nothing to look at yet: only the story and the editor open.
  const emptyPersonal = choice === 'personal' && portfolioTotal(portfolio) <= 0;
  const openChapters = emptyPersonal ? reached.filter((c) => c === 'story' || c === 'mine') : reached;

  const go = (chapter: Chapter) => {
    if (emptyPersonal && chapter !== 'story' && chapter !== 'mine') return;
    if (chapter === 'mine') {
      setPersonal((p) => p ?? { holdings: [], baseCurrency: 'INR' });
      setChoice('personal');
    }
    setReached((r) => (r.includes(chapter) ? r : [...r, chapter]));
    set({ chapter });
    window.scrollTo({ top: 0 });
  };
  const next = () => {
    const to = nextChapter(state.chapter);
    if (to) go(to);
  };

  // Every change to the visitor's investments starts from a copy of whatever portfolio is on screen, so a saved one is never touched.
  const updatePersonal = (fn: (p: PersonalData) => PersonalData) =>
    setPersonal((p) => fn(p ?? { holdings: [...portfolio.holdings], baseCurrency: portfolio.baseCurrency }));
  const editPersonal = (fn: (h: Holding[]) => Holding[]) => {
    setChoice('personal');
    updatePersonal((p) => ({ ...p, holdings: fn(p.holdings) }));
  };
  const addMine = () => {
    setPersonal((p) => p ?? { holdings: [], baseCurrency: 'INR' });
    setChoice('personal');
    go('mine');
  };
  const chooseAndContinue = (picked: Choice) => {
    setChoice(picked);
    setReached((r) => (r.includes('see') ? r : [...r, 'see']));
    set({ chapter: 'see' });
    window.scrollTo({ top: 0 });
  };

  // The chat asks for a specific holding's move: set it as the source, then land on the Play chapter.
  const rebalanceHolding = (id: string) => {
    const h = portfolio.holdings.find((x) => x.id === id);
    if (!h) return;
    set({
      sourceId: id,
      moveAmountInBase: Math.max(0, Math.round(convertCurrency(h.currentValue, h.currency, portfolio.baseCurrency))),
      allocations: {},
    });
    go('play');
  };

  // The chat's add/edit buttons open the real form in Your numbers.
  const openChatForm = (req: OpenRequest) => {
    setOpenRequest(req);
    go('mine');
  };
  // Stable so the editor's openRequest effect can depend on it.
  const handleOpenRequestHandled = useCallback(() => setOpenRequest(null), []);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-ink/10 bg-mist">
        <div className="mx-auto flex max-w-[1120px] items-center gap-4 px-5 py-3">
          <div className="flex items-center gap-2">
            <VestoraLogo size={32} />
            <span className="font-display text-xl font-semibold max-sm:sr-only">Vestora</span>
          </div>
          <ChapterBar
            chapters={visibleChapters(personal !== null)}
            chapter={state.chapter}
            reached={openChapters}
            onGo={go}
          />
          <a href="/#overview" className="shrink-0 text-sm font-medium underline underline-offset-4">
            Full app
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-[1120px] px-5 py-8">
        {choice === 'personal' && personal && personal.holdings.length > 0 && !emptyPersonal && (
          <PersonalBanner
            holdings={personal.holdings}
            baseCurrency={personal.baseCurrency}
            onEdit={state.chapter === 'mine' ? undefined : () => go('mine')}
          />
        )}
        {state.chapter === 'story' && (
          <Story
            portfolio={portfolio}
            savedAvailable={savedAvailable}
            onUseSaved={() => chooseAndContinue('saved')}
            onUseSample={() => chooseAndContinue('sample')}
            hasPersonal={personal !== null}
            onAddMine={addMine}
            onDone={() => (emptyPersonal ? go('mine') : next())}
          />
        )}
        {state.chapter === 'mine' && personal && (
          <Suspense fallback={<p className="py-10 text-lg">Loading your investments</p>}>
            <Editor
              holdings={personal.holdings}
              baseCurrency={personal.baseCurrency}
              onChange={(nextHoldings) => editPersonal(() => nextHoldings)}
              onImported={(imported) =>
                updatePersonal(() => ({ holdings: imported.holdings, baseCurrency: imported.baseCurrency }))
              }
              onBaseCurrency={(baseCurrency) => updatePersonal((p) => ({ ...p, baseCurrency }))}
              onContinue={next}
              openRequest={openRequest}
              onOpenRequestHandled={handleOpenRequestHandled}
            />
            <FocusHeading />
          </Suspense>
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

      {/* One way in, from every chapter. Stays mounted while the panel is open so focus can return here. */}
      <div className="fixed bottom-4 left-4 z-40 max-sm:right-4">
        <button
          type="button"
          ref={chatLauncherRef}
          onClick={() => {
            setChatOpened(true);
            setChatOpen(true);
          }}
          className="rounded-full border border-ink bg-paper px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-ink/5"
        >
          Ask about my portfolio
        </button>
      </div>
      {chatOpened && (
        <Suspense fallback={null}>
          <ChatPanelLazy
            open={chatOpen}
            onClose={() => setChatOpen(false)}
            holdings={portfolio.holdings}
            baseCurrency={portfolio.baseCurrency}
            onEdit={editPersonal}
            onSetBaseCurrency={(baseCurrency) => updatePersonal((p) => ({ ...p, baseCurrency }))}
            onGoChapter={go}
            onRebalanceHolding={rebalanceHolding}
            onOpenForm={openChatForm}
          />
        </Suspense>
      )}
    </div>
  );
}
