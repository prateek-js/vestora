import React, { useState, useRef, useEffect } from 'react';
import { CurrencyCode, UserProfile } from '../types/wealth';
import { DEMO_PROFILES } from '../data/mockData';
import { trackEvent } from '../utils/analytics';
import {
  Plus,
  Upload,
  User,
  RotateCcw,
  RefreshCw,
  MoreVertical,
  SlidersHorizontal,
  ChevronDown,
  Layers,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

const TAB_NAMES = {
  overview: 'Overview & Ledger',
  radar: 'Maturity Radar',
  tax: 'Tax & Diversification',
  simulator: 'Macro Stress Lab',
} as const;

interface NavbarProps {
  activeTab: 'overview' | 'radar' | 'tax' | 'simulator';
  setActiveTab: (tab: 'overview' | 'radar' | 'tax' | 'simulator') => void;
  baseCurrency: CurrencyCode;
  setBaseCurrency: (c: CurrencyCode) => void;
  currentProfile: UserProfile;
  setProfile: (p: UserProfile) => void;
  onOpenAddModal: () => void;
  onOpenUploadModal: () => void;
  onOpenNavRefresh: () => void;
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
  onOpenAddModal,
  onOpenUploadModal,
  onOpenNavRefresh,
  maturedCount,
  onResetToSample,
  fxAsOf,
  fxSource,
}) => {
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement>(null);

  const handleTabChange = (tab: NavbarProps['activeTab']) => {
    setActiveTab(tab);
    trackEvent('tab_viewed', { tab: TAB_NAMES[tab] });
  };

  // Close tools popover on click outside or escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsToolsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="border-b border-slate-800 bg-slate-950/95 backdrop-blur-md sticky top-0 z-40 w-full">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
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

            {/* Consolidated Tools & Data Menu Dropdown */}
            <div className="relative" ref={toolsMenuRef}>
              <button
                type="button"
                onClick={() => setIsToolsOpen(!isToolsOpen)}
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
                    <div className="px-3 py-1.5 text-3xs font-mono uppercase text-slate-500 tracking-wider border-b border-slate-800/80 mb-1">
                      Data & Portfolio Utilities
                    </div>

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
                        <div className="text-3xs text-slate-400">Sync mutual fund prices</div>
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
                        <div className="font-medium text-xs">Load Statement</div>
                        <div className="text-3xs text-slate-400">Import CAS / CSV portfolio</div>
                      </div>
                    </button>

                    {/* Switch Persona (Mobile & Mid-size screens) */}
                    <div className="xl:hidden border-t border-slate-800/80 pt-1.5 px-3 py-1">
                      <div className="text-3xs font-mono text-slate-500 mb-1">Profile Persona:</div>
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

                    {/* Reset to Sample Portfolio */}
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
                          <div className="font-medium text-xs">Reset Ledger</div>
                          <div className="text-3xs text-slate-500">Restore default demo assets</div>
                        </div>
                      </button>
                    </div>

                    {/* FX Status Footer */}
                    <div className="px-3 py-1.5 bg-slate-950/60 rounded-md border border-slate-800/60 text-3xs font-mono text-slate-500 mt-1">
                      FX: {fxSource === 'benchmark' ? 'Built-in Benchmarks' : `ECB Fix (${fxAsOf})`}
                    </div>
                  </div>
                </>
              )}
            </div>

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
