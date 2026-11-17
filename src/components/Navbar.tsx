import React, { useState, useEffect } from 'react';
import { CurrencyCode, UserProfile } from '../types/wealth';
import { DEMO_PROFILES } from '../data/mockData';
import { trackEvent } from '../utils/analytics';
import {
  ArrowRight,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Gamepad2,
  HelpCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Upload,
} from 'lucide-react';

export type AppTab = 'story' | 'overview' | 'rebalance' | 'radar' | 'tax' | 'simulator';

const TAB_NAMES: Record<AppTab, string> = {
  story: 'Interactive Story',
  overview: 'Overview & Ledger',
  rebalance: 'Rebalance & Market',
  radar: 'Maturity Radar',
  tax: 'Tax & Diversification',
  simulator: 'Macro Stress Lab',
};

interface NavbarProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  baseCurrency: CurrencyCode;
  setBaseCurrency: (c: CurrencyCode) => void;
  currentProfile: UserProfile;
  setProfile: (p: UserProfile) => void;
  onOpenAddModal: () => void;
  onOpenUploadModal: () => void;
  onOpenValidateModal: () => void;
  onOpenNavRefresh: () => void;
  holdingsCount: number;
  onExportExcel: () => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
  onExportJson: () => void;
  onTriggerRestore: () => void;
  onStartTour: () => void;
  maturedCount: number;
  onResetToSample: () => void;
  fxAsOf: string | null;
  fxSource: 'live' | 'cached' | 'benchmark';
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  baseCurrency,
  setBaseCurrency,
  currentProfile,
  setProfile,
  holdingsCount,
  onOpenAddModal,
  onOpenUploadModal,
  onOpenValidateModal,
  onOpenNavRefresh,
  onExportExcel,
  onExportCsv,
  onExportPdf,
  onExportJson,
  onTriggerRestore,
  onStartTour,
  maturedCount,
  onResetToSample,
  fxAsOf,
  fxSource,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleTabChange = (tab: AppTab) => {
    setIsMenuOpen(false);
    setActiveTab(tab);
    trackEvent('tab_viewed', { tab: TAB_NAMES[tab] });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Distraction-free marketing & game header on the main Story page
  if (activeTab === 'story') {
    return (
      <header className="border-b border-slate-800 bg-slate-950/95 backdrop-blur-md sticky top-0 z-40 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2.5 shrink-0 text-left"
          >
            <span className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-mono font-bold text-sm shadow-inner shrink-0">
              V
            </span>
            <span className="text-lg sm:text-xl font-bold tracking-tight text-white whitespace-nowrap">
              Vestora
            </span>
          </button>

          {/* Zone 2: Clean Single-Line Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
            <a
              href="#street-stage"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Street Simulation
            </a>
            <a
              href="#why-vestora"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Why Vestora
            </a>
            <button
              type="button"
              onClick={() => handleTabChange('rebalance')}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Market Explorer
            </button>
          </nav>

          {/* Zone 3: Single Primary Action CTA */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleTabChange('overview')}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <span>Enter Overview</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>
    );
  }

  // Clean, uncluttered workspace header bar once inside the app
  return (
    <header className="border-b border-slate-800 bg-slate-950/95 backdrop-blur-md sticky top-0 z-40 w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-6">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => handleTabChange('overview')}
            className="flex items-center gap-2.5 shrink-0 text-left"
          >
            <span className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-mono font-bold text-sm shadow-inner shrink-0">
              V
            </span>
            <span className="text-lg sm:text-xl font-bold tracking-tight text-white whitespace-nowrap">
              Vestora
            </span>
          </button>

          {/* Zone 2: Clean 5 Workspace Tabs */}
          <nav className="hidden md:flex items-center gap-1.5 lg:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleTabChange('overview')}
              className={`px-3 py-1.5 text-xs lg:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'overview'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('rebalance')}
              className={`px-3 py-1.5 text-xs lg:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'rebalance'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Rebalance
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('radar')}
              className={`px-3 py-1.5 text-xs lg:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                activeTab === 'radar'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <span>Maturity Radar</span>
              {maturedCount > 0 && (
                <span className="text-2xs font-mono font-semibold text-amber-400">
                  ({maturedCount})
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('tax')}
              className={`px-3 py-1.5 text-xs lg:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'tax'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Tax &amp; Audit
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('simulator')}
              className={`px-3 py-1.5 text-xs lg:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'simulator'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Stress Lab
            </button>
          </nav>

          {/* Zone 3: Uncluttered 3-Control Action Group (Game Mode, Consolidated Menu, + Add Holding) */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Switch to Interactive Street Game Mode */}
            <button
              type="button"
              onClick={() => handleTabChange('story')}
              className="px-3 py-1.5 text-xs font-medium text-emerald-300 bg-slate-900 hover:bg-slate-800 border border-emerald-500/35 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              title="Open Interactive Street Simulation & Animated Story"
            >
              <Gamepad2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="hidden sm:inline">Game Mode</span>
            </button>

            {/* Consolidated Currency, Persona, Save/Export & Data Tools Menu */}
            <div className="relative" data-tour="export-menu">
              <button
                type="button"
                onClick={() => setIsMenuOpen((prev) => !prev)}
                className={`px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  isMenuOpen
                    ? 'bg-slate-800 border-indigo-500 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800 hover:border-slate-700'
                }`}
                title="Currency, Save/Export, Import & Tools"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="font-mono text-2xs text-slate-300">{baseCurrency}</span>
                <span className="hidden sm:inline">Menu</span>
                <ChevronDown className="w-3 h-3 opacity-75 shrink-0" />
              </button>

              {isMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 z-50 text-xs space-y-3 max-h-[82vh] overflow-y-auto">
                    {/* Currency & Demo Persona */}
                    <div className="space-y-2 pb-2.5 border-b border-slate-800">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-2xs font-medium text-slate-400">Display Currency</span>
                        <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                          {(['INR', 'USD', 'EUR'] as CurrencyCode[]).map((curr) => (
                            <button
                              key={curr}
                              type="button"
                              onClick={() => setBaseCurrency(curr)}
                              className={`px-2 py-1 text-2xs font-mono font-medium rounded transition-colors ${
                                baseCurrency === curr
                                  ? 'bg-indigo-600 text-white'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              {curr}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-2xs font-medium text-slate-400 shrink-0">Demo Persona</span>
                        <select
                          aria-label="Active Investor Profile"
                          value={currentProfile.id}
                          onChange={(e) => {
                            const found = DEMO_PROFILES.find((p) => p.id === e.target.value);
                            if (found) {
                              setProfile(found);
                              setIsMenuOpen(false);
                            }
                          }}
                          className="bg-slate-950 border border-slate-800 text-slate-200 text-2xs rounded-md px-2 py-1 focus:outline-none focus:border-indigo-500 max-w-[180px] truncate"
                        >
                          {DEMO_PROFILES.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.personaTitle.split('&')[0].trim()})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Save & Restore */}
                    <div className="space-y-1 pb-2.5 border-b border-slate-800">
                      <div className="px-1 pb-1 text-2xs font-medium text-slate-400 flex items-center justify-between">
                        <span>Save &amp; Restore</span>
                        <span className="font-mono text-emerald-400">{holdingsCount} holdings</span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          disabled={holdingsCount === 0}
                          onClick={() => {
                            setIsMenuOpen(false);
                            onExportExcel();
                          }}
                          className="px-2.5 py-2 text-left rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 disabled:opacity-45 text-slate-100 transition-colors flex items-center gap-2"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="font-medium">Excel (.xlsx)</span>
                        </button>
                        <button
                          type="button"
                          disabled={holdingsCount === 0}
                          onClick={() => {
                            setIsMenuOpen(false);
                            onExportCsv();
                          }}
                          className="px-2.5 py-2 text-left rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 disabled:opacity-45 text-slate-200 transition-colors flex items-center gap-2"
                        >
                          <Download className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          <span className="font-medium">CSV (.csv)</span>
                        </button>
                        <button
                          type="button"
                          disabled={holdingsCount === 0}
                          onClick={() => {
                            setIsMenuOpen(false);
                            onExportPdf();
                          }}
                          className="px-2.5 py-2 text-left rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 disabled:opacity-45 text-slate-200 transition-colors flex items-center gap-2"
                        >
                          <FileText className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span className="font-medium">PDF Report</span>
                        </button>
                        <button
                          type="button"
                          disabled={holdingsCount === 0}
                          onClick={() => {
                            setIsMenuOpen(false);
                            onExportJson();
                          }}
                          className="px-2.5 py-2 text-left rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 disabled:opacity-45 text-slate-300 transition-colors flex items-center gap-2"
                        >
                          <Download className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-medium">JSON</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          onTriggerRestore();
                        }}
                        className="w-full mt-1 px-2.5 py-2 text-left rounded-lg bg-indigo-950/40 hover:bg-indigo-900/50 border border-indigo-500/30 text-indigo-200 hover:text-white transition-colors flex items-center gap-2"
                      >
                        <Upload className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span>Restore Earlier Export (.xlsx / .csv / .json)</span>
                      </button>
                    </div>

                    {/* Portfolio Data Tools */}
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          onOpenValidateModal();
                        }}
                        className="w-full px-2.5 py-1.5 text-left rounded-lg hover:bg-slate-800 text-slate-200 transition-colors flex items-center gap-2"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Validate / Build Portfolio</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          onOpenNavRefresh();
                        }}
                        className="w-full px-2.5 py-1.5 text-left rounded-lg hover:bg-slate-800 text-slate-200 transition-colors flex items-center gap-2"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span>Refresh Live AMFI NAVs</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          onOpenUploadModal();
                        }}
                        className="w-full px-2.5 py-1.5 text-left rounded-lg hover:bg-slate-800 text-slate-200 transition-colors flex items-center gap-2"
                      >
                        <Upload className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span>Import Excel / CAS / CSV</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          onStartTour();
                        }}
                        className="w-full px-2.5 py-1.5 text-left rounded-lg hover:bg-slate-800 text-slate-200 transition-colors flex items-center gap-2"
                      >
                        <HelpCircle className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span>Interactive Guided Tour</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          onResetToSample();
                        }}
                        className="w-full px-2.5 py-1.5 text-left rounded-lg hover:bg-slate-800 text-rose-300 transition-colors flex items-center gap-2"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span>Manage Data / Reset Portfolio</span>
                      </button>
                    </div>

                    <div className="px-2.5 py-1.5 bg-slate-950/70 rounded-md border border-slate-800 text-2xs font-mono text-slate-500">
                      FX: {fxSource === 'benchmark' ? 'Benchmarks' : `ECB (${fxAsOf})`} · On your device
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Primary CTA: Add Holding */}
            <button
              type="button"
              onClick={onOpenAddModal}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Add Holding</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        </div>

        {/* Mobile Sub-Navigation Bar */}
        <div className="md:hidden flex items-center justify-around py-2 border-t border-slate-800/80 text-xs">
          <button
            type="button"
            onClick={() => handleTabChange('overview')}
            className={`py-1 px-2 rounded font-medium ${
              activeTab === 'overview' ? 'text-indigo-400 font-semibold' : 'text-slate-400'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('rebalance')}
            className={`py-1 px-2 rounded font-medium ${
              activeTab === 'rebalance' ? 'text-indigo-400 font-semibold' : 'text-slate-400'
            }`}
          >
            Rebalance
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('radar')}
            className={`py-1 px-2 rounded font-medium ${
              activeTab === 'radar' ? 'text-indigo-400 font-semibold' : 'text-slate-400'
            }`}
          >
            Radar {maturedCount > 0 && `(${maturedCount})`}
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('tax')}
            className={`py-1 px-2 rounded font-medium ${
              activeTab === 'tax' ? 'text-indigo-400 font-semibold' : 'text-slate-400'
            }`}
          >
            Tax
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('simulator')}
            className={`py-1 px-2 rounded font-medium ${
              activeTab === 'simulator' ? 'text-indigo-400 font-semibold' : 'text-slate-400'
            }`}
          >
            Stress
          </button>
        </div>
      </div>
    </header>
  );
};
