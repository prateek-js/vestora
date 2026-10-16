import React from 'react';
import { CurrencyCode, UserProfile } from '../types/wealth';
import { DEMO_PROFILES } from '../data/mockData';
import { Plus, Upload, User, RotateCcw } from 'lucide-react';

interface NavbarProps {
  activeTab: 'overview' | 'radar' | 'tax' | 'simulator';
  setActiveTab: (tab: 'overview' | 'radar' | 'tax' | 'simulator') => void;
  baseCurrency: CurrencyCode;
  setBaseCurrency: (c: CurrencyCode) => void;
  currentProfile: UserProfile;
  setProfile: (p: UserProfile) => void;
  onOpenAddModal: () => void;
  onOpenUploadModal: () => void;
  maturedCount: number;
  onResetToSample: () => void;
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
  maturedCount,
  onResetToSample,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Zone 1: Brand wordmark single-line */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-mono font-bold text-sm shadow-inner">
                V
              </span>
              Vestora
            </span>
          </div>

          {/* Zone 2: Navigation Links (single line, whitespace-nowrap) */}
          <nav className="hidden md:flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'overview'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Overview & Ledger
            </button>
            <button
              onClick={() => setActiveTab('radar')}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 relative flex items-center gap-1.5 ${
                activeTab === 'radar'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <span>Maturity Radar</span>
              {maturedCount > 0 && (
                <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-xs px-1.5 py-0.2 rounded font-mono font-semibold">
                  {maturedCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('tax')}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'tax'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Tax & Diversification
            </button>
            <button
              onClick={() => setActiveTab('simulator')}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'simulator'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Macro Stress Lab
            </button>
          </nav>

          {/* Zone 3: Global Actions (Currency, Preset Profile, Fast Ingest) */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Currency Selector */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              {(['INR', 'USD', 'EUR'] as CurrencyCode[]).map((curr) => (
                <button
                  key={curr}
                  onClick={() => setBaseCurrency(curr)}
                  className={`px-2 py-1 text-xs font-mono font-medium rounded transition-colors ${
                    baseCurrency === curr
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title={`Switch base currency to ${curr}`}
                >
                  {curr}
                </button>
              ))}
            </div>

            {/* Profile Persona Switcher */}
            <div className="relative hidden lg:block">
              <select
                aria-label="Active Investor Profile"
                value={currentProfile.id}
                onChange={(e) => {
                  const found = DEMO_PROFILES.find((p) => p.id === e.target.value);
                  if (found) setProfile(found);
                }}
                className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 pr-7 appearance-none focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {DEMO_PROFILES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.personaTitle.split('&')[0].trim()})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-2 top-2 text-slate-500">
                <User className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Quick Upload Button */}
            <button
              onClick={onOpenUploadModal}
              className="p-1.5 sm:px-2.5 sm:py-1.5 text-xs font-medium text-slate-300 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 hover:text-white transition-colors flex items-center gap-1.5"
              title="Load a sample statement into the ledger"
            >
              <Upload className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Load Statement</span>
            </button>

            {/* Reset to Sample Data */}
            <button
              onClick={onResetToSample}
              className="p-1.5 text-slate-400 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 hover:text-white transition-colors"
              title="Reset ledger to the sample portfolio"
              aria-label="Reset ledger to the sample portfolio"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Add Investment CTA */}
            <button
              onClick={onOpenAddModal}
              className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors flex items-center gap-1.5 shadow-sm shadow-indigo-500/20 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Investment</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="md:hidden flex items-center justify-around py-2 border-t border-slate-800/80 text-xs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-1 px-2 rounded font-medium ${
              activeTab === 'overview' ? 'text-indigo-400' : 'text-slate-400'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('radar')}
            className={`py-1 px-2 rounded font-medium relative ${
              activeTab === 'radar' ? 'text-indigo-400' : 'text-slate-400'
            }`}
          >
            Maturity Radar {maturedCount > 0 && `(${maturedCount})`}
          </button>
          <button
            onClick={() => setActiveTab('tax')}
            className={`py-1 px-2 rounded font-medium ${
              activeTab === 'tax' ? 'text-indigo-400' : 'text-slate-400'
            }`}
          >
            Tax & Audit
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`py-1 px-2 rounded font-medium ${
              activeTab === 'simulator' ? 'text-indigo-400' : 'text-slate-400'
            }`}
          >
            Stress Lab
          </button>
        </div>
      </div>
    </header>
  );
};
