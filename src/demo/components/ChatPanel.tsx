import { useEffect, useRef, useState } from 'react';
import type { CurrencyCode, Holding } from '../../types/wealth';
import { DEMO_PROFILES } from '../../data/mockData';
import { useDialogA11y } from '../../utils/dialogA11y';
import { sampleHoldingsFor } from '../../utils/portfolioStorage';
import {
  parseFileForChat,
  processLocalChatMessage,
  type ChatActionItem,
  type ChatEngineCallbacks,
  type ChatMetricRow,
} from '../../utils/localChatEngine';
import { VestoraLogo } from '../../components/VestoraLogo';
import { chapterForTab } from '../chatActions';
import { exportPortfolio, type ExportFormat } from '../exports';
import type { Chapter } from '../journeyState';

interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
  /** Assistant lines appended from the app shell (e.g. the empty-list routing note). */
  notes: { id: string; text: string }[];
  holdings: Holding[];
  baseCurrency: CurrencyCode;
  /** Every change to the visitor's investments goes through here. */
  onEdit: (fn: (h: Holding[]) => Holding[]) => void;
  onSetBaseCurrency: (c: CurrencyCode) => void;
  onGoChapter: (c: Chapter) => void;
  onRebalanceHolding: (id: string) => void;
  onOpenForm: (req: { mode: 'add'; draft?: Holding } | { mode: 'edit'; holding: Holding }) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  title?: string;
  text: string;
  metrics?: ChatMetricRow[];
  actions?: ChatActionItem[];
}

const EXPORT_LABEL: Record<ExportFormat, string> = {
  xlsx: 'Excel',
  csv: 'CSV',
  pdf: 'PDF',
  json: 'Vestora file',
};

/** Tone is a coloured edge, so the numbers themselves stay high-contrast ink. */
const TONE_EDGE: Record<NonNullable<ChatMetricRow['tone']>, string> = {
  emerald: 'border-l-level',
  amber: 'border-l-tilt',
  rose: 'border-l-risk',
  neutral: 'border-l-ink/30',
};

const ACTION_CLASS: Record<NonNullable<ChatActionItem['variant']>, string> = {
  primary: 'rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-paper hover:bg-ink/90',
  secondary: 'rounded-full border border-ink/30 px-3 py-1.5 text-xs font-semibold hover:border-ink',
  danger: 'rounded-full bg-risk px-3 py-1.5 text-xs font-semibold text-paper hover:bg-risk/90',
};

const quietButton = 'rounded-full border border-ink/30 px-4 py-2 text-sm font-semibold hover:border-ink';

function messageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function ChatPanel({
  open,
  onClose,
  notes,
  holdings,
  baseCurrency,
  onEdit,
  onSetBaseCurrency,
  onGoChapter,
  onRebalanceHolding,
  onOpenForm,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  // Focus returns to the launcher (the only way in) when the panel closes.
  useEffect(() => {
    launcherRef.current = document.querySelector<HTMLButtonElement>('.demo-chat-launcher');
  }, []);

  // Focus trap + Escape + focus restore, shared with the app drawer. Escape
  // ownership lives here; the message-box focus and auto-scroll below are the
  // demo panel's own behaviour on top of it.
  useDialogA11y({
    open,
    dialogRef: panelRef,
    restoreFocusRef: launcherRef,
    initialFocusRef: inputRef,
    onEscape: onClose,
  });

  // On open, and after each reply, the newest message is on screen (the trap hook owns focus on open).
  // With no messages yet (notes-only, e.g. the empty-list routing note) the feed is scrolled to the TOP
  // so the note itself is visible instead of a blank bottom margin.
  useEffect(() => {
    if (!open) return;
    if (messages.length === 0) {
      topRef.current?.scrollIntoView({ block: 'start' });
      return;
    }
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [open, messages.length, notes.length]);

  if (!open) return null;

  const append = (message: Omit<ChatMessage, 'id' | 'sender'>) =>
    setMessages((prev) => [...prev, { id: messageId('ast'), sender: 'assistant' as const, ...message }]);

  /** Makes a download; the heavy writers load on demand and can fail, so their promise is always caught. */
  const runExport = (format: ExportFormat) => {
    const fail = () =>
      append({ title: 'Download failed', text: `Could not make the ${EXPORT_LABEL[format]} file. Please try again.` });
    try {
      const result = exportPortfolio(format, holdings, baseCurrency);
      if (result) result.catch(fail);
    } catch {
      fail();
    }
  };

  const callbacks: ChatEngineCallbacks = {
    onAddHolding: (holding) => onEdit((hs) => [...hs, holding]),
    onUpdateHolding: (holding) => onEdit((hs) => hs.map((h) => (h.id === holding.id ? holding : h))),
    onReplaceHoldings: (next, detectedCurrency) => {
      onEdit(() => next);
      if (detectedCurrency) onSetBaseCurrency(detectedCurrency);
    },
    onAppendHoldings: (next) => onEdit((hs) => [...hs, ...next]),
    onDeleteHolding: (id) => onEdit((hs) => hs.filter((h) => h.id !== id)),
    onSetBaseCurrency,
    onNavigateToTab: (tab) => {
      const chapter = chapterForTab(tab);
      if (chapter) {
        onClose();
        onGoChapter(chapter);
      } else {
        append({ text: `That view is in the full app at /#${tab}.` });
      }
    },
    onExportExcel: () => runExport('xlsx'),
    onExportCsv: () => runExport('csv'),
    onExportPdf: () => runExport('pdf'),
    onExportJson: () => runExport('json'),
  };

  const send = (override?: string) => {
    const text = (override ?? input).trim();
    if (!text) return;
    if (!override) setInput('');
    setMessages((prev) => [...prev, { id: messageId('usr'), sender: 'user' as const, text }]);
    append(
      processLocalChatMessage(text, { holdings, baseCurrency, portfolioMode: 'personal', profileName: 'You' }, callbacks)
    );
  };

  const handleFile = async (file: File) => {
    setMessages((prev) => [
      ...prev,
      { id: messageId('usr'), sender: 'user' as const, text: `Attached file: ${file.name}` },
    ]);
    try {
      append(await parseFileForChat(file, baseCurrency));
    } catch (err) {
      append({
        title: `Could not read ${file.name}`,
        text: err instanceof Error ? err.message : 'This file could not be read on this device.',
      });
    }
  };

  const runAction = (item: ChatActionItem) => {
    const action = item.action;
    switch (action.type) {
      case 'SUGGEST_PROMPT':
        send(action.prompt);
        return;
      case 'UNDO_HOLDINGS':
        callbacks.onReplaceHoldings(action.snapshot);
        append({
          title: 'Undone',
          text: action.label ?? `Restored the previous list (${action.snapshot.length} holdings).`,
        });
        return;
      case 'APPLY_IMPORT':
        if (action.mode === 'replace') {
          callbacks.onReplaceHoldings(action.holdings, action.currency);
          append({
            title: `Loaded ${action.fileName}`,
            text: `${action.holdings.length} holdings from ${action.fileName} replaced your list.`,
          });
        } else {
          callbacks.onAppendHoldings(action.holdings);
          append({
            title: `Added ${action.holdings.length} holdings`,
            text: `Merged holdings from ${action.fileName} into your list.`,
          });
        }
        return;
      case 'EXPORT':
        runExport(action.format);
        append({ title: `${EXPORT_LABEL[action.format]} file downloading`, text: 'Saved with your other downloads.' });
        return;
      case 'NAVIGATE':
        callbacks.onNavigateToTab(action.tab);
        return;
      case 'SET_CURRENCY':
        onSetBaseCurrency(action.currency);
        return;
      case 'START_BLANK':
        onEdit(() => []);
        append({
          title: 'List cleared',
          text: 'All holdings are gone from this screen. Add an investment to start again.',
        });
        return;
      case 'RESET_SAMPLE':
        onEdit(() => sampleHoldingsFor(DEMO_PROFILES[0]));
        append({ title: 'Sample portfolio loaded', text: 'Restored the built-in sample holdings.' });
        return;
      case 'REBALANCE_HOLDING': {
        if (!holdings.some((h) => h.id === action.holdingId)) {
          append({ title: 'That holding is gone', text: 'It is no longer in your list, so there is nothing to move.' });
          return;
        }
        onClose();
        onRebalanceHolding(action.holdingId);
        return;
      }
      case 'OPEN_EDIT_MODAL':
        onClose();
        onOpenForm({ mode: 'edit', holding: action.holding });
        return;
      case 'OPEN_ADD_MODAL':
        onClose();
        onOpenForm({ mode: 'add', draft: action.draft });
        return;
      case 'CONFIRM_ADD_HOLDING': {
        const snapshot = [...holdings];
        const saved: Holding = { ...action.holding, id: `h-chat-${Date.now()}` };
        callbacks.onAddHolding(saved);
        append({
          title: `Added ${saved.name}`,
          text: 'Saved to your list on this device.',
          actions: [
            { label: 'Show in Your numbers', variant: 'primary', action: { type: 'NAVIGATE', tab: 'overview' } },
            { label: 'Edit details', variant: 'secondary', action: { type: 'OPEN_EDIT_MODAL', holding: saved } },
            {
              label: 'Undo',
              variant: 'secondary',
              action: { type: 'UNDO_HOLDINGS', snapshot, label: `Removed ${saved.name} again.` },
            },
          ],
        });
        return;
      }
      case 'CONFIRM_UPDATE_HOLDING':
        callbacks.onUpdateHolding(action.updated);
        append({
          title: `Updated ${action.updated.name}`,
          text: action.summary,
          actions: [
            { label: 'Show in Your numbers', variant: 'primary', action: { type: 'NAVIGATE', tab: 'overview' } },
            { label: 'Edit details', variant: 'secondary', action: { type: 'OPEN_EDIT_MODAL', holding: action.updated } },
            {
              label: 'Undo',
              variant: 'secondary',
              action: {
                type: 'UNDO_HOLDINGS',
                snapshot: action.snapshot,
                label: `Reverted the change to ${action.updated.name}.`,
              },
            },
          ],
        });
        return;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-ink/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Portfolio chat"
        className="relative flex h-full w-full max-w-[420px] flex-col border-l border-ink/15 bg-paper shadow-2xl"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
      >
        <header className="flex items-start justify-between gap-3 border-b border-ink/10 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <VestoraLogo size={24} />
            <div className="min-w-0">
              <h2 className="m-0 font-display text-lg font-semibold leading-tight">Portfolio chat</h2>
              <p className="m-0 text-xs text-ink/70">Runs on your device. Nothing is sent anywhere.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className={quietButton}>
            Close
          </button>
        </header>

        {dragOver && (
          <div className="pointer-events-none absolute inset-3 z-10 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-ink bg-paper/90 p-6 text-center">
            <p className="m-0 font-semibold">Drop the file to read it here</p>
            <p className="m-0 mt-1 text-sm text-ink/70">Excel, CSV or a Vestora file — nothing is uploaded.</p>
          </div>
        )}

        <div aria-live="polite" className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          <div ref={topRef} />
          {notes.map((n) => (
            <div key={n.id} className="flex justify-start">
              <div className="max-w-[92%] rounded-xl border border-ink/15 bg-mist px-3 py-2 text-sm leading-relaxed">
                <p className="m-0 whitespace-pre-line">{n.text}</p>
              </div>
            </div>
          ))}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[92%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                  m.sender === 'user' ? 'bg-ink text-paper' : 'border border-ink/15 bg-mist'
                }`}
              >
                {m.title && <p className="m-0 mb-1 font-semibold">{m.title}</p>}
                <p className="m-0 whitespace-pre-line">{m.text}</p>
                {m.metrics && m.metrics.length > 0 && (
                  <ul className="m-0 mt-2 grid list-none gap-1.5 p-0">
                    {m.metrics.map((row) => (
                      <li
                        key={row.label}
                        className={`rounded-lg border border-ink/15 border-l-4 bg-paper px-2 py-1.5 ${TONE_EDGE[row.tone ?? 'neutral']}`}
                      >
                        <span className="block break-words text-xs text-ink/70">{row.label}</span>
                        <span className="num block break-words text-sm font-bold">{row.value}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {m.actions && m.actions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.actions.map((item, i) => (
                      <button
                        key={`${m.id}-${i}`}
                        type="button"
                        onClick={() => runAction(item)}
                        className={ACTION_CLASS[item.variant ?? 'secondary']}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <form
          className="flex items-end gap-2 border-t border-ink/10 px-3 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.xlsm,.xlsb,.ods,.csv,.tsv,.json"
            hidden
            tabIndex={-1}
            aria-label="Choose a spreadsheet or JSON file to import"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void handleFile(file);
            }}
          />
          <button type="button" onClick={() => fileRef.current?.click()} className={quietButton}>
            Add a file
          </button>
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={'Try "Add HDFC FD 5L at 7.4%" or "Portfolio summary"'}
            aria-label="Message about your portfolio"
            className="max-h-28 min-h-10 flex-1 resize-none rounded-lg border border-ink/30 bg-paper px-3 py-2 text-sm leading-snug"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="h-10 shrink-0 rounded-full bg-ink px-4 text-sm font-semibold text-paper hover:bg-ink/90 disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </aside>
    </div>
  );
}
