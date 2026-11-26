import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AssetCategory, CurrencyCode, Holding, TaxTag } from '../types/wealth';
import {
  downloadPortfolioExcelTemplate,
  exportHoldingsToCsv,
  exportHoldingsToExcel,
  importExcelBuffer,
  importStatement,
  ParsedStatement,
  StatementFormat,
} from '../utils/statementImport';
import { formatCurrency } from '../utils/currency';
import { todayIso, withDerivedMaturity } from '../utils/maturity';
import { trackEvent } from '../utils/analytics';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  Table2,
  RotateCcw,
  ShieldCheck,
  Plus,
  Trash2,
  Download,
  AlertTriangle,
  ArrowRight,
  Eraser,
} from 'lucide-react';

interface ValidatePortfolioModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentHoldings: Holding[];
  initialTab?: BuilderTab;
  onApplyHoldings: (holdings: Holding[], strategy: 'replace' | 'append') => void;
  onStartBlank: () => void;
  onRestoreDemo: () => void;
}

type BuilderTab = 'excel' | 'manual' | 'reset';

interface ManualDraftRow {
  tempId: string;
  name: string;
  category: AssetCategory;
  institution: string;
  investedAmount: string;
  currentValue: string;
  currency: CurrencyCode;
  interestRatePct: string;
  maturityDate: string;
}

const CATEGORY_OPTIONS: { value: AssetCategory; label: string }[] = [
  { value: 'MUTUAL_FUND', label: 'Mutual Fund' },
  { value: 'EQUITY_STOCK', label: 'Direct Stock / ETF' },
  { value: 'FIXED_DEPOSIT', label: 'Fixed Deposit (FD)' },
  { value: 'RECURRING_DEPOSIT', label: 'Recurring Deposit (RD)' },
  { value: 'SOVEREIGN_GOLD_BOND', label: 'Gold / SGB' },
  { value: 'GOVT_BOND', label: 'Govt Bond / G-Sec' },
  { value: 'CORP_BOND', label: 'Corporate Bond' },
  { value: 'EPF', label: 'EPF' },
  { value: 'PPF', label: 'PPF' },
  { value: 'NPS', label: 'NPS' },
  { value: 'SAVINGS_CASH', label: 'Savings / Cash' },
];

const FORMAT_LABELS: Record<StatementFormat, string> = {
  PORTFOLIO_SHEET: 'Portfolio Spreadsheet',
  CAS: 'CAMS / KFintech CAS Statement',
  FD_REGISTRY: 'Bank Deposit Registry',
  MF_CENTRAL: 'MF Central Export',
};

function defaultTaxTagFor(category: AssetCategory): TaxTag {
  switch (category) {
    case 'FIXED_DEPOSIT':
    case 'RECURRING_DEPOSIT':
    case 'CORP_BOND':
    case 'GOVT_BOND':
    case 'SAVINGS_CASH':
      return 'SLAB_INCOME';
    case 'SOVEREIGN_GOLD_BOND':
    case 'EPF':
    case 'PPF':
      return 'TAX_EXEMPT_EEE';
    case 'NPS':
      return '80CCD';
    default:
      return 'LTCG_EQUITY';
  }
}

