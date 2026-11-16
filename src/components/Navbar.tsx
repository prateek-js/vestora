import React, { useState, useRef, useEffect } from 'react';
import { CurrencyCode, UserProfile } from '../types/wealth';
import { DEMO_PROFILES } from '../data/mockData';
import { trackEvent } from '../utils/analytics';
import {
  Plus,
  Upload,
  RotateCcw,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  FileSpreadsheet,
  Download,
  FileText,
  HelpCircle,
} from 'lucide-react';

const TAB_NAMES = {
  overview: 'Overview & Ledger',
  rebalance: 'Rebalance & Market',
  radar: 'Maturity Radar',
  tax: 'Tax & Diversification',
  simulator: 'Macro Stress Lab',
} as const;

interface NavbarProps {
  activeTab: 'overview' | 'rebalance' | 'radar' | 'tax' | 'simulator';
  setActiveTab: (tab: 'overview' | 'rebalance' | 'radar' | 'tax' | 'simulator') => void;
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
  /** ISO date of the loaded FX fix; null = still on benchmark rates. */
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
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement>(null);

  const handleTabChange = (tab: NavbarProps['activeTab']) => {
    setActiveTab(tab);
    trackEvent('tab_viewed', { tab: TAB_NAMES[tab] });
  };

  // Close popovers on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsToolsOpen(false);
        setIsExportOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="border-b border-slate-800 bg-slate-950/95 backdrop-blur-md sticky top-0 z-40 w-full">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-3">
          {/* Zone 1: Brand wordmark single-line */}
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-mono font-bold text-sm shadow-inner shrink-0">
              V
            </span>
            <span className="text-lg sm:text-xl font-bold tracking-tight text-white whitespace-nowrap">
              Vestora
            </span>
          </div>

