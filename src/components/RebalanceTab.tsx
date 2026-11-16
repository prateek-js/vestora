import React, { useEffect, useMemo, useState } from 'react';
import {
  AssetCategory,
  CurrencyCode,
  DebtPrepaymentRecord,
  Holding,
  TaxTag,
} from '../types/wealth';
import { convertCurrency, formatCurrency, formatPercent } from '../utils/currency';
import { CATEGORY_META } from '../utils/portfolioMetrics';
import { computePortfolioRiskScore } from '../utils/taxAndDiversification';
import {
  calculateHomeLoanPrepaymentImpact,
  fetchLiveUsTreasuryRates,
  fetchMutualFundDetails,
  LISTED_MARKET_INSTRUMENTS,
  ListedMarketInstrument,
  MutualFundMarketDetail,
  MutualFundSearchHit,
  searchMarketMutualFunds,
} from '../utils/marketDirectory';
import {
  ArrowRight,
  CheckCircle2,
  Coins,
  Home,
  Landmark,
  Loader2,
  Plus,
  Search,
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
  baseCurrency: CurrencyCode;
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

type DestinationExplorerTab = 'MF_API' | 'BONDS_FDS' | 'STOCKS_ETFS' | 'HOME_LOAN';
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
  baseCurrency,
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
        ? Math.max(0, Math.round(convertCurrency(sourceHolding.currentValue, sourceHolding.currency, baseCurrency)))
        : 0,
    [sourceHolding, baseCurrency]
  );

  const [moveAmountInBase, setMoveAmountInBase] = useState<number>(0);

  useEffect(() => {
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
  const [mfQuery, setMfQuery] = useState('Flexi Cap');
  const [mfSearching, setMfSearching] = useState(false);
  const [mfHits, setMfHits] = useState<MutualFundSearchHit[]>([]);
  const [mfHasSearched, setMfHasSearched] = useState(false);
  const [selectedSchemeCode, setSelectedSchemeCode] = useState<number | null>(null);
  const [schemeDetail, setSchemeDetail] = useState<MutualFundMarketDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Listed Bonds / FDs + live US Treasury API state
  const [marketQuery, setMarketQuery] = useState('');
  const [marketFilter, setMarketFilter] = useState<MarketGroupFilter>('ALL');
  const [liveTreasuries, setLiveTreasuries] = useState<ListedMarketInstrument[]>([]);
  const [treasuryStatus, setTreasuryStatus] = useState<'loading' | 'live' | 'offline'>('loading');

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
  const [customStockCcy, setCustomStockCcy] = useState<CurrencyCode>(baseCurrency);

  // Home Loan Prepayment state
  const [loanLabel, setLoanLabel] = useState('Home Loan Principal Prepayment');
  const [loanPrincipal, setLoanPrincipal] = useState<number>(() =>
    baseCurrency === 'INR' ? 4500000 : baseCurrency === 'USD' ? 320000 : 280000
  );
  const [loanRatePct, setLoanRatePct] = useState<number>(() =>
    baseCurrency === 'INR' ? 8.55 : baseCurrency === 'USD' ? 6.5 : 4.1
  );
  const [loanYearsLeft, setLoanYearsLeft] = useState<number>(15);

  // Step 3: Split Allocation Cart
  const [destinations, setDestinations] = useState<RebalanceDestination[]>([]);
  const [executedSummary, setExecutedSummary] = useState<string>('');

  // Load initial Mutual Fund search + Live US Treasury rates
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

    fetchLiveUsTreasuryRates().then((rates) => {
      if (!cancelled) {
        if (rates.length > 0) {
          setLiveTreasuries(rates);
          setTreasuryStatus('live');
        } else {
          setTreasuryStatus('offline');
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

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

  // Filtered Bonds / FDs + Stocks
  const allBondAndFdCatalog = useMemo(
    () => [
      ...liveTreasuries,
      ...LISTED_MARKET_INSTRUMENTS.filter((item) => item.group !== 'STOCK_ETF'),
    ],
    [liveTreasuries]
  );

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
    const before = computePortfolioRiskScore(holdings, baseCurrency);
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
      const valInDestCcy = convertCurrency(dest.allocatedInBase, baseCurrency, dest.currency);
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

    const after = computePortfolioRiskScore(simulatedHoldings, baseCurrency);
    return { before, after };
  }, [holdings, baseCurrency, sourceHolding, sourceValueInBase, moveAmountInBase, destinations]);

  const totalDebtRetired = useMemo(
    () => prepayments.reduce((s, p) => s + convertCurrency(p.amountInBase, p.currency, baseCurrency), 0),
    [prepayments, baseCurrency]
  );
  const totalInterestSaved = useMemo(
    () => prepayments.reduce((s, p) => s + convertCurrency(p.interestSaved, p.currency, baseCurrency), 0),
    [prepayments, baseCurrency]
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
      `Rebalanced ${formatCurrency(allocatedTotal, baseCurrency, { compact: false })} from ${sourceHolding.name} across ${finalizedDestinations.length} destination${finalizedDestinations.length > 1 ? 's' : ''}.`
    );
    setDestinations([]);
  };

  if (holdings.length === 0) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-10 text-center space-y-3">
        <Shuffle className="w-8 h-8 text-indigo-400 mx-auto" />
        <h2 className="text-base font-bold text-white">Add or Import Holdings to Rebalance</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Once you have at least one holding (such as Savings Cash, Mutual Funds, Stocks, or FDs), you can break partial or full capital here and diversify across market funds, bonds, FDs, or Home Loan prepayments.
        </p>
        <button
          type="button"
          onClick={onNavigateToOverview}
          className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
        >
          Go to Overview
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-white tracking-tight">
              Holistic Rebalance, Market Search &amp; Diversification
            </h2>
            <span className="text-2xs font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              Live AMFI + US Treasury Open APIs
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Break partial or full capital from any holding — Savings Account, Mutual Fund, Stock, FD, or Bond — and re-allocate into 40,000+ live market Mutual Funds, listed Bonds &amp; FDs, Equity ETFs, or Home Loan principal prepayment.
          </p>
        </div>

        {prepayments.length > 0 && (
          <div className="bg-slate-950 border border-emerald-500/30 rounded-xl px-4 py-2.5 text-xs font-mono shrink-0">
            <div className="text-2xs text-slate-400">Cumulative Debt Prepayment</div>
            <div className="text-emerald-400 font-bold tabular-nums mt-0.5">
              {formatCurrency(totalDebtRetired, baseCurrency, { compact: true })} paid ·{' '}
              {formatCurrency(totalInterestSaved, baseCurrency, { compact: true })} interest saved
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Notice after executing a rebalance */}
      {executedSummary && (
        <div className="px-4 py-3 rounded-xl bg-emerald-950/35 border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{executedSummary}</span>
          </div>
          <button
            type="button"
            onClick={onNavigateToOverview}
            className="text-xs font-semibold text-emerald-300 hover:text-white inline-flex items-center gap-1 whitespace-nowrap"
          >
            <span>View Updated Overview</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main 2-Column Builder: Step 1 (Source) + Step 2 (Open-API Market Explorer) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT (5 cols): Step 1 — Select Source Holding & Partial/Full Amount */}
        <section
          aria-label="Step 1: Source Capital"
          className="lg:col-span-5 bg-slate-900/85 border border-slate-800 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-2xs font-mono uppercase tracking-wider text-indigo-400 font-semibold">
                Step 1 · Break or Move From
              </span>
              <h3 className="text-sm font-bold text-white mt-0.5">Select Source Holding</h3>
            </div>
            <span className="text-2xs font-mono text-slate-400">{holdings.length} holdings</span>
          </div>

          {/* Holding Selector List */}
          <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
            {holdings.map((h) => {
              const val = convertCurrency(h.currentValue, h.currency, baseCurrency);
              const isSelected = sourceHolding?.id === h.id;
              const catLabel = CATEGORY_META[h.category]?.shortLabel ?? h.category;
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => {
                    setSourceHoldingId(h.id);
                    setDestinations([]);
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition-colors flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-indigo-950/45 border-indigo-500 ring-1 ring-indigo-500/50'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-white truncate">{h.name}</span>
                      {h.isMatured && (
                        <span className="text-2xs font-mono text-amber-400 shrink-0">Matured</span>
                      )}
                    </div>
                    <div className="text-2xs text-slate-400 mt-0.5 truncate">
                      {catLabel} · {h.institution}
                    </div>
                  </div>
                  <div className="text-right font-mono shrink-0 tabular-nums">
                    <div className="text-xs font-bold text-slate-100">
                      {formatCurrency(val, baseCurrency, { compact: true })}
                    </div>
                    <div className={`text-2xs ${h.unrealizedGainPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {formatPercent(h.unrealizedGainPct, 1)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Break / Transfer Amount Controls */}
          {sourceHolding && (
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">
                  Amount to Break / Move ({baseCurrency})
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
                        className={`px-2 py-0.5 text-2xs font-mono rounded transition-colors ${
                          active
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
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
                className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm font-mono font-bold text-white focus:outline-none tabular-nums"
              />

              <input
                type="range"
                min={0}
                max={Math.max(1, sourceValueInBase)}
                step={Math.max(1, Math.round(sourceValueInBase / 100))}
                value={moveAmountInBase}
                onChange={(e) => setMoveAmountInBase(Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
                aria-label="Percentage of holding to break or move"
              />

              <div className="grid grid-cols-2 gap-2 text-2xs font-mono bg-slate-950/80 border border-slate-800 rounded-lg p-3">
                <div>
                  <span className="text-slate-500 block">Staged to Diversify</span>
                  <span className="text-indigo-300 font-bold text-xs tabular-nums">
                    {formatCurrency(moveAmountInBase, baseCurrency, { compact: false })}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block">Remaining in Source</span>
                  <span className="text-slate-200 font-semibold text-xs tabular-nums">
                    {sourceValueInBase - moveAmountInBase <= 1
                      ? 'Full Exit (0)'
                      : formatCurrency(sourceValueInBase - moveAmountInBase, baseCurrency, { compact: false })}
                  </span>
                </div>
              </div>

              {sourceHolding.category === 'SAVINGS_CASH' && (
                <p className="text-2xs text-emerald-300/90 leading-relaxed">
                  Breaking part of a Savings Account keeps the remaining cash liquid while putting idle surplus to work.
                </p>
              )}
              {(sourceHolding.category === 'MUTUAL_FUND' || sourceHolding.category === 'EQUITY_STOCK') && (
                <p className="text-2xs text-slate-400 leading-relaxed">
                  Partial redemption reduces units &amp; cost basis proportionally without closing your remaining holding.
                </p>
              )}
            </div>
          )}
        </section>

        {/* RIGHT (7 cols): Step 2 — Search Market Funds, Listed Bonds/FDs, ETFs & Home Loan */}
        <section
          aria-label="Step 2: Market Search and Destinations"
          className="lg:col-span-7 bg-slate-900/85 border border-slate-800 rounded-xl p-5 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-2xs font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                Step 2 · Diversify Anywhere
              </span>
              <h3 className="text-sm font-bold text-white mt-0.5">
                Search Market Funds, Bonds, FDs, Stocks or Pay Home Loan
              </h3>
            </div>
          </div>

          {/* 4-Category Explorer Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-lg">
            {(
              [
                { id: 'MF_API', label: 'Mutual Funds (API)', icon: TrendingUp },
                { id: 'BONDS_FDS', label: 'Bonds & FDs', icon: Landmark },
                { id: 'STOCKS_ETFS', label: 'Stocks & ETFs', icon: Coins },
                { id: 'HOME_LOAN', label: 'Home Loan Payoff', icon: Home },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = explorerTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setExplorerTab(tab.id)}
                  className={`px-2.5 py-2 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    active
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* TAB A: Live Open-API Mutual Fund Search (api.mfapi.in) */}
          {explorerTab === 'MF_API' && (
            <div className="space-y-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleMfSearch();
                }}
                className="flex items-center gap-2"
              >
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={mfQuery}
                    onChange={(e) => setMfQuery(e.target.value)}
                    placeholder="Search 40,000+ AMFI mutual funds (e.g. Parag Parikh, Nifty 50, Gilt, Liquid)..."
                    className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={mfSearching || !mfQuery.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
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
                        ? 'bg-indigo-950/60 border-indigo-400 text-indigo-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Search Results List */}
              <div className="border border-slate-800 rounded-xl bg-slate-950/60 divide-y divide-slate-800/80 max-h-[340px] overflow-y-auto">
                {mfSearching ? (
                  <div className="py-10 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                    <span>Searching live AMFI directory...</span>
                  </div>
                ) : mfHits.length === 0 && mfHasSearched ? (
                  <div className="py-10 text-center text-xs text-slate-400 px-4">
                    No schemes matched &ldquo;{mfQuery}&rdquo;. Try another keyword like <strong className="text-slate-200">Nifty</strong>, <strong className="text-slate-200">Gilt</strong>, <strong className="text-slate-200">Liquid</strong>, or <strong className="text-slate-200">Flexi</strong>.
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
                            <div className="text-xs font-semibold text-slate-100 group-hover:text-indigo-300 transition-colors leading-snug">
                              {hit.schemeName}
                            </div>
                            <div className="text-2xs font-mono text-slate-500 mt-0.5 flex items-center gap-2">
                              <span>AMFI #{hit.schemeCode}</span>
                              <span>·</span>
                              <span className="text-indigo-400">
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
                                ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-500/40'
                                : 'bg-indigo-600 hover:bg-indigo-500 disabled:opacity-45 text-white'
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
                          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-2xs">
                            {loadingDetail ? (
                              <div className="flex items-center gap-2 text-slate-400 py-1">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                                <span>Loading live NAV history &amp; CAGR...</span>
                              </div>
                            ) : schemeDetail && schemeDetail.schemeCode === hit.schemeCode ? (
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2 text-slate-300">
                                  <span className="font-medium">{schemeDetail.fundHouse}</span>
                                  <span className="font-mono text-slate-400">{schemeDetail.schemeCategory}</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800 font-mono tabular-nums">
                                  <div>
                                    <span className="text-slate-500 block">Latest NAV ({schemeDetail.navDate})</span>
                                    <span className="text-white font-bold">₹{schemeDetail.latestNav.toFixed(2)}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 block">30-Day Return</span>
                                    <span
                                      className={`font-semibold ${
                                        (schemeDetail.return30dPct ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                      }`}
                                    >
                                      {schemeDetail.return30dPct !== null
                                        ? formatPercent(schemeDetail.return30dPct)
                                        : '—'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 block">1-Year Return</span>
                                    <span
                                      className={`font-semibold ${
                                        (schemeDetail.cagr1yPct ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                      }`}
                                    >
                                      {schemeDetail.cagr1yPct !== null
                                        ? formatPercent(schemeDetail.cagr1yPct)
                                        : '—'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 block">3-Year CAGR</span>
                                    <span
                                      className={`font-semibold ${
                                        (schemeDetail.cagr3yPct ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                      }`}
                                    >
                                      {schemeDetail.cagr3yPct !== null
                                        ? formatPercent(schemeDetail.cagr3yPct)
                                        : '—'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-500">Could not fetch historical NAVs for this scheme.</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              <div className="flex items-center justify-between text-2xs text-slate-500">
                <span>Source: Open AMFI NAV API (api.mfapi.in) · Keyless live query</span>
                <span className="font-mono">Showing up to {mfHits.length} matches</span>
              </div>
            </div>
          )}

          {/* TAB B: Listed Bonds, Fixed Deposits & Live US Treasuries */}
          {explorerTab === 'BONDS_FDS' && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={marketQuery}
                    onChange={(e) => setMarketQuery(e.target.value)}
                    placeholder="Search SBI FD, RBI Bond, T-Bill, NABARD, Treasury, SGB..."
                    className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowCustomBondForm((v) => !v)}
                  className="px-3 py-2 text-xs font-medium text-indigo-300 bg-indigo-950/40 hover:bg-indigo-900/50 border border-indigo-500/35 rounded-lg transition-colors whitespace-nowrap shrink-0"
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
                      className={`px-2.5 py-1 text-2xs font-medium rounded-md border transition-colors ${
                        marketFilter === f.id
                          ? 'bg-indigo-600 border-indigo-500 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <span className="text-2xs font-mono text-slate-400">
                  {treasuryStatus === 'live'
                    ? `US Treasury API: Live (${liveTreasuries[0]?.asOf})`
                    : treasuryStatus === 'loading'
                    ? 'Loading US Treasury rates...'
                    : 'Listed market directory'}
                </span>
              </div>

              {/* Optional Custom FD / Bond Builder */}
              {showCustomBondForm && (
                <div className="p-3.5 rounded-xl bg-slate-950 border border-indigo-500/40 space-y-2.5 text-xs">
                  <div className="font-semibold text-indigo-300">Add Custom Fixed Deposit or Listed Bond</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={customBondName}
                      onChange={(e) => setCustomBondName(e.target.value)}
                      placeholder="Instrument Name (e.g. ICICI 15M FD / Tata Capital NCD)"
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    <input
                      type="text"
                      value={customBondInstitution}
                      onChange={(e) => setCustomBondInstitution(e.target.value)}
                      placeholder="Bank / Issuer (e.g. ICICI Bank)"
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    <select
                      value={customBondCat}
                      onChange={(e) => setCustomBondCat(e.target.value as 'FIXED_DEPOSIT' | 'GOVT_BOND' | 'CORP_BOND')}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500"
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
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-indigo-500"
                      />
                      <input
                        type="number"
                        value={customBondDays}
                        onChange={(e) => setCustomBondDays(e.target.value)}
                        placeholder="Days (e.g. 365)"
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-indigo-500"
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
                          currency: baseCurrency,
                          expectedRatePct: rate,
                          tenureDays: days,
                          taxTag: 'SLAB_INCOME',
                        });
                        setCustomBondName('');
                        setShowCustomBondForm(false);
                      }}
                      className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-45 rounded-lg transition-colors"
                    >
                      + Add Custom Bond / FD to Split
                    </button>
                  </div>
                </div>
              )}

              {/* Listed Bonds & FDs Results */}
              <div className="border border-slate-800 rounded-xl bg-slate-950/60 divide-y divide-slate-800/80 max-h-[320px] overflow-y-auto">
                {filteredBondsAndFds.map((item) => {
                  const alreadyInCart = destinations.some((d) => d.id === item.id);
                  return (
                    <div key={item.id} className="p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-slate-100">{item.name}</span>
                          <span className="text-2xs font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                            {item.rating}
                          </span>
                          {item.asOf && (
                            <span className="text-2xs font-mono text-emerald-400">Live</span>
                          )}
                        </div>
                        <div className="text-2xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-2">
                          <span>{item.issuer}</span>
                          <span>·</span>
                          <span>{item.tenureLabel}</span>
                          <span>·</span>
                          <span>{item.taxSummary}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right font-mono tabular-nums">
                          <div className="text-xs font-bold text-emerald-400">
                            {item.rateOrYieldPct.toFixed(2)}%
                          </div>
                          <div className="text-2xs text-slate-500">{item.currency} p.a.</div>
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
                              ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-500/40'
                              : 'bg-indigo-600 hover:bg-indigo-500 disabled:opacity-45 text-white'
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
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={marketQuery}
                  onChange={(e) => setMarketQuery(e.target.value)}
                  placeholder="Filter listed index ETFs (NIFTYBEES, BANKBEES, VOO, QQQ)..."
                  className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              <div className="border border-slate-800 rounded-xl bg-slate-950/60 divide-y divide-slate-800/80">
                {filteredStocksAndEtfs.map((item) => {
                  const alreadyInCart = destinations.some((d) => d.id === item.id);
                  return (
                    <div key={item.id} className="p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-100">{item.name}</div>
                        <div className="text-2xs text-slate-400 mt-0.5">
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
                            ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-500/40'
                            : 'bg-indigo-600 hover:bg-indigo-500 disabled:opacity-45 text-white'
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
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs">
                <div className="font-semibold text-slate-200">Add Any Market Stock or Ticker</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={customStockName}
                    onChange={(e) => setCustomStockName(e.target.value)}
                    placeholder="Stock / Ticker (e.g. TCS, NVDA, MSFT)"
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <input
                    type="text"
                    value={customStockBroker}
                    onChange={(e) => setCustomStockBroker(e.target.value)}
                    placeholder="Exchange / Broker"
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <div className="flex gap-2">
                    <select
                      value={customStockCcy}
                      onChange={(e) => setCustomStockCcy(e.target.value as CurrencyCode)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white font-mono focus:outline-none"
                    >
                      <option value="INR">INR</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                    <button
                      type="button"
                      disabled={!customStockName.trim() || moveAmountInBase <= 0}
                      onClick={() => {
                        addDestinationToCart({
                          id: `custom-eq-${Date.now()}`,
                          kind: 'CUSTOM_ASSET',
                          title: customStockName.trim(),
                          subtitle: `${customStockBroker.trim() || 'Broker Demat'} · ${customStockCcy}`,
                          category: 'EQUITY_STOCK',
                          institution: customStockBroker.trim() || 'Brokerage Demat',
                          currency: customStockCcy,
                          taxTag: 'LTCG_EQUITY',
                        });
                        setCustomStockName('');
                      }}
                      className="flex-1 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-45 rounded-lg transition-colors whitespace-nowrap"
                    >
                      + Add Stock
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB D: Home Loan / Debt Prepayment Calculator */}
          {explorerTab === 'HOME_LOAN' && (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Home className="w-4 h-4 text-emerald-400" />
                      <span>Home Loan / Debt Principal Prepayment</span>
                    </h4>
                    <p className="text-2xs text-slate-400 mt-0.5">
                      Every unit moved toward your home loan earns a guaranteed, risk-free return equal to your loan rate — tax-free.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-2xs text-slate-400 mb-1">Loan Label / Bank</label>
                    <input
                      type="text"
                      value={loanLabel}
                      onChange={(e) => setLoanLabel(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs text-slate-400 mb-1">
                      Outstanding Principal ({baseCurrency})
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={loanPrincipal}
                      onChange={(e) => setLoanPrincipal(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs text-slate-400 mb-1">
                      Interest Rate (% p.a.)
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      min={0}
                      max={30}
                      value={loanRatePct}
                      onChange={(e) => setLoanRatePct(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs text-slate-400 mb-1">
                      Remaining Tenure (Years)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={35}
                      value={loanYearsLeft}
                      onChange={(e) => setLoanYearsLeft(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Real-time Amortization Savings Preview */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-800 font-mono tabular-nums">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-2xs text-slate-500 block">Effective Risk-Free Yield</span>
                    <span className="text-sm font-bold text-emerald-400">
                      {homeLoanImpact.taxFreeReturnPct.toFixed(2)}% tax-free
                    </span>
                    <span className="text-2xs text-slate-500 block mt-0.5">
                      ~{homeLoanImpact.preTaxEquivalent30Pct.toFixed(1)}% pre-tax @ 30%
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-2xs text-slate-500 block">Total Interest Saved</span>
                    <span className="text-sm font-bold text-emerald-400">
                      +{formatCurrency(homeLoanImpact.interestSaved, baseCurrency, { compact: true })}
                    </span>
                    <span className="text-2xs text-slate-500 block mt-0.5">
                      On {formatCurrency(homeLoanImpact.prepayApplied, baseCurrency, { compact: true })} prepay
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-2xs text-slate-500 block">Tenure Reduced By</span>
                    <span className="text-sm font-bold text-indigo-300">
                      {Math.floor(homeLoanImpact.monthsSaved / 12)}y {homeLoanImpact.monthsSaved % 12}m
                    </span>
                    <span className="text-2xs text-slate-500 block mt-0.5">
                      EMI {formatCurrency(homeLoanImpact.monthlyEmi, baseCurrency, { compact: true })}/mo
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
                        subtitle: `${loanRatePct.toFixed(2)}% p.a. · Saves ~${formatCurrency(homeLoanImpact.interestSaved, baseCurrency, { compact: true })} interest (${homeLoanImpact.monthsSaved} mos off)`,
                        currency: baseCurrency,
                        loanRatePct,
                        loanInterestSaved: homeLoanImpact.interestSaved,
                        loanMonthsSaved: homeLoanImpact.monthsSaved,
                      })
                    }
                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 rounded-lg transition-colors inline-flex items-center gap-1.5"
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
        aria-label="Step 3: Allocation Split and Execution"
        className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <span className="text-2xs font-mono uppercase tracking-wider text-amber-400 font-semibold">
              Step 3 · Review Split &amp; Execute
            </span>
            <h3 className="text-sm font-bold text-white mt-0.5">
              Target Allocation Plan ({destinations.length}{' '}
              {destinations.length === 1 ? 'destination' : 'destinations'})
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums">
            <div>
              <span className="text-slate-400">Allocated: </span>
              <span
                className={`font-bold ${
                  isOverAllocated
                    ? 'text-rose-400'
                    : allocatedTotal === moveAmountInBase && moveAmountInBase > 0
                    ? 'text-emerald-400'
                    : 'text-amber-300'
                }`}
              >
                {formatCurrency(allocatedTotal, baseCurrency, { compact: false })}
              </span>
              <span className="text-slate-500">
                {' '}
                / {formatCurrency(moveAmountInBase, baseCurrency, { compact: false })}
              </span>
            </div>

            {destinations.length > 1 && (
              <button
                type="button"
                onClick={handleSplitEvenly}
                className="px-2.5 py-1 text-2xs font-sans font-medium text-indigo-300 bg-indigo-950/40 hover:bg-indigo-900/50 border border-indigo-500/35 rounded-md transition-colors"
              >
                Split Evenly
              </button>
            )}
          </div>
        </div>

        {destinations.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            Select one or more Mutual Funds, Bonds, FDs, Stocks, or Home Loan Prepayment in <strong className="text-slate-200">Step 2</strong> above to build your rebalance split.
          </div>
        ) : (
          <div className="space-y-2.5">
            {destinations.map((dest) => (
              <div
                key={dest.id}
                className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-2xs font-mono px-1.5 py-0.5 rounded font-semibold ${
                        dest.kind === 'HOME_LOAN'
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : dest.kind === 'MUTUAL_FUND'
                          ? 'bg-indigo-500/15 text-indigo-300'
                          : 'bg-sky-500/15 text-sky-300'
                      }`}
                    >
                      {dest.kind === 'HOME_LOAN'
                        ? 'HOME LOAN'
                        : dest.category
                        ? CATEGORY_META[dest.category]?.shortLabel ?? dest.category
                        : 'MARKET'}
                    </span>
                    <span className="text-xs font-semibold text-white truncate">{dest.title}</span>
                  </div>
                  <div className="text-2xs text-slate-400 mt-1 truncate">{dest.subtitle}</div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-2xs font-mono text-slate-500">{baseCurrency}</span>
                    <input
                      type="number"
                      min={0}
                      max={moveAmountInBase}
                      value={dest.allocatedInBase}
                      onChange={(e) =>
                        handleUpdateDestAmount(dest.id, Math.max(0, Number(e.target.value) || 0))
                      }
                      className="w-32 bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-white text-right focus:outline-none tabular-nums"
                    />
                  </div>
                  {unallocatedAmount > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateDestAmount(dest.id, dest.allocatedInBase + unallocatedAmount)
                      }
                      className="px-2 py-1 text-2xs font-mono text-indigo-300 hover:text-white bg-slate-900 border border-slate-700 rounded-md"
                      title="Allocate remaining staged capital here"
                    >
                      +Fill
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveDestination(dest.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                    aria-label={`Remove ${dest.title}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {/* Before -> After Portfolio Risk Score & Execute Row */}
            <div className="pt-3 mt-2 border-t border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums">
                <div>
                  <span className="text-slate-500">Risk Score Impact: </span>
                  <span className="text-slate-200 font-semibold">
                    {riskSimulation.before.score} ({riskSimulation.before.posture})
                  </span>
                  <span className="text-slate-500 mx-1.5">→</span>
                  <span className="text-indigo-300 font-bold">
                    {riskSimulation.after.score} ({riskSimulation.after.posture})
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Equity Share: </span>
                  <span className="text-slate-300">
                    {riskSimulation.before.equityExposurePct}% → {riskSimulation.after.equityExposurePct}%
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {isOverAllocated && (
                  <span className="text-2xs text-rose-400 font-medium">
                    Allocated exceeds staged source amount by{' '}
                    {formatCurrency(allocatedTotal - moveAmountInBase, baseCurrency, { compact: true })}
                  </span>
                )}
                <button
                  type="button"
                  disabled={!canExecute}
                  onClick={handleConfirmExecute}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-45 disabled:cursor-not-allowed rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap shadow-sm shadow-indigo-600/30"
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
          className="bg-slate-900/85 border border-slate-800 rounded-xl p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Home className="w-4 h-4 text-emerald-400" />
              <span>Recorded Home Loan &amp; Debt Prepayments ({prepayments.length})</span>
            </h3>
            {onClearPrepayments && (
              <button
                type="button"
                onClick={onClearPrepayments}
                className="text-2xs text-slate-400 hover:text-rose-300 transition-colors"
              >
                Clear History
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-800/80 text-xs">
            {prepayments.map((p) => (
              <div key={p.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-slate-100">
                    {p.loanLabel} <span className="text-slate-500 font-normal">from {p.sourceName}</span>
                  </div>
                  <div className="text-2xs font-mono text-slate-400 mt-0.5">
                    {p.date} · {p.loanRatePct.toFixed(2)}% rate · Shaved {p.monthsSaved} months off loan
                  </div>
                </div>
                <div className="text-left sm:text-right font-mono tabular-nums">
                  <div className="font-bold text-white">
                    {formatCurrency(convertCurrency(p.amountInBase, p.currency, baseCurrency), baseCurrency)} prepaid
                  </div>
                  <div className="text-2xs text-emerald-400">
                    +{formatCurrency(convertCurrency(p.interestSaved, p.currency, baseCurrency), baseCurrency)} interest saved
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
