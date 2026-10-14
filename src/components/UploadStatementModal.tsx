import React, { useState } from 'react';
import { CurrencyCode, Holding } from '../types/wealth';
import { X, Upload, FileText, CheckCircle2, ArrowRight } from 'lucide-react';

interface UploadStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseCurrency: CurrencyCode;
  onImportHoldings: (newHoldings: Holding[]) => void;
}

export const UploadStatementModal: React.FC<UploadStatementModalProps> = ({
  isOpen,
  onClose,
  baseCurrency,
  onImportHoldings,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<'CAS' | 'FD_REGISTRY' | 'RETIREMENT'>('CAS');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleSimulateImport = () => {
    setIsProcessing(true);

    setTimeout(() => {
      let imported: Holding[] = [];

      if (selectedTemplate === 'CAS') {
        imported = [
          {
            id: `h-cas-${Date.now()}-1`,
            name: 'Quant Small Cap Fund (Direct Growth)',
            category: 'MUTUAL_FUND',
            institution: 'Quant Mutual Fund',
            accountNumberMask: 'Folio: 9940129',
            investedAmount: 300000,
            currentValue: 485000,
            currency: 'INR',
            purchaseDate: '2022-08-10',
            unrealizedGain: 185000,
            unrealizedGainPct: 61.67,
            taxTag: 'LTCG_EQUITY',
            notes: 'Imported via CAMS/KFintech Consolidated Account Statement (CAS).',
          },
          {
            id: `h-cas-${Date.now()}-2`,
            name: 'Tata Consultancy Services (TCS) - 50 Shares',
            category: 'EQUITY_STOCK',
            institution: 'Zerodha Broking',
            accountNumberMask: 'Demat: 12081600',
            investedAmount: 175000,
            currentValue: 215000,
            currency: 'INR',
            purchaseDate: '2023-01-20',
            unrealizedGain: 40000,
            unrealizedGainPct: 22.86,
            taxTag: 'LTCG_EQUITY',
          },
        ];
      } else if (selectedTemplate === 'FD_REGISTRY') {
        imported = [
          {
            id: `h-fd-${Date.now()}-1`,
            name: 'Axis Bank 1-Year Special Term Deposit',
            category: 'FIXED_DEPOSIT',
            institution: 'Axis Bank',
            accountNumberMask: 'FD-••••3391',
            investedAmount: 500000,
            currentValue: 538000,
            currency: 'INR',
            interestRatePct: 7.60,
            purchaseDate: '2025-11-10',
            maturityDate: '2026-11-10',
            daysToMaturity: 28, // Maturing in 28 days!
            isMatured: false,
            unrealizedGain: 38000,
            unrealizedGainPct: 7.6,
            taxTag: 'SLAB_INCOME',
          },
        ];
      } else {
        imported = [
          {
            id: `h-ret-${Date.now()}-1`,
            name: 'Sovereign Gold Bond 2020-21 Series VI',
            category: 'SOVEREIGN_GOLD_BOND',
            institution: 'Reserve Bank of India',
            accountNumberMask: 'RBI-SGB-2020',
            investedAmount: 350000,
            currentValue: 610000,
            currency: 'INR',
            interestRatePct: 2.50,
            purchaseDate: '2020-09-04',
            maturityDate: '2028-09-04',
            daysToMaturity: 690,
            isMatured: false,
            unrealizedGain: 260000,
            unrealizedGainPct: 74.29,
            taxTag: 'TAX_EXEMPT_EEE',
          },
        ];
      }

      onImportHoldings(imported);
      setIsProcessing(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg shadow-2xl p-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Upload className="w-4 h-4 text-indigo-400" />
            <span>Upload Portfolio Statement / CAS</span>
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-400 mt-3">
          Synchronize your mutual funds, demat equities, fixed deposits, or retirement passbooks directly
          via institutional statement files.
        </p>

        {/* Template Selector */}
        <div className="mt-4 space-y-2.5">
          <label className="block text-xs font-semibold text-slate-300">
            Select Statement Format to Ingest:
          </label>

          <div
            onClick={() => setSelectedTemplate('CAS')}
            className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
              selectedTemplate === 'CAS'
                ? 'bg-slate-800 border-indigo-500'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}
          >
            <FileText className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold text-white">
                CAMS / KFintech Consolidated Account Statement (eCAS)
              </div>
              <p className="text-2xs text-slate-400 mt-0.5">
                Mutual funds across all AMCs with ISINs, folio numbers, units, and purchase dates.
              </p>
            </div>
          </div>

          <div
            onClick={() => setSelectedTemplate('FD_REGISTRY')}
            className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
              selectedTemplate === 'FD_REGISTRY'
                ? 'bg-slate-800 border-indigo-500'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}
          >
            <FileText className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold text-white">
                Bank Term Deposit & Recurring Deposit Registry (CSV)
              </div>
              <p className="text-2xs text-slate-400 mt-0.5">
                Fixed deposits, recurring deposits with interest rates, maturity dates, and principal.
              </p>
            </div>
          </div>

          <div
            onClick={() => setSelectedTemplate('RETIREMENT')}
            className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
              selectedTemplate === 'RETIREMENT'
                ? 'bg-slate-800 border-indigo-500'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}
          >
            <FileText className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold text-white">
                RBI Retail Direct Sovereign Gold Bond & G-Sec Export
              </div>
              <p className="text-2xs text-slate-400 mt-0.5">
                Sovereign Gold Bond tranches, central government securities, and state development loans.
              </p>
            </div>
          </div>
        </div>

        {/* Drag Drop Area */}
        <div className="mt-4 border-2 border-dashed border-slate-800 rounded-xl p-6 text-center hover:border-slate-700 transition-colors bg-slate-950/40">
          <Upload className="w-8 h-8 text-slate-500 mx-auto" />
          <div className="text-xs font-medium text-slate-300 mt-2">
            Drag and drop statement PDF / CSV, or browse
          </div>
          <p className="text-2xs text-slate-500 mt-1">
            Client-side parsing only. Your financial statement never leaves your browser.
          </p>
        </div>

        {/* Actions */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSimulateImport}
            disabled={isProcessing}
            className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            {isProcessing ? (
              <span>Parsing Statement...</span>
            ) : (
              <>
                <span>Import Sample Statement</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