function createEmptyDraft(): ManualDraftRow {
  return {
    tempId: `row-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    category: 'MUTUAL_FUND',
    institution: '',
    investedAmount: '',
    currentValue: '',
    currency: 'INR',
    interestRatePct: '',
    maturityDate: '',
  };
}

export const ValidatePortfolioModal: React.FC<ValidatePortfolioModalProps> = ({
  isOpen,
  onClose,
  currentHoldings,
  initialTab = 'excel',
  onApplyHoldings,
  onStartBlank,
  onRestoreDemo,
}) => {
  const [activeTab, setActiveTab] = useState<BuilderTab>(initialTab);
  const [applyStrategy, setApplyStrategy] = useState<'replace' | 'append'>('replace');

  // Excel / CSV state
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [parsed, setParsed] = useState<ParsedStatement | null>(null);
  const [previewHoldings, setPreviewHoldings] = useState<Holding[]>([]);
  const [excelError, setExcelError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual batch entry state
  const [draftRows, setDraftRows] = useState<ManualDraftRow[]>([
    createEmptyDraft(),
    createEmptyDraft(),
  ]);
  const [manualError, setManualError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setExcelError('');
      setManualError('');
      setParsed(null);
      setPreviewHoldings([]);
      setFileName('');
      setFileBuffer(null);
      setSheetNames([]);
      setActiveSheet('');
      setDraftRows([createEmptyDraft(), createEmptyDraft()]);
    }
  }, [isOpen, initialTab]);

  const manualSummary = useMemo(() => {
    let validCount = 0;
    let totalInvested = 0;
    let totalValue = 0;

    draftRows.forEach((row) => {
      const inv = parseFloat(row.investedAmount);
      const val = parseFloat(row.currentValue);
      if (row.name.trim() && Number.isFinite(inv) && inv > 0 && Number.isFinite(val) && val >= 0) {
        validCount += 1;
        totalInvested += inv;
        totalValue += val;
      }
    });

    return { validCount, totalInvested, totalValue };
  }, [draftRows]);

  if (!isOpen) return null;

  const processExcelBuffer = (buffer: ArrayBuffer, name: string, requestedSheet?: string) => {
    setExcelError('');
    try {
      const result = importExcelBuffer(buffer, requestedSheet);
      setFileBuffer(buffer);
      setFileName(name);
      setSheetNames(result.sheetNames);
      setActiveSheet(result.activeSheet);
      setParsed(result.parsed);
      setPreviewHoldings(result.parsed.holdings);

      if (result.parsed.holdings.length === 0) {
        setExcelError(
          `Sheet "${result.activeSheet}" was read, but no valid holding rows matched. Check column headers or select another sheet.`
        );
      }
    } catch (err) {
      setParsed(null);
      setPreviewHoldings([]);
      setExcelError(err instanceof Error ? err.message : 'Unable to parse this Excel workbook.');
    }
  };

  const handleSpreadsheetFile = (file: File) => {
    setExcelError('');
    const lower = file.name.toLowerCase();
    const isExcel = /\.(xlsx|xls|xlsm|xlsb|ods)$/i.test(lower);
    const isCsv = /\.(csv|tsv|txt)$/i.test(lower) || file.type === 'text/csv' || file.type === 'text/plain';

    if (!isExcel && !isCsv) {
      setExcelError('Please upload an Excel workbook (.xlsx, .xls) or CSV/TSV file.');
      return;
    }

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          processExcelBuffer(reader.result, file.name);
        }
      };
      reader.onerror = () => setExcelError('Could not read the Excel file.');
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const result = importStatement(String(reader.result ?? ''));
          setFileBuffer(null);
          setSheetNames([]);
          setActiveSheet('');
          setFileName(file.name);
          setParsed(result);
          setPreviewHoldings(result.holdings);
          if (result.holdings.length === 0) {
            setExcelError('No valid rows matched the expected columns.');
          }
        } catch (err) {
          setParsed(null);
          setPreviewHoldings([]);
          setExcelError(err instanceof Error ? err.message : 'Could not parse CSV file.');
        }
      };
      reader.onerror = () => setExcelError('Could not read the CSV file.');
      reader.readAsText(file);
    }
  };

  const handleApplyExcel = () => {
    if (previewHoldings.length === 0) return;
    onApplyHoldings(previewHoldings, applyStrategy);
    trackEvent('portfolio_validated_excel', {
      count: previewHoldings.length,
      strategy: applyStrategy,
      format: parsed?.format ?? 'PORTFOLIO_SHEET',
    });
    onClose();
  };

  const handleLoadExistingIntoManual = () => {
    if (currentHoldings.length === 0) return;
    setDraftRows(
      currentHoldings.map((h) => ({
        tempId: h.id,
        name: h.name,
        category: h.category,
        institution: h.institution,
        investedAmount: String(Math.round(h.investedAmount)),
        currentValue: String(Math.round(h.currentValue)),
        currency: h.currency,
        interestRatePct: h.interestRatePct !== undefined ? String(h.interestRatePct) : '',
        maturityDate: h.maturityDate ?? '',
      }))
    );
    setManualError('');
  };

  const handleUpdateDraft = (tempId: string, field: keyof ManualDraftRow, value: string) => {
    setDraftRows((prev) =>
      prev.map((row) => (row.tempId === tempId ? { ...row, [field]: value } : row))
    );
  };

  const handleApplyManual = () => {
    setManualError('');
    const nonEmpty = draftRows.filter(
      (r) => r.name.trim() || r.investedAmount.trim() || r.currentValue.trim()
    );

    if (nonEmpty.length === 0) {
      setManualError('Enter at least one holding with a name, invested amount, and current value.');
      return;
    }

    const built: Holding[] = [];
    for (let i = 0; i < nonEmpty.length; i++) {
      const r = nonEmpty[i];
      const inv = parseFloat(r.investedAmount);
      const val = parseFloat(r.currentValue);
      if (!r.name.trim()) {
        setManualError(`Row ${i + 1}: Please enter an instrument or asset name.`);
        return;
      }
      if (!Number.isFinite(inv) || inv <= 0) {
        setManualError(`Row ${i + 1} (${r.name}): Invested amount must be greater than 0.`);
        return;
      }
      if (!Number.isFinite(val) || val < 0) {
        setManualError(`Row ${i + 1} (${r.name}): Current value must be 0 or greater.`);
        return;
      }

      const rate = r.interestRatePct.trim() ? parseFloat(r.interestRatePct) : undefined;
      const gain = val - inv;
      const gainPct = inv > 0 ? (gain / inv) * 100 : 0;

      built.push(
        withDerivedMaturity({
          id: `h-manual-${Date.now()}-${i}`,
          name: r.name.trim(),
          category: r.category,
          institution: r.institution.trim() || 'Self-Reported',
          investedAmount: inv,
          currentValue: val,
          currency: 'INR',
          interestRatePct: rate !== undefined && Number.isFinite(rate) ? rate : undefined,
          purchaseDate: todayIso(),
          maturityDate: r.maturityDate.trim() || undefined,
          unrealizedGain: gain,
          unrealizedGainPct: gainPct,
          taxTag: defaultTaxTagFor(r.category),
          notes: 'Entered in Validate & Simulate session',
        })
      );
    }

    onApplyHoldings(built, applyStrategy);
    trackEvent('portfolio_validated_manual', {
      count: built.length,
      strategy: applyStrategy,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-ink/50 backdrop-blur-xs">
      <div className="bg-paper border border-slate-700 rounded-xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-ink/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between gap-4 shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-ink">
              Restart & Validate Your Portfolio
            </h2>
            <p className="text-xs text-ink/70 mt-0.5">
              Upload an Excel sheet or enter holdings manually to simulate your real portfolio.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink/70 hover:text-ink p-1.5 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Explicit Privacy Banner */}
        <div className="px-5 py-2.5 bg-emerald-500/10 border-b border-emerald-500/20 flex items-start sm:items-center gap-2.5 shrink-0">
          <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5 sm:mt-0" />
          <p className="text-xs text-emerald-700 leading-relaxed">
            <span className="font-semibold">We don&apos;t store your data with us.</span>{' '}
            Your Excel files and manual entries are processed privately on your device and never uploaded to our servers.
          </p>
        </div>

        {/* Mode Tabs & Replace/Append Control */}
        <div className="px-5 py-3 border-b border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-mist shrink-0">
          <div className="flex items-center gap-1 p-1 bg-mist border border-slate-700 rounded-lg w-fit">
            <button
              type="button"
              onClick={() => setActiveTab('excel')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'excel'
                  ? 'bg-ink text-paper'
                  : 'text-ink/70 hover:text-ink'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Upload Excel / CSV
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('manual')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'manual'
                  ? 'bg-ink text-paper'
                  : 'text-ink/70 hover:text-ink'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              Manual Entries
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('reset')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'reset'
                  ? 'bg-ink text-paper'
                  : 'text-ink/70 hover:text-ink'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Options
            </button>
          </div>

          {activeTab !== 'reset' && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-ink/70 whitespace-nowrap">Action:</span>
              <div className="flex items-center bg-mist border border-slate-700 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setApplyStrategy('replace')}
                  className={`px-3 py-1.5 min-h-[40px] text-2xs font-medium rounded transition-colors whitespace-nowrap ${
                    applyStrategy === 'replace'
                      ? 'bg-ink text-paper'
                      : 'text-ink/70 hover:text-ink'
                  }`}
                >
                  Start Fresh (Replace All)
                </button>
                <button
                  type="button"
                  onClick={() => setApplyStrategy('append')}
                  className={`px-3 py-1.5 min-h-[40px] text-2xs font-medium rounded transition-colors whitespace-nowrap ${
                    applyStrategy === 'append'
                      ? 'bg-ink text-paper'
                      : 'text-ink/70 hover:text-ink'
                  }`}
                >
                  Add to Existing
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: EXCEL / CSV PARSER */}
          {activeTab === 'excel' && (
            <div className="space-y-4">
              {excelError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/40 rounded-lg text-rose-700 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{excelError}</span>
                </div>
              )}

              {!parsed || previewHoldings.length === 0 ? (
                <>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragActive(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleSpreadsheetFile(file);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                      dragActive
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-slate-700 hover:border-ink/40 bg-mist'
                    }`}
                  >
                    <UploadCloud className="w-9 h-9 text-emerald-700 mx-auto" />
                    <div className="text-sm font-medium text-ink mt-3">
                      Drop your Excel (.xlsx, .xls) or CSV file here
                    </div>
                    <p className="text-xs text-ink/70 mt-1">
                      Supports custom portfolio spreadsheets, CAMS CAS, MF Central, and Bank FD registries.
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.xlsm,.xlsb,.ods,.csv,.tsv,.txt"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleSpreadsheetFile(file);
                        e.target.value = '';
                      }}
                    />
                  </div>

                  {/* Sheet selector if workbook had multiple sheets and current failed */}
                  {sheetNames.length > 1 && fileBuffer && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-ink/70">Select worksheet:</span>
                      {sheetNames.map((sheet) => (
                        <button
                          key={sheet}
                          type="button"
                          onClick={() => processExcelBuffer(fileBuffer, fileName, sheet)}
                          className={`px-2.5 py-1 rounded-md border text-xs font-mono transition-colors ${
                            activeSheet === sheet
                              ? 'bg-emerald-500 border-emerald-500 text-white font-semibold'
                              : 'bg-paper border-slate-700 text-ink/70 hover:border-ink/40'
                          }`}
                        >
                          {sheet}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-slate-700 bg-mist">
                    <div>
                      <div className="text-xs font-semibold text-ink">
                        Need an Excel format to start from?
                      </div>
                      <p className="text-xs text-ink/70 mt-0.5">
                        Download our ready-to-edit <span className="font-mono text-ink/70">.xlsx</span> template with columns for all asset types, update your numbers, and drop it back here.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadPortfolioExcelTemplate()}
                      className="px-4 py-2 text-xs font-semibold text-ink bg-paper hover:bg-ink/5 border border-slate-700 rounded-lg transition-colors flex items-center gap-2 shrink-0 whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-700" />
                      Download Excel Template (.xlsx)
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-mist border border-slate-700">
                    <div>
                      <div className="text-xs font-mono text-emerald-700">{fileName}</div>
                      <div className="text-xs text-ink/70 mt-0.5">
                        Detected: <span className="font-semibold text-ink">{FORMAT_LABELS[parsed.format]}</span>
                        {parsed.sheetName && ` · Sheet "${parsed.sheetName}"`}
                        {' · '}
                        <span className="text-emerald-700 font-semibold">
                          {previewHoldings.length} holdings ready
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setParsed(null);
                        setPreviewHoldings([]);
                        setFileBuffer(null);
                        setFileName('');
                      }}
                      className="text-xs text-ink/70 hover:text-ink underline-offset-2 hover:underline self-start sm:self-center"
                    >
                      Choose another file
                    </button>
                  </div>

                  {/* Multi-sheet switcher */}
                  {sheetNames.length > 1 && fileBuffer && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-ink/70">Worksheet:</span>
                      {sheetNames.map((sheet) => (
                        <button
                          key={sheet}
                          type="button"
                          onClick={() => processExcelBuffer(fileBuffer, fileName, sheet)}
                          className={`px-2.5 py-1 rounded-md border text-xs font-mono transition-colors ${
                            activeSheet === sheet
                              ? 'bg-emerald-500 border-emerald-500 text-white font-semibold'
                              : 'bg-paper border-slate-700 text-ink/70 hover:border-ink/40'
                          }`}
                        >
                          {sheet}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Preview Table */}
                  <div className="border border-slate-700 rounded-xl overflow-hidden">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-mist text-ink/70 font-mono text-2xs border-b border-slate-700 sticky top-0">
                          <tr>
                            <th className="py-2.5 px-3">Instrument</th>
                            <th className="py-2.5 px-3">Category</th>
                            <th className="py-2.5 px-3 text-right">Invested</th>
                            <th className="py-2.5 px-3 text-right">Current Value</th>
                            <th className="py-2.5 px-3 text-center">Remove</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/60">
                          {previewHoldings.map((h) => (
                            <tr key={h.id} className="hover:bg-ink/5">
                              <td className="py-2 px-3">
                                <div className="font-medium text-ink">{h.name}</div>
                                <div className="text-2xs text-ink/70">{h.institution}</div>
                              </td>
                              <td className="py-2 px-3 text-ink/70">
                                {h.category.replace('_', ' ')}
                              </td>
                              <td className="py-2 px-3 text-right font-mono tabular-nums text-ink/70">
                                {formatCurrency(h.investedAmount)}
                              </td>
                              <td className="py-2 px-3 text-right font-mono tabular-nums font-medium text-ink">
                                {formatCurrency(h.currentValue)}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewHoldings((prev) => prev.filter((item) => item.id !== h.id))
                                  }
                                  className="text-ink/70 hover:text-rose-600 p-1 transition-colors"
                                  title="Exclude row"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {parsed.skipped.length > 0 && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs">
                      <div className="font-semibold text-amber-700 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {parsed.skipped.length} row{parsed.skipped.length > 1 ? 's' : ''} skipped
                      </div>
                      <ul className="mt-1.5 space-y-1 text-2xs text-amber-700">
                        {parsed.skipped.slice(0, 4).map((s, idx) => (
                          <li key={idx}>
                            Row {s.row}: {s.reason} ({s.raw})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MANUAL QUICK ENTRY GRID */}
          {activeTab === 'manual' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-ink/70">
                  Add one or more holdings below to validate and stress-test your portfolio immediately.
                </p>
                {currentHoldings.length > 0 && (
                  <button
                    type="button"
                    onClick={handleLoadExistingIntoManual}
                    className="text-xs text-emerald-700 hover:text-emerald-800 font-medium transition-colors"
                  >
                    Load current {currentHoldings.length} holdings to edit
                  </button>
                )}
              </div>

              {manualError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/40 rounded-lg text-rose-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{manualError}</span>
                </div>
              )}

              <div className="space-y-2.5">
                {draftRows.map((row, idx) => (
                  <div
                    key={row.tempId}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-3 rounded-xl border border-slate-700 bg-mist items-end"
                  >
                    <div className="sm:col-span-3">
                      <label className="block text-2xs text-ink/70 mb-1">
                        Instrument #{idx + 1} *
                      </label>
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => handleUpdateDraft(row.tempId, 'name', e.target.value)}
                        placeholder="e.g. Nifty 50 Index or SBI FD"
                        className="w-full bg-paper border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-2xs text-ink/70 mb-1">Category</label>
                      <select
                        value={row.category}
                        onChange={(e) => handleUpdateDraft(row.tempId, 'category', e.target.value)}
                        className="w-full bg-paper border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-ink focus:outline-none focus:border-emerald-500"
                      >
                        {CATEGORY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-2xs text-ink/70 mb-1">Invested *</label>
                      <input
                        type="number"
                        step="any"
                        value={row.investedAmount}
                        onChange={(e) => handleUpdateDraft(row.tempId, 'investedAmount', e.target.value)}
                        placeholder="500000"
                        className="w-full bg-paper border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-ink focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-2xs text-ink/70 mb-1">Current Value *</label>
                      <input
                        type="number"
                        step="any"
                        value={row.currentValue}
                        onChange={(e) => handleUpdateDraft(row.tempId, 'currentValue', e.target.value)}
                        placeholder="565000"
                        className="w-full bg-paper border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-ink focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-2xs text-ink/70 mb-1">Maturity (Opt.)</label>
                      <input
                        type="date"
                        value={row.maturityDate}
                        onChange={(e) => handleUpdateDraft(row.tempId, 'maturityDate', e.target.value)}
                        className="w-full bg-paper border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-ink focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="sm:col-span-1 flex items-center justify-end gap-1">
                      <span className="px-1.5 py-1.5 text-2xs font-mono text-ink/70">INR</span>
                      {draftRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setDraftRows((prev) => prev.filter((item) => item.tempId !== row.tempId))
                          }
                          className="p-1.5 text-ink/70 hover:text-rose-600 transition-colors"
                          title="Remove row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setDraftRows((prev) => [...prev, createEmptyDraft()])}
                  className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-500/10 hover:bg-emerald-500/20 hover:text-emerald-800 border border-emerald-500/30 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Another Row
                </button>

                <div className="text-xs font-mono text-ink/70 tabular-nums">
                  Ready: <span className="text-ink font-semibold">{manualSummary.validCount}</span> rows · Total Value:{' '}
                  <span className="text-emerald-700 font-semibold">
                    {formatCurrency(manualSummary.totalValue)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RESET / START BLANK */}
          {activeTab === 'reset' && (
            <div className="space-y-4 py-2">
              {currentHoldings.length > 0 && (
                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-emerald-700">
                      Save your current progress before resetting ({currentHoldings.length} holdings)
                    </div>
                    <p className="text-2xs text-ink/70 mt-0.5">
                      Download your portfolio as Excel or CSV so you can re-import it later anytime.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => exportHoldingsToExcel(currentHoldings)}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Save .xlsx
                    </button>
                    <button
                      type="button"
                      onClick={() => exportHoldingsToCsv(currentHoldings)}
                      className="px-3 py-1.5 text-xs font-medium text-ink bg-paper hover:bg-ink/5 border border-slate-700 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5 text-sky-700" />
                      Save .csv
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl border border-slate-700 bg-mist flex flex-col justify-between space-y-4">
                <div>
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-700 mb-3">
                    <Eraser className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-ink">Start with Blank Slate (0 Holdings)</h3>
                  <p className="text-xs text-ink/70 mt-1.5 leading-relaxed">
                    Clears all demo holdings from this browser so you can start completely fresh and add holdings one by one.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onStartBlank();
                    onClose();
                  }}
                  className="w-full px-4 py-2 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-700 rounded-lg transition-colors"
                >
                  Clear All & Start Blank
                </button>
              </div>

              <div className="p-5 rounded-xl border border-slate-700 bg-mist flex flex-col justify-between space-y-4">
                <div>
                  <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-700 mb-3">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-ink">Reset Session & Load Demo</h3>
                  <p className="text-xs text-ink/70 mt-1.5 leading-relaxed">
                    Clears your current session on this device and restores the illustrative sample portfolio.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onRestoreDemo();
                    onClose();
                  }}
                  className="w-full px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 border border-transparent rounded-lg transition-colors"
                >
                  Restore Sample Portfolio
                </button>
              </div>
            </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-700 bg-mist flex items-center justify-between gap-3 shrink-0">
          <span className="text-2xs text-ink/70 hidden sm:inline">
            We don&apos;t store your data with us · Processed privately on your device
          </span>

          <div className="flex items-center gap-3 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-ink/70 hover:text-ink transition-colors"
            >
              Cancel
            </button>

            {activeTab === 'excel' && previewHoldings.length > 0 && (
              <button
                type="button"
                onClick={handleApplyExcel}
                className="px-5 py-2 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-2"
              >
                <span>
                  {applyStrategy === 'replace' ? 'Simulate with' : 'Add'} {previewHoldings.length} Holdings
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {activeTab === 'manual' && (
              <button
                type="button"
                onClick={handleApplyManual}
                className="px-5 py-2 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-2"
              >
                <span>
                  {applyStrategy === 'replace' ? 'Restart & Simulate Portfolio' : 'Add Entries'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
