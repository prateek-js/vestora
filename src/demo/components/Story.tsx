import { useEffect, useMemo, useRef, useState } from 'react';
import { convertCurrency, formatCurrency } from '../../utils/currency';
import { analyzeAllocationProfile, TARGET_MIX_BY_GOAL } from '../../utils/smartDiversification';
import { balanceScore, beamState, gapSentence } from '../balance';
import { BUCKET_COLOR, BUCKET_LABEL } from '../buckets';
import type { DemoPortfolio } from '../demoData';
import { moveToken, startingTokens, TOKEN_POINTS, tokensToMix, type Token } from '../storyGame';
import { Beam, panWeights } from './Beam';

interface StoryProps {
  portfolio: DemoPortfolio;
  savedAvailable: boolean;
  onUseSaved: () => void;
  /** Choose the sample and move on to the next chapter. */
  onUseSample: () => void;
  hasPersonal: boolean;
  onAddMine: () => void;
  onDone: () => void;
}

const BEATS = 4;
const TARGET = TARGET_MIX_BY_GOAL.BALANCED.weights;

const VOICES = [
  { who: 'A finance forum', says: 'Buy now. This one is about to run.' },
  { who: 'A commission advisor', says: 'Our new fund offer is just right for you.' },
  { who: 'A wealth manager', says: 'Hand it all over to us. We take 1.5% a year.' },
];

const primaryButton =
  'rounded-full bg-ink px-6 py-3 font-semibold text-paper transition-colors hover:bg-ink/90 disabled:opacity-40';
const secondaryButton = 'rounded-full border border-ink px-6 py-3 font-semibold text-ink hover:bg-ink/5';
const quietButton = 'rounded-full px-4 py-3 font-semibold text-ink underline underline-offset-4 hover:bg-ink/5';

function WeightButton({ token, onMove }: { token: Token; onMove: (id: string) => void }) {
  const acrossTo = token.side === 'left' ? 'steadier side' : 'growth side';
  return (
    <button
      type="button"
      data-token={token.id}
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/plain', token.id)}
      onClick={() => onMove(token.id)}
      aria-label={`${BUCKET_LABEL[token.bucket]}, ${TOKEN_POINTS} points. Move to the ${acrossTo}.`}
      className="flex min-h-14 min-w-24 items-center gap-2 rounded-lg border border-ink/15 bg-paper py-2 pl-2 pr-3 text-left shadow-sm transition-colors hover:border-ink/40"
    >
      <span aria-hidden className="h-8 w-2 rounded-full" style={{ backgroundColor: BUCKET_COLOR[token.bucket] }} />
      <span className="leading-tight">
        <span className="block text-sm font-semibold">{BUCKET_LABEL[token.bucket]}</span>
        <span className="num block text-sm text-ink/70">{TOKEN_POINTS} points</span>
      </span>
    </button>
  );
}

function Tray({
  title,
  side,
  tokens,
  onMove,
}: {
  title: string;
  side: Token['side'];
  tokens: Token[];
  onMove: (id: string) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData('text/plain');
        const dragged = id && document.querySelector<HTMLElement>(`[data-token="${id}"]`);
        // Only a weight coming from the other tray moves.
        if (dragged && dragged.closest('[data-tray]')?.getAttribute('data-tray') !== side) onMove(id);
      }}
      data-tray={side}
      className={`min-h-28 rounded-xl border border-dashed p-3 transition-colors ${
        over ? 'border-ink bg-ink/5' : 'border-ink/25'
      }`}
    >
      <div className="mb-2 text-sm font-semibold">{title}</div>
      <div className="flex flex-wrap gap-2">
        {tokens.map((t) => (
          <WeightButton key={t.id} token={t} onMove={onMove} />
        ))}
      </div>
    </div>
  );
}

