import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Check, Copy, Mail, Send, X } from 'lucide-react';
import { trackEvent } from '../utils/analytics';

export const MAKER_EMAIL = 'prateekdesai1990@gmail.com';
export const MAKER_NAME = 'Prateek Desai';

export type ContactTopicId = 'question' | 'feature' | 'bug' | 'hello';

interface TopicOption {
  id: ContactTopicId;
  label: string;
  shortLabel: string;
  subject: string;
  placeholder: string;
  hint: string;
}

const TOPICS: TopicOption[] = [
  {
    id: 'question',
    label: 'Portfolio question',
    shortLabel: 'Portfolio question',
    subject: '[Vestora] Portfolio or rebalance question',
    hint: 'Ask about an FD, home loan, or mutual fund edge case',
    placeholder: 'Example: How should I model a floating-rate home loan alongside maturing FDs?',
  },
  {
    id: 'feature',
    label: 'Feature idea',
    shortLabel: 'Feature idea',
    subject: '[Vestora] Feature suggestion',
    hint: 'Request a calculator, asset class, or statement format',
    placeholder: 'Example: Would love to import Groww / Zerodha Coin exports directly...',
  },
  {
    id: 'bug',
    label: 'Report an issue',
    shortLabel: 'Report issue',
    subject: '[Vestora] Bug or math report',
    hint: 'Flag a number, import row, or layout detail that felt off',
    placeholder: 'Tell me what happened and which page you were on...',
  },
  {
    id: 'hello',
    label: 'Just say hello',
    shortLabel: 'Say hello',
    subject: '[Vestora] Hello Prateek',
    hint: 'Feedback, partnership, or a quick note',
    placeholder: 'Write anything — every note goes straight to my personal inbox.',
  },
];

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below
  }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

