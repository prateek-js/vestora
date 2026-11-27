import React, { useEffect, useRef, useState } from 'react';
import { Holding } from '../types/wealth';
import {
  downloadPortfolioExcelTemplate,
  importExcelBuffer,
  importStatement,
  STATEMENT_TEMPLATES,
  StatementFormat,
  ParsedStatement,
} from '../utils/statementImport';
import { trackEvent } from '../utils/analytics';
import { X, FileText, ArrowRight, ShieldCheck, UploadCloud, Download, AlertTriangle } from 'lucide-react';

interface UploadStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportHoldings: (newHoldings: Holding[]) => void;
}

const FORMAT_LABELS: Record<StatementFormat, string> = {
  PORTFOLIO_SHEET: 'Portfolio Spreadsheet (.xlsx / .csv)',
  CAS: 'CAMS / KFintech Consolidated Account Statement',
  FD_REGISTRY: 'Bank FD / RD deposit registry',
  MF_CENTRAL: 'MF Central consolidated holdings export',
};

function downloadTemplate(format: StatementFormat): void {
  const template = STATEMENT_TEMPLATES[format];
  const blob = new Blob([template.csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vestora-${format.toLowerCase()}-template.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export const UploadStatementModal: React.FC<UploadStatementModalProps> = ({
  isOpen,
  onClose,
  onImportHoldings,
}) => {
  const [parsed, setParsed] = useState<ParsedStatement | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setParsed(null);
      setFileName('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const reset = () => {
    setParsed(null);
    setFileName('');
    setError('');
  };

  const ingestText = (text: string, name: string) => {
    setError('');
    try {
      const result = importStatement(text);
      if (result.holdings.length === 0 && result.skipped.length === 0) {
        setError('Statement parsed but no data rows matched the expected columns.');
        setParsed(null);
        return;
      }
      setParsed(result);
      setFileName(name);
    } catch (e) {
      setParsed(null);
      setFileName(name);
      setError(e instanceof Error ? e.message : 'Could not parse this file.');
    }
  };

  const handleFile = (file: File) => {
    const isExcel = /\.(xlsx|xls|xlsm|xlsb|ods)$/i.test(file.name);
    const isCsvLike =
      /\.(csv|tsv|txt)$/i.test(file.name) || file.type === 'text/csv' || file.type === 'text/plain';
    if (!isExcel && !isCsvLike) {
      setError('Please drop an Excel (.xlsx, .xls) or CSV/TSV file.');
      return;
    }

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          try {
            const workbookResult = importExcelBuffer(reader.result);
            if (workbookResult.parsed.holdings.length === 0) {
              setError('Excel workbook parsed, but no valid holding rows matched.');
              setParsed(null);
              return;
            }
            setParsed(workbookResult.parsed);
            setFileName(file.name);
            setError('');
          } catch (e) {
            setParsed(null);
            setFileName(file.name);
            setError(e instanceof Error ? e.message : 'Could not parse Excel file.');
          }
        }
      };
      reader.onerror = () => setError('Could not read that Excel file.');
      reader.readAsArrayBuffer(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => ingestText(String(reader.result ?? ''), file.name);
    reader.onerror = () => setError('Could not read that file.');
    reader.readAsText(file);
  };

  const confirmImport = () => {
    if (!parsed || parsed.holdings.length === 0) return;
    onImportHoldings(parsed.holdings);
    trackEvent('statement_imported', {
      format: parsed.format,
      imported: parsed.holdings.length,
      skipped: parsed.skipped.length,
      file_name: fileName || 'pasted',
    });
    onClose();
  };

  const loadSampleForFormat = (format: StatementFormat) => {
    ingestText(STATEMENT_TEMPLATES[format].csv, `${format.toLowerCase()}-sample.csv`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-xs">
      <div className="bg-paper border border-slate-700 rounded-xl w-full max-w-xl max-h-[88vh] overflow-y-auto shadow-ink/10 shadow-2xl p-6">
        <div className="flex items-center justify-between border-b border-slate-700 pb-4">
          <h3 className="text-base font-bold text-ink flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-700" />
            <span>Import Excel or CSV Statement</span>
          </h3>
          <button
            onClick={() => {
              reset();
              onClose();
            }}
            className="text-ink/70 hover:text-ink p-1 rounded-lg transition-colors"
            aria-label="Close import"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2.5 text-xs text-emerald-700">
          <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <span>
            We don&apos;t store your data with us. Your file is read privately on your device and never sent to any server.
          </span>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/40 rounded-lg text-rose-700 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!parsed && (
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
                if (file) handleFile(file);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`mt-4 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                dragActive
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-slate-700 hover:border-ink/40 bg-mist'
              }`}
            >
              <UploadCloud className="w-8 h-8 text-ink/70 mx-auto" />
              <div className="text-xs font-medium text-ink mt-2">
                Drop an Excel (.xlsx, .xls) or CSV statement here, or click to browse
              </div>
              <p className="text-2xs text-ink/70 mt-1">
                Parsed entirely in your browser — the file never leaves your device.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.xlsm,.xlsb,.ods,.csv,.tsv,.txt,text/csv,text/plain"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = '';
                }}
              />
            </div>

            {/* Excel & CSV Templates */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-ink">
                  Templates & sample statements
                </label>
                <button
                  type="button"
                  onClick={() => downloadPortfolioExcelTemplate()}
                  className="text-2xs font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  Download Excel Template (.xlsx)
                </button>
              </div>
              {(Object.keys(STATEMENT_TEMPLATES) as StatementFormat[]).map((format) => (
                <div
                  key={format}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-slate-700 bg-mist"
                >
                  <div className="min-w-0">
                    <div className="text-2xs font-semibold text-ink truncate">
                      {FORMAT_LABELS[format]}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => downloadTemplate(format)}
                      className="text-2xs text-ink/70 hover:text-ink flex items-center gap-1 transition-colors"
                      title="Download CSV template"
                    >
                      <Download className="w-3 h-3" />
                      CSV
                    </button>
                    <button
                      onClick={() => loadSampleForFormat(format)}
                      className="text-2xs text-emerald-700 hover:text-emerald-800 flex items-center gap-1 transition-colors"
                      title="Load sample rows now"
                    >
                      Sample
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {parsed && (
          <div className="mt-4 space-y-4">
            <div className="bg-mist border border-slate-700 rounded-lg p-3">
              <div className="text-2xs font-mono text-ink/70">{fileName}</div>
              <div className="text-xs text-ink font-semibold mt-1">
                {FORMAT_LABELS[parsed.format]}
              </div>
              <div className="text-2xs text-ink/70 mt-1">
                {parsed.holdings.length} holding{parsed.holdings.length !== 1 ? 's' : ''} ready to
                import
                {parsed.skipped.length > 0 && ` · ${parsed.skipped.length} row${parsed.skipped.length !== 1 ? 's' : ''} skipped`}
              </div>
            </div>

            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {parsed.holdings.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between gap-3 bg-paper border border-slate-700 rounded-lg px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-2xs font-semibold text-ink truncate">{h.name}</div>
                    <div className="text-2xs text-ink/70 truncate">
                      {h.institution}
                      {h.accountNumberMask ? ` · ${h.accountNumberMask}` : ''}
                    </div>
                  </div>
                  <div className="text-2xs text-ink/70 font-mono whitespace-nowrap">
                    {Math.round(h.currentValue).toLocaleString()} {h.currency}
                  </div>
                </div>
              ))}
            </div>

            {parsed.skipped.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <div className="text-2xs font-semibold text-amber-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Skipped rows
                </div>
                <ul className="mt-1.5 space-y-1">
                  {parsed.skipped.slice(0, 5).map((s, i) => (
                    <li key={i} className="text-2xs text-amber-700 truncate">
                      Row {s.row}: {s.reason} — <span className="text-amber-700">{s.raw}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-3 border-t border-slate-700 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={reset}
                className="text-xs font-medium text-ink/70 hover:text-ink transition-colors"
              >
                Choose another file
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    reset();
                    onClose();
                  }}
                  className="px-4 py-2 text-xs font-medium text-ink/70 hover:text-ink transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmImport}
                  className="px-5 py-2 text-xs font-semibold text-paper bg-ink hover:bg-ink/90 rounded-lg transition-colors flex items-center gap-2 shadow-sm shadow-ink/10"
                >
                  <span>Import {parsed.holdings.length} Holdings</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
