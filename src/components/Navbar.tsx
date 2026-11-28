import React, { useState, useEffect } from 'react';
import { trackEvent } from '../utils/analytics';
import type { AppTab } from '../utils/tabRouting';
import { VestoraLogo } from './VestoraLogo';
import { MakerTriggerButton } from './ContactMaker';
import {
  ChevronDown,
  Compass,
  Download,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Upload,
} from 'lucide-react';

const TAB_NAMES: Record<AppTab, string> = {
  overview: 'Overview & Ledger',
  rebalance: 'Rebalance & Market',
  radar: 'Maturity Radar',
  tax: 'Tax & Diversification',
  simulator: 'Macro Stress Lab',
};

interface NavbarProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
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
  onOpenContact: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
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
  onOpenContact,
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

  // Clean, uncluttered workspace header bar once inside the app
  return (
    <header className="border-b border-ink/10 bg-mist sticky top-0 z-40 w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-6">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => handleTabChange('overview')}
            className="flex items-center gap-2.5 shrink-0 text-left"
          >
            <VestoraLogo size={32} />
            <span className="font-display text-lg sm:text-xl font-semibold tracking-tight text-ink whitespace-nowrap">
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
                  ? 'bg-ink text-paper'
                  : 'text-ink/70 hover:text-ink hover:bg-ink/10'
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('rebalance')}
              className={`px-3 py-1.5 text-xs lg:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'rebalance'
                  ? 'bg-ink text-paper'
                  : 'text-ink/70 hover:text-ink hover:bg-ink/10'
              }`}
            >
              Rebalance
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('radar')}
              className={`px-3 py-1.5 text-xs lg:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                activeTab === 'radar'
                  ? 'bg-ink text-paper'
                  : 'text-ink/70 hover:text-ink hover:bg-ink/10'
              }`}
            >
              <span>Maturity Radar</span>
              {maturedCount > 0 && (
                <span
                  className={`text-2xs font-mono font-semibold ${
                    activeTab === 'radar' ? 'text-amber-400' : 'text-ink/70'
                  }`}
                >
                  ({maturedCount})
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('tax')}
              className={`px-3 py-1.5 text-xs lg:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'tax'
                  ? 'bg-ink text-paper'
                  : 'text-ink/70 hover:text-ink hover:bg-ink/10'
              }`}
            >
              Tax &amp; Audit
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('simulator')}
              className={`px-3 py-1.5 text-xs lg:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'simulator'
                  ? 'bg-ink text-paper'
                  : 'text-ink/70 hover:text-ink hover:bg-ink/10'
              }`}
            >
              Stress Lab
            </button>
          </nav>

          {/* Zone 3: Uncluttered 3-Control Action Group (Take the tour, Consolidated Menu, + Add Holding) */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Guided tour of how rebalancing works */}
            <a
              href="/demo/"
              className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-paper hover:bg-ink/5 border border-level/50 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              aria-label="New here? Take the tour"
              title="A 2-minute walk-through with a sample portfolio — the full app is one click away"
            >
              <Compass className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span className="hidden lg:inline">Take the tour</span>
            </a>

            {/* Prominent Direct-to-Maker trigger */}
            <MakerTriggerButton onClick={onOpenContact} variant="app" />

            {/* Consolidated Save/Export, Import & Data Tools Menu */}
            <div className="relative" data-tour="export-menu">
              <button
                type="button"
                onClick={() => setIsMenuOpen((prev) => !prev)}
                className={`px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  isMenuOpen
                    ? 'bg-ink border-ink text-paper'
                    : 'bg-paper border-slate-700 text-ink hover:bg-ink/5 hover:border-ink/40'
                }`}
                title="Save/Export, Import & Tools"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span className="hidden sm:inline">Menu</span>
                <ChevronDown className="w-3 h-3 opacity-75 shrink-0" />
              </button>

              {isMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-80 bg-paper border border-slate-700 rounded-xl shadow-ink/10 shadow-lg p-3 z-50 text-ink space-y-3 max-h-[82vh] overflow-y-auto">
                    {/* Save & Restore */}
                    <div className="space-y-1 pb-2.5 border-b border-slate-700">
                      <div className="px-1 pb-1 text-2xs font-medium text-ink/70 flex items-center justify-between">
                        <span>Save &amp; Restore</span>
                        <span className="font-mono text-emerald-700">{holdingsCount} holdings</span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          disabled={holdingsCount === 0}
                          onClick={() => {
                            setIsMenuOpen(false);
                            onExportExcel();
                          }}
                          className="px-2.5 py-2 text-left rounded-lg bg-mist hover:bg-ink/5 border border-slate-700 disabled:opacity-45 text-ink transition-colors flex items-center gap-2"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                          <span className="font-medium">Excel (.xlsx)</span>
                        </button>
                        <button
                          type="button"
                          disabled={holdingsCount === 0}
                          onClick={() => {
                            setIsMenuOpen(false);
                            onExportCsv();
                          }}
                          className="px-2.5 py-2 text-left rounded-lg bg-mist hover:bg-ink/5 border border-slate-700 disabled:opacity-45 text-ink transition-colors flex items-center gap-2"
                        >
                          <Download className="w-3.5 h-3.5 text-debt shrink-0" />
                          <span className="font-medium">CSV (.csv)</span>
                        </button>
                        <button
                          type="button"
                          disabled={holdingsCount === 0}
                          onClick={() => {
                            setIsMenuOpen(false);
                            onExportPdf();
                          }}
                          className="px-2.5 py-2 text-left rounded-lg bg-mist hover:bg-ink/5 border border-slate-700 disabled:opacity-45 text-ink transition-colors flex items-center gap-2"
                        >
                          <FileText className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span className="font-medium">PDF Report</span>
                        </button>
                        <button
                          type="button"
                          disabled={holdingsCount === 0}
                          onClick={() => {
                            setIsMenuOpen(false);
                            onExportJson();
                          }}
                          className="px-2.5 py-2 text-left rounded-lg bg-mist hover:bg-ink/5 border border-slate-700 disabled:opacity-45 text-ink transition-colors flex items-center gap-2"
                        >
                          <Download className="w-3.5 h-3.5 text-ink/70 shrink-0" />
                          <span className="font-medium">JSON</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          onTriggerRestore();
                        }}
                        className="w-full mt-1 px-2.5 py-2 text-left rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 hover:text-emerald-800 border border-emerald-500/40 text-emerald-700 transition-colors flex items-center gap-2"
                      >
                        <Upload className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
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
                        className="w-full px-2.5 py-1.5 text-left rounded-lg hover:bg-ink/5 text-ink transition-colors flex items-center gap-2"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span>Validate / Build Portfolio</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          onOpenNavRefresh();
                        }}
                        className="w-full px-2.5 py-1.5 text-left rounded-lg hover:bg-ink/5 text-ink transition-colors flex items-center gap-2"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span>Refresh Live AMFI NAVs</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          onOpenUploadModal();
                        }}
                        className="w-full px-2.5 py-1.5 text-left rounded-lg hover:bg-ink/5 text-ink transition-colors flex items-center gap-2"
                      >
                        <Upload className="w-3.5 h-3.5 text-debt shrink-0" />
                        <span>Import Excel / CAS / CSV</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          onStartTour();
                        }}
                        className="w-full px-2.5 py-1.5 text-left rounded-lg hover:bg-ink/5 text-ink transition-colors flex items-center gap-2"
                      >
                        <HelpCircle className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span>Interactive Guided Tour</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          onResetToSample();
                        }}
                        className="w-full px-2.5 py-1.5 text-left rounded-lg hover:bg-ink/5 text-rose-600 transition-colors flex items-center gap-2"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>Manage Data / Reset Portfolio</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Primary CTA: Add Holding */}
            <button
              type="button"
              onClick={onOpenAddModal}
              className="px-3 py-1.5 text-xs font-semibold text-paper bg-ink rounded-lg hover:bg-ink/90 transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Add Holding</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        </div>

        {/* Mobile Sub-Navigation Bar */}
        <div className="md:hidden flex items-center justify-around py-2 border-t border-ink/10 text-xs">
          <button
            type="button"
            onClick={() => handleTabChange('overview')}
            className={`py-1 px-2 rounded font-medium ${
              activeTab === 'overview' ? 'text-emerald-700 font-semibold' : 'text-ink/70'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('rebalance')}
            className={`py-1 px-2 rounded font-medium ${
              activeTab === 'rebalance' ? 'text-emerald-700 font-semibold' : 'text-ink/70'
            }`}
          >
            Rebalance
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('radar')}
            className={`py-1 px-2 rounded font-medium ${
              activeTab === 'radar' ? 'text-emerald-700 font-semibold' : 'text-ink/70'
            }`}
          >
            Radar {maturedCount > 0 && `(${maturedCount})`}
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('tax')}
            className={`py-1 px-2 rounded font-medium ${
              activeTab === 'tax' ? 'text-emerald-700 font-semibold' : 'text-ink/70'
            }`}
          >
            Tax
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('simulator')}
            className={`py-1 px-2 rounded font-medium ${
              activeTab === 'simulator' ? 'text-emerald-700 font-semibold' : 'text-ink/70'
            }`}
          >
            Stress
          </button>
        </div>
      </div>
    </header>
  );
};
