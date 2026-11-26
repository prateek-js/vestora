import React, { useEffect, useRef, useState } from 'react';
import { Holding } from '../types/wealth';
import {
  ChatActionItem,
  ChatActionKind,
  ChatMetricRow,
  parseFileForChat,
  processLocalChatMessage,
} from '../utils/localChatEngine';
import { useDialogA11y } from '../utils/dialogA11y';
import {
  MessageSquareText,
  Paperclip,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { VestoraLogo } from './VestoraLogo';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  title?: string;
  text: string;
  metrics?: ChatMetricRow[];
  actions?: ChatActionItem[];
  timestamp: string;
}

interface PortfolioChatDrawerProps {
  holdings: Holding[];
  portfolioMode: 'demo' | 'personal';
  profileName: string;
  onAddHolding: (holding: Holding) => void;
  onUpdateHolding: (holding: Holding) => void;
  onDeleteHolding: (id: string) => void;
  onReplaceHoldings: (holdings: Holding[]) => void;
  onAppendHoldings: (holdings: Holding[]) => void;
  onNavigateToTab: (tab: 'overview' | 'rebalance' | 'radar' | 'tax' | 'simulator') => void;
  onStartBlank: () => void;
  onResetToSample: () => void;
  onExportExcel: () => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
  onExportJson: () => void;
  onRebalanceHoldingById: (holdingId: string) => void;
  onOpenEditModal: (holding: Holding) => void;
  onOpenAddModal: (draft?: Holding) => void;
}

interface QuickChip {
  label: string;
  kind: 'prompt' | 'add_form' | 'import_file';
  prompt?: string;
}

const QUICK_CHIPS: QuickChip[] = [
  { label: '+ Add Form', kind: 'add_form' },
  { label: 'Edit Holding', kind: 'prompt', prompt: 'Edit holding' },
  { label: 'Summary', kind: 'prompt', prompt: 'Portfolio summary' },
  { label: '5Y Stress', kind: 'prompt', prompt: 'Simulate 8% inflation and -15% crash over 5 years' },
  { label: 'Import File', kind: 'import_file' },
  { label: 'Export', kind: 'prompt', prompt: 'Export' },
];

