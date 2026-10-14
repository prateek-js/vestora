/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CurrencyCode, Holding, ReinvestmentSolution, UserProfile } from './types/wealth';
import { INITIAL_PROFILES, CURATED_REINVESTMENT_SOLUTIONS } from './data/mockData';
import { Navbar } from './components/Navbar';
import { OverviewTab } from './components/OverviewTab';
import { MaturityRadarTab } from './components/MaturityRadarTab';
import { TaxAndInsightsTab } from './components/TaxAndInsightsTab';
import { MacroSimulatorTab } from './components/MacroSimulatorTab';
import { AddHoldingModal } from './components/AddHoldingModal';
import { UploadStatementModal } from './components/UploadStatementModal';
import { ReinvestModal } from './components/ReinvestModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'radar' | 'tax' | 'simulator'>('overview');
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>('INR');
  const [currentProfile, setCurrentProfile] = useState<UserProfile>(INITIAL_PROFILES[0]);
  const [holdings, setHoldings] = useState<Holding[]>(INITIAL_PROFILES[0].holdings);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [reinvestHolding, setReinvestHolding] = useState<Holding | null>(null);
  const [reinvestSolution, setReinvestSolution] = useState<ReinvestmentSolution | null>(null);

  // Count matured holdings
  const maturedCount = holdings.filter(
    (h) => h.isMatured || (h.daysToMaturity !== undefined && h.daysToMaturity <= 0)
  ).length;

  // Handle Profile Switch
  const handleProfileSwitch = (newProfile: UserProfile) => {
    setCurrentProfile(newProfile);
    setHoldings(newProfile.holdings);
    setBaseCurrency(newProfile.baseCurrency);
  };

  // Add Holding
  const handleAddHolding = (newHolding: Holding) => {
    setHoldings((prev) => [newHolding, ...prev]);
  };

  // Delete Holding
  const handleDeleteHolding = (id: string) => {
    setHoldings((prev) => prev.filter((h) => h.id !== id));
  };

  // Import Statement Holdings
  const handleImportHoldings = (imported: Holding[]) => {
    setHoldings((prev) => [...imported, ...prev]);
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
    // 1. Remove or zero out the source matured holding
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
      category: newCategory as any,
      institution: 'Institutional Primary Custody',
      accountNumberMask: `DEP-${Date.now().toString().slice(-4)}`,
      investedAmount: deployedAmount,
      currentValue: deployedAmount,
      currency: baseCurrency,
      interestRatePct: solution.expectedAnnualYieldPct,
      purchaseDate: '2026-10-13',
      unrealizedGain: 0,
      unrealizedGainPct: 0,
      taxTag: solution.taxImplication.includes('12.5%') ? 'LTCG_EQUITY' : 'SLAB_INCOME',
      notes: `Reinvested from ${sourceHolding.name} on ${new Date().toLocaleDateString()}. Strategy: ${solution.actionTag}`,
    };

    setHoldings([newReinvestedHolding, ...remainingHoldings]);
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
      />

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
    </div>
  );
}
