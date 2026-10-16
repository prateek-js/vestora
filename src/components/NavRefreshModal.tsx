import React, { useEffect, useState } from 'react';
import { Holding } from '../types/wealth';
import { refreshMutualFundNavs, searchFunds, NavRefreshOutcome } from '../utils/navRefresh';
import { formatCurrency } from '../utils/currency';
import { CurrencyCode } from '../types/wealth';
import { X, RefreshCw, CheckCircle2, AlertCircle, Search, Link2 } from 'lucide-react';

interface NavRefreshModalProps {
  isOpen: boolean;
  onClose: () => void;
  holdings: Holding[];
  baseCurrency: CurrencyCode;
  onHoldingsRefreshed: (holdings: Holding[]) => void;
}

type Phase = 'confirm' | 'running' | 'done';

export const NavRefreshModal: React.FC<NavRefreshModalProps> = ({
  isOpen,
  onClose,
  holdings,
  baseCurrency,
  onHoldingsRefreshed,
}) => {
  const [phase, setPhase] = useState<Phase>('confirm');
  const [outcome, setOutcome] = useState<NavRefreshOutcome | null>(null);
  // id -> chosen schemeCode during mapping
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [searchResults, setSearchResults] = useState<Record<string, { schemeCode: number; schemeName: string }[]>>({});
  const [searchingFor, setSearchingFor] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPhase('confirm');
      setOutcome(null);
      setMapping({});
      setSearchResults({});
      setSearchingFor(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const funds = holdings.filter((h) => h.category === 'MUTUAL_FUND');

  const runRefresh = async () => {
    setPhase('running');

    // Apply any user-chosen scheme mappings before the refresh pass.
    let working = holdings;
    if (Object.keys(mapping).length > 0) {
      working = holdings.map((h) =>
        mapping[h.id] ? { ...h, schemeCode: mapping[h.id] } : h
      );
    }

    const result = await refreshMutualFundNavs(working);
    setOutcome(result);
    setPhase('done');
    onHoldingsRefreshed(result.updatedHoldings);
  };

  const handleSearch = async (holdingId: string, name: string) => {
    setSearchingFor(holdingId);
    const results = await searchFunds(name);
    setSearchResults((prev) => ({ ...prev, [holdingId]: results }));
    setSearchingFor(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-xl max-h-[85vh] overflow-y-auto shadow-2xl p-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-sky-400" />
            <span>Refresh Mutual Fund NAVs</span>
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
            aria-label="Close NAV refresh"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {phase === 'confirm' && (
          <div className="mt-4 space-y-4 text-xs">
            <p className="text-slate-400 leading-relaxed">
              Pulls today's published NAVs from AMFI's feed (via mfapi.in, keyless and
              client-side) and re-values each fund as units × latest NAV. On the first
              refresh, current value is adopted as units; afterwards valuations track the
              published NAV.
            </p>
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 text-2xs text-slate-500 leading-relaxed">
              {funds.length > 0 ? (
                <>
                  <span className="text-slate-300 font-semibold">{funds.length} mutual fund holdings</span>{' '}
                  will be checked — {funds.filter((f) => f.schemeCode).length} already mapped to AMFI
                  scheme codes{funds.some((f) => !f.schemeCode) ? ', the rest can be mapped below' : ''}.
                </>
              ) : (
                'No mutual fund holdings in the current ledger.'
              )}
            </div>

            {/* Unmapped fund mapping UI */}
            {funds.filter((f) => !f.schemeCode).map((fund) => (
              <div key={fund.id} className="border border-slate-800 rounded-lg p-3 bg-slate-950/40">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-200 font-semibold truncate">{fund.name}</span>
                  <button
                    onClick={() => handleSearch(fund.id, fund.name)}
                    disabled={searchingFor === fund.id}
                    className="text-2xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 shrink-0 disabled:opacity-50"
                  >
                    <Search className="w-3 h-3" />
                    {searchingFor === fund.id ? 'Searching…' : 'Find scheme'}
                  </button>
                </div>
                {searchResults[fund.id]?.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {searchResults[fund.id].map((r) => (
                      <button
                        key={r.schemeCode}
                        onClick={() =>
                          setMapping((prev) => ({ ...prev, [fund.id]: r.schemeCode }))
                        }
                        className={`w-full text-left px-2 py-1.5 rounded text-2xs transition-colors flex items-center justify-between gap-2 ${
                          mapping[fund.id] === r.schemeCode
                            ? 'bg-indigo-600/30 border border-indigo-500 text-white'
                            : 'bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <span className="truncate">{r.schemeName}</span>
                        {mapping[fund.id] === r.schemeCode && <Link2 className="w-3 h-3 shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
                {mapping[fund.id] && (
                  <p className="text-2xs text-emerald-400 mt-1.5">
                    Mapped to scheme {mapping[fund.id]} — will refresh on confirm.
                  </p>
                )}
              </div>
            ))}

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={runRefresh}
                disabled={funds.length === 0}
                className="px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh {funds.length} Funds</span>
              </button>
            </div>
          </div>
        )}

        {phase === 'running' && (
          <div className="py-12 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-sky-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-400">Fetching latest NAVs from AMFI feed…</p>
          </div>
        )}

        {phase === 'done' && outcome && (
          <div className="mt-4 space-y-4 text-xs">
            {outcome.updated.length > 0 && (
              <div className="space-y-2">
                <div className="text-2xs font-mono text-slate-500 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  {outcome.updated.length} FUNDS RE-VALUED
                </div>
                {outcome.updated.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-slate-200 font-semibold truncate">{u.name}</div>
                      <div className="text-2xs text-slate-500 font-mono">
                        NAV {u.oldNav !== null ? u.oldNav.toFixed(2) : '—'} → {u.nav.toFixed(2)} · as of {u.navDate}
                      </div>
                    </div>
                    <div className="text-emerald-400 font-mono font-semibold text-xs shrink-0 ml-3">
                      {formatCurrency(
                        outcome.updatedHoldings.find((h) => h.id === u.id)?.currentValue ?? 0,
                        baseCurrency,
                        { compact: true }
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {outcome.unmapped.length > 0 && (
              <div className="bg-amber-950/20 border border-amber-500/30 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-2xs text-amber-200/90 leading-relaxed">
                  {outcome.unmapped.length} fund{outcome.unmapped.length > 1 ? 's' : ''} not mapped to a
                  scheme code yet — reopen this dialog and use “Find scheme” to enable refresh for{' '}
                  {outcome.unmapped.map((u) => u.name).join(', ')}.
                </p>
              </div>
            )}

            {outcome.failed.length > 0 && (
              <div className="bg-rose-950/20 border border-rose-500/30 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <p className="text-2xs text-rose-200/90 leading-relaxed">
                  {outcome.failed.map((f) => `${f.name}: ${f.reason}`).join(' · ')}
                </p>
              </div>
            )}

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
