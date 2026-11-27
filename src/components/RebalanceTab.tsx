import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AssetCategory,
  CurrencyCode,
  DebtPrepaymentRecord,
  Holding,
  TaxTag,
} from '../types/wealth';
import { formatCurrency, formatPercent } from '../utils/currency';
import { CATEGORY_META } from '../utils/portfolioMetrics';
import { computePortfolioRiskScore } from '../utils/taxAndDiversification';
import {
  calculateHomeLoanPrepaymentImpact,
  fetchKuveraCategoryDirectory,
  fetchMutualFundDetails,
  KUVERA_SUBCATEGORIES,
  KuveraFundEntry,
  LISTED_MARKET_INSTRUMENTS,
  MutualFundMarketDetail,
  MutualFundSearchHit,
  searchMarketMutualFunds,
} from '../utils/marketDirectory';
import {
  AMFI_BENCHMARK_CONFIG,
  DiversificationGoal,
  fetchLiveMarketBenchmarks,
  generateSmartDiversificationPlans,
  LiveMarketBenchmarks,
  SmartDiversificationPlan,
  TARGET_MIX_BY_GOAL,
  TaxSlabOption,
} from '../utils/smartDiversification';
import {
  ArrowRight,
  CheckCircle2,
  Coins,
  Home,
  Landmark,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Shuffle,
  Trash2,
  TrendingUp,
} from 'lucide-react';

export interface RebalanceDestination {
  id: string;
  kind: 'MUTUAL_FUND' | 'MARKET_INSTRUMENT' | 'CUSTOM_ASSET' | 'HOME_LOAN';
  title: string;
  subtitle: string;
  category?: AssetCategory;
  institution?: string;
  currency: CurrencyCode;
  allocatedInBase: number;
  expectedRatePct?: number;
  schemeCode?: number;
  navOrPrice?: number;
  gain30dPct?: number;
  tenureDays?: number;
  taxTag?: TaxTag;
  // Home loan specifics
  loanRatePct?: number;
  loanInterestSaved?: number;
  loanMonthsSaved?: number;
}

interface RebalanceTabProps {
  holdings: Holding[];
  initialSourceHoldingId?: string | null;
  prepayments: DebtPrepaymentRecord[];
  onExecuteRebalance: (payload: {
    sourceHoldingId: string;
    movedAmountInBase: number;
    destinations: RebalanceDestination[];
  }) => void;
  onClearPrepayments?: () => void;
  onNavigateToOverview: () => void;
}

type DestinationExplorerTab = 'MF_API' | 'BONDS_FDS' | 'NPS_API' | 'STOCKS_ETFS' | 'HOME_LOAN';
type MarketGroupFilter = 'ALL' | 'FD' | 'GOVT_BOND' | 'CORP_BOND' | 'GOLD';

const POPULAR_MF_CHIPS = [
  'Flexi Cap',
  'Nifty 50',
  'Midcap',
  'Small Cap',
  'Arbitrage',
  'Liquid',
  'Gilt',
  'Corporate Bond',
  'Gold',
  'ELSS',
];

