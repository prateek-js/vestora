/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CurrencyCode, DebtPrepaymentRecord, Holding, ReinvestmentSolution, UserProfile } from './types/wealth';
import { DEMO_PROFILES, CURATED_REINVESTMENT_SOLUTIONS } from './data/mockData';
import { Navbar } from './components/Navbar';
import { OverviewTab } from './components/OverviewTab';
import { RebalanceDestination, RebalanceTab } from './components/RebalanceTab';
import { MaturityRadarTab } from './components/MaturityRadarTab';
import { TaxAndInsightsTab } from './components/TaxAndInsightsTab';
import { MacroSimulatorTab } from './components/MacroSimulatorTab';
import { AddHoldingModal } from './components/AddHoldingModal';
import { UploadStatementModal } from './components/UploadStatementModal';
import { ValidatePortfolioModal } from './components/ValidatePortfolioModal';
import { ReinvestModal } from './components/ReinvestModal';
import {
  clearPersistedPortfolio,
  loadPersistedPortfolio,
  sampleHoldingsFor,
  savePersistedPortfolio,
} from './utils/portfolioStorage';
import { isoFromToday, todayIso, withDerivedMaturity } from './utils/maturity';
import { convertCurrency } from './utils/currency';
import { trackEvent } from './utils/analytics';
import { refreshFxRates } from './utils/liveRates';
import { NavRefreshModal } from './components/NavRefreshModal';
import { buildExport, downloadPortfolioExport, parsePortfolioExport } from './utils/backupRestore';
import {
  exportHoldingsToCsv,
  exportHoldingsToExcel,
  importExcelBuffer,
  importStatement,
} from './utils/statementImport';
import { generatePortfolioPdfReport } from './utils/pdfReport';
import { OnboardingTour } from './components/OnboardingTour';
import { StreetStoryGame } from './components/StreetStoryGame';
import { PortfolioChatDrawer } from './components/PortfolioChatDrawer';
import { syncDocumentSeo } from './utils/seo';
import { RotateCcw, Download, Upload, ShieldCheck, FileSpreadsheet, FileText, CheckCircle2, X } from 'lucide-react';

type ActiveTab = 'story' | 'overview' | 'rebalance' | 'radar' | 'tax' | 'simulator';

const HASH_TO_TAB: Record<string, ActiveTab> = {
  '#story': 'story',
  '#overview': 'overview',
  '#rebalance': 'rebalance',
  '#radar': 'radar',
  '#tax': 'tax',
  '#simulator': 'simulator',
};