function buildMailPayload(topic: TopicOption, note: string, contextLabel: string) {
  const trimmed = note.trim();
  const bodyLines = [
    trimmed || `Hi Prateek,\n\nI'm reaching out from Vestora (${contextLabel}).`,
    '',
    `— Sent via Vestora (${contextLabel})`,
  ];
  const body = bodyLines.join('\n');
  const mailtoHref = `mailto:${MAKER_EMAIL}?subject=${encodeURIComponent(topic.subject)}&body=${encodeURIComponent(body)}`;
  const gmailHref = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(MAKER_EMAIL)}&su=${encodeURIComponent(topic.subject)}&body=${encodeURIComponent(body)}`;
  return { mailtoHref, gmailHref };
}

export interface ContactMakerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTopic?: ContactTopicId;
  contextLabel?: string;
}

/**
 * Interactive "Direct to the Maker" dispatch sheet.
 * Brand-token-pure (ink, mist, paper, level) so it renders identically in both
 * the main workspace (`index.css`) and `/demo/` (`demo.css`).
 */
export const ContactMakerModal: React.FC<ContactMakerModalProps> = ({
  isOpen,
  onClose,
  initialTopic = 'question',
  contextLabel = 'vestorawealths.app',
}) => {
  const [topicId, setTopicId] = useState<ContactTopicId>(initialTopic);
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);
  const titleId = useId();
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTopicId(initialTopic);
      setCopied(false);
      trackEvent('contact_maker_opened', { topic: initialTopic, context: contextLabel });
    }
  }, [isOpen, initialTopic, contextLabel]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const activeTopic = useMemo(
    () => TOPICS.find((t) => t.id === topicId) ?? TOPICS[0],
    [topicId],
  );

  const { mailtoHref, gmailHref } = useMemo(
    () => buildMailPayload(activeTopic, note, contextLabel),
    [activeTopic, note, contextLabel],
  );

  if (!isOpen) return null;

  const handleCopy = async () => {
    const ok = await copyText(MAKER_EMAIL);
    if (ok) {
      setCopied(true);
      trackEvent('contact_maker_email_copied', { context: contextLabel });
      window.setTimeout(() => setCopied(false), 2400);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/45 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-ink/15 bg-paper text-ink shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top editorial maker header */}
        <div className="flex items-start justify-between gap-4 border-b border-ink/10 bg-mist/60 px-6 py-5">
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              aria-hidden="true"
              className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink text-paper text-sm font-bold tracking-tight"
            >
              PD
              <span className="absolute -bottom-0.5 inset-x-2 h-0.5 rounded-full bg-level" />
            </div>
            <div className="min-w-0">
              <h2 id={titleId} className="font-display text-lg font-bold tracking-tight text-ink">
                Write directly to {MAKER_NAME}
              </h2>
              <p className="mt-0.5 text-xs text-ink/70">
                Maker of Vestora · Reads every note personally · Zero bots
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close maker message window"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink/60 hover:bg-ink/5 hover:text-ink transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Interactive topic picker */}
          <div className="space-y-2">
            <span className="block text-xs font-semibold text-ink/70">
              What&apos;s on your mind?
            </span>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Message topic">
              {TOPICS.map((topic) => {
                const selected = topic.id === topicId;
                return (
                  <button
                    key={topic.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      setTopicId(topic.id);
                      noteInputRef.current?.focus();
                    }}
                    className={`rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                      selected
                        ? 'border-ink bg-ink text-paper'
                        : 'border-ink/15 bg-paper text-ink hover:border-ink/35 hover:bg-mist/60'
                    }`}
                  >
                    <span className="block text-xs font-semibold leading-snug">{topic.label}</span>
                    <span
                      className={`mt-0.5 block text-[11px] leading-snug ${
                        selected ? 'text-paper/80' : 'text-ink/65'
                      }`}
                    >
                      {topic.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick-note draft composer */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <label htmlFor="maker-quick-note" className="font-semibold text-ink/75">
                Quick note <span className="font-normal text-ink/55">(optional)</span>
              </label>
              <span className="truncate text-[11px] text-ink/55 max-w-[230px]">
                {activeTopic.subject}
              </span>
            </div>
            <textarea
              ref={noteInputRef}
              id="maker-quick-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={activeTopic.placeholder}
              className="w-full resize-none rounded-xl border border-ink/20 bg-mist/45 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink/45 focus:border-ink focus:bg-paper focus:outline-none transition-colors"
            />
          </div>

          {/* Dispatch actions: Gmail Web + Default Mail App */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <a
              href={gmailHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                trackEvent('contact_maker_action', { channel: 'gmail', topic: topicId, context: contextLabel })
              }
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-xs font-semibold text-paper hover:bg-ink/90 transition-colors whitespace-nowrap"
            >
              <Send className="h-3.5 w-3.5 shrink-0" />
              <span>Compose in Gmail</span>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-80" />
            </a>

            <a
              href={mailtoHref}
              onClick={() =>
                trackEvent('contact_maker_action', { channel: 'mailto', topic: topicId, context: contextLabel })
              }
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-ink/25 bg-paper px-4 text-xs font-semibold text-ink hover:bg-ink/5 hover:border-ink/45 transition-colors whitespace-nowrap"
            >
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span>Open Mail App</span>
            </a>
          </div>

          {/* Tactile one-click copy strip */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-ink/12 bg-mist/70 px-3.5 py-2.5">
            <div className="min-w-0">
              <span className="block text-[11px] font-medium text-ink/60">
                Or copy my direct inbox
              </span>
              <span className="block truncate text-xs font-semibold text-ink select-all">
                {MAKER_EMAIL}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                copied
                  ? 'border-level bg-level text-paper'
                  : 'border-ink/20 bg-paper text-ink hover:border-ink/45 hover:bg-ink/5'
              }`}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 shrink-0" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 shrink-0" />
                  <span>Copy email</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export interface MakerTriggerButtonProps {
  onClick: () => void;
  variant?: 'app' | 'demo' | 'seo';
}

/**
 * Prominent, craft-forward top-bar trigger visible immediately without scrolling to a footer.
 */
