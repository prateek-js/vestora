import { useCallback, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { VestoraLogo } from '../components/VestoraLogo';
import type { Holding } from '../types/wealth';
import { loadPersistedPortfolio } from '../utils/portfolioStorage';
import type { LiveMarketBenchmarks } from '../utils/smartDiversification';
import { ChapterBar } from './components/ChapterBar';
import { DemoErrorBoundary } from './components/DemoErrorBoundary';
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
import { chapterForTab } from './chatActions';
import { exportPortfolio, type ExportFormat } from './exports';
import { DEMO_PROFILES } from '../data/mockData';
import { sampleHoldingsFor } from '../utils/portfolioStorage';
import { useSplit } from './useSplit';
import {
  ContactMakerModal,
  MakerDeskStrip,
  MakerTriggerButton,
  type ContactTopicId,
} from '../components/ContactMaker';

// The spreadsheet code and the chat panel stay out of the first load.
const Editor = lazy(() => import('./components/Editor').then((m) => ({ default: m.Editor })));
const PortfolioChatDrawerLazy = lazy(() =>
  import('../components/PortfolioChatDrawer').then((m) => ({ default: m.PortfolioChatDrawer }))
);

type Choice = 'sample' | 'saved' | 'personal';
interface PersonalData {
  holdings: Holding[];
}

/** Ask the editor, from anywhere, to open its add or edit form. */
type OpenRequest = { mode: 'add'; draft?: Holding } | { mode: 'edit'; holding: Holding };

/** Assistant line shown when a chat edit empties the list while the visitor is on a numbers chapter. */
const EMPTY_LIST_NOTE = 'Your list is empty — add an investment to see your numbers.';

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
  // Assistant lines appended on the chat's behalf (e.g. the empty-list routing note).
  const [chatNotes, setChatNotes] = useState<{ id: string; text: string }[]>([]);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactTopic, setContactTopic] = useState<ContactTopicId>('question');

  const openContact = (topic: ContactTopicId = 'question') => {
    setContactTopic(topic);
    setContactOpen(true);
  };

  // Read-only: the demo never writes the visitor's stored portfolio.
  const sample = useMemo<DemoPortfolio>(() => pickPortfolio(null), []);
  const saved = useMemo<DemoPortfolio>(() => pickPortfolio(loadPersistedPortfolio()), []);
  const savedAvailable = saved.source === 'saved';
  const portfolio = useMemo<DemoPortfolio>(() => {
    if (choice === 'personal' && personal) return personalPortfolio(personal.holdings);
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
  // The chat panel owns focus while it is open (the note must be heard where the visitor is); read it without re-running this effect.
  const chatOpenRef = useRef(false);
  useEffect(() => {
    chatOpenRef.current = chatOpen;
  }, [chatOpen]);
  useEffect(() => {
    if (firstChapterRender.current) {
      firstChapterRender.current = false;
      chapterAtOpenRef.current = state.chapter;
      return;
    }
    if (!chatOpenRef.current) document.querySelector<HTMLElement>('main h1')?.focus();
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
      setPersonal((p) => p ?? { holdings: [] });
      setChoice('personal');
    }
    setReached((r) => (r.includes(chapter) ? r : [...r, chapter]));
    set({ chapter });
    window.scrollTo({ top: 0 });
  };

  // Chat-entry navigation into Your numbers: seeds from the portfolio on screen
  // (a copy) so a sample or saved path never lands on an empty editor. Only the
  // story's "Add my investments" button starts empty.
  const goMineFromChat = () => {
    setPersonal((p) => p ?? { holdings: [...portfolio.holdings] });
    setChoice('personal');
    setReached((r) => (r.includes('mine') ? r : [...r, 'mine']));
    set({ chapter: 'mine' });
    window.scrollTo({ top: 0 });
  };
  const next = () => {
    const to = nextChapter(state.chapter);
    if (to) go(to);
  };

  // Every change to the visitor's investments starts from a copy of whatever portfolio is on screen, so a saved one is never touched.
  const updatePersonal = (fn: (p: PersonalData) => PersonalData) =>
    setPersonal((p) => fn(p ?? { holdings: [...portfolio.holdings] }));
  const editPersonal = (fn: (h: Holding[]) => Holding[]) => {
    setChoice('personal');
    updatePersonal((p) => ({ ...p, holdings: fn(p.holdings) }));
  };

  // A chat edit that empties the list strands the visitor on a numbers chapter
  // (₹0 everywhere): go() can only gate entering those chapters, not eject from
  // one. Route back to Your numbers with a note in the chat.
  useEffect(() => {
    if (!emptyPersonal || !chatOpened) return;
    if (state.chapter !== 'see' && state.chapter !== 'play' && state.chapter !== 'plan') return;
    setChatNotes((prev) =>
      prev.some((n) => n.text === EMPTY_LIST_NOTE) ? prev : [...prev, { id: `note-empty-${Date.now()}`, text: EMPTY_LIST_NOTE }]
    );
    set({ chapter: 'mine' });
    window.scrollTo({ top: 0 });
  }, [emptyPersonal, chatOpened, state.chapter, set]);
  const addMine = () => {
    setPersonal((p) => p ?? { holdings: [] });
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
      moveAmountInBase: Math.max(0, Math.round(h.currentValue)),
      allocations: {},
    });
    go('play');
  };

  // The chat's add/edit buttons open the real form in Your numbers. Chat-entry
  // seeding keeps whatever portfolio is on screen (see goMineFromChat).
  const openChatForm = (req: OpenRequest) => {
    setOpenRequest(req);
    goMineFromChat();
  };
  // Stable so the editor's openRequest effect can depend on it.
  const handleOpenRequestHandled = useCallback(() => setOpenRequest(null), []);
  // Stable so the chat panel's focus-trap hook can depend on it.
  const handleChatClose = useCallback(() => setChatOpen(false), []);

  /** Makes a chat-requested download; the heavy writers load on demand and can fail, so the promise is always caught. The drawer reports success unconditionally, so a real failure surfaces as a note. */
  const runDemoExport = (format: ExportFormat, holdings: Holding[]) => {
    const fail = () =>
      setChatNotes((prev) => [
        ...prev,
        { id: `note-export-${Date.now()}`, text: 'The download failed — please try the export again from the page.' },
      ]);
    try {
      const result = exportPortfolio(format, holdings);
      if (result) result.catch(fail);
    } catch {
      fail();
    }
  };

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
          <div className="flex shrink-0 items-center gap-3">
            <MakerTriggerButton onClick={() => openContact('question')} variant="demo" />
            <a
              href="/#overview"
              className="shrink-0 text-sm font-medium underline underline-offset-4 whitespace-nowrap"
              title="Your saved portfolio, every tool, nothing stored on our servers"
            >
              Full app
            </a>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1120px] px-5 pb-28 py-8">
        {choice === 'personal' && personal && personal.holdings.length > 0 && !emptyPersonal && (
          <PersonalBanner
            holdings={personal.holdings}
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
          <DemoErrorBoundary>
            <Suspense fallback={<p className="py-10 text-lg">Loading your investments</p>}>
              <Editor
                holdings={personal.holdings}
                onChange={(nextHoldings) => editPersonal(() => nextHoldings)}
                onImported={(imported) => updatePersonal(() => ({ holdings: imported.holdings }))}
                onContinue={next}
                openRequest={openRequest}
                onOpenRequestHandled={handleOpenRequestHandled}
              />
              <FocusHeading />
            </Suspense>
          </DemoErrorBoundary>
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

        <div className="mt-24 pt-8 border-t border-ink/10">
          <MakerDeskStrip
            onOpenContact={(topic) => openContact(topic ?? 'question')}
            contextLabel={`vestorawealths.app/demo (${state.chapter})`}
          />
        </div>
      </main>

      <ContactMakerModal
        isOpen={contactOpen}
        onClose={() => setContactOpen(false)}
        initialTopic={contactTopic}
        contextLabel={`vestorawealths.app/demo (${state.chapter})`}
      />

      {/* One way in, from every chapter. Stays mounted while the panel is open so focus can return here. */}
      <div className="fixed bottom-4 left-4 z-40 max-sm:right-4">
        <button
          type="button"
          ref={chatLauncherRef}
          onClick={() => {
            setChatOpened(true);
            setChatOpen(true);
          }}
          className="demo-chat-launcher rounded-full border border-ink bg-paper px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-ink/5"
        >
          Ask about my portfolio
        </button>
      </div>
      {chatOpened && (
        <DemoErrorBoundary>
          <Suspense fallback={null}>
            <PortfolioChatDrawerLazy
              open={chatOpen}
              onClose={handleChatClose}
              notes={chatNotes}
              subtitle="Edits this page's portfolio. Runs on your device."
              holdings={portfolio.holdings}
              portfolioMode="personal"
              profileName="You"
              onAddHolding={(h) => editPersonal((hs) => [...hs, h])}
              onUpdateHolding={(h) => editPersonal((hs) => hs.map((x) => (x.id === h.id ? h : x)))}
              onDeleteHolding={(id) => editPersonal((hs) => hs.filter((x) => x.id !== id))}
              onReplaceHoldings={(hs) => editPersonal(() => hs)}
              onAppendHoldings={(hs) => editPersonal((old) => [...old, ...hs])}
              onNavigateToTab={() => {
                /* unreachable in the demo: mapTabToTarget handles every NAVIGATE */
              }}
              mapTabToTarget={(tab) => {
                const chapter = chapterForTab(tab);
                if (chapter === 'mine') {
                  goMineFromChat();
                } else if (chapter) {
                  go(chapter);
                } else {
                  setChatNotes((prev) => [
                    ...prev,
                    { id: `note-tab-${Date.now()}`, text: `That view is in the full app at /#${tab}.` },
                  ]);
                }
              }}
              onStartBlank={() => editPersonal(() => [])}
              onResetToSample={() => editPersonal(() => sampleHoldingsFor(DEMO_PROFILES[0]))}
              onExportExcel={() => runDemoExport('xlsx', portfolio.holdings)}
              onExportCsv={() => runDemoExport('csv', portfolio.holdings)}
              onExportPdf={() => runDemoExport('pdf', portfolio.holdings)}
              onExportJson={() => runDemoExport('json', portfolio.holdings)}
              onRebalanceHoldingById={(id) => {
                if (!portfolio.holdings.some((h) => h.id === id)) {
                  setChatNotes((prev) => [
                    ...prev,
                    {
                      id: `note-gone-${Date.now()}`,
                      text: 'That holding is gone — it is no longer in your list, so there is nothing to move.',
                    },
                  ]);
                  return;
                }
                setChatOpen(false);
                rebalanceHolding(id);
              }}
              onOpenForm={(req) => {
                setChatOpen(false);
                if (req.mode === 'edit') openChatForm({ mode: 'edit', holding: req.holding! });
                else openChatForm({ mode: 'add', draft: req.draft });
              }}
            />
          </Suspense>
        </DemoErrorBoundary>
      )}
    </div>
  );
}