export function Story({ portfolio, savedAvailable, onUseSaved, onUseSample, hasPersonal, onAddMine, onDone }: StoryProps) {
  const [beat, setBeat] = useState(0);
  const [tokens, setTokens] = useState<Token[]>(startingTokens);
  const [lastMoved, setLastMoved] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const own = useMemo(
    () => analyzeAllocationProfile(portfolio.holdings, portfolio.baseCurrency, 'BALANCED').currentPct,
    [portfolio]
  );
  const total = useMemo(
    () =>
      portfolio.holdings.reduce(
        (sum, h) => sum + convertCurrency(h.currentValue, h.currency, portfolio.baseCurrency),
        0
      ),
    [portfolio]
  );

  const gameMix = tokensToMix(tokens);
  const game = beamState(gameMix, TARGET);
  const shown = beat === 2 ? gameMix : beat === 3 ? TARGET : own;
  const beam = beamState(shown, TARGET);
  const pans = panWeights(shown);
  const summary = beat === 3 ? 'Your mix is on target' : gapSentence(shown, TARGET);

  // Keep keyboard users oriented: land on the new headline, and stay on a weight after it moves trays.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [beat]);
  useEffect(() => {
    if (lastMoved) document.querySelector<HTMLElement>(`[data-token="${lastMoved}"]`)?.focus();
  }, [tokens, lastMoved]);

  const onMove = (id: string) => {
    setTokens((t) => moveToken(t, id));
    setLastMoved(id);
  };
  const next = () => setBeat((b) => Math.min(BEATS - 1, b + 1));
  const back = () => setBeat((b) => Math.max(0, b - 1));

  return (
    <section
      aria-label="The story"
      className="grid items-start gap-8 py-4 md:grid-cols-[1fr_1.15fr] md:grid-rows-[auto_1fr] md:gap-x-12 md:gap-y-0 md:py-10"
    >
      {/* Source order is what a phone shows: intro, then the beam and game, then the buttons. */}
      <div className="md:col-start-1 md:row-start-1">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div role="img" aria-label={`Step ${beat + 1} of ${BEATS}`} className="flex gap-1.5">
            {Array.from({ length: BEATS }, (_, i) => (
              <span key={i} className={`h-1.5 w-8 rounded-full ${i <= beat ? 'bg-ink' : 'bg-ink/15'}`} />
            ))}
          </div>
          <button type="button" onClick={onDone} className={quietButton}>
            Skip story
          </button>
        </div>

        {beat === 0 && (
          <>
            <h1 ref={headingRef} tabIndex={-1} className="text-4xl font-bold md:text-6xl">
              You own {portfolio.holdings.length} investments. Nobody has looked at them together.
            </h1>
            <p className="mt-5 max-w-[46ch] text-lg">
              Each one made sense when you bought it. Taken together, they lean one way. {summary}.
            </p>
          </>
        )}

        {beat === 1 && (
          <>
            <h1 ref={headingRef} tabIndex={-1} className="text-4xl font-bold md:text-6xl">
              Everyone you ask pulls a different way.
            </h1>
            <ul className="m-0 mt-6 grid max-w-[52ch] list-none gap-3 p-0">
              {VOICES.map((v) => (
                <li key={v.who} className="rounded-xl bg-paper p-4">
                  <span className="block text-sm font-semibold text-ink/70">{v.who}</span>
                  <span className="block text-lg">“{v.says}”</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 max-w-[46ch] text-lg">
              None of them has seen your whole portfolio in one place.
            </p>
          </>
        )}

        {beat === 2 && (
          <>
            <h1 ref={headingRef} tabIndex={-1} className="text-4xl font-bold md:text-6xl">
              Balance looks like this.
            </h1>
            <p className="mt-5 max-w-[46ch] text-lg">
              Growth assets sit on one side and steadier ones on the other. Tap a weight to move it across
              until the beam sits level.
            </p>
            <p aria-live="polite" className="mt-4 text-lg font-semibold">
              <span className="num">Balance score {balanceScore(gameMix, TARGET)} of 100.</span>{' '}
              {game.level ? 'Level. This is what rebalancing does to a portfolio.' : gapSentence(gameMix, TARGET) + '.'}
            </p>
          </>
        )}

        {beat === 3 && (
          <>
            <h1 ref={headingRef} tabIndex={-1} className="text-4xl font-bold md:text-6xl">
              {portfolio.source === 'sample' ? 'Try it on a sample portfolio.' : 'Try it on your portfolio.'}
            </h1>
            <p className="mt-5 max-w-[46ch] text-lg">
              {portfolio.source === 'saved'
                ? 'You are using your saved portfolio, with '
                : portfolio.source === 'personal'
                  ? 'You are using the portfolio you built, with '
                  : 'We will use a sample with '}
              {portfolio.holdings.length} investments worth{' '}
              <span className="num font-semibold">{formatCurrency(total, portfolio.baseCurrency, { compact: true })}</span>.
              You can change anything. Your numbers stay on this device.
            </p>
          </>
        )}

      </div>

      <div className="md:col-start-2 md:row-span-2 md:row-start-1 md:pt-24">
        <Beam
          tiltDeg={beat === 2 ? game.tiltDeg : beam.tiltDeg}
          level={beat === 2 ? game.level : beam.level}
          summary={summary}
          leftWeights={pans.left}
          rightWeights={pans.right}
        />
        {beat === 2 && (
          <div className="mx-auto mt-4 grid max-w-[640px] gap-3 sm:grid-cols-2">
            <Tray title="Growth side" side="left" tokens={tokens.filter((t) => t.side === 'left')} onMove={onMove} />
            <Tray title="Steadier side" side="right" tokens={tokens.filter((t) => t.side === 'right')} onMove={onMove} />
          </div>
        )}
        {beat === 2 && (
          <div className="mx-auto mt-3 flex max-w-[640px] justify-end">
            <button type="button" onClick={() => setTokens(startingTokens())} className={quietButton}>
              Start again
            </button>
          </div>
        )}
      </div>

      <div className="md:col-start-1 md:row-start-2">
        <div className="flex flex-wrap items-center gap-3 md:mt-8">
          {beat > 0 && (
            <button type="button" onClick={back} className={quietButton}>
              Back
            </button>
          )}
          {beat < 2 && (
            <button type="button" onClick={next} className={primaryButton}>
              {beat === 0 ? 'Why does that matter?' : 'What does balanced look like?'}
            </button>
          )}
          {beat === 2 && (
            <button type="button" onClick={next} className={primaryButton}>
              {game.level ? 'Try it with a portfolio' : 'Skip ahead'}
            </button>
          )}
          {beat === 3 && (
            <>
              <button
                type="button"
                onClick={onUseSample}
                className={primaryButton}
              >
                Use the sample portfolio
              </button>
              {savedAvailable && (
                <button
                  type="button"
                  onClick={onUseSaved}
                  className={secondaryButton}
                >
                  Use my saved portfolio
                </button>
              )}
              <button type="button" onClick={onAddMine} className={secondaryButton}>
                {hasPersonal ? 'Edit my investments' : 'Add my investments'}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