function nowTimeLabel(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const WELCOME_MESSAGE = (): ChatMessage => ({
  id: 'welcome-msg',
  sender: 'assistant',
  title: 'Private Portfolio Chat',
  text: 'Use the guided chips above or type naturally (e.g., "Add 8 lakh to HDFC bank account ending with 1093")—all entries preview for 1-click confirmation and stay 100% on your device.',
  actions: [
    { label: '+ Add via Form', variant: 'primary', action: { type: 'OPEN_ADD_MODAL' } },
    { label: 'Portfolio Summary', variant: 'secondary', action: { type: 'SUGGEST_PROMPT', prompt: 'Portfolio summary' } },
    { label: 'Simulate 5Y Stress', variant: 'secondary', action: { type: 'SUGGEST_PROMPT', prompt: 'Simulate 8% inflation and -15% crash over 5 years' } },
  ],
  timestamp: nowTimeLabel(),
});

export const PortfolioChatDrawer: React.FC<PortfolioChatDrawerProps> = ({
  holdings,
  portfolioMode,
  profileName,
  onAddHolding,
  onUpdateHolding,
  onDeleteHolding,
  onReplaceHoldings,
  onAppendHoldings,
  onNavigateToTab,
  onStartBlank,
  onResetToSample,
  onExportExcel,
  onExportCsv,
  onExportPdf,
  onExportJson,
  onRebalanceHoldingById,
  onOpenEditModal,
  onOpenAddModal,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(() => [WELCOME_MESSAGE()]);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  // Focus trap + aria-modal + focus restore to the launcher, shared with the demo panel.
  useDialogA11y({
    open: isOpen,
    dialogRef: drawerRef,
    restoreFocusRef: launcherRef,
    initialFocusRef: inputRef,
    onEscape: () => setIsOpen(false),
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages.length]);

  const closeDrawer = () => setIsOpen(false);

  const appendAssistantMessage = (payload: Omit<ChatMessage, 'id' | 'sender' | 'timestamp'>) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `ast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: 'assistant',
        ...payload,
        timestamp: nowTimeLabel(),
      },
    ]);
  };

  const handleSendText = (overrideText?: string) => {
    const trimmed = (overrideText ?? input).trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: trimmed,
      timestamp: nowTimeLabel(),
    };
    setMessages((prev) => [...prev, userMsg]);
    if (!overrideText) setInput('');

    const reply = processLocalChatMessage(
      trimmed,
      { holdings, portfolioMode, profileName },
      {
        onAddHolding,
        onUpdateHolding,
        onReplaceHoldings,
        onAppendHoldings,
        onDeleteHolding,
        onNavigateToTab,
        onExportExcel,
        onExportCsv,
        onExportPdf,
        onExportJson,
      }
    );

    appendAssistantMessage(reply);
  };

  const handleFileImport = async (file: File) => {
    const userMsg: ChatMessage = {
      id: `usr-file-${Date.now()}`,
      sender: 'user',
      text: `Attached file: ${file.name}`,
      timestamp: nowTimeLabel(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const reply = await parseFileForChat(file);
      appendAssistantMessage(reply);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not parse this file locally.';
      appendAssistantMessage({
        title: `Could not read ${file.name}`,
        text: msg,
      });
    }
  };

  const handleActionClick = (action: ChatActionKind) => {
    switch (action.type) {
      case 'SUGGEST_PROMPT':
        handleSendText(action.prompt);
        return;
      case 'UNDO_HOLDINGS':
        onReplaceHoldings(action.snapshot);
        appendAssistantMessage({
          title: 'Action Undone',
          text: action.label ?? `Restored previous portfolio state (${action.snapshot.length} holdings).`,
        });
        return;
      case 'APPLY_IMPORT':
        if (action.mode === 'replace') {
          onReplaceHoldings(action.holdings);
          appendAssistantMessage({
            title: `Replaced Portfolio from ${action.fileName}`,
            text: `Loaded ${action.holdings.length} holdings into your private device ledger.`,
            actions: [{ label: 'Open Overview', variant: 'primary', action: { type: 'NAVIGATE', tab: 'overview' } }],
          });
        } else {
          onAppendHoldings(action.holdings);
          appendAssistantMessage({
            title: `Appended ${action.holdings.length} Holdings`,
            text: `Merged holdings from ${action.fileName} into your active portfolio.`,
            actions: [{ label: 'Open Overview', variant: 'primary', action: { type: 'NAVIGATE', tab: 'overview' } }],
          });
        }
        return;
      case 'EXPORT':
        if (action.format === 'xlsx') onExportExcel();
        else if (action.format === 'csv') onExportCsv();
        else if (action.format === 'pdf') onExportPdf();
        else onExportJson();
        appendAssistantMessage({
          title: `Exported ${action.format.toUpperCase()}`,
          text: `Generated and downloaded your ${holdings.length}-holding ${action.format.toUpperCase()} file locally.`,
        });
        return;
      case 'NAVIGATE':
        onNavigateToTab(action.tab);
        return;
      case 'START_BLANK':
        onStartBlank();
        appendAssistantMessage({
          title: 'Started Blank Portfolio',
          text: 'Cleared all holdings locally. Drop a file or type "Add HDFC FD 5L at 7.4%" to begin.',
        });
        return;
      case 'RESET_SAMPLE':
        onResetToSample();
        appendAssistantMessage({
          title: 'Sample Portfolio Loaded',
          text: 'Restored the built-in multi-asset sample profile.',
        });
        return;
      case 'REBALANCE_HOLDING':
        onRebalanceHoldingById(action.holdingId);
        return;
      case 'OPEN_EDIT_MODAL':
        setIsOpen(false);
        onOpenEditModal(action.holding);
        return;
      case 'OPEN_ADD_MODAL':
        setIsOpen(false);
        onOpenAddModal(action.draft);
        return;
      case 'CONFIRM_ADD_HOLDING': {
        const snapshot = [...holdings];
        const holdingToSave: Holding = {
          ...action.holding,
          id: `h-chat-${Date.now()}`,
        };
        onAddHolding(holdingToSave);
        appendAssistantMessage({
          title: `Saved ${holdingToSave.name}`,
          text: `Added to your local portfolio${holdingToSave.accountNumberMask && !holdingToSave.accountNumberMask.startsWith('CHT-') ? ` (${holdingToSave.accountNumberMask})` : ''}.`,
          actions: [
            { label: 'View in Overview', variant: 'primary', action: { type: 'NAVIGATE', tab: 'overview' } },
            { label: 'Edit Details', variant: 'secondary', action: { type: 'OPEN_EDIT_MODAL', holding: holdingToSave } },
            {
              label: 'Undo Entry',
              variant: 'secondary',
              action: { type: 'UNDO_HOLDINGS', snapshot, label: `Reverted adding ${holdingToSave.name}` },
            },
          ],
        });
        return;
      }
      case 'CONFIRM_UPDATE_HOLDING':
        onUpdateHolding(action.updated);
        appendAssistantMessage({
          title: `Updated ${action.updated.name}`,
          text: action.summary,
          actions: [
            { label: 'View in Overview', variant: 'primary', action: { type: 'NAVIGATE', tab: 'overview' } },
            { label: 'Edit Details', variant: 'secondary', action: { type: 'OPEN_EDIT_MODAL', holding: action.updated } },
            {
              label: 'Undo Change',
              variant: 'secondary',
              action: { type: 'UNDO_HOLDINGS', snapshot: action.snapshot, label: `Reverted change to ${action.updated.name}` },
            },
          ],
        });
        return;
    }
  };

  return (
    <>
      {/* Floating Compact Launcher Button — stays mounted while the drawer is open so focus can return here */}
      <button
        type="button"
        ref={launcherRef}
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label="Open on-device portfolio chat"
        className={`fixed bottom-5 right-5 z-40 h-11 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-700 text-white font-semibold text-xs shadow-lg shadow-ink/10 border border-emerald-600/60 inline-flex items-center gap-2 transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${isOpen ? 'pointer-events-none opacity-0' : ''}`}
      >
        <MessageSquareText className="w-4 h-4 shrink-0" />
        <span className="whitespace-nowrap">Portfolio Chat</span>
        <span className="hidden sm:inline text-2xs font-mono opacity-75">Ctrl+/</span>
      </button>

      {/* Slide-Over Chat Drawer */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDrawer();
          }}
        >
          <aside
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="On-device Portfolio Chat Assistant"
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingFile(true);
            }}
            onDragLeave={() => setIsDraggingFile(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingFile(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFileImport(file);
            }}
            className="relative w-full max-w-md h-full bg-paper border-l border-slate-700 shadow-ink/10 shadow-2xl flex flex-col"
          >
            {/* Drag-and-drop overlay */}
            {isDraggingFile && (
              <div className="absolute inset-0 z-20 bg-paper/90 border-2 border-dashed border-emerald-500 m-3 rounded-xl flex flex-col items-center justify-center text-center p-6 pointer-events-none">
                <Upload className="w-8 h-8 text-emerald-700 mb-2" />
                <p className="text-sm font-bold text-ink">Drop File to Parse Locally</p>
                <p className="text-xs text-ink/70 mt-1">
                  Supports .xlsx, .xls, .csv, .tsv, and .json backups
                </p>
              </div>
            )}

            {/* Drawer Header */}
            <div className="px-4 py-3.5 border-b border-slate-700 bg-mist flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <VestoraLogo size={28} />
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-ink truncate">Portfolio Assistant</h2>
                  <p className="text-2xs text-emerald-700 flex items-center gap-1 truncate">
                    <ShieldCheck className="w-3 h-3 shrink-0" />
                    <span>On-device · Zero external API calls</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setMessages([WELCOME_MESSAGE()])}
                  title="Clear chat history"
                  aria-label="Clear chat history"
                  className="p-2 text-ink/70 hover:text-ink rounded-lg hover:bg-ink/5 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={closeDrawer}
                  aria-label="Close chat assistant"
                  className="p-2 text-ink/70 hover:text-ink rounded-lg hover:bg-ink/5 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Guided Action Chips Strip */}
            <div className="px-4 py-2 border-b border-slate-700/80 bg-mist/60 flex items-center gap-1.5 overflow-x-auto shrink-0">
              {QUICK_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => {
                    if (chip.kind === 'add_form') {
                      setIsOpen(false);
                      onOpenAddModal();
                    } else if (chip.kind === 'import_file') {
                      fileInputRef.current?.click();
                    } else if (chip.prompt) {
                      handleSendText(chip.prompt);
                    }
                  }}
                  className={`px-2.5 py-1.5 min-h-[32px] text-2xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors ${
                    chip.kind === 'add_form'
                      ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/40 hover:bg-emerald-700 hover:text-white'
                      : 'text-ink/70 bg-paper border border-slate-700 hover:text-emerald-800 hover:border-emerald-500/40'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Message Feed */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[92%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-ink text-paper font-medium'
                        : 'bg-mist border border-slate-700 text-ink'
                    }`}
                  >
                    {msg.title && (
                      <div className="font-bold text-ink mb-1">{msg.title}</div>
                    )}
                    <div className="whitespace-pre-line">{msg.text}</div>

                    {msg.metrics && msg.metrics.length > 0 && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-700/80 grid grid-cols-2 gap-2 font-mono tabular-nums">
                        {msg.metrics.map((m) => (
                          <div key={m.label} className="bg-paper border border-slate-700 rounded-lg px-2.5 py-1.5">
                            <span className="text-2xs text-ink/70 block">{m.label}</span>
                            <span
                              className={`text-xs font-bold ${
                                m.tone === 'emerald'
                                  ? 'text-emerald-700'
                                  : m.tone === 'amber'
                                  ? 'text-amber-700'
                                  : m.tone === 'rose'
                                  ? 'text-rose-600'
                                  : 'text-ink'
                              }`}
                            >
                              {m.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {msg.actions && msg.actions.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-slate-700/80 flex flex-wrap gap-1.5">
                        {msg.actions.map((item, idx) => (
                          <button
                            key={`${msg.id}-act-${idx}`}
                            type="button"
                            onClick={() => handleActionClick(item.action)}
                            className={`px-2.5 py-1.5 min-h-[32px] text-2xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                              item.variant === 'primary'
                                ? 'bg-emerald-500 hover:bg-emerald-700 text-white'
                                : item.variant === 'danger'
                                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                : 'bg-paper hover:bg-ink/5 text-ink border border-slate-700'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-2xs text-ink/70 mt-1 px-1 font-mono">{msg.timestamp}</span>
                </div>
              ))}
              <div ref={scrollEndRef} />
            </div>

            {/* Composer Bar */}
            <div className="p-3 border-t border-slate-700 bg-mist shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.xlsm,.xlsb,.ods,.csv,.tsv,.json,application/json"
                className="hidden"
                tabIndex={-1}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) handleFileImport(file);
                }}
              />
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendText();
                }}
                className="flex items-end gap-2"
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach .xlsx, .csv, or .json to import locally"
                  aria-label="Attach spreadsheet or JSON file"
                  className="h-10 w-10 shrink-0 rounded-lg bg-paper hover:bg-ink/5 border border-slate-700 text-ink/70 hover:text-emerald-700 flex items-center justify-center transition-colors"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendText();
                    }
                  }}
                  placeholder='Add or edit holding, "Simulate 8% inflation", or drop Excel/CSV...'
                  className="flex-1 min-h-10 max-h-28 resize-none bg-paper border border-slate-700 focus:border-emerald-500 rounded-lg px-3 py-2.5 text-xs text-ink placeholder-ink/60 focus:outline-none leading-snug"
                />

                <button
                  type="submit"
                  disabled={!input.trim()}
                  aria-label="Send message"
                  className="h-10 w-10 shrink-0 rounded-lg bg-emerald-500 hover:bg-emerald-700 disabled:opacity-45 text-white flex items-center justify-center transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </aside>
        </div>
      )}
    </>
  );
};
