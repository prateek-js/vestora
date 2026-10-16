import React, { useState } from 'react';
import { CurrencyCode, Holding } from '../types/wealth';
import { withDerivedMaturity } from '../utils/maturity';
import { X, FileText, ArrowRight, Sparkles } from 'lucide-react';

interface UploadStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseCurrency: CurrencyCode;
  onImportHoldings: (newHoldings: Holding[]) => void;
}

type StatementTemplate = 'CAS' | 'FD_REGISTRY' | 'RETIREMENT';

const TEMPLATES: {
  id: StatementTemplate;
  title: string;
  description: string;
  accent: string;
}[] = [
  {
    id: 'CAS',
    title: 'Mutual Fund & Demat Sample (CAMS / KFintech style)',
    description: 'Two equity holdings with folio numbers, unrealized gains, and LTCG tags.',
    accent: 'text-indigo-400',
  },
  {
    id: 'FD_REGISTRY',
    title: 'Fixed Deposit Sample (Bank registry style)',
    description: 'One term deposit maturing in ~4 weeks — feeds the Maturity Radar.',
    accent: 'text-sky-400',
  },
  {
    id: 'RETIREMENT',
    title: 'Sovereign Gold Bond Sample (RBI Retail Direct style)',
    description: 'One SGB tranche with EEE tax status and long-dated maturity.',
    accent: 'text-amber-400',
  },
];

// Sample rows are dated relative to today so the Maturity Radar always has a
// live "maturing soon" example regardless of when the demo is opened.
function buildSampleHoldings(template: StatementTemplate): Holding[] {
  const stamp = Date.now();
  if (template === 'CAS') {
    return [
      {
        id: `h-cas-${stamp}-1`,
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
        notes: 'Sample row in CAMS/KFintech Consolidated Account Statement (CAS) format.',
      },
      {
        id: `h-cas-${stamp}-2`,
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
  }

  if (template === 'FD_REGISTRY') {
    const maturity = new Date();
    maturity.setDate(maturity.getDate() + 28);
    const maturityIso = maturity.toISOString().slice(0, 10);
    return [
      {
        id: `h-fd-${stamp}-1`,
        name: 'Axis Bank 1-Year Special Term Deposit',
        category: 'FIXED_DEPOSIT',
        institution: 'Axis Bank',
        accountNumberMask: 'FD-••••3391',
        investedAmount: 500000,
        currentValue: 538000,
        currency: 'INR',
        interestRatePct: 7.6,
        purchaseDate: '2025-11-10',
        maturityDate: maturityIso,
        daysToMaturity: 28,
        isMatured: false,
        unrealizedGain: 38000,
        unrealizedGainPct: 7.6,
        taxTag: 'SLAB_INCOME',
        notes: 'Sample row in bank term-deposit registry format. Maturing in ~4 weeks.',
      },
    ];
  }

  const maturity = new Date();
  maturity.setDate(maturity.getDate() + 690);
  const maturityIso = maturity.toISOString().slice(0, 10);
  return [
    {
      id: `h-ret-${stamp}-1`,
      name: 'Sovereign Gold Bond 2020-21 Series VI',
      category: 'SOVEREIGN_GOLD_BOND',
      institution: 'Reserve Bank of India',
      accountNumberMask: 'RBI-SGB-2020',
      investedAmount: 350000,
      currentValue: 610000,
      currency: 'INR',
      interestRatePct: 2.5,
      purchaseDate: '2020-09-04',
      maturityDate: maturityIso,
      daysToMaturity: 690,
      isMatured: false,
      unrealizedGain: 260000,
      unrealizedGainPct: 74.29,
      taxTag: 'TAX_EXEMPT_EEE',
      notes: 'Sample row in RBI Retail Direct SGB export format.',
    },
  ];
}

export const UploadStatementModal: React.FC<UploadStatementModalProps> = ({
  isOpen,
  onClose,
  onImportHoldings,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<StatementTemplate>('CAS');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleLoadSample = () => {
    setIsProcessing(true);

    setTimeout(() => {
      const imported = buildSampleHoldings(selectedTemplate).map(withDerivedMaturity);
      onImportHoldings(imported);
      setIsProcessing(false);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg shadow-2xl p-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            <span>Load a Sample Statement</span>
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-3 p-3 bg-slate-950/60 border border-slate-800 rounded-lg flex items-start gap-2.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-2xs text-slate-400 leading-relaxed">
            Vestora is fully client-side, so there is no file upload — pick a real-world statement
            format below and its sample holdings are added to your ledger. Live statement parsing is
            on the roadmap.
          </p>
        </div>

        {/* Template Selector */}
        <div className="mt-4 space-y-2.5">
          <label className="block text-xs font-semibold text-slate-300">
            Choose statement format:
          </label>

          {TEMPLATES.map((template) => (
            <div
              key={template.id}
              onClick={() => setSelectedTemplate(template.id)}
              className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
                selectedTemplate === template.id
                  ? 'bg-slate-800 border-indigo-500'
                  : 'bg-slate-950 border-slate-800 hover:border-slate-700'
              }`}
            >
              <FileText className={`w-5 h-5 ${template.accent} shrink-0 mt-0.5`} />
              <div>
                <div className="text-xs font-semibold text-white">{template.title}</div>
                <p className="text-2xs text-slate-400 mt-0.5">{template.description}</p>
              </div>
            </div>
          ))}
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
            onClick={handleLoadSample}
            disabled={isProcessing}
            className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            {isProcessing ? (
              <span>Loading Sample...</span>
            ) : (
              <>
                <span>Add Sample Holdings</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