export default function App() {
  // Hydrate from localStorage when this browser has a saved portfolio; sample
  // data otherwise. Everything is client-side — localStorage is the only storage.
  const initial = useMemo(() => {
    const persisted = loadPersistedPortfolio();
    if (persisted) {
      return {
        ...persisted,
        mode: persisted.mode ?? ('demo' as const),
        prepayments: persisted.prepayments ?? ([] as DebtPrepaymentRecord[]),
      };
    }
    const profile = DEMO_PROFILES[0];
    return {
      profileId: profile.id,
      baseCurrency: profile.baseCurrency,
      holdings: sampleHoldingsFor(profile),
      mode: 'demo' as const,
      prepayments: [] as DebtPrepaymentRecord[],
    };
  }, []);

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    if (typeof window !== 'undefined') {
      const matched = HASH_TO_TAB[window.location.hash.toLowerCase()];
      if (matched) return matched;
    }
    return 'story';
  });

  useEffect(() => {
    const onHashChange = () => {
      const h = window.location.hash.toLowerCase();
      if (!h) {
        setActiveTab('story');
        return;
      }
      const matched = HASH_TO_TAB[h];
      if (matched) setActiveTab(matched);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    syncDocumentSeo(activeTab);
    const currentHash = window.location.hash.toLowerCase();
    if (activeTab === 'story') {
      if (currentHash && currentHash !== '#street-stage' && currentHash !== '#why-vestora' && currentHash !== '#story') {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    } else {
      const desired = `#${activeTab}`;
      if (currentHash !== desired) {
        window.history.replaceState(null, '', desired);
      }
    }
  }, [activeTab]);
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>(initial.baseCurrency);
  const [currentProfileId, setCurrentProfileId] = useState<string>(initial.profileId);
  const [holdings, setHoldings] = useState<Holding[]>(initial.holdings);
  const [prepayments, setPrepayments] = useState<DebtPrepaymentRecord[]>(initial.prepayments);
  const [portfolioMode, setPortfolioMode] = useState<'demo' | 'personal'>(initial.mode);
  const [rebalanceSourceId, setRebalanceSourceId] = useState<string | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [restoreError, setRestoreError] = useState('');
  const [restoreNotice, setRestoreNotice] = useState('');
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [isTourOpen, setIsTourOpen] = useState<boolean>(false);

  const handleCloseTour = () => {
    setIsTourOpen(false);
    try {
      window.localStorage.setItem('vestora_tour_seen_v1', '1');
    } catch {
      // Ignore storage restrictions
    }
  };

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null);
  const [draftHolding, setDraftHolding] = useState<Holding | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isValidateModalOpen, setIsValidateModalOpen] = useState(false);
  const [validateInitialTab, setValidateInitialTab] = useState<'excel' | 'manual' | 'reset'>('excel');
  const [isNavRefreshOpen, setIsNavRefreshOpen] = useState(false);
  const [reinvestHolding, setReinvestHolding] = useState<Holding | null>(null);
  const [reinvestSolution, setReinvestSolution] = useState<ReinvestmentSolution | null>(null);

  const openAddModal = (draft?: Holding) => {
    setEditingHolding(null);
    setDraftHolding(draft ?? null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (holding: Holding) => {
    setDraftHolding(null);
    setEditingHolding(holding);
    setIsAddModalOpen(true);
  };

  const closeAddEditModal = () => {
    setIsAddModalOpen(false);
    setEditingHolding(null);
    setDraftHolding(null);
  };

  const openValidateModal = (tab: 'excel' | 'manual' | 'reset' = 'excel') => {
    setValidateInitialTab(tab);
    setIsValidateModalOpen(true);
  };

  // Live FX rates: seeded from static benchmarks, then overwritten once ECB loads.
  const [fxAsOf, setFxAsOf] = useState<string | null>(null);
  const [fxSource, setFxSource] = useState<'live' | 'cached' | 'benchmark'>('benchmark');
  useEffect(() => {
    let cancelled = false;
    refreshFxRates().then((state) => {
      if (!cancelled) {
        setFxAsOf(state.asOf);
        setFxSource(state.source);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist solely to browser localStorage; never sent to any backend server.
  useEffect(() => {
    savePersistedPortfolio({
      profileId: currentProfileId,
      baseCurrency,
      holdings,
      mode: portfolioMode,
      prepayments,
    });
  }, [currentProfileId, baseCurrency, holdings, portfolioMode, prepayments]);

  const currentProfile =
    DEMO_PROFILES.find((p) => p.id === currentProfileId) ?? DEMO_PROFILES[0];

  const maturedCount = holdings.filter(
    (h) => h.isMatured || (h.daysToMaturity !== undefined && h.daysToMaturity <= 0)
  ).length;

  // Handle Profile Switch (switches back to sample demo persona)
  const handleProfileSwitch = (newProfile: UserProfile) => {
    setCurrentProfileId(newProfile.id);
    setHoldings(sampleHoldingsFor(newProfile));
    setBaseCurrency(newProfile.baseCurrency);
    setPortfolioMode('demo');
    trackEvent('profile_switched', { profile_id: newProfile.id });
  };

  // Add Single Holding
  const handleAddHolding = (newHolding: Holding) => {
    setHoldings((prev) => [newHolding, ...prev]);
    setPortfolioMode('personal');
    trackEvent('holding_added', { category: newHolding.category, currency: newHolding.currency });
  };

  // Update Existing Holding
  const handleUpdateHolding = (updatedHolding: Holding) => {
    setHoldings((prev) =>
      prev.map((h) => (h.id === updatedHolding.id ? updatedHolding : h))
    );
    setPortfolioMode('personal');
    trackEvent('holding_updated', { category: updatedHolding.category, currency: updatedHolding.currency });
  };

  // Delete Holding
  const handleDeleteHolding = (id: string) => {
    setHoldings((prev) => prev.filter((h) => h.id !== id));
    setPortfolioMode('personal');
  };

  // Import Statement Holdings (Append)
  const handleImportHoldings = (imported: Holding[]) => {
    setHoldings((prev) => [...imported, ...prev]);
    setPortfolioMode('personal');
    trackEvent('sample_statement_imported', { count: imported.length });
  };

  // Apply holdings from Validate & Simulate Portfolio flow
  const handleApplyValidatedHoldings = (
    validatedHoldings: Holding[],
    strategy: 'replace' | 'append'
  ) => {
    if (strategy === 'replace') {
      setCurrentProfileId('custom');
      setHoldings(validatedHoldings);
    } else {
      setHoldings((prev) => [...validatedHoldings, ...prev]);
    }
    setPortfolioMode('personal');
    setActiveTab('overview');
  };

  // Start completely blank (0 holdings) for clean manual / Excel build
  const handleStartBlank = () => {
    clearPersistedPortfolio();
    setCurrentProfileId('custom');
    setHoldings([]);
    setPrepayments([]);
    setRebalanceSourceId(null);
    setPortfolioMode('personal');
    setIsResetConfirmOpen(false);
    setActiveTab('overview');
    trackEvent('portfolio_cleared_blank');
  };

  // Trigger Reinvestment Modal
  const handleOpenReinvest = (holding: Holding, solution?: ReinvestmentSolution) => {
    setReinvestHolding(holding);
    setReinvestSolution(solution || CURATED_REINVESTMENT_SOLUTIONS[0]);
  };

  // Execute Reinvestment Mutation
  const handleExecuteReinvestment = (
    sourceHolding: Holding,
    solution: ReinvestmentSolution,
    deployedAmount: number
  ) => {
    const remainingHoldings = holdings.filter((h) => h.id !== sourceHolding.id);

    let newCategory = 'MUTUAL_FUND';
    if (solution.instrumentType.includes('Sovereign') || solution.instrumentType.includes('Debt')) {
      newCategory = 'GOVT_BOND';
    } else if (solution.instrumentType.includes('Corporate')) {
      newCategory = 'CORP_BOND';
    } else if (solution.instrumentType.includes('Arbitrage')) {
      newCategory = 'MUTUAL_FUND';
    }

    const newReinvestedHolding: Holding = {
      id: `h-reinvested-${Date.now()}`,
      name: solution.solutionName,
      category: newCategory as Holding['category'],
      institution: 'Institutional Primary Custody',
      accountNumberMask: `DEP-${Date.now().toString().slice(-4)}`,
      investedAmount: deployedAmount,
      currentValue: deployedAmount,
      currency: baseCurrency,
      interestRatePct: solution.expectedAnnualYieldPct,
      purchaseDate: todayIso(),
      unrealizedGain: 0,
      unrealizedGainPct: 0,
      taxTag: solution.taxImplication.includes('12.5%') ? 'LTCG_EQUITY' : 'SLAB_INCOME',
      notes: `Reinvested from ${sourceHolding.name} on ${new Date().toLocaleDateString()}. Strategy: ${solution.actionTag}`,
    };

    setHoldings([newReinvestedHolding, ...remainingHoldings]);
    trackEvent('reinvestment_executed', {
      solution_id: solution.id,
      risk_tier: solution.riskTier,
      amount: deployedAmount,
    });
  };

  // Execute holistic partial/full rebalance across Market MFs, Bonds, FDs, Stocks, or Home Loan Prepayments
  const handleExecuteRebalance = ({
    sourceHoldingId,
    movedAmountInBase,
    destinations,
  }: {
    sourceHoldingId: string;
    movedAmountInBase: number;
    destinations: RebalanceDestination[];
  }) => {
    const source = holdings.find((h) => h.id === sourceHoldingId);
    if (!source || movedAmountInBase <= 0 || destinations.length === 0) return;

    const sourceValueInBase = convertCurrency(source.currentValue, source.currency, baseCurrency);
    const movedRatio = sourceValueInBase > 0 ? Math.min(1, movedAmountInBase / sourceValueInBase) : 1;

    const updatedHoldings: Holding[] = [];
    holdings.forEach((h) => {
      if (h.id !== sourceHoldingId) {
        updatedHoldings.push(h);
        return;
      }
      if (movedRatio < 0.999) {
        const remainRatio = Math.max(0, 1 - movedRatio);
        const remainingValue = Number((h.currentValue * remainRatio).toFixed(2));
        const remainingInvested = Number((h.investedAmount * remainRatio).toFixed(2));
        const remainingGain = Number((remainingValue - remainingInvested).toFixed(2));
        const remainingGainPct =
          remainingInvested > 0 ? Number(((remainingGain / remainingInvested) * 100).toFixed(2)) : 0;
        updatedHoldings.push({
          ...h,
          currentValue: remainingValue,
          investedAmount: remainingInvested,
          units: h.units !== undefined ? Number((h.units * remainRatio).toFixed(4)) : undefined,
          unrealizedGain: remainingGain,
          unrealizedGainPct: remainingGainPct,
        });
      }
    });

    const newHoldings: Holding[] = [];
    const newPrepayments: DebtPrepaymentRecord[] = [];
    const stamp = Date.now();

    destinations.forEach((dest, idx) => {
      if (dest.allocatedInBase <= 0) return;

      if (dest.kind === 'HOME_LOAN') {
        newPrepayments.push({
          id: `prepay-${stamp}-${idx}`,
          date: todayIso(),
          sourceName: source.name,
          loanLabel: dest.title,
          amountInBase: dest.allocatedInBase,
          currency: baseCurrency,
          loanRatePct: dest.loanRatePct ?? 8.5,
          interestSaved: dest.loanInterestSaved ?? 0,
          monthsSaved: dest.loanMonthsSaved ?? 0,
        });
        return;
      }

      const amountInDestCurrency = Number(
        convertCurrency(dest.allocatedInBase, baseCurrency, dest.currency).toFixed(2)
      );
      const navOrPrice = dest.navOrPrice && dest.navOrPrice > 0 ? dest.navOrPrice : undefined;
      const units = navOrPrice ? Number((amountInDestCurrency / navOrPrice).toFixed(4)) : undefined;
      const maturityDate = dest.tenureDays ? isoFromToday(dest.tenureDays) : undefined;

      const created = withDerivedMaturity<Holding>({
        id: `h-rebal-${stamp}-${idx}`,
        name: dest.title,
        category: dest.category ?? 'MUTUAL_FUND',
        institution: dest.institution ?? 'Market Allocation',
        accountNumberMask: dest.schemeCode ? `AMFI-${dest.schemeCode}` : `MKT-${String(stamp).slice(-4)}`,
        investedAmount: amountInDestCurrency,
        currentValue: amountInDestCurrency,
        currency: dest.currency,
        interestRatePct: dest.expectedRatePct,
        units,
        navOrPrice,
        gain30dPct: dest.gain30dPct,
        schemeCode: dest.schemeCode,
        purchaseDate: todayIso(),
        maturityDate,
        unrealizedGain: 0,
        unrealizedGainPct: 0,
        taxTag: dest.taxTag ?? 'LTCG_EQUITY',
        notes: `Rebalanced from ${source.name} on ${todayIso()}`,
      });
      newHoldings.push(created);
    });

    setHoldings([...newHoldings, ...updatedHoldings]);
    if (newPrepayments.length > 0) {
      setPrepayments((prev) => [...newPrepayments, ...prev]);
    }
    setPortfolioMode('personal');
    trackEvent('portfolio_rebalanced', {
      destinations: destinations.length,
      debt_prepayments: newPrepayments.length,
    });
  };

  // Reset to a fresh sample portfolio
  const handleResetToSample = () => {
    const profile = DEMO_PROFILES[0];
    clearPersistedPortfolio();
    setCurrentProfileId(profile.id);
    setHoldings(sampleHoldingsFor(profile));
    setPrepayments([]);
    setRebalanceSourceId(null);
    setBaseCurrency(profile.baseCurrency);
    setPortfolioMode('demo');
    setIsResetConfirmOpen(false);
    trackEvent('portfolio_reset');
  };

  // Export a portable JSON backup of the current ledger
  const handleExportPortfolio = () => {
    downloadPortfolioExport(buildExport(currentProfileId, baseCurrency, holdings));
    trackEvent('portfolio_exported', { holdings: holdings.length });
  };

  // Export current portfolio to Excel (.xlsx) or CSV (.csv)
  const handleExportExcel = () => {
    exportHoldingsToExcel(holdings, baseCurrency);
    trackEvent('portfolio_exported_xlsx', { holdings: holdings.length });
  };

  const handleExportCsv = () => {
    exportHoldingsToCsv(holdings);
    trackEvent('portfolio_exported_csv', { holdings: holdings.length });
  };

  const handleExportPdf = () => {
    generatePortfolioPdfReport({
      holdings,
      baseCurrency,
      portfolioMode,
      profileName: currentProfile.name,
    });
    trackEvent('portfolio_exported_pdf', { holdings: holdings.length });
  };

  // Restore a previously exported Excel, CSV, or JSON backup file
  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const lower = file.name.toLowerCase();
    const isExcel = /\.(xlsx|xls|xlsm|xlsb|ods)$/i.test(lower);
    const reader = new FileReader();

    reader.onload = () => {
      try {
        if (isExcel) {
          const preview = importExcelBuffer(reader.result as ArrayBuffer, undefined, baseCurrency);
          if (preview.parsed.holdings.length === 0) {
            throw new Error('No recognizable holdings found in this Excel workbook.');
          }
          setHoldings(preview.parsed.holdings);
          setPortfolioMode('personal');
          setActiveTab('overview');
          setRestoreError('');
          setRestoreNotice(`Restored ${preview.parsed.holdings.length} holdings from ${file.name}.`);
          setIsResetConfirmOpen(false);
          trackEvent('portfolio_restored_xlsx', { holdings: preview.parsed.holdings.length });
          return;
        }

        const text = String(reader.result ?? '');
        if (lower.endsWith('.csv') || lower.endsWith('.tsv')) {
          const parsed = importStatement(text, baseCurrency);
          if (parsed.holdings.length === 0) {
            throw new Error('No recognizable holdings found in this CSV file.');
          }
          setHoldings(parsed.holdings);
          setPortfolioMode('personal');
          setActiveTab('overview');
          setRestoreError('');
          setRestoreNotice(`Restored ${parsed.holdings.length} holdings from ${file.name}.`);
          setIsResetConfirmOpen(false);
          trackEvent('portfolio_restored_csv', { holdings: parsed.holdings.length });
          return;
        }

        const result = parsePortfolioExport(text);
        setHoldings(result.holdings);
        if (result.baseCurrency) setBaseCurrency(result.baseCurrency);
        setPortfolioMode('personal');
        setActiveTab('overview');
        setRestoreError('');
        setRestoreNotice(`Restored ${result.holdings.length} holdings from ${file.name}.`);
        setIsResetConfirmOpen(false);
        trackEvent('portfolio_restored', { holdings: result.holdings.length });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not restore this file.';
        setRestoreError(msg);
        setRestoreNotice('');
        setIsResetConfirmOpen(true);
      }
    };

    reader.onerror = () => {
      setRestoreError('Could not read that file.');
      setIsResetConfirmOpen(true);
    };
    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col overflow-x-hidden">
      {/* Top Bar Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        baseCurrency={baseCurrency}
        setBaseCurrency={setBaseCurrency}
        currentProfile={currentProfile}
        setProfile={handleProfileSwitch}
        holdingsCount={holdings.length}
        onOpenAddModal={() => openAddModal()}
        onOpenUploadModal={() => setIsUploadModalOpen(true)}
        onOpenValidateModal={() => openValidateModal('excel')}
        onOpenNavRefresh={() => setIsNavRefreshOpen(true)}
        onExportExcel={handleExportExcel}
        onExportCsv={handleExportCsv}
        onExportPdf={handleExportPdf}
        onExportJson={handleExportPortfolio}
        onTriggerRestore={() => restoreInputRef.current?.click()}
        onStartTour={() => {
          setActiveTab('overview');
          setIsTourOpen(true);
        }}
        maturedCount={maturedCount}
        onResetToSample={() => setIsResetConfirmOpen(true)}
        fxAsOf={fxAsOf}
        fxSource={fxSource}
      />

      {/* Global hidden file input for restoring saved .xlsx / .csv / .json exports */}
      <input
        ref={restoreInputRef}
        type="file"
        accept=".xlsx,.xls,.xlsm,.xlsb,.ods,.csv,.tsv,.json,application/json"
        className="hidden"
        onChange={handleRestoreFile}
      />

      {restoreNotice && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{restoreNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setRestoreNotice('')}
              className="text-emerald-300 hover:text-white p-0.5"
              aria-label="Dismiss restore message"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'overview' && (
          <OverviewTab
            holdings={holdings}
            baseCurrency={baseCurrency}
            portfolioMode={portfolioMode}
            profileName={currentProfile.name}
            onNavigateToTab={(tab) => setActiveTab(tab)}
            onSelectHoldingToReinvest={(h) => {
              setActiveTab('radar');
              handleOpenReinvest(h);
            }}
            onRebalanceHolding={(h) => {
              setRebalanceSourceId(h.id);
              setActiveTab('rebalance');
            }}
            onEditHolding={openEditModal}
            onDeleteHolding={handleDeleteHolding}
            onOpenValidateModal={openValidateModal}
            onOpenAddModal={() => openAddModal()}
          />
        )}

        {activeTab === 'rebalance' && (
          <RebalanceTab
            holdings={holdings}
            baseCurrency={baseCurrency}
            initialSourceHoldingId={rebalanceSourceId}
            prepayments={prepayments}
            onExecuteRebalance={handleExecuteRebalance}
            onClearPrepayments={() => setPrepayments([])}
            onNavigateToOverview={() => setActiveTab('overview')}
          />
        )}

        {activeTab === 'radar' && (
          <MaturityRadarTab
            holdings={holdings}
            baseCurrency={baseCurrency}
            onDeploySolution={(h, s) => {
              setReinvestHolding(h);
              setReinvestSolution(s);
            }}
            onOpenMarketRebalance={(h) => {
              setRebalanceSourceId(h.id);
              setActiveTab('rebalance');
            }}
          />
        )}

        {activeTab === 'tax' && (
          <TaxAndInsightsTab holdings={holdings} baseCurrency={baseCurrency} />
        )}

        {activeTab === 'simulator' && (
          <MacroSimulatorTab holdings={holdings} baseCurrency={baseCurrency} />
        )}

        {activeTab === 'story' && (
          <StreetStoryGame
            holdings={holdings}
            baseCurrency={baseCurrency}
            onEnterLiveRebalance={() => {
              const preferred =
                holdings.find((h) => h.isMatured) ??
                holdings.find((h) => h.category === 'SAVINGS_CASH') ??
                holdings[0];
              if (preferred) setRebalanceSourceId(preferred.id);
              setActiveTab('rebalance');
            }}
            onOpenOverview={() => setActiveTab('overview')}
            onOpenValidateModal={() => openValidateModal('excel')}
          />
        )}
      </main>

      {/* Compliance, SEO Guides & Privacy Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950">
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-3">
          <nav
            aria-label="Free Wealth Calculators and Guides"
            className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400 border-b border-slate-800/70 pb-3"
          >
            <span className="text-2xs font-mono uppercase tracking-wider text-slate-500">
              Free Calculators &amp; Guides:
            </span>
            <a href="/home-loan-vs-fd-calculator/" className="hover:text-emerald-300 transition-colors">
              Home Loan vs FD Calculator
            </a>
            <a href="/mutual-fund-rebalance-india/" className="hover:text-emerald-300 transition-colors">
              Mutual Fund Rebalance &amp; Direct Plan
            </a>
            <a href="/fd-maturity-reinvestment-guide/" className="hover:text-emerald-300 transition-colors">
              Matured FD Reinvestment Guide
            </a>
            <a href="/ltcg-tax-harvesting-india/" className="hover:text-emerald-300 transition-colors">
              LTCG Tax Harvesting &amp; 80CCD(1B)
            </a>
          </nav>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <p className="text-2xs text-slate-500 leading-relaxed max-w-3xl">
              We don&apos;t store your data with us — all spreadsheets and manual entries stay strictly on your device. Figures are illustrative / self-reported and not investment or tax advice.
            </p>
            <span className="text-2xs text-slate-600 font-mono whitespace-nowrap">
              © {new Date().getFullYear()} Vestora · Private by design
            </span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <ValidatePortfolioModal
        isOpen={isValidateModalOpen}
        onClose={() => setIsValidateModalOpen(false)}
        baseCurrency={baseCurrency}
        currentHoldings={holdings}
        initialTab={validateInitialTab}
        onApplyHoldings={handleApplyValidatedHoldings}
        onStartBlank={handleStartBlank}
        onRestoreDemo={handleResetToSample}
      />

      <AddHoldingModal
        isOpen={isAddModalOpen}
        onClose={closeAddEditModal}
        baseCurrency={baseCurrency}
        editingHolding={editingHolding}
        draftHolding={draftHolding}
        onAddHolding={handleAddHolding}
        onUpdateHolding={handleUpdateHolding}
      />

      <UploadStatementModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        baseCurrency={baseCurrency}
        onImportHoldings={handleImportHoldings}
      />

      <NavRefreshModal
        isOpen={isNavRefreshOpen}
        onClose={() => setIsNavRefreshOpen(false)}
        holdings={holdings}
        baseCurrency={baseCurrency}
        onHoldingsRefreshed={setHoldings}
      />

      <ReinvestModal
        isOpen={Boolean(reinvestHolding && reinvestSolution)}
        onClose={() => {
          setReinvestHolding(null);
          setReinvestSolution(null);
        }}
        holding={reinvestHolding}
        solution={reinvestSolution}
        baseCurrency={baseCurrency}
        onExecuteReinvestment={handleExecuteReinvestment}
      />

      {/* Portfolio data management: export / restore / reset */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-sm shadow-2xl p-6">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-400" />
              <span>Manage Portfolio Data</span>
            </h3>
            <div className="mt-3 p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/25 flex items-start gap-2 text-2xs text-emerald-200/90">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                We don&apos;t store your data with us. Everything remains private on your own device.
              </span>
            </div>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={holdings.length === 0}
                className="w-full px-4 py-2.5 text-xs font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-45 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Save Portfolio as Excel (.xlsx)
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={holdings.length === 0}
                  className="px-3 py-2 text-xs font-medium text-slate-200 bg-slate-950 border border-slate-700 hover:border-slate-500 disabled:opacity-45 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-sky-400" />
                  Export .csv
                </button>
                <button
                  type="button"
                  onClick={handleExportPortfolio}
                  disabled={holdings.length === 0}
                  className="px-3 py-2 text-xs font-medium text-slate-200 bg-slate-950 border border-slate-700 hover:border-slate-500 disabled:opacity-45 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  Export .json
                </button>
              </div>

              <button
                type="button"
                onClick={handleExportPdf}
                disabled={holdings.length === 0}
                className="w-full px-4 py-2.5 text-xs font-medium text-slate-200 bg-slate-950 border border-slate-700 hover:border-rose-500/70 disabled:opacity-45 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <FileText className="w-3.5 h-3.5 text-rose-400" />
                Export Printable PDF Report (.pdf)
              </button>

              <button
                type="button"
                onClick={() => restoreInputRef.current?.click()}
                className="w-full px-4 py-2.5 text-xs font-medium text-slate-200 bg-slate-950 border border-slate-700 hover:border-emerald-500/70 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-400" />
                Re-import Saved (.xlsx / .csv / .json)
              </button>

              <button
                type="button"
                onClick={handleStartBlank}
                className="w-full px-4 py-2.5 text-xs font-medium text-slate-200 bg-slate-950 border border-slate-700 hover:border-emerald-500 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                Clear All & Start Blank (0 Holdings)
              </button>

              <button
                type="button"
                onClick={handleResetToSample}
                className="w-full px-4 py-2.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset to Sample Portfolio
              </button>
            </div>

            {restoreError && (
              <p className="mt-3 text-2xs text-rose-300 bg-rose-950/30 border border-rose-500/40 rounded-lg px-3 py-2">
                {restoreError}
              </p>
            )}

            <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsResetConfirmOpen(false);
                  setRestoreError('');
                }}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <OnboardingTour
        isOpen={isTourOpen}
        onClose={handleCloseTour}
        onEnsureOverviewTab={() => setActiveTab('overview')}
      />

      <PortfolioChatDrawer
        holdings={holdings}
        baseCurrency={baseCurrency}
        portfolioMode={portfolioMode}
        profileName={currentProfile.name}
        onAddHolding={handleAddHolding}
        onUpdateHolding={handleUpdateHolding}
        onDeleteHolding={handleDeleteHolding}
        onReplaceHoldings={(nextHoldings, detectedCurrency) => {
          setHoldings(nextHoldings);
          if (detectedCurrency) setBaseCurrency(detectedCurrency);
          setPortfolioMode('personal');
          setCurrentProfileId('custom');
        }}
        onAppendHoldings={handleImportHoldings}
        onSetBaseCurrency={setBaseCurrency}
        onNavigateToTab={setActiveTab}
        onStartBlank={handleStartBlank}
        onResetToSample={handleResetToSample}
        onExportExcel={handleExportExcel}
        onExportCsv={handleExportCsv}
        onExportPdf={handleExportPdf}
        onExportJson={handleExportPortfolio}
        onRebalanceHoldingById={(holdingId) => {
          setRebalanceSourceId(holdingId);
          setActiveTab('rebalance');
        }}
        onOpenEditModal={openEditModal}
        onOpenAddModal={openAddModal}
      />
    </div>
  );
}