export const RebalanceTab: React.FC<RebalanceTabProps> = ({
  holdings,
  initialSourceHoldingId,
  prepayments,
  onExecuteRebalance,
  onClearPrepayments,
  onNavigateToOverview,
}) => {
  // Step 1: Source holding & break/move amount
  const [sourceHoldingId, setSourceHoldingId] = useState<string>(() => {
    if (initialSourceHoldingId && holdings.some((h) => h.id === initialSourceHoldingId)) {
      return initialSourceHoldingId;
    }
    const preferred =
      holdings.find((h) => h.isMatured) ??
      holdings.find((h) => h.category === 'SAVINGS_CASH') ??
      holdings[0];
    return preferred?.id ?? '';
  });

  useEffect(() => {
    if (initialSourceHoldingId && holdings.some((h) => h.id === initialSourceHoldingId)) {
      setSourceHoldingId(initialSourceHoldingId);
    } else if (!holdings.some((h) => h.id === sourceHoldingId)) {
      const fallback =
        holdings.find((h) => h.isMatured) ??
        holdings.find((h) => h.category === 'SAVINGS_CASH') ??
        holdings[0];
      setSourceHoldingId(fallback?.id ?? '');
    }
  }, [initialSourceHoldingId, holdings, sourceHoldingId]);

  const sourceHolding = useMemo(
    () => holdings.find((h) => h.id === sourceHoldingId) ?? holdings[0] ?? null,
    [holdings, sourceHoldingId]
  );

  const sourceValueInBase = useMemo(
    () =>
      sourceHolding
        ? Math.max(0, Math.round(sourceHolding.currentValue))
        : 0,
    [sourceHolding]
  );

  const [moveAmountInBase, setMoveAmountInBase] = useState<number>(0);
  const skipNextDefaultAmountRef = useRef<boolean>(false);
  const step3Ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (skipNextDefaultAmountRef.current) {
      skipNextDefaultAmountRef.current = false;
      return;
    }
    if (sourceValueInBase > 0) {
      // Default to 100% for matured deposits, 50% for active cash/investments so partial move is obvious
      const defaultPct = sourceHolding?.isMatured ? 1 : 0.5;
      setMoveAmountInBase(Math.round(sourceValueInBase * defaultPct));
    } else {
      setMoveAmountInBase(0);
    }
  }, [sourceHolding?.id, sourceHolding?.isMatured, sourceValueInBase]);

  // Step 2: Destination Market Explorer state
  const [explorerTab, setExplorerTab] = useState<DestinationExplorerTab>('MF_API');

  // Mutual Fund live open API state
  const [mfMode, setMfMode] = useState<'AMFI_SEARCH' | 'KUVERA_RANKED'>('AMFI_SEARCH');
  const [mfQuery, setMfQuery] = useState('Flexi Cap');
  const [mfSearching, setMfSearching] = useState(false);
  const [mfHits, setMfHits] = useState<MutualFundSearchHit[]>([]);
  const [mfHasSearched, setMfHasSearched] = useState(false);
  const [selectedSchemeCode, setSelectedSchemeCode] = useState<number | null>(null);
  const [schemeDetail, setSchemeDetail] = useState<MutualFundMarketDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Kuvera Ranked Category explorer state
  const [kuveraFunds, setKuveraFunds] = useState<KuveraFundEntry[]>([]);
  const [kuveraLoading, setKuveraLoading] = useState(false);
  const [selectedKuveraSubcat, setSelectedKuveraSubcat] = useState<string>('Flexi Cap Fund');
  const [resolvingKuveraCode, setResolvingKuveraCode] = useState<string | null>(null);

  // NPS asset class filter
  const [npsClassFilter, setNpsClassFilter] = useState<'ALL' | 'E' | 'C' | 'G'>('ALL');

  // Listed Bonds / FDs state
  const [marketQuery, setMarketQuery] = useState('');
  const [marketFilter, setMarketFilter] = useState<MarketGroupFilter>('ALL');

  // Custom Bond / FD inline builder
  const [showCustomBondForm, setShowCustomBondForm] = useState(false);
  const [customBondName, setCustomBondName] = useState('');
  const [customBondCat, setCustomBondCat] = useState<'FIXED_DEPOSIT' | 'GOVT_BOND' | 'CORP_BOND'>('FIXED_DEPOSIT');
  const [customBondInstitution, setCustomBondInstitution] = useState('');
  const [customBondRate, setCustomBondRate] = useState('7.75');
  const [customBondDays, setCustomBondDays] = useState('365');

  // Custom Stock / ETF inline builder
  const [customStockName, setCustomStockName] = useState('');
  const [customStockBroker, setCustomStockBroker] = useState('NSE / Zerodha');

  // Home Loan Prepayment state
  const [loanLabel, setLoanLabel] = useState('Home Loan Principal Prepayment');
  const [loanPrincipal, setLoanPrincipal] = useState<number>(() =>
    4500000
  );
  const [loanRatePct, setLoanRatePct] = useState<number>(() =>
    8.55
  );
  const [loanYearsLeft, setLoanYearsLeft] = useState<number>(15);

  // Step 3: Split Allocation Cart
  const [destinations, setDestinations] = useState<RebalanceDestination[]>([]);
  const [executedSummary, setExecutedSummary] = useState<string>('');

  // Smart Diversification Engine state (Option 2: Hybrid Client + Open Market APIs)
  const [smartGoal, setSmartGoal] = useState<DiversificationGoal>('BALANCED');
  const [taxSlabPct, setTaxSlabPct] = useState<TaxSlabOption>(30);
  const [hasHomeLoan, setHasHomeLoan] = useState<boolean>(true);
  const [benchmarks, setBenchmarks] = useState<LiveMarketBenchmarks | null>(null);
  const [benchmarksLoading, setBenchmarksLoading] = useState<boolean>(true);
  const [activeSuggestedPlanId, setActiveSuggestedPlanId] = useState<string | null>(null);

  const loadSmartBenchmarks = () => {
    setBenchmarksLoading(true);
    fetchLiveMarketBenchmarks().then((snap) => {
      setBenchmarks(snap);
      setBenchmarksLoading(false);
    });
  };

  // Load initial Mutual Fund search + Live Benchmark Snapshot
  useEffect(() => {
    let cancelled = false;
    setMfSearching(true);
    searchMarketMutualFunds('Flexi Cap').then((hits) => {
      if (!cancelled) {
        setMfHits(hits);
        setMfHasSearched(true);
        setMfSearching(false);
      }
    });

    setBenchmarksLoading(true);
    fetchLiveMarketBenchmarks().then((snap) => {
      if (!cancelled) {
        setBenchmarks(snap);
        setBenchmarksLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const smartReport = useMemo(
    () =>
      generateSmartDiversificationPlans(
        holdings,
        {
          goal: smartGoal,
          taxSlabPct,
          hasHomeLoan,
          homeLoanRatePct: loanRatePct,
          homeLoanPrincipal: loanPrincipal,
          homeLoanYearsLeft: loanYearsLeft,
        },
        benchmarks
      ),
    [holdings, smartGoal, taxSlabPct, hasHomeLoan, loanRatePct, loanPrincipal, loanYearsLeft, benchmarks]
  );

  const handleApplySuggestedPlan = (plan: SmartDiversificationPlan) => {
    const sourceVal = plan.sourceHolding.currentValue;
    const boundedMove = Math.min(Math.round(sourceVal), Math.max(0, Math.round(plan.moveAmountInBase)));

    if (plan.sourceHolding.id !== sourceHoldingId) {
      skipNextDefaultAmountRef.current = true;
      setSourceHoldingId(plan.sourceHolding.id);
    }
    setMoveAmountInBase(boundedMove);
    setDestinations(plan.destinations.map((d) => ({ ...d })));
    setActiveSuggestedPlanId(plan.id);
    setExecutedSummary('');

    setTimeout(() => {
      step3Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  };

  const handleMfSearch = async (queryOverride?: string) => {
    const q = (queryOverride ?? mfQuery).trim();
    if (!q) return;
    if (queryOverride !== undefined) setMfQuery(queryOverride);
    setMfSearching(true);
    setSelectedSchemeCode(null);
    setSchemeDetail(null);
    const hits = await searchMarketMutualFunds(q);
    setMfHits(hits);
    setMfHasSearched(true);
    setMfSearching(false);
  };

  const handleOpenKuveraRanked = async () => {
    setMfMode('KUVERA_RANKED');
    if (kuveraFunds.length > 0 || kuveraLoading) return;
    setKuveraLoading(true);
    const list = await fetchKuveraCategoryDirectory();
    setKuveraFunds(list);
    setKuveraLoading(false);
  };

  const rankedKuveraMatches = useMemo(() => {
    if (kuveraFunds.length === 0) return [];
    return kuveraFunds
      .filter((f) => f.subCategory === selectedKuveraSubcat && (f.cagr3y !== null || f.cagr1y !== null))
      .sort((a, b) => (b.cagr3y ?? b.cagr1y ?? -99) - (a.cagr3y ?? a.cagr1y ?? -99))
      .slice(0, 20);
  }, [kuveraFunds, selectedKuveraSubcat]);

  const handleInspectMf = async (schemeCode: number) => {
    if (selectedSchemeCode === schemeCode && schemeDetail) {
      setSelectedSchemeCode(null);
      return;
    }
    setSelectedSchemeCode(schemeCode);
    setLoadingDetail(true);
    const detail = await fetchMutualFundDetails(schemeCode);
    setSchemeDetail(detail);
    setLoadingDetail(false);
  };

  // Cart allocation math
  const allocatedTotal = useMemo(
    () => destinations.reduce((sum, d) => sum + (Number.isFinite(d.allocatedInBase) ? d.allocatedInBase : 0), 0),
    [destinations]
  );
  const unallocatedAmount = Math.max(0, moveAmountInBase - allocatedTotal);
  const isOverAllocated = allocatedTotal > moveAmountInBase + 1;

  const suggestNextAmount = () => {
    if (unallocatedAmount > 0) return unallocatedAmount;
    if (moveAmountInBase > 0 && destinations.length === 0) return moveAmountInBase;
    return Math.round(moveAmountInBase * 0.25);
  };

  const addDestinationToCart = (dest: Omit<RebalanceDestination, 'allocatedInBase'> & { allocatedInBase?: number }) => {
    const amount = dest.allocatedInBase ?? suggestNextAmount();
    setDestinations((prev) => {
      // Prevent exact duplicate id — bump allocation or replace if already added
      const exists = prev.find((item) => item.id === dest.id);
      if (exists) return prev;
      return [...prev, { ...dest, allocatedInBase: Math.max(0, amount) }];
    });
    setExecutedSummary('');
  };

  const handleUpdateDestAmount = (id: string, val: number) => {
    setDestinations((prev) =>
      prev.map((d) => (d.id === id ? { ...d, allocatedInBase: Math.max(0, val) } : d))
    );
  };

  const handleSplitEvenly = () => {
    if (destinations.length === 0 || moveAmountInBase <= 0) return;
    const each = Math.floor(moveAmountInBase / destinations.length);
    const remainder = moveAmountInBase - each * destinations.length;
    setDestinations((prev) =>
      prev.map((d, idx) => ({
        ...d,
        allocatedInBase: each + (idx === 0 ? remainder : 0),
      }))
    );
  };

  const handleRemoveDestination = (id: string) => {
    setDestinations((prev) => prev.filter((d) => d.id !== id));
  };

  // Filtered Bonds / FDs + Live India G-Secs
  const allBondAndFdCatalog = useMemo(
    () => [
      ...(benchmarks?.indiaGsecs ?? []),
      ...LISTED_MARKET_INSTRUMENTS.filter((item) => item.group !== 'STOCK_ETF'),
    ],
    [benchmarks?.indiaGsecs]
  );

  const filteredNpsSchemes = useMemo(() => {
    const list = benchmarks?.npsSchemes ?? [];
    const byClass = npsClassFilter === 'ALL' ? list : list.filter((s) => s.assetClass === npsClassFilter);
    return [...byClass].sort((a, b) => (b.cagr3yPct ?? 0) - (a.cagr3yPct ?? 0));
  }, [benchmarks?.npsSchemes, npsClassFilter]);

  const filteredBondsAndFds = useMemo(() => {
    const q = marketQuery.trim().toLowerCase();
    return allBondAndFdCatalog.filter((item) => {
      if (marketFilter !== 'ALL' && item.group !== marketFilter) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.issuer.toLowerCase().includes(q) ||
        item.rating.toLowerCase().includes(q) ||
        item.currency.toLowerCase().includes(q)
      );
    });
  }, [allBondAndFdCatalog, marketFilter, marketQuery]);

  const filteredStocksAndEtfs = useMemo(() => {
    const q = marketQuery.trim().toLowerCase();
    return LISTED_MARKET_INSTRUMENTS.filter((item) => {
      if (item.group !== 'STOCK_ETF') return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.issuer.toLowerCase().includes(q) ||
        item.rating.toLowerCase().includes(q)
      );
    });
  }, [marketQuery]);

  // Live Home Loan impact calculation for staged prepayment amount
  const stagedLoanAmount = useMemo(() => {
    const existingLoanDest = destinations.find((d) => d.kind === 'HOME_LOAN');
    if (existingLoanDest) return existingLoanDest.allocatedInBase;
    return unallocatedAmount > 0 ? unallocatedAmount : moveAmountInBase;
  }, [destinations, unallocatedAmount, moveAmountInBase]);

  const homeLoanImpact = useMemo(
    () =>
      calculateHomeLoanPrepaymentImpact(
        loanPrincipal,
        loanRatePct,
        loanYearsLeft * 12,
        stagedLoanAmount
      ),
    [loanPrincipal, loanRatePct, loanYearsLeft, stagedLoanAmount]
  );

  // Before -> After Portfolio Risk Score simulation
  const riskSimulation = useMemo(() => {
    const before = computePortfolioRiskScore(holdings);
    if (!sourceHolding || destinations.length === 0 || moveAmountInBase <= 0) {
      return { before, after: before };
    }

    const simulatedHoldings: Holding[] = [];
    const sourceMovedRatio = sourceValueInBase > 0 ? Math.min(1, moveAmountInBase / sourceValueInBase) : 0;

    holdings.forEach((h) => {
      if (h.id !== sourceHolding.id) {
        simulatedHoldings.push(h);
        return;
      }
      if (sourceMovedRatio < 0.995) {
        const remainRatio = 1 - sourceMovedRatio;
        simulatedHoldings.push({
          ...h,
          currentValue: h.currentValue * remainRatio,
          investedAmount: h.investedAmount * remainRatio,
        });
      }
    });

    destinations.forEach((dest, idx) => {
      if (dest.kind === 'HOME_LOAN' || dest.allocatedInBase <= 0) return;
      const valInDestCcy = dest.allocatedInBase;
      simulatedHoldings.push({
        id: `sim-dest-${idx}`,
        name: dest.title,
        category: dest.category ?? 'MUTUAL_FUND',
        institution: dest.institution ?? 'Market',
        investedAmount: valInDestCcy,
        currentValue: valInDestCcy,
        currency: dest.currency,
        interestRatePct: dest.expectedRatePct,
        purchaseDate: '2026-11-16',
        unrealizedGain: 0,
        unrealizedGainPct: 0,
        taxTag: dest.taxTag ?? 'LTCG_EQUITY',
      });
    });

    const after = computePortfolioRiskScore(simulatedHoldings);
    return { before, after };
  }, [holdings, sourceHolding, sourceValueInBase, moveAmountInBase, destinations]);

  const totalDebtRetired = useMemo(
    () => prepayments.reduce((s, p) => s + p.amountInBase, 0),
    [prepayments]
  );
  const totalInterestSaved = useMemo(
    () => prepayments.reduce((s, p) => s + p.interestSaved, 0),
    [prepayments]
  );

  const canExecute =
    Boolean(sourceHolding) &&
    moveAmountInBase > 0 &&
    destinations.length > 0 &&
    allocatedTotal > 0 &&
    !isOverAllocated;

  const handleConfirmExecute = () => {
    if (!canExecute || !sourceHolding) return;
    // Refresh Home Loan saved stats using exact destination amount
    const finalizedDestinations = destinations.map((d) => {
      if (d.kind !== 'HOME_LOAN') return d;
      const impact = calculateHomeLoanPrepaymentImpact(
        loanPrincipal,
        d.loanRatePct ?? loanRatePct,
        loanYearsLeft * 12,
        d.allocatedInBase
      );
      return {
        ...d,
        loanInterestSaved: impact.interestSaved,
        loanMonthsSaved: impact.monthsSaved,
      };
    });

    onExecuteRebalance({
      sourceHoldingId: sourceHolding.id,
      movedAmountInBase: allocatedTotal,
      destinations: finalizedDestinations,
    });

    setExecutedSummary(
      `Rebalanced ${formatCurrency(allocatedTotal, { compact: false })} from ${sourceHolding.name} across ${finalizedDestinations.length} destination${finalizedDestinations.length > 1 ? 's' : ''}.`
    );
    setDestinations([]);
  };

  if (holdings.length === 0) {
    return (
      <div className="bg-paper border border-slate-700 shadow-ink/10 shadow-sm rounded-xl p-10 text-center space-y-3">
        <Shuffle className="w-8 h-8 text-emerald-700 mx-auto" />
        <h2 className="text-base font-bold text-ink">Add or Import Holdings to Rebalance</h2>
        <p className="text-xs text-ink/70 max-w-md mx-auto">
          Once you have at least one holding (such as Savings Cash, Mutual Funds, Stocks, or FDs), you can break partial or full capital here and diversify across market funds, bonds, FDs, or Home Loan prepayments.
        </p>
        <button
          type="button"
          onClick={onNavigateToOverview}
          className="px-4 py-2 text-xs font-semibold text-paper bg-ink hover:bg-ink/90 rounded-lg transition-colors"
        >
          Go to Overview
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-paper border border-slate-700 shadow-ink/10 shadow-sm rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-ink tracking-tight">
              Holistic Rebalance, Market Search &amp; Diversification
            </h2>
            <span className="text-2xs font-mono text-emerald-700">
              Live AMFI · NPS · GoI G-Sec · Kuvera APIs
            </span>
          </div>
          <p className="text-xs text-ink/70 mt-1 max-w-3xl leading-relaxed">
            Break partial or full capital from any holding — Savings Account, Mutual Fund, Stock, FD, or Bond — and re-allocate into 40,000+ live Mutual Funds, NPS Tier-I pensions, GoI G-Secs &amp; T-Bills, listed Bonds &amp; FDs, Equity ETFs, or Home Loan principal prepayment.
          </p>
        </div>

        {prepayments.length > 0 && (
          <div className="bg-mist border border-emerald-500/30 rounded-xl px-4 py-2.5 text-xs font-mono shrink-0">
            <div className="text-2xs text-ink/70">Cumulative Debt Prepayment</div>
            <div className="text-emerald-700 font-bold tabular-nums mt-0.5">
              {formatCurrency(totalDebtRetired, { compact: true })} paid ·{' '}
              {formatCurrency(totalInterestSaved, { compact: true })} interest saved
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Notice after executing a rebalance */}
      {executedSummary && (
        <div className="px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-ink">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{executedSummary}</span>
          </div>
          <button
            type="button"
            onClick={onNavigateToOverview}
            className="text-xs font-semibold text-emerald-800 hover:text-emerald-800 inline-flex items-center gap-1 whitespace-nowrap"
          >
            <span>View Updated Overview</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Smart Diversification Suggestions (Hybrid Client Rules + Live AMFI & GoI G-Sec APIs) */}
      <section
        aria-label="Smart Diversification Suggestions"
        className="bg-paper border border-slate-700 shadow-ink/10 shadow-sm rounded-xl p-5 space-y-5"
      >
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 border-b border-ink/10 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink/70">
              <span className="font-semibold text-emerald-700">Smart Diversification Suggestions</span>
              <span aria-hidden="true">·</span>
              <span>
                {benchmarksLoading
                  ? 'Syncing live AMFI, NPS Tier-I, GoI G-Sec & Gold feeds...'
                  : benchmarks && (benchmarks.liveFundCount > 0 || benchmarks.npsSchemes.length > 0)
                  ? `Live AMFI (${benchmarks.liveFundCount}/7) · NPS (${benchmarks.npsSchemes.length}) · GoI G-Sec (${benchmarks.indiaGsecs.length}) · synced at ${benchmarks.fetchedAt}`
                  : 'Rule-based market estimates (offline fallback)'}
              </span>
            </div>
            <h3 className="text-base font-bold text-ink">
              Portfolio-Specific Rebalance Plans Built from Live Market Yields
            </h3>
            <p className="text-xs text-ink/70 max-w-3xl">
              {TARGET_MIX_BY_GOAL[smartGoal].subtitle}. Calculations adjust automatically for your tax bracket and optional home loan rate.
            </p>
          </div>

          <button
            type="button"
            onClick={loadSmartBenchmarks}
            disabled={benchmarksLoading}
            className="px-3 py-1.5 text-xs font-medium text-ink bg-mist hover:bg-ink/5 border border-slate-700 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-700 ${benchmarksLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Live Market Data</span>
          </button>
        </div>

        {/* Interactive Tuning Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <div className="text-xs font-medium text-ink/70 mb-1.5">Target Allocation Goal</div>
            <div className="grid grid-cols-3 gap-1 p-1 bg-mist border border-slate-700 rounded-lg">
              {(['CONSERVATIVE', 'BALANCED', 'GROWTH'] as DiversificationGoal[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setSmartGoal(g)}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    smartGoal === g
                      ? 'bg-ink text-paper'
                      : 'text-ink/70 hover:text-ink'
                  }`}
                >
                  {TARGET_MIX_BY_GOAL[g].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-ink/70 mb-1.5">Income Tax Bracket</div>
            <div className="grid grid-cols-4 gap-1 p-1 bg-mist border border-slate-700 rounded-lg">
              {([0, 10, 20, 30] as TaxSlabOption[]).map((slab) => (
                <button
                  key={slab}
                  type="button"
                  onClick={() => setTaxSlabPct(slab)}
                  className={`px-2 py-1.5 text-xs font-mono font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    taxSlabPct === slab
                      ? 'bg-ink text-paper'
                      : 'text-ink/70 hover:text-ink'
                  }`}
                >
                  {slab}%
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-ink/70 mb-1.5">Active Home Loan Comparison</div>
            <div className="flex items-center gap-2">
              <div className="grid grid-cols-2 gap-1 p-1 bg-mist border border-slate-700 rounded-lg flex-1">
                <button
                  type="button"
                  onClick={() => setHasHomeLoan(true)}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    hasHomeLoan ? 'bg-ink text-paper' : 'text-ink/70 hover:text-ink'
                  }`}
                >
                  Include Loan
                </button>
                <button
                  type="button"
                  onClick={() => setHasHomeLoan(false)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    !hasHomeLoan ? 'bg-ink text-paper' : 'text-ink/70 hover:text-ink'
                  }`}
                >
                  Debt-Free
                </button>
              </div>
              {hasHomeLoan && (
                <div className="flex items-center gap-1 bg-paper border border-slate-700 rounded-lg px-2.5 py-1.5 shrink-0">
                  <input
                    type="number"
                    step="0.05"
                    min={0}
                    max={25}
                    value={loanRatePct}
                    onChange={(e) => setLoanRatePct(Math.max(0, Number(e.target.value) || 0))}
                    aria-label="Home loan rate percentage"
                    className="w-12 bg-transparent text-xs font-mono font-bold text-ink focus:outline-none tabular-nums text-right"
                  />
                  <span className="text-xs font-mono text-ink/70">%</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Current vs Target Portfolio Mix Comparison Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 border-t border-ink/10 text-xs">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-ink/70 font-medium">Current Mix vs. {TARGET_MIX_BY_GOAL[smartGoal].label} Target</span>
              <span className="font-mono text-ink/70 tabular-nums">
                Total {formatCurrency(smartReport.analysis.totalValuation, { compact: true })}
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="h-2.5 w-full rounded-sm overflow-hidden flex bg-mist">
                <div
                  style={{ width: `${smartReport.analysis.currentPct.equity}%` }}
                  className="bg-equity transition-all"
                  title={`Equity: ${smartReport.analysis.currentPct.equity}%`}
                />
                <div
                  style={{ width: `${smartReport.analysis.currentPct.debt}%` }}
                  className="bg-debt transition-all"
                  title={`Debt & FD: ${smartReport.analysis.currentPct.debt}%`}
                />
                <div
                  style={{ width: `${smartReport.analysis.currentPct.gold}%` }}
                  className="bg-gold transition-all"
                  title={`Gold: ${smartReport.analysis.currentPct.gold}%`}
                />
                <div
                  style={{ width: `${smartReport.analysis.currentPct.cash}%` }}
                  className="bg-cash transition-all"
                  title={`Cash: ${smartReport.analysis.currentPct.cash}%`}
                />
              </div>
              <div className="h-1.5 w-full rounded-sm overflow-hidden flex bg-mist opacity-60">
                <div style={{ width: `${smartReport.analysis.targetPct.equity}%` }} className="bg-equity" />
                <div style={{ width: `${smartReport.analysis.targetPct.debt}%` }} className="bg-debt" />
                <div style={{ width: `${smartReport.analysis.targetPct.gold}%` }} className="bg-gold" />
                <div style={{ width: `${smartReport.analysis.targetPct.cash}%` }} className="bg-cash" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 pt-1 font-mono text-2xs tabular-nums">
              {(
                [
                  { key: 'equity', label: 'Equity', dot: 'bg-equity' },
                  { key: 'debt', label: 'Debt/FD', dot: 'bg-debt' },
                  { key: 'gold', label: 'Gold', dot: 'bg-gold' },
                  { key: 'cash', label: 'Cash', dot: 'bg-cash' },
                ] as const
              ).map((b) => {
                const curr = smartReport.analysis.currentPct[b.key];
                const targ = smartReport.analysis.targetPct[b.key];
                const diff = curr - targ;
                return (
                  <div key={b.key} className="text-ink/70">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-xs ${b.dot}`} />
                      <span>{b.label}</span>
                    </div>
                    <div className="text-ink font-semibold mt-0.5">
                      {curr}% <span className="text-ink/70">/ {targ}%</span>
                    </div>
                    <div
                      className={
                        Math.abs(diff) <= 4
                          ? 'text-ink/70'
                          : diff > 0
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                      }
                    >
                      {diff > 0 ? `+${diff}% over` : diff < 0 ? `${diff}% under` : 'On target'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Market Reference Benchmarks */}
          <div className="bg-mist border border-slate-700 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between text-2xs text-ink/70">
              <span className="font-medium text-ink">
                Live Indian Benchmarks (AMFI · GoI G-Sec · NPS · Gold)
              </span>
              <span className="font-mono">Yield / 3Y CAGR</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-2xs font-mono tabular-nums">
              {AMFI_BENCHMARK_CONFIG.slice(0, 4).map((cfg) => {
                const det = benchmarks?.funds[cfg.id];
                const cagr = det?.cagr3yPct ?? det?.cagr1yPct;
                return (
                  <div key={cfg.id} className="flex items-center justify-between gap-2 border-b border-ink/10 pb-1">
                    <span className="text-ink/70 truncate">{cfg.id.replace('_', ' ')}</span>
                    <span className="text-emerald-700 font-semibold shrink-0">
                      {cagr !== null && cagr !== undefined ? `${cagr.toFixed(1)}%` : `${cfg.fallbackYieldPct}%`}
                      {det?.annualizedVolatilityPct ? (
                        <span className="text-ink/70 font-normal"> · {det.annualizedVolatilityPct}%v</span>
                      ) : null}
                    </span>
                  </div>
                );
              })}
              <div className="flex items-center justify-between gap-2 border-b border-ink/10 pb-1">
                <span className="text-ink/70 truncate">INDIA G-SEC</span>
                <span className="text-emerald-700 font-semibold shrink-0">
                  {benchmarks?.indiaGsecs[0]
                    ? `${benchmarks.indiaGsecs[0].rateOrYieldPct.toFixed(2)}%`
                    : '6.78%'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 border-b border-ink/10 pb-1">
                <span className="text-ink/70 truncate">NPS TOP E</span>
                <span className="text-emerald-700 font-semibold shrink-0">
                  {benchmarks?.npsSchemes.length
                    ? `${Math.max(...benchmarks.npsSchemes.map((s) => s.cagr3yPct ?? 0)).toFixed(1)}%`
                    : '12.2%'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 border-b border-ink/10 pb-1">
                <span className="text-ink/70 truncate">24K GOLD</span>
                <span className="text-amber-800 font-semibold shrink-0">
                  {benchmarks?.goldInrPer10g
                    ? `₹${(benchmarks.goldInrPer10g / 1000).toFixed(1)}k/10g`
                    : '₹116k/10g'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 border-b border-ink/10 pb-1">
                <span className="text-ink/70 truncate">364D T-BILL</span>
                <span className="text-emerald-700 font-semibold shrink-0">
                  {benchmarks?.indiaGsecs.find((g) => /364/i.test(g.name))?.rateOrYieldPct.toFixed(2) ?? '6.54'}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Recommended Actionable Diversification Plans */}
        {smartReport.plans.length === 0 ? (
          <div className="py-6 text-center text-xs text-ink/70 border-t border-ink/10">
            Your portfolio is already closely aligned with your {TARGET_MIX_BY_GOAL[smartGoal].label} target. Use Steps 1–3 below to customize any manual move.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 border-t border-ink/10">
            {smartReport.plans.map((plan) => {
              const isStaged = activeSuggestedPlanId === plan.id && destinations.length > 0;
              return (
                <article
                  key={plan.id}
                  className={`rounded-xl p-4 border flex flex-col justify-between gap-4 transition-colors ${
                    isStaged
                      ? 'bg-emerald-500/10 border-emerald-500'
                      : 'bg-mist border-slate-700 hover:border-ink/40'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-2xs text-ink/70">
                      <span className="font-medium text-emerald-700">{plan.categoryLabel}</span>
                      <span className="font-mono tabular-nums text-emerald-700 font-semibold">
                        {plan.benefitSummary}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-ink leading-snug">{plan.title}</h4>
                    <p className="text-xs text-ink/70 leading-relaxed">{plan.rationale}</p>

                    <div className="pt-2 border-t border-ink/10 space-y-1.5 text-2xs">
                      <div className="flex items-center justify-between text-ink/70 font-mono">
                        <span>Source: {plan.sourceHolding.name}</span>
                        <span className="text-ink font-semibold tabular-nums">
                          -{formatCurrency(plan.moveAmountInBase, { compact: true })}
                        </span>
                      </div>
                      {plan.destinations.map((dest) => (
                        <div
                          key={dest.id}
                          className="flex items-center justify-between gap-2 text-ink/70 font-mono"
                        >
                          <span className="truncate">→ {dest.title}</span>
                          <span className="text-emerald-700 font-semibold shrink-0 tabular-nums">
                            +{formatCurrency(dest.allocatedInBase, { compact: true })}
                            {dest.expectedRatePct ? ` (${dest.expectedRatePct.toFixed(1)}%)` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-ink/10 flex items-center justify-between gap-3">
                    <div className="text-2xs font-mono text-ink/70 tabular-nums">
                      Risk Score:{' '}
                      <span className="text-ink font-semibold">{plan.riskBefore}</span>
                      {' → '}
                      <span className="text-emerald-700 font-bold">
                        {plan.riskAfter} ({plan.postureAfter})
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleApplySuggestedPlan(plan)}
                      className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                        isStaged
                          ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/50'
                          : 'bg-ink hover:bg-ink/90 text-paper'
                      }`}
                    >
                      {isStaged ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Staged in Step 3</span>
                        </>
                      ) : (
                        <>
                          <span>Stage Plan in Rebalance</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Main 2-Column Builder: Step 1 (Source) + Step 2 (Open-API Market Explorer) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT (5 cols): Step 1 — Select Source Holding & Partial/Full Amount */}
        <section
          aria-label="Step 1: Source Capital"
          className="lg:col-span-5 bg-paper border border-slate-700 shadow-ink/10 shadow-sm rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-2xs font-mono uppercase tracking-wider text-emerald-700 font-semibold">
                Step 1 · Break or Move From
              </span>
              <h3 className="text-sm font-bold text-ink mt-0.5">Select Source Holding</h3>
            </div>
            <span className="text-2xs font-mono text-ink/70">{holdings.length} holdings</span>
          </div>

          {/* Holding Selector List */}
          <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
            {holdings.map((h) => {
              const val = h.currentValue;
              const isSelected = sourceHolding?.id === h.id;
              const catLabel = CATEGORY_META[h.category]?.shortLabel ?? h.category;
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => {
                    setSourceHoldingId(h.id);
                    setDestinations([]);
                    setActiveSuggestedPlanId(null);
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition-colors flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500/40'
                      : 'bg-mist border-slate-700 hover:border-ink/40'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-ink truncate">{h.name}</span>
                      {h.isMatured && (
                        <span className="text-2xs font-mono text-amber-800 shrink-0">Matured</span>
                      )}
                    </div>
                    <div className="text-2xs text-ink/70 mt-0.5 truncate">
                      {catLabel} · {h.institution}
                    </div>
                  </div>
                  <div className="text-right font-mono shrink-0 tabular-nums">
                    <div className="text-xs font-bold text-ink">
                      {formatCurrency(val, { compact: true })}
                    </div>
                    <div className={`text-2xs ${h.unrealizedGainPct >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {formatPercent(h.unrealizedGainPct, 1)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Break / Transfer Amount Controls */}
          {sourceHolding && (
            <div className="pt-3 border-t border-ink/10 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink/70 font-medium">
                  Amount to Break / Move (INR)
                </span>
                <div className="flex items-center gap-1">
                  {[0.25, 0.5, 0.75, 1].map((pct) => {
                    const target = Math.round(sourceValueInBase * pct);
                    const active = Math.abs(moveAmountInBase - target) <= 5;
                    return (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setMoveAmountInBase(target)}
                        className={`px-2 py-0.5 text-2xs font-mono font-semibold rounded transition-colors ${
                          active
                            ? 'bg-ink text-paper'
                            : 'bg-paper border border-slate-700 text-ink/70 hover:text-ink'
                        }`}
                      >
                        {pct * 100}%
                      </button>
                    );
                  })}
                </div>
              </div>

              <input
                type="number"
                min={0}
                max={sourceValueInBase}
                value={moveAmountInBase}
                onChange={(e) => {
                  const val = Math.max(0, Math.min(sourceValueInBase, Number(e.target.value) || 0));
                  setMoveAmountInBase(val);
                }}
                className="w-full bg-paper border border-slate-700 focus:border-emerald-500 rounded-lg px-3 py-2 text-sm font-mono font-bold text-ink focus:outline-none tabular-nums"
              />

              <input
                type="range"
                min={0}
                max={Math.max(1, sourceValueInBase)}
                step={Math.max(1, Math.round(sourceValueInBase / 100))}
                value={moveAmountInBase}
                onChange={(e) => setMoveAmountInBase(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
                aria-label="Percentage of holding to break or move"
              />

              <div className="grid grid-cols-2 gap-2 text-2xs font-mono bg-mist border border-slate-700 rounded-lg p-3">
                <div>
                  <span className="text-ink/70 block">Staged to Diversify</span>
                  <span className="text-emerald-700 font-bold text-xs tabular-nums">
                    {formatCurrency(moveAmountInBase, { compact: false })}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-ink/70 block">Remaining in Source</span>
                  <span className="text-ink font-semibold text-xs tabular-nums">
                    {sourceValueInBase - moveAmountInBase <= 1
                      ? 'Full Exit (0)'
                      : formatCurrency(sourceValueInBase - moveAmountInBase, { compact: false })}
                  </span>
                </div>
              </div>

              {sourceHolding.category === 'SAVINGS_CASH' && (
                <p className="text-2xs text-emerald-700 leading-relaxed">
                  Breaking part of a Savings Account keeps the remaining cash liquid while putting idle surplus to work.
                </p>
              )}
              {(sourceHolding.category === 'MUTUAL_FUND' || sourceHolding.category === 'EQUITY_STOCK') && (
                <p className="text-2xs text-ink/70 leading-relaxed">
                  Partial redemption reduces units &amp; cost basis proportionally without closing your remaining holding.
                </p>
              )}
            </div>
          )}
        </section>

        {/* RIGHT (7 cols): Step 2 — Search Market Funds, Listed Bonds/FDs, ETFs & Home Loan */}
        <section
          aria-label="Step 2: Market Search and Destinations"
          className="lg:col-span-7 bg-paper border border-slate-700 shadow-ink/10 shadow-sm rounded-xl p-5 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-2xs font-mono uppercase tracking-wider text-emerald-700 font-semibold">
                Step 2 · Diversify Anywhere
              </span>
              <h3 className="text-sm font-bold text-ink mt-0.5">
                Search Market Funds, Bonds, FDs, Stocks or Pay Home Loan
              </h3>
            </div>
          </div>

          {/* 5-Category Explorer Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 p-1 bg-mist border border-slate-700 rounded-lg">
            {(
              [
                { id: 'MF_API', label: 'Mutual Funds', icon: TrendingUp },
                { id: 'BONDS_FDS', label: 'Bonds & FDs', icon: Landmark },
                { id: 'NPS_API', label: 'NPS (Live)', icon: ShieldCheck },
                { id: 'STOCKS_ETFS', label: 'Stocks & ETFs', icon: Coins },
                { id: 'HOME_LOAN', label: 'Home Loan', icon: Home },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = explorerTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setExplorerTab(tab.id)}
                  className={`px-2 py-2 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-ink text-paper'
                      : 'text-ink/70 hover:text-ink hover:bg-ink/5'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* TAB A: Live Open-API Mutual Fund Search (api.mfapi.in + api.kuvera.in Ranked Tree) */}
          {explorerTab === 'MF_API' && (
            <div className="space-y-3">
              {/* Sub-mode Toggle: AMFI Text Search vs Kuvera Ranked by Category */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center p-1 bg-mist border border-slate-700 rounded-lg gap-1">
                  <button
                    type="button"
                    onClick={() => setMfMode('AMFI_SEARCH')}
                    className={`px-3 py-1.5 text-2xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      mfMode === 'AMFI_SEARCH'
                        ? 'bg-ink text-paper'
                        : 'text-ink/70 hover:text-ink'
                    }`}
                  >
                    Search 40,000+ (AMFI API)
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenKuveraRanked}
                    className={`px-3 py-1.5 text-2xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      mfMode === 'KUVERA_RANKED'
                        ? 'bg-ink text-paper'
                        : 'text-ink/70 hover:text-ink'
                    }`}
                  >
                    Top Ranked by Category (Kuvera API)
                  </button>
                </div>
                <span className="text-2xs font-mono text-ink/70">
                  {mfMode === 'AMFI_SEARCH' ? 'Direct NAV + History' : 'Sorted by 3Y CAGR'}
                </span>
              </div>

              {mfMode === 'KUVERA_RANKED' ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {KUVERA_SUBCATEGORIES.map((subcat) => (
                      <button
                        key={subcat}
                        type="button"
                        onClick={() => setSelectedKuveraSubcat(subcat)}
                        className={`px-2.5 py-1 text-2xs font-semibold rounded-md border transition-colors whitespace-nowrap ${
                          selectedKuveraSubcat === subcat
                            ? 'bg-ink border-ink text-paper'
                            : 'bg-paper border-slate-700 text-ink/70 hover:text-ink'
                        }`}
                      >
                        {subcat}
                      </button>
                    ))}
                  </div>

                  <div className="border border-slate-700 rounded-xl bg-mist divide-y divide-slate-700/60 max-h-[340px] overflow-y-auto">
                    {kuveraLoading ? (
                      <div className="py-10 text-center text-xs text-ink/70 flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
                        <span>Loading live categorized Direct-Growth rankings...</span>
                      </div>
                    ) : rankedKuveraMatches.length === 0 ? (
                      <div className="py-10 text-center text-xs text-ink/70">
                        No Direct-Growth schemes found in this category.
                      </div>
                    ) : (
                      rankedKuveraMatches.map((fund) => {
                        const destId = `kuv-${fund.code}`;
                        const alreadyInCart = destinations.some((d) => d.id === destId);
                        const isResolving = resolvingKuveraCode === fund.code;
                        return (
                          <div key={fund.code} className="p-3 flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold text-ink leading-snug">
                                {fund.name}
                              </div>
                              <div className="text-2xs font-mono text-ink/70 mt-1 flex flex-wrap items-center gap-x-2 tabular-nums">
                                <span>{fund.topCategory} · {fund.subCategory}</span>
                                <span>·</span>
                                <span className="text-emerald-700 font-semibold">
                                  3Y: {fund.cagr3y !== null ? `${fund.cagr3y.toFixed(1)}%` : '—'}
                                </span>
                                <span>1Y: {fund.cagr1y !== null ? `${fund.cagr1y.toFixed(1)}%` : '—'}</span>
                                {fund.cagr5y !== null && <span>5Y: {fund.cagr5y.toFixed(1)}%</span>}
                                {fund.volatility !== null && <span>Vol: {fund.volatility.toFixed(1)}%</span>}
                              </div>
                            </div>

                            <button
                              type="button"
                              disabled={alreadyInCart || isResolving || moveAmountInBase <= 0}
                              onClick={async () => {
                                setResolvingKuveraCode(fund.code);
                                const cleanQuery = fund.name
                                  .replace(/Direct Plan|Growth|Option/gi, '')
                                  .trim()
                                  .split(/\s+/)
                                  .slice(0, 4)
                                  .join(' ');
                                const amfiHits = await searchMarketMutualFunds(cleanQuery);
                                const matchedCode = amfiHits[0]?.schemeCode;
                                const amfiDetail = matchedCode
                                  ? await fetchMutualFundDetails(matchedCode)
                                  : null;
                                const isDebtMf =
                                  /Debt|Arbitrage|Liquid|Gilt|Money Market|Corporate Bond|Floater/i.test(
                                    `${fund.topCategory} ${fund.subCategory}`
                                  );

                                addDestinationToCart({
                                  id: destId,
                                  kind: 'MUTUAL_FUND',
                                  title: fund.name,
                                  subtitle: amfiDetail
                                    ? `${amfiDetail.fundHouse} · NAV ₹${amfiDetail.latestNav.toFixed(2)} · 3Y ${fund.cagr3y?.toFixed(1) ?? '—'}%`
                                    : `${fund.subCategory} · 3Y CAGR ${fund.cagr3y?.toFixed(1) ?? '—'}%`,
                                  category: 'MUTUAL_FUND',
                                  institution: amfiDetail?.fundHouse ?? 'AMFI / Kuvera Direct',
                                  currency: 'INR',
                                  schemeCode: matchedCode,
                                  navOrPrice: amfiDetail?.latestNav,
                                  expectedRatePct: fund.cagr3y ?? fund.cagr1y ?? (isDebtMf ? 7.2 : 13.0),
                                  taxTag: isDebtMf ? 'SLAB_INCOME' : 'LTCG_EQUITY',
                                });
                                setResolvingKuveraCode(null);
                              }}
                              className={`px-2.5 py-1.5 text-2xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 ${
                                alreadyInCart
                                  ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/40'
                                  : 'bg-ink hover:bg-ink/90 disabled:opacity-45 text-paper'
                              }`}
                            >
                              {isResolving ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : alreadyInCart ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Added</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3 h-3" />
                                  <span>Add</span>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="flex items-center justify-between text-2xs text-ink/70">
                    <span>Source: Kuvera Categorized MF Tree + AMFI Scheme Resolver</span>
                    <span className="font-mono">Top {rankedKuveraMatches.length} Direct Growth</span>
                  </div>
                </div>
              ) : (
                <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleMfSearch();
                }}
                className="flex items-center gap-2"
              >
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-ink/70" />
                  <input
                    type="text"
                    value={mfQuery}
                    onChange={(e) => setMfQuery(e.target.value)}
                    placeholder="Search 40,000+ AMFI mutual funds (e.g. Parag Parikh, Nifty 50, Gilt, Liquid)..."
                    className="w-full bg-paper border border-slate-700 focus:border-emerald-500 rounded-lg pl-9 pr-3 py-2 text-xs text-ink placeholder-ink/60 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={mfSearching || !mfQuery.trim()}
                  className="px-4 py-2 text-xs font-semibold text-paper bg-ink hover:bg-ink/90 disabled:opacity-50 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  {mfSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  <span>Search Market</span>
                </button>
              </form>

              {/* Quick Discovery Chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                {POPULAR_MF_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleMfSearch(chip)}
                    className={`px-2 py-1 text-2xs font-medium rounded-md border transition-colors ${
                      mfQuery.toLowerCase() === chip.toLowerCase()
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-700'
                        : 'bg-paper border-slate-700 text-ink/70 hover:text-ink hover:border-ink/40'
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Search Results List */}
              <div className="border border-slate-700 rounded-xl bg-mist divide-y divide-slate-700/60 max-h-[340px] overflow-y-auto">
                {mfSearching ? (
                  <div className="py-10 text-center text-xs text-ink/70 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
                    <span>Searching live AMFI directory...</span>
                  </div>
                ) : mfHits.length === 0 && mfHasSearched ? (
                  <div className="py-10 text-center text-xs text-ink/70 px-4">
                    No schemes matched &ldquo;{mfQuery}&rdquo;. Try another keyword like <strong className="text-ink">Nifty</strong>, <strong className="text-ink">Gilt</strong>, <strong className="text-ink">Liquid</strong>, or <strong className="text-ink">Flexi</strong>.
                  </div>
                ) : (
                  mfHits.map((hit) => {
                    const isExpanded = selectedSchemeCode === hit.schemeCode;
                    const alreadyInCart = destinations.some((d) => d.id === `mf-${hit.schemeCode}`);
                    return (
                      <div key={hit.schemeCode} className="p-3 space-y-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => handleInspectMf(hit.schemeCode)}
                            className="text-left min-w-0 flex-1 group"
                          >
                            <div className="text-xs font-semibold text-ink group-hover:text-emerald-700 transition-colors leading-snug">
                              {hit.schemeName}
                            </div>
                            <div className="text-2xs font-mono text-ink/70 mt-0.5 flex items-center gap-2">
                              <span>AMFI #{hit.schemeCode}</span>
                              <span>·</span>
                              <span className="text-emerald-700">
                                {isExpanded ? 'Hide NAV & CAGR' : 'Click to inspect live NAV & 1Y/3Y CAGR'}
                              </span>
                            </div>
                          </button>

                          <button
                            type="button"
                            disabled={alreadyInCart || moveAmountInBase <= 0}
                            onClick={async () => {
                              let detail =
                                schemeDetail?.schemeCode === hit.schemeCode
                                  ? schemeDetail
                                  : null;
                              if (!detail) {
                                detail = await fetchMutualFundDetails(hit.schemeCode);
                              }
                              const isDebtMf =
                                /debt|liquid|gilt|bond|overnight|money market|arbitrage|banking and psu/i.test(
                                  `${hit.schemeName} ${detail?.schemeCategory ?? ''}`
                                );
                              addDestinationToCart({
                                id: `mf-${hit.schemeCode}`,
                                kind: 'MUTUAL_FUND',
                                title: detail?.schemeName ?? hit.schemeName,
                                subtitle: detail
                                  ? `${detail.fundHouse} · NAV ₹${detail.latestNav.toFixed(2)}`
                                  : `AMFI Scheme #${hit.schemeCode}`,
                                category: 'MUTUAL_FUND',
                                institution: detail?.fundHouse ?? 'AMFI Mutual Fund',
                                currency: 'INR',
                                schemeCode: hit.schemeCode,
                                navOrPrice: detail?.latestNav,
                                gain30dPct:
                                  detail?.return30dPct !== null && detail?.return30dPct !== undefined
                                    ? Number(detail.return30dPct.toFixed(2))
                                    : undefined,
                                expectedRatePct:
                                  detail?.cagr3yPct ?? detail?.cagr1yPct ?? (isDebtMf ? 7.2 : 12.5),
                                taxTag: isDebtMf ? 'SLAB_INCOME' : 'LTCG_EQUITY',
                              });
                            }}
                            className={`px-2.5 py-1.5 text-2xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 ${
                              alreadyInCart
                                ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/40'
                                : 'bg-ink hover:bg-ink/90 disabled:opacity-45 text-paper'
                            }`}
                          >
                            {alreadyInCart ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Added</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3 h-3" />
                                <span>Add to Split</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Live NAV & Historical CAGR Drawer */}
                        {isExpanded && (
                          <div className="p-3 rounded-lg bg-paper border border-slate-700 text-2xs">
                            {loadingDetail ? (
                              <div className="flex items-center gap-2 text-ink/70 py-1">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />
                                <span>Loading live NAV history &amp; CAGR...</span>
                              </div>
                            ) : schemeDetail && schemeDetail.schemeCode === hit.schemeCode ? (
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2 text-ink/70">
                                  <span className="font-medium">{schemeDetail.fundHouse}</span>
                                  <span className="font-mono text-ink/70">{schemeDetail.schemeCategory}</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-ink/10 font-mono tabular-nums">
                                  <div>
                                    <span className="text-ink/70 block">Latest NAV ({schemeDetail.navDate})</span>
                                    <span className="text-ink font-bold">₹{schemeDetail.latestNav.toFixed(2)}</span>
                                  </div>
                                  <div>
                                    <span className="text-ink/70 block">30-Day Return</span>
                                    <span
                                      className={`font-semibold ${
                                        (schemeDetail.return30dPct ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-600'
                                      }`}
                                    >
                                      {schemeDetail.return30dPct !== null
                                        ? formatPercent(schemeDetail.return30dPct)
                                        : '—'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-ink/70 block">1-Year Return</span>
                                    <span
                                      className={`font-semibold ${
                                        (schemeDetail.cagr1yPct ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-600'
                                      }`}
                                    >
                                      {schemeDetail.cagr1yPct !== null
                                        ? formatPercent(schemeDetail.cagr1yPct)
                                        : '—'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-ink/70 block">3-Year CAGR</span>
                                    <span
                                      className={`font-semibold ${
                                        (schemeDetail.cagr3yPct ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-600'
                                      }`}
                                    >
                                      {schemeDetail.cagr3yPct !== null
                                        ? formatPercent(schemeDetail.cagr3yPct)
                                        : '—'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-ink/70 block">1Y Volatility</span>
                                    <span className="font-semibold text-ink">
                                      {schemeDetail.annualizedVolatilityPct !== null
                                        ? `${schemeDetail.annualizedVolatilityPct.toFixed(1)}%`
                                        : '—'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <span className="text-ink/70">Could not fetch historical NAVs for this scheme.</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              <div className="flex items-center justify-between text-2xs text-ink/70">
                <span>Source: Open AMFI NAV API (api.mfapi.in) · Keyless live query</span>
                <span className="font-mono">Showing up to {mfHits.length} matches</span>
              </div>
                </>
              )}
            </div>
          )}

          {/* TAB B: Listed Bonds, Fixed Deposits & Live GoI G-Secs */}
          {explorerTab === 'BONDS_FDS' && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-ink/70" />
                  <input
                    type="text"
                    value={marketQuery}
                    onChange={(e) => setMarketQuery(e.target.value)}
                    placeholder="Search SBI FD, RBI Bond, T-Bill, NABARD, SGB..."
                    className="w-full bg-paper border border-slate-700 focus:border-emerald-500 rounded-lg pl-9 pr-3 py-2 text-xs text-ink placeholder-ink/60 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowCustomBondForm((v) => !v)}
                  className="px-3 py-2 text-xs font-medium text-emerald-700 bg-emerald-500/10 hover:bg-emerald-500/20 hover:text-emerald-800 border border-emerald-500/35 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  {showCustomBondForm ? 'Hide Custom Form' : '+ Custom FD / Bond'}
                </button>
              </div>

              {/* Group Filters */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: 'ALL', label: 'All Listed' },
                      { id: 'FD', label: 'Fixed Deposits' },
                      { id: 'GOVT_BOND', label: 'Govt Bonds & T-Bills' },
                      { id: 'CORP_BOND', label: 'Corp Bonds & NCDs' },
                      { id: 'GOLD', label: 'Gold / SGB' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setMarketFilter(f.id)}
                      className={`px-2.5 py-1 text-2xs font-semibold rounded-md border transition-colors ${
                        marketFilter === f.id
                          ? 'bg-ink border-ink text-paper'
                          : 'bg-paper border-slate-700 text-ink/70 hover:text-ink'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <span className="text-2xs font-mono text-ink/70">
                  {benchmarks?.indiaGsecs.length
                    ? `GoI G-Sec API: Live (${benchmarks.indiaGsecs.length})`
                    : 'Listed market directory'}
                </span>
              </div>

              {/* Optional Custom FD / Bond Builder */}
              {showCustomBondForm && (
                <div className="p-3.5 rounded-xl bg-mist border border-emerald-500/40 space-y-2.5 text-xs">
                  <div className="font-semibold text-emerald-700">Add Custom Fixed Deposit or Listed Bond</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={customBondName}
                      onChange={(e) => setCustomBondName(e.target.value)}
                      placeholder="Instrument Name (e.g. ICICI 15M FD / Tata Capital NCD)"
                      className="bg-paper border border-slate-700 rounded-lg px-2.5 py-1.5 text-ink placeholder-ink/60 focus:outline-none focus:border-emerald-500"
                    />
                    <input
                      type="text"
                      value={customBondInstitution}
                      onChange={(e) => setCustomBondInstitution(e.target.value)}
                      placeholder="Bank / Issuer (e.g. ICICI Bank)"
                      className="bg-paper border border-slate-700 rounded-lg px-2.5 py-1.5 text-ink placeholder-ink/60 focus:outline-none focus:border-emerald-500"
                    />
                    <select
                      value={customBondCat}
                      onChange={(e) => setCustomBondCat(e.target.value as 'FIXED_DEPOSIT' | 'GOVT_BOND' | 'CORP_BOND')}
                      className="bg-paper border border-slate-700 rounded-lg px-2.5 py-1.5 text-ink focus:outline-none focus:border-emerald-500"
                    >
                      <option value="FIXED_DEPOSIT">Fixed Deposit (FD)</option>
                      <option value="GOVT_BOND">Govt Bond / T-Bill</option>
                      <option value="CORP_BOND">Corporate Bond / NCD</option>
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        step="0.05"
                        value={customBondRate}
                        onChange={(e) => setCustomBondRate(e.target.value)}
                        placeholder="Rate %"
                        className="bg-paper border border-slate-700 rounded-lg px-2.5 py-1.5 text-ink font-mono focus:outline-none focus:border-emerald-500"
                      />
                      <input
                        type="number"
                        value={customBondDays}
                        onChange={(e) => setCustomBondDays(e.target.value)}
                        placeholder="Days (e.g. 365)"
                        className="bg-paper border border-slate-700 rounded-lg px-2.5 py-1.5 text-ink font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={!customBondName.trim() || moveAmountInBase <= 0}
                      onClick={() => {
                        const rate = parseFloat(customBondRate) || 7.5;
                        const days = parseInt(customBondDays, 10) || 365;
                        addDestinationToCart({
                          id: `custom-bond-${Date.now()}`,
                          kind: 'CUSTOM_ASSET',
                          title: customBondName.trim(),
                          subtitle: `${customBondInstitution.trim() || 'Custom Issuer'} · ${rate}% p.a.`,
                          category: customBondCat,
                          institution: customBondInstitution.trim() || 'Custom Bank / Issuer',
                          currency: 'INR',
                          expectedRatePct: rate,
                          tenureDays: days,
                          taxTag: 'SLAB_INCOME',
                        });
                        setCustomBondName('');
                        setShowCustomBondForm(false);
                      }}
                      className="px-3.5 py-1.5 text-xs font-semibold text-paper bg-ink hover:bg-ink/90 disabled:opacity-45 rounded-lg transition-colors"
                    >
                      + Add Custom Bond / FD to Split
                    </button>
                  </div>
                </div>
              )}

              {/* Listed Bonds & FDs Results */}
              <div className="border border-slate-700 rounded-xl bg-mist divide-y divide-slate-700/60 max-h-[320px] overflow-y-auto">
                {filteredBondsAndFds.map((item) => {
                  const alreadyInCart = destinations.some((d) => d.id === item.id);
                  return (
                    <div key={item.id} className="p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-ink">{item.name}</span>
                          <span className="text-2xs font-mono px-1.5 py-0.5 rounded bg-ink/5 text-ink/70">
                            {item.rating}
                          </span>
                          {item.asOf && (
                            <span className="text-2xs font-mono text-emerald-700">Live</span>
                          )}
                        </div>
                        <div className="text-2xs text-ink/70 mt-0.5 flex flex-wrap items-center gap-x-2">
                          <span>{item.issuer}</span>
                          <span>·</span>
                          <span>{item.tenureLabel}</span>
                          <span>·</span>
                          <span>{item.taxSummary}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right font-mono tabular-nums">
                          <div className="text-xs font-bold text-emerald-700">
                            {item.rateOrYieldPct.toFixed(2)}%
                          </div>
                          <div className="text-2xs text-ink/70">{item.currency} p.a.</div>
                        </div>

                        <button
                          type="button"
                          disabled={alreadyInCart || moveAmountInBase <= 0}
                          onClick={() =>
                            addDestinationToCart({
                              id: item.id,
                              kind: 'MARKET_INSTRUMENT',
                              title: item.name,
                              subtitle: `${item.issuer} · ${item.rateOrYieldPct.toFixed(2)}% p.a. (${item.tenureLabel})`,
                              category: item.category,
                              institution: item.issuer,
                              currency: item.currency,
                              expectedRatePct: item.rateOrYieldPct,
                              tenureDays: item.tenureDays,
                              taxTag: item.taxTag,
                            })
                          }
                          className={`px-2.5 py-1.5 text-2xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1 whitespace-nowrap ${
                            alreadyInCart
                              ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/40'
                              : 'bg-ink hover:bg-ink/90 disabled:opacity-45 text-paper'
                          }`}
                        >
                          {alreadyInCart ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Added</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3 h-3" />
                              <span>Add</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB C: Listed Equity ETFs & Custom Stocks */}
          {explorerTab === 'STOCKS_ETFS' && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-ink/70" />
                <input
                  type="text"
                  value={marketQuery}
                  onChange={(e) => setMarketQuery(e.target.value)}
                  placeholder="Filter listed index ETFs (NIFTYBEES, BANKBEES, VOO, QQQ)..."
                  className="w-full bg-paper border border-slate-700 focus:border-emerald-500 rounded-lg pl-9 pr-3 py-2 text-xs text-ink placeholder-ink/60 focus:outline-none"
                />
              </div>

              <div className="border border-slate-700 rounded-xl bg-mist divide-y divide-slate-700/60">
                {filteredStocksAndEtfs.map((item) => {
                  const alreadyInCart = destinations.some((d) => d.id === item.id);
                  return (
                    <div key={item.id} className="p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-ink">{item.name}</div>
                        <div className="text-2xs text-ink/70 mt-0.5">
                          {item.issuer} · {item.rating} · {item.taxSummary}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={alreadyInCart || moveAmountInBase <= 0}
                        onClick={() =>
                          addDestinationToCart({
                            id: item.id,
                            kind: 'MARKET_INSTRUMENT',
                            title: item.name,
                            subtitle: `${item.issuer} · ${item.currency}`,
                            category: 'EQUITY_STOCK',
                            institution: item.issuer,
                            currency: item.currency,
                            expectedRatePct: item.rateOrYieldPct,
                            taxTag: item.taxTag,
                          })
                        }
                        className={`px-2.5 py-1.5 text-2xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 ${
                          alreadyInCart
                            ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/40'
                            : 'bg-ink hover:bg-ink/90 disabled:opacity-45 text-paper'
                        }`}
                      >
                        <Plus className="w-3 h-3" />
                        <span>{alreadyInCart ? 'Added' : 'Add ETF'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Quick Custom Stock / Ticker Entry */}
              <div className="p-3.5 rounded-xl bg-mist border border-slate-700 space-y-2.5 text-xs">
                <div className="font-semibold text-ink">Add Any Market Stock or Ticker</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={customStockName}
                    onChange={(e) => setCustomStockName(e.target.value)}
                    placeholder="Stock / Ticker (e.g. TCS, NVDA, MSFT)"
                    className="bg-paper border border-slate-700 rounded-lg px-2.5 py-1.5 text-ink placeholder-ink/60 focus:outline-none focus:border-emerald-500"
                  />
                  <input
                    type="text"
                    value={customStockBroker}
                    onChange={(e) => setCustomStockBroker(e.target.value)}
                    placeholder="Exchange / Broker"
                    className="bg-paper border border-slate-700 rounded-lg px-2.5 py-1.5 text-ink placeholder-ink/60 focus:outline-none focus:border-emerald-500"
                  />
                  <div className="flex gap-2">
                    <span className="inline-flex items-center bg-paper border border-slate-700 rounded-lg px-2 py-1.5 text-ink font-mono">
                      INR
                    </span>
                    <button
                      type="button"
                      disabled={!customStockName.trim() || moveAmountInBase <= 0}
                      onClick={() => {
                        addDestinationToCart({
                          id: `custom-eq-${Date.now()}`,
                          kind: 'CUSTOM_ASSET',
                          title: customStockName.trim(),
                          subtitle: `${customStockBroker.trim() || 'Broker Demat'} · INR`,
                          category: 'EQUITY_STOCK',
                          institution: customStockBroker.trim() || 'Brokerage Demat',
                          currency: 'INR',
                          taxTag: 'LTCG_EQUITY',
                        });
                        setCustomStockName('');
                      }}
                      className="flex-1 px-3 py-1.5 text-xs font-semibold text-paper bg-ink hover:bg-ink/90 disabled:opacity-45 rounded-lg transition-colors whitespace-nowrap"
                    >
                      + Add Stock
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB C2: Live NPS Tier-I Pension Schemes (npsnav.in) */}
          {explorerTab === 'NPS_API' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {(
                    [
                      { id: 'ALL', label: 'All Schemes' },
                      { id: 'E', label: 'Equity (E)' },
                      { id: 'C', label: 'Corp Debt (C)' },
                      { id: 'G', label: 'Govt Bonds (G)' },
                    ] as const
                  ).map((cls) => (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => setNpsClassFilter(cls.id)}
                      className={`px-2.5 py-1 text-2xs font-semibold rounded-md border transition-colors whitespace-nowrap ${
                        npsClassFilter === cls.id
                          ? 'bg-ink border-ink text-paper'
                          : 'bg-paper border-slate-700 text-ink/70 hover:text-ink'
                      }`}
                    >
                      {cls.label}
                    </button>
                  ))}
                </div>
                <span className="text-2xs font-mono text-ink/70">
                  Section 80CCD(1B) · Extra ₹50,000 Deduction
                </span>
              </div>

              <div className="border border-slate-700 rounded-xl bg-mist divide-y divide-slate-700/60 max-h-[340px] overflow-y-auto">
                {benchmarksLoading && filteredNpsSchemes.length === 0 ? (
                  <div className="py-10 text-center text-xs text-ink/70 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
                    <span>Loading live NPS Tier-I NAVs from PFRDA / NPSNAV...</span>
                  </div>
                ) : filteredNpsSchemes.length === 0 ? (
                  <div className="py-10 text-center text-xs text-ink/70">
                    Could not fetch live NPS NAVs right now. Click Refresh Live Market Data above to retry.
                  </div>
                ) : (
                  filteredNpsSchemes.map((nps) => {
                    const destId = `nps-${nps.schemeCode}`;
                    const alreadyInCart = destinations.some((d) => d.id === destId);
                    return (
                      <div key={nps.schemeCode} className="p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-ink leading-snug">
                            {nps.schemeName}
                          </div>
                          <div className="text-2xs font-mono text-ink/70 mt-1 flex flex-wrap items-center gap-x-2 tabular-nums">
                            <span>{nps.pfmName}</span>
                            <span>·</span>
                            <span className="text-ink font-semibold">NAV ₹{nps.nav.toFixed(2)}</span>
                            <span>({nps.lastUpdated})</span>
                            <span>·</span>
                            <span className="text-emerald-700 font-semibold">
                              3Y: {nps.cagr3yPct !== null ? `${nps.cagr3yPct.toFixed(2)}%` : '—'}
                            </span>
                            {nps.cagr5yPct !== null && <span>5Y: {nps.cagr5yPct.toFixed(2)}%</span>}
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={alreadyInCart || moveAmountInBase <= 0}
                          onClick={() =>
                            addDestinationToCart({
                              id: destId,
                              kind: 'CUSTOM_ASSET',
                              title: nps.schemeName,
                              subtitle: `${nps.pfmName} · NAV ₹${nps.nav.toFixed(2)} · 3Y ${nps.cagr3yPct?.toFixed(2) ?? '—'}%`,
                              category: 'NPS',
                              institution: nps.pfmName,
                              currency: 'INR',
                              expectedRatePct: nps.cagr3yPct ?? nps.cagr5yPct ?? 10.5,
                              navOrPrice: nps.nav,
                              taxTag: '80CCD',
                            })
                          }
                          className={`px-2.5 py-1.5 text-2xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 ${
                            alreadyInCart
                              ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/40'
                              : 'bg-ink hover:bg-ink/90 disabled:opacity-45 text-paper'
                          }`}
                        >
                          {alreadyInCart ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Added</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3 h-3" />
                              <span>Add NPS</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="flex items-center justify-between text-2xs text-ink/70">
                <span>Source: Open NPSNAV API (npsnav.in) · Keyless live PFRDA NAV query</span>
                <span className="font-mono">{filteredNpsSchemes.length} schemes</span>
              </div>
            </div>
          )}

          {/* TAB D: Home Loan / Debt Prepayment Calculator */}
          {explorerTab === 'HOME_LOAN' && (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-mist border border-slate-700 space-y-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-ink flex items-center gap-2">
                      <Home className="w-4 h-4 text-emerald-700" />
                      <span>Home Loan / Debt Principal Prepayment</span>
                    </h4>
                    <p className="text-2xs text-ink/70 mt-0.5">
                      Every unit moved toward your home loan earns a guaranteed, risk-free return equal to your loan rate — tax-free.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-2xs text-ink/70 mb-1">Loan Label / Bank</label>
                    <input
                      type="text"
                      value={loanLabel}
                      onChange={(e) => setLoanLabel(e.target.value)}
                      className="w-full bg-paper border border-slate-700 rounded-lg px-2.5 py-1.5 text-ink focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs text-ink/70 mb-1">
                      Outstanding Principal (INR)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={loanPrincipal}
                      onChange={(e) => setLoanPrincipal(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full bg-paper border border-slate-700 rounded-lg px-2.5 py-1.5 text-ink font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs text-ink/70 mb-1">
                      Interest Rate (% p.a.)
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      min={0}
                      max={30}
                      value={loanRatePct}
                      onChange={(e) => setLoanRatePct(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full bg-paper border border-slate-700 rounded-lg px-2.5 py-1.5 text-ink font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs text-ink/70 mb-1">
                      Remaining Tenure (Years)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={35}
                      value={loanYearsLeft}
                      onChange={(e) => setLoanYearsLeft(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full bg-paper border border-slate-700 rounded-lg px-2.5 py-1.5 text-ink font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Real-time Amortization Savings Preview */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-ink/10 font-mono tabular-nums">
                  <div className="p-2.5 rounded-lg bg-paper border border-slate-700">
                    <span className="text-2xs text-ink/70 block">Effective Risk-Free Yield</span>
                    <span className="text-sm font-bold text-emerald-700">
                      {homeLoanImpact.taxFreeReturnPct.toFixed(2)}% tax-free
                    </span>
                    <span className="text-2xs text-ink/70 block mt-0.5">
                      ~{homeLoanImpact.preTaxEquivalent30Pct.toFixed(1)}% pre-tax @ 30%
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-paper border border-slate-700">
                    <span className="text-2xs text-ink/70 block">Total Interest Saved</span>
                    <span className="text-sm font-bold text-emerald-700">
                      +{formatCurrency(homeLoanImpact.interestSaved, { compact: true })}
                    </span>
                    <span className="text-2xs text-ink/70 block mt-0.5">
                      On {formatCurrency(homeLoanImpact.prepayApplied, { compact: true })} prepay
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-paper border border-slate-700">
                    <span className="text-2xs text-ink/70 block">Tenure Reduced By</span>
                    <span className="text-sm font-bold text-emerald-700">
                      {Math.floor(homeLoanImpact.monthsSaved / 12)}y {homeLoanImpact.monthsSaved % 12}m
                    </span>
                    <span className="text-2xs text-ink/70 block mt-0.5">
                      EMI {formatCurrency(homeLoanImpact.monthlyEmi, { compact: true })}/mo
                    </span>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    disabled={
                      destinations.some((d) => d.kind === 'HOME_LOAN') || moveAmountInBase <= 0
                    }
                    onClick={() =>
                      addDestinationToCart({
                        id: 'home-loan-prepay',
                        kind: 'HOME_LOAN',
                        title: loanLabel.trim() || 'Home Loan Prepayment',
                        subtitle: `${loanRatePct.toFixed(2)}% p.a. · Saves ~${formatCurrency(homeLoanImpact.interestSaved, { compact: true })} interest (${homeLoanImpact.monthsSaved} mos off)`,
                        currency: 'INR',
                        loanRatePct,
                        loanInterestSaved: homeLoanImpact.interestSaved,
                        loanMonthsSaved: homeLoanImpact.monthsSaved,
                      })
                    }
                    className="px-4 py-2 text-xs font-semibold text-paper bg-ink hover:bg-ink/90 disabled:opacity-45 rounded-lg transition-colors inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>
                      {destinations.some((d) => d.kind === 'HOME_LOAN')
                        ? 'Home Loan Prepayment Added'
                        : 'Add Home Loan Prepayment to Split'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* STEP 3: Split Allocation Cart & Live Portfolio Risk Impact */}
      <section
        ref={step3Ref}
        aria-label="Step 3: Allocation Split and Execution"
        className="bg-paper border border-slate-700 shadow-ink/10 shadow-sm rounded-xl p-5 space-y-4"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-ink/10 pb-4">
          <div>
            <span className="text-2xs font-mono uppercase tracking-wider text-amber-700 font-semibold">
              Step 3 · Review Split &amp; Execute
            </span>
            <h3 className="text-sm font-bold text-ink mt-0.5">
              Target Allocation Plan ({destinations.length}{' '}
              {destinations.length === 1 ? 'destination' : 'destinations'})
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums">
            <div>
              <span className="text-ink/70">Allocated: </span>
              <span
                className={`font-bold ${
                  isOverAllocated
                    ? 'text-rose-700'
                    : allocatedTotal === moveAmountInBase && moveAmountInBase > 0
                    ? 'text-emerald-700'
                    : 'text-amber-700'
                }`}
              >
                {formatCurrency(allocatedTotal, { compact: false })}
              </span>
              <span className="text-ink/70">
                {' '}
                / {formatCurrency(moveAmountInBase, { compact: false })}
              </span>
            </div>

            {destinations.length > 1 && (
              <button
                type="button"
                onClick={handleSplitEvenly}
                className="px-2.5 py-1 text-2xs font-sans font-medium text-emerald-700 bg-emerald-500/10 hover:bg-emerald-500/20 hover:text-emerald-800 border border-emerald-500/35 rounded-md transition-colors"
              >
                Split Evenly
              </button>
            )}
          </div>
        </div>

        {destinations.length === 0 ? (
          <div className="py-8 text-center text-xs text-ink/70">
            Select one or more Mutual Funds, Bonds, FDs, Stocks, or Home Loan Prepayment in <strong className="text-ink">Step 2</strong> above to build your rebalance split.
          </div>
        ) : (
          <div className="space-y-2.5">
            {destinations.map((dest) => (
              <div
                key={dest.id}
                className="p-3.5 rounded-xl bg-mist border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-2xs font-mono px-1.5 py-0.5 rounded font-semibold ${
                        dest.kind === 'HOME_LOAN'
                          ? 'bg-emerald-500/10 text-emerald-700'
                          : dest.kind === 'MUTUAL_FUND'
                          ? 'bg-indigo-500/10 text-indigo-600'
                          : 'bg-debt/10 text-sky-700'
                      }`}
                    >
                      {dest.kind === 'HOME_LOAN'
                        ? 'HOME LOAN'
                        : dest.category
                        ? CATEGORY_META[dest.category]?.shortLabel ?? dest.category
                        : 'MARKET'}
                    </span>
                    <span className="text-xs font-semibold text-ink truncate">{dest.title}</span>
                  </div>
                  <div className="text-2xs text-ink/70 mt-1 truncate">{dest.subtitle}</div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-2xs font-mono text-ink/70">INR</span>
                    <input
                      type="number"
                      min={0}
                      max={moveAmountInBase}
                      value={dest.allocatedInBase}
                      onChange={(e) =>
                        handleUpdateDestAmount(dest.id, Math.max(0, Number(e.target.value) || 0))
                      }
                      className="w-32 bg-paper border border-slate-700 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-ink text-right focus:outline-none tabular-nums"
                    />
                  </div>
                  {unallocatedAmount > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateDestAmount(dest.id, dest.allocatedInBase + unallocatedAmount)
                      }
                      className="px-2 py-1 text-2xs font-mono text-emerald-700 hover:text-emerald-800 bg-paper border border-slate-700 hover:border-emerald-500/50 rounded-md"
                      title="Allocate remaining staged capital here"
                    >
                      +Fill
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveDestination(dest.id)}
                    className="p-1.5 text-ink/70 hover:text-rose-600 transition-colors"
                    aria-label={`Remove ${dest.title}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {/* Before -> After Portfolio Risk Score & Execute Row */}
            <div className="pt-3 mt-2 border-t border-ink/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums">
                <div>
                  <span className="text-ink/70">Risk Score Impact: </span>
                  <span className="text-ink font-semibold">
                    {riskSimulation.before.score} ({riskSimulation.before.posture})
                  </span>
                  <span className="text-ink/70 mx-1.5">→</span>
                  <span className="text-emerald-700 font-bold">
                    {riskSimulation.after.score} ({riskSimulation.after.posture})
                  </span>
                </div>
                <div>
                  <span className="text-ink/70">Equity Share: </span>
                  <span className="text-ink/70">
                    {riskSimulation.before.equityExposurePct}% → {riskSimulation.after.equityExposurePct}%
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {isOverAllocated && (
                  <span className="text-2xs text-rose-700 font-medium">
                    Allocated exceeds staged source amount by{' '}
                    {formatCurrency(allocatedTotal - moveAmountInBase, { compact: true })}
                  </span>
                )}
                <button
                  type="button"
                  disabled={!canExecute}
                  onClick={handleConfirmExecute}
                  className="px-5 py-2.5 text-xs font-semibold text-paper bg-ink hover:bg-ink/90 disabled:opacity-45 disabled:cursor-not-allowed rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap shadow-sm shadow-ink/10"
                >
                  <span>Execute Rebalance &amp; Update Portfolio</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Home Loan / Debt Prepayments Log */}
      {prepayments.length > 0 && (
        <section
          aria-label="Home Loan Prepayment History"
          className="bg-paper border border-slate-700 shadow-ink/10 shadow-sm rounded-xl p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <Home className="w-4 h-4 text-emerald-700" />
              <span>Recorded Home Loan &amp; Debt Prepayments ({prepayments.length})</span>
            </h3>
            {onClearPrepayments && (
              <button
                type="button"
                onClick={onClearPrepayments}
                className="text-2xs text-ink/70 hover:text-rose-600 transition-colors"
              >
                Clear History
              </button>
            )}
          </div>

          <div className="divide-y divide-ink/10 text-xs">
            {prepayments.map((p) => (
              <div key={p.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-ink">
                    {p.loanLabel} <span className="text-ink/70 font-normal">from {p.sourceName}</span>
                  </div>
                  <div className="text-2xs font-mono text-ink/70 mt-0.5">
                    {p.date} · {p.loanRatePct.toFixed(2)}% rate · Shaved {p.monthsSaved} months off loan
                  </div>
                </div>
                <div className="text-left sm:text-right font-mono tabular-nums">
                  <div className="font-bold text-ink">
                    {formatCurrency(p.amountInBase, { compact: true })} prepaid
                  </div>
                  <div className="text-2xs text-emerald-700">
                    +{formatCurrency(p.interestSaved, { compact: true })} interest saved
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