export const MakerTriggerButton: React.FC<MakerTriggerButtonProps> = ({
  onClick,
  variant = 'app',
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg border border-ink/20 bg-paper text-ink hover:border-ink/45 hover:bg-ink/5 transition-colors whitespace-nowrap shrink-0 ${
        variant === 'demo' ? 'px-2.5 py-1.5 text-sm font-medium' : 'px-2.5 py-1.5 text-xs font-medium'
      }`}
      title={`Write directly to ${MAKER_NAME} (${MAKER_EMAIL})`}
    >
      <span
        aria-hidden="true"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-ink text-paper text-[10px] font-bold tracking-tight"
      >
        PD
      </span>
      <span className="hidden sm:inline">Talk to maker</span>
    </button>
  );
};

export interface MakerDeskStripProps {
  onOpenContact: (topic?: ContactTopicId) => void;
  contextLabel?: string;
  compact?: boolean;
}

/**
 * Replaces the traditional "Contact us: <email>" footer line with an inviting,
 * interactive direct-to-maker desk card that works identically in `/demo/`, `/`,
 * `WelcomeScreen`, and SEO landing pages.
 */
export const MakerDeskStrip: React.FC<MakerDeskStripProps> = ({
  onOpenContact,
  contextLabel = 'vestorawealths.app',
  compact = false,
}) => {
  const [copied, setCopied] = useState(false);

  const handleQuickCopy = async () => {
    const ok = await copyText(MAKER_EMAIL);
    if (ok) {
      setCopied(true);
      trackEvent('contact_maker_email_copied', { context: `${contextLabel}-strip` });
      window.setTimeout(() => setCopied(false), 2400);
    }
  };

  if (compact) {
    return (
      <div className="mt-6 w-full rounded-xl border border-ink/12 bg-paper px-4 py-3.5 text-left">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink text-paper text-xs font-bold"
            >
              PD
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink truncate">Built by {MAKER_NAME}</p>
              <p className="text-[11px] text-ink/65 truncate">
                Questions, feedback, or edge cases?
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenContact('hello')}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-ink px-3 text-xs font-semibold text-paper hover:bg-ink/90 transition-colors whitespace-nowrap"
          >
            <span>Write a note</span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label="Write directly to the maker"
      className="rounded-xl border border-ink/12 bg-paper p-5 sm:p-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-start gap-3.5 max-w-xl">
          <div
            aria-hidden="true"
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink text-paper text-sm font-bold tracking-tight"
          >
            PD
            <span className="absolute -bottom-0.5 inset-x-2 h-0.5 rounded-full bg-level" />
          </div>
          <div className="space-y-1">
            <h2 className="font-display text-base font-bold text-ink tracking-tight">
              Built &amp; read by one human — talk directly to {MAKER_NAME}
            </h2>
            <p className="text-xs text-ink/70 leading-relaxed">
              No support tickets or auto-responders. Pick a topic to draft a note straight to my
              inbox, or copy my email in one click.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onOpenContact('question')}
            className="h-10 rounded-lg bg-ink px-4 text-xs font-semibold text-paper hover:bg-ink/90 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Send className="h-3.5 w-3.5 shrink-0" />
            <span>Write a note</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenContact('feature')}
            className="h-10 rounded-lg border border-ink/20 bg-mist/60 px-3.5 text-xs font-semibold text-ink hover:border-ink/40 hover:bg-mist transition-colors whitespace-nowrap"
          >
            Suggest a feature
          </button>
          <button
            type="button"
            onClick={handleQuickCopy}
            title={`Copy ${MAKER_EMAIL}`}
            className={`h-10 rounded-lg border px-3.5 text-xs font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap ${
              copied
                ? 'border-level bg-level text-paper'
                : 'border-ink/20 bg-paper text-ink hover:border-ink/40 hover:bg-ink/5'
            }`}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 shrink-0" />
                <span>Email copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 shrink-0" />
                <span>{MAKER_EMAIL}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
};
