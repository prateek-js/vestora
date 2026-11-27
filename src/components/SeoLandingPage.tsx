import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Calculator,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { SEO_PAGES, SEO_PAGE_LIST, SeoPageSlug } from '../data/seoPages';

function formatInr(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)} L`;
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
}

const HomeLoanVsFdCalc: React.FC = () => {
  const [capital, setCapital] = useState(700000);
  const [fdRate, setFdRate] = useState(6.75);
  const [taxSlab, setTaxSlab] = useState(30);
  const [loanRate, setLoanRate] = useState(8.55);
  const [years, setYears] = useState(10);

  const metrics = useMemo(() => {
    const postTaxFdRate = fdRate * (1 - (taxSlab * 1.04) / 100);
    const fdFutureValue = capital * Math.pow(1 + postTaxFdRate / 100, years);
    const fdNetGain = fdFutureValue - capital;
    const loanSavedValue = capital * Math.pow(1 + loanRate / 100, years);
    const loanInterestSaved = loanSavedValue - capital;
    const advantage = loanInterestSaved - fdNetGain;
    const spread = loanRate - postTaxFdRate;
    return { postTaxFdRate, fdNetGain, loanInterestSaved, advantage, spread };
  }, [capital, fdRate, taxSlab, loanRate, years]);

  return (
    <div className="bg-paper border border-slate-700 shadow-ink/10 shadow-sm rounded-xl p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 border-b border-slate-700/80 pb-4">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-emerald-700" />
          <h2 className="text-base font-bold text-ink">Interactive Home Loan vs FD Calculator</h2>
        </div>
        <span className="text-2xs font-mono text-emerald-700">100% ON-DEVICE MATH</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs">
        <label className="space-y-1.5">
          <span className="text-ink/70 block">Surplus / FD Amount (₹)</span>
          <input
            type="number"
            min={50000}
            step={50000}
            value={capital}
            onChange={(e) => setCapital(Math.max(10000, Number(e.target.value) || 0))}
            className="w-full px-3 py-2 rounded-lg bg-mist border border-slate-700 text-ink font-mono tabular-nums focus:outline-none focus:border-emerald-500"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-ink/70 block">FD Interest Rate (% p.a.)</span>
          <input
            type="number"
            step={0.1}
            min={2}
            max={12}
            value={fdRate}
            onChange={(e) => setFdRate(Math.max(0, Number(e.target.value) || 0))}
            className="w-full px-3 py-2 rounded-lg bg-mist border border-slate-700 text-ink font-mono tabular-nums focus:outline-none focus:border-emerald-500"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-ink/70 block">Income Tax Slab (%)</span>
          <select
            value={taxSlab}
            onChange={(e) => setTaxSlab(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg bg-mist border border-slate-700 text-ink font-mono focus:outline-none focus:border-emerald-500"
          >
            <option value={0}>0% Slab</option>
            <option value={10}>10% Slab</option>
            <option value={20}>20% Slab</option>
            <option value={30}>30% Slab (+4% cess)</option>
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-ink/70 block">Home Loan Rate (% p.a.)</span>
          <input
            type="number"
            step={0.05}
            min={5}
            max={16}
            value={loanRate}
            onChange={(e) => setLoanRate(Math.max(0, Number(e.target.value) || 0))}
            className="w-full px-3 py-2 rounded-lg bg-mist border border-slate-700 text-ink font-mono tabular-nums focus:outline-none focus:border-emerald-500"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-ink/70 block">Remaining Loan Years</span>
          <input
            type="number"
            min={1}
            max={25}
            value={years}
            onChange={(e) => setYears(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
            className="w-full px-3 py-2 rounded-lg bg-mist border border-slate-700 text-ink font-mono tabular-nums focus:outline-none focus:border-emerald-500"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-mist border border-slate-700/80">
          <span className="text-2xs text-ink/70 font-mono uppercase">Effective Post-Tax FD Yield</span>
          <div className="text-2xl font-bold text-amber-800 font-mono tabular-nums mt-1">
            {metrics.postTaxFdRate.toFixed(2)}% p.a.
          </div>
          <p className="text-xs text-ink/70 mt-1">
            {years}Y post-tax gain: <strong className="text-ink">{formatInr(metrics.fdNetGain)}</strong>
          </p>
        </div>

        <div className="p-4 rounded-lg bg-mist border border-emerald-500/35">
          <span className="text-2xs text-emerald-700 font-mono uppercase">Loan Prepayment Return</span>
          <div className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
            {loanRate.toFixed(2)}% tax-free
          </div>
          <p className="text-xs text-ink/70 mt-1">
            {years}Y interest saved: <strong className="text-emerald-700">{formatInr(metrics.loanInterestSaved)}</strong>
          </p>
        </div>

        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
          <span className="text-2xs text-emerald-700 font-mono uppercase">Net Wealth Advantage</span>
          <div className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
            {metrics.advantage >= 0 ? `+${formatInr(metrics.advantage)}` : formatInr(metrics.advantage)}
          </div>
          <p className="text-xs text-emerald-700 mt-1">
            {metrics.spread >= 0
              ? `Prepayment beats FD by ${metrics.spread.toFixed(2)}% every year`
              : `FD beats loan by ${Math.abs(metrics.spread).toFixed(2)}% p.a.`}
          </p>
        </div>
      </div>
    </div>
  );
};

const MutualFundRebalanceCalc: React.FC = () => {
  const [corpus, setCorpus] = useState(1500000);
  const [cagr, setCagr] = useState(12.0);
  const [commissionDrag, setCommissionDrag] = useState(1.1);
  const [years, setYears] = useState(15);

  const metrics = useMemo(() => {
    const directVal = corpus * Math.pow(1 + cagr / 100, years);
    const regularVal = corpus * Math.pow(1 + Math.max(0, cagr - commissionDrag) / 100, years);
    const feeLeak = directVal - regularVal;
    const annualLeakNow = corpus * (commissionDrag / 100);
    return { directVal, regularVal, feeLeak, annualLeakNow };
  }, [corpus, cagr, commissionDrag, years]);

  return (
    <div className="bg-paper border border-slate-700 shadow-ink/10 shadow-sm rounded-xl p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 border-b border-slate-700/80 pb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-700" />
          <h2 className="text-base font-bold text-ink">Direct vs Regular Mutual Fund Commission Calculator</h2>
        </div>
        <span className="text-2xs font-mono text-emerald-700">0% COMMISSION BENCHMARK</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <label className="space-y-1.5">
          <span className="text-ink/70 block">Mutual Fund Portfolio (₹)</span>
          <input
            type="number"
            min={50000}
            step={100000}
            value={corpus}
            onChange={(e) => setCorpus(Math.max(10000, Number(e.target.value) || 0))}
            className="w-full px-3 py-2 rounded-lg bg-mist border border-slate-700 text-ink font-mono tabular-nums focus:outline-none focus:border-emerald-500"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-ink/70 block">Direct Plan Expected CAGR (%)</span>
          <input
            type="number"
            step={0.5}
            min={4}
            max={20}
            value={cagr}
            onChange={(e) => setCagr(Math.max(1, Number(e.target.value) || 0))}
            className="w-full px-3 py-2 rounded-lg bg-mist border border-slate-700 text-ink font-mono tabular-nums focus:outline-none focus:border-emerald-500"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-ink/70 block">Regular Plan Fee Drag (% p.a.)</span>
          <input
            type="number"
            step={0.1}
            min={0.3}
            max={2.0}
            value={commissionDrag}
            onChange={(e) => setCommissionDrag(Math.max(0.1, Number(e.target.value) || 0))}
            className="w-full px-3 py-2 rounded-lg bg-mist border border-slate-700 text-ink font-mono tabular-nums focus:outline-none focus:border-emerald-500"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-ink/70 block">Compounding Horizon (Years)</span>
          <input
            type="number"
            min={1}
            max={30}
            value={years}
            onChange={(e) => setYears(Math.max(1, Math.min(35, Number(e.target.value) || 1)))}
            className="w-full px-3 py-2 rounded-lg bg-mist border border-slate-700 text-ink font-mono tabular-nums focus:outline-none focus:border-emerald-500"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-mist border border-slate-700/80">
          <span className="text-2xs text-ink/70 font-mono uppercase">Regular Plan ({years}Y Value)</span>
          <div className="text-2xl font-bold text-ink font-mono tabular-nums mt-1">
            {formatInr(metrics.regularVal)}
          </div>
          <p className="text-xs text-rose-700 mt-1">
            Year-1 fee leak: {formatInr(metrics.annualLeakNow)}/yr
          </p>
        </div>

        <div className="p-4 rounded-lg bg-mist border border-emerald-500/35">
          <span className="text-2xs text-emerald-700 font-mono uppercase">Direct-Growth ({years}Y Value)</span>
          <div className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
            {formatInr(metrics.directVal)}
          </div>
          <p className="text-xs text-ink/70 mt-1">Same underlying portfolio, 0% trail fee</p>
        </div>

        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
          <span className="text-2xs text-emerald-700 font-mono uppercase">Wealth Saved by Switching</span>
          <div className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
            +{formatInr(metrics.feeLeak)}
          </div>
          <p className="text-xs text-emerald-700 mt-1">Stays compounding in your pocket</p>
        </div>
      </div>
    </div>
  );
};

const FdMaturityCalc: React.FC = () => {
  const [amount, setAmount] = useState(692000);
  const [fdRate, setFdRate] = useState(6.5);
  const [taxSlab, setTaxSlab] = useState(30);
  const [goal, setGoal] = useState<'conservative' | 'balanced' | 'growth'>('balanced');

  const metrics = useMemo(() => {
    const fdPostTax = fdRate * (1 - (taxSlab * 1.04) / 100);
    const splits =
      goal === 'conservative'
        ? { safe: 0.6, growth: 0.25, npsOrLoan: 0.15, blendedNet: 7.45 }
        : goal === 'balanced'
          ? { safe: 0.35, growth: 0.45, npsOrLoan: 0.2, blendedNet: 9.2 }
          : { safe: 0.2, growth: 0.65, npsOrLoan: 0.15, blendedNet: 10.65 };

    const fd5Y = amount * Math.pow(1 + fdPostTax / 100, 5);
    const smart5Y = amount * Math.pow(1 + splits.blendedNet / 100, 5);
    return {
      fdPostTax,
      splits,
      fd5Y,
      smart5Y,
      extraGain: smart5Y - fd5Y,
    };
  }, [amount, fdRate, taxSlab, goal]);

  return (
    <div className="bg-paper border border-slate-700 shadow-ink/10 shadow-sm rounded-xl p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 border-b border-slate-700/80 pb-4">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-emerald-700" />
          <h2 className="text-base font-bold text-ink">Matured FD Smart Reinvestment Split Calculator</h2>
        </div>
        <span className="text-2xs font-mono text-emerald-700">5-YEAR POST-TAX COMPARISON</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <label className="space-y-1.5">
          <span className="text-ink/70 block">Matured FD Corpus (₹)</span>
          <input
            type="number"
            min={50000}
            step={50000}
            value={amount}
            onChange={(e) => setAmount(Math.max(10000, Number(e.target.value) || 0))}
            className="w-full px-3 py-2 rounded-lg bg-mist border border-slate-700 text-ink font-mono tabular-nums focus:outline-none focus:border-emerald-500"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-ink/70 block">Bank Renewal Rate (% p.a.)</span>
          <input
            type="number"
            step={0.1}
            min={3}
            max={10}
            value={fdRate}
            onChange={(e) => setFdRate(Math.max(1, Number(e.target.value) || 0))}
            className="w-full px-3 py-2 rounded-lg bg-mist border border-slate-700 text-ink font-mono tabular-nums focus:outline-none focus:border-emerald-500"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-ink/70 block">Your Tax Bracket</span>
          <select
            value={taxSlab}
            onChange={(e) => setTaxSlab(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg bg-mist border border-slate-700 text-ink font-mono focus:outline-none focus:border-emerald-500"
          >
            <option value={0}>0% Slab</option>
            <option value={20}>20% Slab</option>
            <option value={30}>30% Slab (+4% cess)</option>
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-ink/70 block">Reinvestment Risk Profile</span>
          <select
            value={goal}
            onChange={(e) => setGoal(e.target.value as 'conservative' | 'balanced' | 'growth')}
            className="w-full px-3 py-2 rounded-lg bg-mist border border-slate-700 text-ink font-mono focus:outline-none focus:border-emerald-500"
          >
            <option value="conservative">Conservative (G-Sec + Arbitrage)</option>
            <option value="balanced">Balanced (G-Sec + Direct MF + NPS)</option>
            <option value="growth">Growth (Direct Index + Flexi Cap)</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-mist border border-slate-700/80">
          <span className="text-2xs text-ink/70 font-mono uppercase">Auto-Renewed FD (5Y Net)</span>
          <div className="text-2xl font-bold text-amber-800 font-mono tabular-nums mt-1">
            {formatInr(metrics.fd5Y)}
          </div>
          <p className="text-xs text-ink/70 mt-1">Effective post-tax yield: {metrics.fdPostTax.toFixed(2)}% p.a.</p>
        </div>

        <div className="p-4 rounded-lg bg-mist border border-emerald-500/35">
          <span className="text-2xs text-emerald-700 font-mono uppercase">Smart Split Portfolio (5Y)</span>
          <div className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
            {formatInr(metrics.smart5Y)}
          </div>
          <p className="text-xs text-ink/70 mt-1">
            {Math.round(metrics.splits.safe * 100)}% Sovereign/Arb · {Math.round(metrics.splits.growth * 100)}% Direct MF ·{' '}
            {Math.round(metrics.splits.npsOrLoan * 100)}% NPS/Loan
          </p>
        </div>

        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
          <span className="text-2xs text-emerald-700 font-mono uppercase">Extra 5-Year Wealth</span>
          <div className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
            +{formatInr(metrics.extraGain)}
          </div>
          <p className="text-xs text-emerald-700 mt-1">Without paying bank or broker commissions</p>
        </div>
      </div>
    </div>
  );
};

const LtcgTaxHarvestingCalc: React.FC = () => {
  const [unrealizedLtcg, setUnrealizedLtcg] = useState(185000);
  const [alreadyRealized, setAlreadyRealized] = useState(0);
  const [npsContribution, setNpsContribution] = useState(50000);
  const [taxSlab, setTaxSlab] = useState(30);

  const metrics = useMemo(() => {
    const remainingLimit = Math.max(0, 125000 - alreadyRealized);
    const harvestableNow = Math.min(unrealizedLtcg, remainingLimit);
    const ltcgTaxSaved = harvestableNow * 0.125 * 1.04;
    const eligibleNps = Math.min(50000, Math.max(0, npsContribution));
    const npsTaxSaved = eligibleNps * (taxSlab / 100) * 1.04;
    return {
      remainingLimit,
      harvestableNow,
      ltcgTaxSaved,
      npsTaxSaved,
      totalTaxAlpha: ltcgTaxSaved + npsTaxSaved,
    };
  }, [unrealizedLtcg, alreadyRealized, npsContribution, taxSlab]);

  return (
    <div className="bg-paper border border-slate-700 shadow-ink/10 shadow-sm rounded-xl p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 border-b border-slate-700/80 pb-4">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-emerald-700" />
          <h2 className="text-base font-bold text-ink">₹1.25L LTCG Harvesting &amp; 80CCD(1B) Calculator</h2>
        </div>
        <span className="text-2xs font-mono text-emerald-700">FY 2025-26 / 2026-27 RULES</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <label className="space-y-1.5">
          <span className="text-ink/70 block">Unrealized Equity LTCG (₹)</span>
          <input
            type="number"
            min={0}
            step={10000}
            value={unrealizedLtcg}
            onChange={(e) => setUnrealizedLtcg(Math.max(0, Number(e.target.value) || 0))}
            className="w-full px-3 py-2 rounded-lg bg-mist border border-slate-700 text-ink font-mono tabular-nums focus:outline-none focus:border-emerald-500"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-ink/70 block">LTCG Already Booked This FY (₹)</span>
          <input
            type="number"
            min={0}
            step={10000}
            value={alreadyRealized}
            onChange={(e) => setAlreadyRealized(Math.max(0, Number(e.target.value) || 0))}
            className="w-full px-3 py-2 rounded-lg bg-mist border border-slate-700 text-ink font-mono tabular-nums focus:outline-none focus:border-emerald-500"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-ink/70 block">NPS 80CCD(1B) Deposit (Max ₹50K)</span>
          <input
            type="number"
            min={0}
            max={50000}
            step={5000}
            value={npsContribution}
            onChange={(e) => setNpsContribution(Math.max(0, Math.min(50000, Number(e.target.value) || 0)))}
            className="w-full px-3 py-2 rounded-lg bg-mist border border-slate-700 text-ink font-mono tabular-nums focus:outline-none focus:border-emerald-500"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-ink/70 block">Income Tax Slab (%)</span>
          <select
            value={taxSlab}
            onChange={(e) => setTaxSlab(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg bg-mist border border-slate-700 text-ink font-mono focus:outline-none focus:border-emerald-500"
          >
            <option value={10}>10% Slab</option>
            <option value={20}>20% Slab</option>
            <option value={30}>30% Slab (+4% cess)</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-mist border border-slate-700/80">
          <span className="text-2xs text-ink/70 font-mono uppercase">Tax-Free LTCG Harvestable</span>
          <div className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
            {formatInr(metrics.harvestableNow)}
          </div>
          <p className="text-xs text-ink/70 mt-1">
            Saves <strong className="text-emerald-700">{formatInr(metrics.ltcgTaxSaved)}</strong> in 12.5% LTCG tax
          </p>
        </div>

        <div className="p-4 rounded-lg bg-mist border border-slate-700/80">
          <span className="text-2xs text-ink/70 font-mono uppercase">NPS 80CCD(1B) Tax Saved</span>
          <div className="text-2xl font-bold text-amber-800 font-mono tabular-nums mt-1">
            {formatInr(metrics.npsTaxSaved)}
          </div>
          <p className="text-xs text-ink/70 mt-1">Old Regime extra deduction beyond ₹1.5L 80C</p>
        </div>

        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
          <span className="text-2xs text-emerald-700 font-mono uppercase">Total Annual Tax Saved</span>
          <div className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
            +{formatInr(metrics.totalTaxAlpha)}
          </div>
          <p className="text-xs text-emerald-700 mt-1">Legal, repeatable tax alpha every FY</p>
        </div>
      </div>
    </div>
  );
};

interface SeoLandingPageProps {
  slug: SeoPageSlug;
}

export const SeoLandingPage: React.FC<SeoLandingPageProps> = ({ slug }) => {
  const page = SEO_PAGES[slug];
  const otherPages = SEO_PAGE_LIST.filter((p) => p.slug !== slug);

  return (
    <div className="min-h-screen bg-mist text-ink flex flex-col">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 border-b border-slate-700/80 bg-mist/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-2.5 group">
            <img src="/logo-240.png" alt="Vestora Wealth logo" className="w-8 h-8 rounded-lg" />
            <span className="text-sm font-bold tracking-wider text-ink group-hover:text-emerald-800 transition-colors">
              VESTORA WEALTH
            </span>
          </a>

          <nav aria-label="Primary" className="hidden md:flex items-center gap-5 text-xs text-ink/70">
            <a href="/" className="hover:text-ink transition-colors">
              Interactive Story
            </a>
            <a href="/#overview" className="hover:text-ink transition-colors">
              Portfolio Overview
            </a>
            <a href="/#rebalance" className="hover:text-ink transition-colors">
              Live Rebalance
            </a>
            <a href="/#tax" className="hover:text-ink transition-colors">
              Tax Audit
            </a>
          </nav>

          <a
            href={page.ctaHref}
            className="px-3.5 py-2 text-xs font-semibold text-paper bg-ink hover:bg-ink/90 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <span>Open Portal</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-ink/70">
          <a href="/" className="hover:text-emerald-800 transition-colors">
            Vestora Wealth
          </a>
          <ChevronRight className="w-3.5 h-3.5 text-ink/50" />
          <span className="text-ink">{page.navLabel}</span>
        </nav>

        {/* Hero */}
        <section className="space-y-4 max-w-4xl">
          <div className="text-2xs font-mono font-bold tracking-widest text-emerald-700 uppercase">
            {page.eyebrow}
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink leading-tight">
            {page.h1}
          </h1>
          <p className="text-sm sm:text-base text-ink/70 leading-relaxed">{page.subtitle}</p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <a
              href={page.ctaHref}
              className="px-4 py-2.5 text-xs font-semibold text-paper bg-ink hover:bg-ink/90 rounded-lg transition-colors inline-flex items-center gap-1.5"
            >
              <span>{page.ctaLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
            <a
              href={page.secondaryCtaHref}
              className="px-4 py-2.5 text-xs font-medium text-ink bg-paper hover:bg-ink/5 border border-slate-700 rounded-lg transition-colors"
            >
              {page.secondaryCtaLabel}
            </a>
            <span className="inline-flex items-center gap-1.5 text-xs text-ink/70">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>0% Commission · 100% On-Device Privacy</span>
            </span>
          </div>
        </section>

        {/* Interactive Calculator */}
        <section aria-label="Interactive Calculator">
          {slug === 'home-loan-vs-fd-calculator' && <HomeLoanVsFdCalc />}
          {slug === 'mutual-fund-rebalance-india' && <MutualFundRebalanceCalc />}
          {slug === 'fd-maturity-reinvestment-guide' && <FdMaturityCalc />}
          {slug === 'ltcg-tax-harvesting-india' && <LtcgTaxHarvestingCalc />}
        </section>

        {/* Comparison Table */}
        <section className="bg-paper border border-slate-700 shadow-ink/10 shadow-sm rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-ink">{page.comparisonHeading}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-700 text-ink/70 font-mono uppercase text-2xs">
                  <th className="py-3 pr-4">Strategy / Option</th>
                  <th className="py-3 px-4">Indicative Yield</th>
                  <th className="py-3 px-4">Tax &amp; Fee Impact</th>
                  <th className="py-3 pl-4">Unbiased Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/80">
                {page.comparisonRows.map((row) => (
                  <tr key={row.option} className="hover:bg-ink/5">
                    <td className="py-3.5 pr-4 font-semibold text-ink">{row.option}</td>
                    <td className="py-3.5 px-4 font-mono text-emerald-700 tabular-nums">{row.typicalReturn}</td>
                    <td className="py-3.5 px-4 text-ink/70">{row.taxImpact}</td>
                    <td className="py-3.5 pl-4 text-ink/70">{row.verdict}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Key Takeaways */}
        <section className="bg-paper border border-slate-700 shadow-ink/10 shadow-sm rounded-xl p-6 space-y-3">
          <h2 className="text-base font-bold text-ink">Key Math Takeaways Before You Decide</h2>
          <ul className="space-y-2.5 text-xs sm:text-sm text-ink/70">
            {page.keyTakeaways.map((point) => (
              <li key={point} className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* FAQ Accordion (Synced with Page JSON-LD) */}
        <section className="bg-paper border border-slate-700 shadow-ink/10 shadow-sm rounded-xl p-6 space-y-4">
          <h2 className="text-base font-bold text-ink">Frequently Asked Questions</h2>
          <div className="divide-y divide-slate-700/80 text-xs sm:text-sm">
            {page.faqs.map((faq) => (
              <details key={faq.q} className="group py-3.5" open>
                <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-semibold text-ink hover:text-emerald-800 transition-colors">
                  <span>{faq.q}</span>
                  <span className="text-ink/50 group-open:rotate-45 transition-transform text-base leading-none">+</span>
                </summary>
                <p className="mt-2 text-ink/70 leading-relaxed pr-6">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Related Guides (Internal SEO Cross-Linking) */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-ink/70 font-mono">
            More Unbiased Vestora Calculators &amp; Guides
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {otherPages.map((rel) => (
              <a
                key={rel.slug}
                href={`/${rel.slug}/`}
                className="p-4 rounded-xl bg-paper border border-slate-700 shadow-ink/10 shadow-sm hover:border-emerald-600/60 hover:bg-ink/5 transition-colors flex flex-col justify-between gap-3 group"
              >
                <div>
                  <span className="text-2xs font-mono text-emerald-700">{rel.eyebrow}</span>
                  <h3 className="text-sm font-bold text-ink group-hover:text-emerald-800 transition-colors mt-1">
                    {rel.navLabel}
                  </h3>
                  <p className="text-xs text-ink/70 mt-1.5 line-clamp-2">{rel.metaDescription}</p>
                </div>
                <span className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1">
                  Open Calculator <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </a>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700/80 bg-mist">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-2xs text-ink/70">
          <p>
            Vestora Wealth runs 100% locally in your browser with zero account sign-up and zero commissions. Figures are educational and not financial or tax advice.
          </p>
          <span className="font-mono text-ink/70 whitespace-nowrap">
            © {new Date().getFullYear()} Vestora Wealth
          </span>
        </div>
      </footer>
    </div>
  );
};
