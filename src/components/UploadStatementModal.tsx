import React, { useEffect, useRef, useState } from 'react';
import { Holding } from '../types/wealth';
import {
  importStatement,
  STATEMENT_TEMPLATES,
  StatementFormat,
  ParsedStatement,
} from '../utils/statementImport';
import { trackEvent } from '../utils/analytics';
import { X, FileText, ArrowRight, Sparkles, UploadCloud, Download, AlertTriangle } from 'lucide-react';

interface UploadStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportHoldings: (newHoldings: Holding[]) => void;
}

const FORMAT_LABELS: Record<StatementFormat, string> = {
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

  // Reset stale parse state whenever the modal (re)opens — without this, a
  // previously-previewed statement lingers and can be re-imported by accident.
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
    const isCsvLike =
      /\.(csv|tsv|txt)$/i.test(file.name) || file.type === 'text/csv' || file.type === 'text/plain';
    if (!isCsvLike) {
      setError('Please drop a CSV/TSV export. PDF statements need to be saved as CSV from your bank or MF Central first.');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-xl max-h-[88vh] overflow-y-auto shadow-2xl p-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            <span>Import Statement</span>
          </h3>
          <button
            onClick={() => {
              reset();
              onClose();
            }}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
            aria-label="Close import"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-950/30 border border-rose-500/40 rounded-lg text-rose-300 text-xs flex items-start gap-2">
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
                  ? 'border-indigo-400 bg-indigo-500/10'
                  : 'border-slate-800 hover:border-slate-600 bg-slate-950/40'
              }`}
            >
              <UploadCloud className="w-8 h-8 text-slate-500 mx-auto" />
              <div className="text-xs font-medium text-slate-300 mt-2">
                Drop a CSV statement here, or click to browse
              </div>
              <p className="text-2xs text-slate-500 mt-1">
                Parsed entirely in your browser — the file never leaves your device.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.txt,text/csv,text/plain"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = '';
                }}
              />
            </div>

            <p className="text-2xs text-slate-500 mt-3 leading-relaxed flex items-start gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Works with CAS (CAMS/KFintech), bank deposit registries, and MF Central
                holdings exports — formats are auto-detected from the header row. Monthly CAS
                from your mailbox or the MF Central download both drop straight in.
              </span>
            </p>

            {/* Templates */}
            <div className="mt-4 space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                No statement handy? Try a sample or grab the exact template:
              </label>
              {(Object.keys(STATEMENT_TEMPLATES) as StatementFormat[]).map((format) => (
                <div
                  key={format}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-slate-800 bg-slate-950/40"
                >
                  <div className="min-w-0">
                    <div className="text-2xs font-semibold text-slate-200 truncate">
                      {FORMAT_LABELS[format]}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => downloadTemplate(format)}
                      className="text-2xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                      title="Download CSV template"
                    >
                      <Download className="w-3 h-3" />
                      Template
                    </button>
                    <button
                      onClick={() => loadSampleForFormat(format)}
                      className="text-2xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
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
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
              <div className="text-2xs font-mono text-slate-500">{fileName}</div>
              <div className="text-xs text-slate-200 font-semibold mt-1">
                {FORMAT_LABELS[parsed.format]}
              </div>
              <div className="text-2xs text-slate-400 mt-1">
                {parsed.holdings.length} holding{parsed.holdings.length !== 1 ? 's' : ''} ready to
                import
                {parsed.skipped.length > 0 && ` · ${parsed.skipped.length} row${parsed.skipped.length !== 1 ? 's' : ''} skipped`}
              </div>
            </div>

            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {parsed.holdings.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between gap-3 bg-slate-950/40 border border-slate-800 rounded-lg px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-2xs font-semibold text-slate-200 truncate">{h.name}</div>
                    <div className="text-2xs text-slate-500 truncate">
                      {h.institution}
                      {h.accountNumberMask ? ` · ${h.accountNumberMask}` : ''}
                    </div>
                  </div>
                  <div className="text-2xs text-slate-300 font-mono whitespace-nowrap">
                    ₹{Math.round(h.currentValue).toLocaleString('en-IN')}
                  </div>
                </div>
              ))}
            </div>

            {parsed.skipped.length > 0 && (
              <div className="bg-amber-950/20 border border-amber-500/30 rounded-lg p-3">
                <div className="text-2xs font-semibold text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Skipped rows
                </div>
                <ul className="mt-1.5 space-y-1">
                  {parsed.skipped.slice(0, 5).map((s, i) => (
                    <li key={i} className="text-2xs text-amber-200/80 truncate">
                      Row {s.row}: {s.reason} — <span className="text-amber-200/60">{s.raw}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={reset}
                className="text-xs font-medium text-slate-400 hover:text-white transition-colors"
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
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmImport}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
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