          {/* Zone 2: Navigation Links (Clean, single-line, responsive) */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-1.5 shrink-0">
            <button
              onClick={() => handleTabChange('overview')}
              className={`px-2.5 lg:px-3 py-1.5 text-xs lg:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'overview'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => handleTabChange('rebalance')}
              className={`px-2.5 lg:px-3 py-1.5 text-xs lg:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'rebalance'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Rebalance
            </button>
            <button
              onClick={() => handleTabChange('radar')}
              className={`px-2.5 lg:px-3 py-1.5 text-xs lg:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 relative flex items-center gap-1.5 ${
                activeTab === 'radar'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <span>Maturity Radar</span>
              {maturedCount > 0 && (
                <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-2xs px-1.5 py-0.2 rounded font-mono font-semibold">
                  {maturedCount}
                </span>
              )}
            </button>
            <button
              onClick={() => handleTabChange('tax')}
              className={`px-2.5 lg:px-3 py-1.5 text-xs lg:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'tax'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Tax & Audit
            </button>
            <button
              onClick={() => handleTabChange('simulator')}
              className={`px-2.5 lg:px-3 py-1.5 text-xs lg:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'simulator'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Stress Lab
            </button>
          </nav>

          {/* Zone 3: Global Actions (Compact, zero-overflow design) */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Currency Selector (Compact Segmented Pill) */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 shrink-0">
              {(['INR', 'USD', 'EUR'] as CurrencyCode[]).map((curr) => (
                <button
                  key={curr}
                  onClick={() => setBaseCurrency(curr)}
                  className={`px-2 py-1 text-2xs sm:text-xs font-mono font-medium rounded transition-colors ${
                    baseCurrency === curr
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title={`Base currency: ${curr}`}
                >
                  {curr}
                </button>
              ))}
            </div>

            {/* Profile Persona Switcher (Clean, truncated on wide screens) */}
            <div className="relative hidden xl:block">
              <select
                aria-label="Active Investor Profile"
                value={currentProfile.id}
                onChange={(e) => {
                  const found = DEMO_PROFILES.find((p) => p.id === e.target.value);
                  if (found) setProfile(found);
                }}
                className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-lg pl-2.5 pr-6 py-1.5 appearance-none focus:outline-none focus:border-indigo-500 cursor-pointer max-w-[140px] truncate"
              >
                {DEMO_PROFILES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name.split(' ')[0]} ({p.personaTitle.split('&')[0].trim()})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-2 top-2 text-slate-500">
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Dedicated Save / Export & Restore Menu (Always visible top-level action) */}
            <div className="relative" data-tour="export-menu">
              <button
                type="button"
                onClick={() => {
                  setIsToolsOpen(false);
                  setIsExportOpen((prev) => !prev);
                }}
                className={`px-2.5 py-1.5 text-xs font-medium border rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  isExportOpen
                    ? 'bg-emerald-950/60 border-emerald-400 text-emerald-200'
                    : 'bg-slate-900 border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/40 hover:border-emerald-400/70'
                }`}
                title="Save portfolio (.xlsx / .csv / .pdf / .json) or restore a saved file"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Save / Export</span>
                <ChevronDown className="w-3 h-3 opacity-80 shrink-0" />
              </button>

              {isExportOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsExportOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 text-xs space-y-1">
                    <div className="px-3 py-1.5 text-2xs font-medium text-slate-400 border-b border-slate-800/80 mb-1 flex items-center justify-between">
                      <span>Save &amp; Restore Progress</span>
                      <span className="font-mono text-emerald-400">{holdingsCount} items</span>
                    </div>

                    <button
                      type="button"
                      disabled={holdingsCount === 0}
                      onClick={() => {
                        setIsExportOpen(false);
                        onExportExcel();
                      }}
                      className="w-full px-3 py-2 text-left rounded-lg hover:bg-slate-800 disabled:opacity-45 disabled:cursor-not-allowed text-slate-100 hover:text-white transition-colors flex items-center gap-2.5"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-xs">Save as Excel (.xlsx)</div>
                        <div className="text-2xs text-slate-400">Best for re-importing later</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={holdingsCount === 0}
                      onClick={() => {
                        setIsExportOpen(false);
                        onExportCsv();
                      }}
                      className="w-full px-3 py-2 text-left rounded-lg hover:bg-slate-800 disabled:opacity-45 disabled:cursor-not-allowed text-slate-200 hover:text-white transition-colors flex items-center gap-2.5"
                    >
                      <Download className="w-4 h-4 text-sky-400 shrink-0" />
                      <div>
                        <div className="font-medium text-xs">Save as CSV (.csv)</div>
                        <div className="text-2xs text-slate-400">Universal spreadsheet &amp; backup</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={holdingsCount === 0}
                      onClick={() => {
                        setIsExportOpen(false);
                        onExportPdf();
                      }}
                      className="w-full px-3 py-2 text-left rounded-lg hover:bg-slate-800 disabled:opacity-45 disabled:cursor-not-allowed text-slate-200 hover:text-white transition-colors flex items-center gap-2.5"
                    >
                      <FileText className="w-4 h-4 text-rose-400 shrink-0" />
                      <div>
                        <div className="font-medium text-xs">Export PDF Report (.pdf)</div>
                        <div className="text-2xs text-slate-400">Printable summary + growth charts</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={holdingsCount === 0}
                      onClick={() => {
                        setIsExportOpen(false);
                        onExportJson();
                      }}
                      className="w-full px-3 py-2 text-left rounded-lg hover:bg-slate-800 disabled:opacity-45 disabled:cursor-not-allowed text-slate-300 hover:text-white transition-colors flex items-center gap-2.5"
                    >
                      <Download className="w-4 h-4 text-slate-400 shrink-0" />
                      <div>
                        <div className="font-medium text-xs">Export JSON Snapshot (.json)</div>
                        <div className="text-2xs text-slate-400">Portable raw data backup</div>
                      </div>
                    </button>

                    <div className="border-t border-slate-800/80 pt-1 mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsExportOpen(false);
                          onTriggerRestore();
                        }}
                        className="w-full px-3 py-2 text-left rounded-lg bg-indigo-950/40 hover:bg-indigo-900/50 border border-indigo-500/30 text-indigo-200 hover:text-white transition-colors flex items-center gap-2.5"
                      >
                        <Upload className="w-4 h-4 text-indigo-400 shrink-0" />
                        <div>
                          <div className="font-semibold text-xs">Restore Earlier Export</div>
                          <div className="text-2xs text-indigo-300/80">Re-import .xlsx, .csv, or .json</div>
                        </div>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Consolidated Tools & Data Menu Dropdown */}
            <div className="relative" ref={toolsMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setIsExportOpen(false);
                  setIsToolsOpen(!isToolsOpen);
                }}
                className={`p-1.5 sm:px-2.5 sm:py-1.5 text-xs font-medium border rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${
                  isToolsOpen
                    ? 'bg-slate-800 border-indigo-500 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
                title="Data sync & utilities"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden lg:inline text-2xs">Tools</span>
              </button>

              {/* Tools Dropdown Popover */}
              {isToolsOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsToolsOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 z-50 text-xs space-y-1">
                    <div className="px-3 py-1.5 text-2xs font-medium text-slate-400 border-b border-slate-800/80 mb-1">
                      Portfolio & Data Tools
                    </div>

                    {/* Restart & Validate Portfolio */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsToolsOpen(false);
                        onOpenValidateModal();
                      }}
                      className="w-full px-3 py-2 text-left rounded-lg hover:bg-slate-800 text-slate-100 hover:text-white transition-colors flex items-center gap-2.5"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <div className="font-medium text-xs">Validate / Restart Portfolio</div>
                        <div className="text-2xs text-slate-400">Upload Excel or manual batch</div>
                      </div>
                    </button>

                    {/* Refresh NAVs */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsToolsOpen(false);
                        onOpenNavRefresh();
                      }}
                      className="w-full px-3 py-2 text-left rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white transition-colors flex items-center gap-2.5"
                    >
                      <RefreshCw className="w-4 h-4 text-indigo-400 shrink-0" />
                      <div>
                        <div className="font-medium text-xs">Refresh AMFI NAVs</div>
                        <div className="text-2xs text-slate-400">Sync mutual fund prices</div>
                      </div>
                    </button>

                    {/* Upload Statement */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsToolsOpen(false);
                        onOpenUploadModal();
                      }}
                      className="w-full px-3 py-2 text-left rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white transition-colors flex items-center gap-2.5"
                    >
                      <Upload className="w-4 h-4 text-sky-400 shrink-0" />
                      <div>
                        <div className="font-medium text-xs">Import Excel / CSV</div>
                        <div className="text-2xs text-slate-400">Append XLSX, CAS, or CSV rows</div>
                      </div>
                    </button>

                    {/* Switch Persona (Mobile & Mid-size screens) */}
                    <div className="xl:hidden border-t border-slate-800/80 pt-1.5 px-3 py-1">
                      <div className="text-2xs text-slate-500 mb-1">Demo Persona:</div>
                      <select
                        value={currentProfile.id}
                        onChange={(e) => {
                          const found = DEMO_PROFILES.find((p) => p.id === e.target.value);
                          if (found) {
                            setProfile(found);
                            setIsToolsOpen(false);
                          }
                        }}
                        className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-2xs rounded-md p-1.5 focus:outline-none"
                      >
                        {DEMO_PROFILES.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.personaTitle.split('&')[0].trim()})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Backup / Reset */}
                    <div className="border-t border-slate-800/80 pt-1 mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsToolsOpen(false);
                          onResetToSample();
                        }}
                        className="w-full px-3 py-2 text-left rounded-lg hover:bg-slate-800/80 text-rose-300 hover:text-rose-200 transition-colors flex items-center gap-2.5"
                      >
                        <RotateCcw className="w-4 h-4 text-rose-400 shrink-0" />
                        <div>
                          <div className="font-medium text-xs">Export, Restore or Reset</div>
                          <div className="text-2xs text-slate-500">Save Excel / CSV / JSON or clear session</div>
                        </div>
                      </button>
                    </div>

                    {/* FX Status Footer */}
                    <div className="px-3 py-1.5 bg-slate-950/60 rounded-md border border-slate-800/60 text-2xs font-mono text-slate-500 mt-1">
                      FX: {fxSource === 'benchmark' ? 'Benchmarks' : `ECB (${fxAsOf})`} · On your device
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Interactive Quick Tour Trigger */}
            <button
              type="button"
              onClick={onStartTour}
              className="p-1.5 sm:px-2 sm:py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors flex items-center gap-1 shrink-0 whitespace-nowrap"
              title="Take a quick guided tour of saving, exporting & importing"
            >
              <HelpCircle className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="hidden lg:inline text-2xs">Tour</span>
            </button>

            {/* Primary Action CTA (+ Add Holding) */}
            <button
              onClick={onOpenAddModal}
              className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors flex items-center gap-1 shadow-xs shadow-indigo-500/20 whitespace-nowrap shrink-0 active:scale-95"
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
            onClick={() => handleTabChange('overview')}
            className={`py-1 px-2 rounded font-medium ${
              activeTab === 'overview' ? 'text-indigo-400 font-semibold' : 'text-slate-400'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => handleTabChange('rebalance')}
            className={`py-1 px-2 rounded font-medium ${
              activeTab === 'rebalance' ? 'text-indigo-400 font-semibold' : 'text-slate-400'
            }`}
          >
            Rebalance
          </button>
          <button
            onClick={() => handleTabChange('radar')}
            className={`py-1 px-2 rounded font-medium relative ${
              activeTab === 'radar' ? 'text-indigo-400 font-semibold' : 'text-slate-400'
            }`}
          >
            Maturity Radar {maturedCount > 0 && `(${maturedCount})`}
          </button>
          <button
            onClick={() => handleTabChange('tax')}
            className={`py-1 px-2 rounded font-medium ${
              activeTab === 'tax' ? 'text-indigo-400 font-semibold' : 'text-slate-400'
            }`}
          >
            Tax & Audit
          </button>
          <button
            onClick={() => handleTabChange('simulator')}
            className={`py-1 px-2 rounded font-medium ${
              activeTab === 'simulator' ? 'text-indigo-400 font-semibold' : 'text-slate-400'
            }`}
          >
            Stress Lab
          </button>
        </div>
      </div>
    </header>
  );
};
