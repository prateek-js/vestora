/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { CurrencyCode, Holding, ReinvestmentSolution, UserProfile } from './types/wealth';
import { DEMO_PROFILES, CURATED_REINVESTMENT_SOLUTIONS } from './data/mockData';
import { Navbar } from './components/Navbar';
import { OverviewTab } from './components/OverviewTab';
import { MaturityRadarTab } from './components/MaturityRadarTab';
import { TaxAndInsightsTab } from './components/TaxAndInsightsTab';
import { MacroSimulatorTab } from './components/MacroSimulatorTab';
import { AddHoldingModal } from './components/AddHoldingModal';
import { UploadStatementModal } from './components/UploadStatementModal';
import { ReinvestModal } from './components/ReinvestModal';
import {
  PersistedPortfolio,
  clearPersistedPortfolio,
  loadPersistedPortfolio,
  sampleHoldingsFor,
  savePersistedPortfolio,
} from './utils/portfolioStorage';
import { todayIso } from './utils/maturity';
import { trackEvent } from './utils/analytics';
import { Info, X, RotateCcw } from 'lucide-react';

type ActiveTab = 'overview' | 'radar' | 'tax' | 'simulator';

export default function App() {
  // Hydrate from localStorage when this browser has a saved portfolio; sample
  // data otherwise. The whole engine is client-side, so this is the database.
  const initial = useMemo(() => {
    const persisted = loadPersistedPortfolio();
    if (persisted) return { ...persisted, restored: true };
    const profile = DEMO_PROFILES[0];
    return {
      profileId: profile.id,
      baseCurrency: profile.baseCurrency,
      holdings: sampleHoldingsFor(profile),
      restored: false,
    };
  }, []);

  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>(initial.baseCurrency);
  const [currentProfileId, setCurrentProfileId] = useState<string>(initial.profileId);
  const [holdings, setHoldings] = useState<Holding[]>(initial.holdings);
  const [isDemoBannerDismissed, setIsDemoBannerDismissed] = useState(initial.restored);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [reinvestHolding, setReinvestHolding] = useState<Holding | null>(null);
  const [reinvestSolution, setReinvestSolution] = useState<ReinvestmentSolution | null>(null);

  // Every mutation persists — localStorage is the app's only database.
  useEffect(() => {
    savePersistedPortfolio({ profileId: currentProfileId, baseCurrency, holdings });
  }, [currentProfileId, baseCurrency, holdings]);

  const currentProfile =
    DEMO_PROFILES.find((p) => p.id === currentProfileId) ?? DEMO_PROFILES[0];

  // Count matured holdings
  const maturedCount = holdings.filter(
    (h) => h.isMatured || (h.daysToMaturity !== undefined && h.daysToMaturity <= 0)
  ).length;

  // Handle Profile Switch (replaces the ledger with the chosen sample persona)
  const handleProfileSwitch = (newProfile: UserProfile) => {
    setCurrentProfileId(newProfile.id);
    setHoldings(sampleHoldingsFor(newProfile));
    setBaseCurrency(newProfile.baseCurrency);
    trackEvent('profile_switched', { profile_id: newProfile.id });
  };

  // Add Holding
  const handleAddHolding = (newHolding: Holding) => {
    setHoldings((prev) => [newHolding, ...prev]);
    trackEvent('holding_added', { category: newHolding.category, currency: newHolding.currency });
  };

  // Delete Holding
  const handleDeleteHolding = (id: string) => {
    setHoldings((prev) => prev.filter((h) => h.id !== id));
  };

  // Import Statement Holdings
  const handleImportHoldings = (imported: Holding[]) => {
    setHoldings((prev) => [...imported, ...prev]);
    trackEvent('sample_statement_imported', { count: imported.length });
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
    // 1. Remove the source matured holding
    const remainingHoldings = holdings.filter((h) => h.id !== sourceHolding.id);

    // 2. Create the new reinvested holding
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

  // Reset to a fresh sample portfolio
  const handleResetToSample = () => {
    const profile = DEMO_PROFILES[0];
    clearPersistedPortfolio();
    setCurrentProfileId(profile.id);
    setHoldings(sampleHoldingsFor(profile));
    setBaseCurrency(profile.baseCurrency);
    setIsDemoBannerDismissed(false);
    setIsResetConfirmOpen(false);
    trackEvent('portfolio_reset');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Bar Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        baseCurrency={baseCurrency}
        setBaseCurrency={setBaseCurrency}
        currentProfile={currentProfile}
        setProfile={handleProfileSwitch}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenUploadModal={() => setIsUploadModalOpen(true)}
        maturedCount={maturedCount}
        onResetToSample={() => setIsResetConfirmOpen(true)}
      />

      {/* Demo notice for first-time / sample-data visitors */}
      {!isDemoBannerDismissed && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-slate-900/60 border border-indigo-500/30 rounded-xl px-4 py-3 flex items-start gap-3">
            <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-300 leading-relaxed flex-1">
              <span className="font-semibold text-white">Demo mode — sample portfolio loaded.</span>{' '}
              This is illustrative data for one sample investor; nothing here is investment advice.
              Add your own holdings or load a sample statement to explore, and everything stays in
              this browser — no account, no server.
            </p>
            <button
              onClick={() => setIsDemoBannerDismissed(true)}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors shrink-0"
              aria-label="Dismiss demo notice"
            >
              <X className="w-4 h-4" />
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
            onNavigateToTab={(tab) => setActiveTab(tab)}
            onSelectHoldingToReinvest={(h) => {
              setActiveTab('radar');
              handleOpenReinvest(h);
            }}
            onDeleteHolding={handleDeleteHolding}
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
          />
        )}

        {activeTab === 'tax' && (
          <TaxAndInsightsTab holdings={holdings} baseCurrency={baseCurrency} />
        )}

        {activeTab === 'simulator' && (
          <MacroSimulatorTab holdings={holdings} baseCurrency={baseCurrency} />
        )}
      </main>

      {/* Compliance footer: this app shows illustrative figures, not advice */}
      <footer className="border-t border-slate-800 bg-slate-950">
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <p className="text-2xs text-slate-500 leading-relaxed max-w-3xl">
            Vestora is a personal portfolio tracking and scenario-modeling tool. All figures are
            self-reported or sample data, yields are indicative, and nothing here is investment,
            tax, or legal advice. Verify every product with the issuing institution or a registered
            advisor before acting.
          </p>
          <span className="text-2xs text-slate-600 font-mono whitespace-nowrap">
            © {new Date().getFullYear()} Vestora · Client-side only
          </span>
        </div>
      </footer>

      {/* Modals */}
      <AddHoldingModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        baseCurrency={baseCurrency}
        onAddHolding={handleAddHolding}
      />

      <UploadStatementModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        baseCurrency={baseCurrency}
        onImportHoldings={handleImportHoldings}
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

      {/* Reset-to-sample confirmation */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-sm shadow-2xl p-6">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-400" />
              <span>Reset to sample portfolio?</span>
            </h3>
            <p className="text-xs text-slate-400 mt-3 leading-relaxed">
              This clears your saved ledger from this browser and reloads the sample data. It cannot
              be undone.
            </p>
            <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetToSample}
                className="px-5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition-colors shadow-sm"
              >
                Reset Portfolio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
