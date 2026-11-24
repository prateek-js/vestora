import { useId, useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { convertCurrency, formatCurrency } from '../../utils/currency';
import { todayIso } from '../../utils/maturity';
import { runMacroSimulation } from '../../utils/simulationEngine';
import {
  analyzeAllocationProfile,
  TARGET_MIX_BY_GOAL,
  type DiversificationGoal,
  type LiveMarketBenchmarks,
} from '../../utils/smartDiversification';
import { beamState, gapSentence } from '../balance';
import { buildBenchmarkRows } from '../benchmarkMap';
import type { BenchmarkStatus, DemoPortfolio } from '../demoData';
import type { JourneyState } from '../journeyState';
import { BenchmarkRows } from './BenchmarkRows';
import { Beam, panWeights } from './Beam';
import { macroAllocation } from '../splitEngine';
import { FactorPanel } from './FactorPanel';
import { MixBar } from './MixBar';

interface SeeItProps {
  portfolio: DemoPortfolio;
  benchmarks: LiveMarketBenchmarks | null;
  benchmarkStatus: BenchmarkStatus;
  journey: JourneyState;
  set: (patch: Partial<JourneyState>) => void;
  onNext: () => void;
}

const GOALS: DiversificationGoal[] = ['CONSERVATIVE', 'BALANCED', 'GROWTH'];

const STATUS_TEXT: Record<BenchmarkStatus, string> = {
  loading: 'Checking for live benchmark data',
  live: 'Live benchmark data',
  sample: 'Sample benchmark data',
};

const primaryButton = 'rounded-full bg-ink px-6 py-3 font-semibold text-paper transition-colors hover:bg-ink/90';

export function SeeIt({ portfolio, benchmarks, benchmarkStatus, journey, set, onNext }: SeeItProps) {
  const goalId = useId();
  const { holdings, baseCurrency } = portfolio;

  const analysis = useMemo(
    () => analyzeAllocationProfile(holdings, baseCurrency, journey.goal),
    [holdings, baseCurrency, journey.goal]
  );
  const target = TARGET_MIX_BY_GOAL[journey.goal].weights;
  const beam = beamState(analysis.currentPct, target);
  const sentence = gapSentence(analysis.currentPct, target);
  const pans = panWeights(analysis.currentPct);

  const { rows, unbenchmarked } = useMemo(
    () => buildBenchmarkRows(holdings, baseCurrency, benchmarks, todayIso()),
    [holdings, baseCurrency, benchmarks]
  );

  const total = useMemo(
    () => holdings.reduce((sum, h) => sum + convertCurrency(h.currentValue, h.currency, baseCurrency), 0),
    [holdings, baseCurrency]
  );
  const sim = useMemo(() => {
    const alloc = macroAllocation(holdings, baseCurrency);
    return runMacroSimulation(total, alloc, alloc, journey.factors);
  }, [holdings, baseCurrency, total, journey.factors]);
  const chartData = sim.trajectory.map((t) => ({
    year: t.label,
    baseline: Math.round(t.baselineNominal),
    scenario: Math.round(t.scenarioNominal),
  }));
  const money = (n: number) => formatCurrency(n, baseCurrency, { compact: true });
  const horizon = journey.factors.projectionHorizonYears;
  const chartSummary = `In ${horizon} ${horizon === 1 ? 'year' : 'years'} your portfolio could be worth ${money(sim.finalBaselineNetWorth)} in calm conditions, or ${money(sim.finalScenarioNetWorth)} with the conditions you chose.`;

  return (
    <div className="grid gap-12 py-4 md:py-8">
      <section className="grid items-start gap-8 md:grid-cols-[1fr_1fr] md:gap-12">
        <div>
          <h1 tabIndex={-1} className="text-4xl font-bold outline-none md:text-5xl">
            Here is where your <span className="num whitespace-nowrap">{money(total)}</span> stands.
          </h1>
          <p className="mt-4 max-w-[46ch] text-lg">
            {sentence}. A balanced mix keeps one bad year in one place from setting the tone for everything else.
          </p>
          <fieldset className="m-0 mt-6 border-0 p-0">
            <legend className="mb-2 p-0 font-semibold">What are you aiming for?</legend>
            <div className="flex flex-wrap gap-2">
              {GOALS.map((g) => (
                <label
                  key={g}
                  className={`cursor-pointer rounded-full border px-5 py-2 font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink ${
                    journey.goal === g ? 'border-ink bg-ink text-paper' : 'border-ink/30 hover:border-ink'
                  }`}
                >
                  <input
                    type="radio"
                    name={goalId}
                    className="sr-only"
                    checked={journey.goal === g}
                    onChange={() => set({ goal: g })}
                  />
                  {TARGET_MIX_BY_GOAL[g].label}
                </label>
              ))}
            </div>
            <p className="num mb-0 mt-3 text-sm text-ink/80">
              Target: {target.equity}% equity, {target.debt}% debt, {target.gold}% gold, {target.cash}% cash.
            </p>
          </fieldset>
        </div>
        <div className="rounded-2xl bg-paper p-5 md:p-6">
          <Beam
            size="slim"
            tiltDeg={beam.tiltDeg}
            level={beam.level}
            summary={sentence}
            leftWeights={pans.left}
            rightWeights={pans.right}
          />
          <div className="mt-4">
            <MixBar label="Your mix today" mix={analysis.currentPct} target={target} />
          </div>
        </div>
      </section>

      <section aria-labelledby="bench-title">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="bench-title" className="text-2xl font-bold md:text-3xl">
            How each investment is doing
          </h2>
          <span className="text-sm text-ink/80" role="status">
            {STATUS_TEXT[benchmarkStatus]}
          </span>
        </div>
        <p className="mt-2 max-w-[60ch] text-ink/80">
          Each one is compared with a similar fund or deposit, so you can see if it is earning its place.
        </p>
        <div className="mt-4 rounded-2xl bg-paper px-5 py-2 md:px-6">
          <BenchmarkRows rows={rows} unbenchmarked={unbenchmarked} />
        </div>
      </section>

      <section aria-labelledby="world-title">
        <h2 id="world-title" className="text-2xl font-bold md:text-3xl">
          What the world could do to it
        </h2>
        <p className="mt-2 max-w-[60ch] text-ink/80">
          Move the sliders to try different conditions. The chart shows your portfolio as it is today.
        </p>
        <div className="mt-4 grid gap-8 rounded-2xl bg-paper p-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:p-6">
          <FactorPanel factors={journey.factors} onChange={(factors) => set({ factors })} />
          <div>
            <div role="img" aria-label={chartSummary} className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="var(--color-ink)" strokeOpacity={0.08} vertical={false} />
                  <XAxis dataKey="year" tickLine={false} axisLine={false} tickMargin={10} tick={{ fontSize: 12 }} />
                  <YAxis
                    width={64}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v: number) => money(v)}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip formatter={(v) => money(Number(v))} />
                  <Line
                    type="monotone"
                    dataKey="baseline"
                    name="Calm conditions"
                    stroke="var(--color-cash)"
                    strokeWidth={2}
                    strokeDasharray="6 5"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="scenario"
                    name="Your conditions"
                    stroke="var(--color-ink)"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mb-0 mt-3 text-sm text-ink/80">
              Rupee amounts are not adjusted for inflation, so they show what the money adds up to, not what it will buy.
            </p>
            <dl className="m-0 mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-ink/80">Calm conditions, dashed line</dt>
                <dd className="num m-0 text-2xl font-bold">{money(sim.finalBaselineNetWorth)}</dd>
              </div>
              <div>
                <dt className="text-sm text-ink/80">Your conditions, solid line</dt>
                <dd className="num m-0 text-2xl font-bold">{money(sim.finalScenarioNetWorth)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <div>
        <button type="button" onClick={onNext} className={primaryButton}>
          Try a rebalance
        </button>
      </div>
    </div>
  );
}
