import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import type { Holding } from '../../types/wealth';
import { formatCurrency } from '../../utils/currency';
import { portfolioTotal } from '../demoData';
import { draftFromHolding, emptyDraft, STARTER_CATEGORIES, type HoldingDraft } from '../holdingDraft';
import { parseImportedFile, readImportFile, type ImportedPortfolio } from '../personalPortfolio';
import { ExportBar } from './ExportBar';
import { CATEGORY_LABEL, HoldingForm } from './HoldingForm';

type OpenRequest = { mode: 'add'; draft?: Holding } | { mode: 'edit'; holding: Holding };

interface EditorProps {
  holdings: Holding[];
  onChange: (next: Holding[]) => void;
  onImported: (p: ImportedPortfolio) => void;
  onContinue: () => void;
  openRequest?: OpenRequest | null;
  onOpenRequestHandled?: () => void;
}

interface FormState {
  initial: HoldingDraft;
  existing?: Holding;
}

const primaryButton =
  'rounded-full bg-ink px-6 py-3 font-semibold text-paper transition-colors hover:bg-ink/90 disabled:opacity-40';
const outlineButton =
  'rounded-full border border-ink/30 px-4 py-2 font-semibold hover:border-ink disabled:opacity-40';
const quietButton = 'rounded-full px-3 py-1.5 text-sm font-semibold text-ink underline underline-offset-4 hover:bg-ink/5';

export function Editor({
  holdings,
  onChange,
  onImported,
  onContinue,
  openRequest,
  onOpenRequestHandled,
}: EditorProps) {
  const uid = useId();
  const [form, setForm] = useState<FormState | null>(null);
  const [removed, setRemoved] = useState<{ holding: Holding; index: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);

  const total = portfolioTotal({ holdings });
  const canContinue = total > 0;
  const money = (n: number) => formatCurrency(n);

  // Lets another chapter open the form here (for example "edit this one" from the plan).
  useEffect(() => {
    if (!openRequest) return;
    if (openRequest.mode === 'edit') {
      setForm({ initial: draftFromHolding(openRequest.holding), existing: openRequest.holding });
    } else {
      setForm({ initial: openRequest.draft ? draftFromHolding(openRequest.draft) : emptyDraft('MUTUAL_FUND') });
    }
    onOpenRequestHandled?.();
  }, [openRequest, onOpenRequestHandled]);

  // Moves focus to the Undo button after a removal, since the row that held focus is gone.
  useEffect(() => {
    if (removed) undoRef.current?.focus();
  }, [removed]);

  const openAdd = (category: Holding['category'] = 'MUTUAL_FUND') => {
    setForm({ initial: emptyDraft(category) });
  };

  const closeForm = () => {
    setForm(null);
    listHeadingRef.current?.focus();
  };

  const save = (h: Holding) => {
    const exists = holdings.some((x) => x.id === h.id);
    onChange(exists ? holdings.map((x) => (x.id === h.id ? h : x)) : [...holdings, h]);
    setRemoved(null);
    setImportNote(null);
    closeForm();
  };

  const remove = (h: Holding) => {
    const index = holdings.findIndex((x) => x.id === h.id);
    setRemoved({ holding: h, index });
    setImportNote(null);
    onChange(holdings.filter((x) => x.id !== h.id));
  };

  const undo = () => {
    if (!removed) return;
    const at = Math.min(removed.index, holdings.length);
    onChange([...holdings.slice(0, at), removed.holding, ...holdings.slice(at)]);
    setRemoved(null);
    listHeadingRef.current?.focus();
  };

  const pickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setImportError(null);
    setImportNote(null);
    try {
      const { fileName, content } = await readImportFile(file);
      const imported = parseImportedFile(fileName, content);
      setRemoved(null);
      setForm(null);
      onImported(imported);
      const count = imported.holdings.length;
      const skipped = imported.skippedRows;
      setImportNote(
        `Loaded ${count} ${count === 1 ? 'investment' : 'investments'} from ${fileName}.` +
          (skipped > 0 ? ` ${skipped} ${skipped === 1 ? 'row was' : 'rows were'} left out because they were not clear.` : ''),
      );
    } catch (err) {
      // A failed import leaves what is listed untouched.
      setImportError(err instanceof Error ? err.message : `Could not read ${file.name}. Try saving it again.`);
    } finally {
      input.value = '';
    }
  };

  return (
    <div>
      <h1 tabIndex={-1} className="text-4xl font-bold outline-none md:text-5xl">
        Your investments
      </h1>
      <p className="mt-3 max-w-prose text-lg">
        List what you own, or load a file. Nothing leaves this screen.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="button" className={primaryButton} onClick={() => openAdd()}>
          Add an investment
        </button>
        <button type="button" className={outlineButton} onClick={() => fileRef.current?.click()}>
          Import a file
        </button>
        <input
          ref={fileRef}
          id={`${uid}-file`}
          type="file"
          accept=".xlsx,.xls,.xlsm,.xlsb,.ods,.csv,.tsv,.json"
          hidden
          tabIndex={-1}
          aria-label="Choose a file to import"
          onChange={(e) => void pickFile(e)}
        />
        <span className="rounded-lg border border-ink/30 bg-paper px-3 py-2 text-sm font-mono">INR</span>
      </div>
      <p className="mb-0 mt-2 text-sm text-ink/70">
        Importing a file replaces everything listed here. Excel, CSV and Vestora files work.
      </p>
      {importError && (
        <p role="alert" className="mb-0 mt-3 font-semibold text-risk">
          {importError}
        </p>
      )}
      {importNote && (
        <p role="status" className="mb-0 mt-3 text-sm font-semibold">
          {importNote}
        </p>
      )}

      {form && (
        <div className="mt-6">
          <HoldingForm
            key={form.existing?.id ?? `new-${form.initial.category}`}
            initial={form.initial}
            existing={form.existing}
            onSave={save}
            onCancel={closeForm}
          />
        </div>
      )}

      <section aria-labelledby={`${uid}-list`} className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id={`${uid}-list`} ref={listHeadingRef} tabIndex={-1} className="m-0 text-2xl font-bold outline-none">
            What you have
          </h2>
          {holdings.length > 0 && (
            <p className="num m-0 font-semibold">
              Total {money(total)}
            </p>
          )}
        </div>

        <div role="status" aria-live="polite">
          {removed && (
            <p className="mb-0 mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-ink/15 bg-paper px-4 py-2">
              <span>Removed {removed.holding.name}.</span>
              <button ref={undoRef} type="button" onClick={undo} className={quietButton}>
                Undo
              </button>
            </p>
          )}
        </div>

        {holdings.length === 0 ? (
          <div className="mt-4 rounded-xl border border-ink/15 bg-paper p-5">
            <p className="m-0 font-semibold">Nothing listed yet. Start with one of these.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {STARTER_CATEGORIES.map((s) => (
                <button key={s.category} type="button" className={outlineButton} onClick={() => openAdd(s.category)}>
                  Add a {s.label.toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ul className="m-0 mt-4 grid list-none gap-2 p-0">
            {holdings.map((h) => (
              <li
                key={h.id}
                className="flex flex-col gap-2 rounded-xl border border-ink/15 bg-paper p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="m-0 break-words font-semibold leading-snug">{h.name}</p>
                  <p className="m-0 break-words text-sm text-ink/70">
                    {CATEGORY_LABEL[h.category]} · {h.institution}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <span className="num font-bold">{money(h.currentValue)}</span>
                  <button
                    type="button"
                    className={quietButton}
                    aria-label={`Edit ${h.name}`}
                    onClick={() => setForm({ initial: draftFromHolding(h), existing: h })}
                  >
                    Edit
                  </button>
                  <button type="button" className={quietButton} aria-label={`Delete ${h.name}`} onClick={() => remove(h)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-8 flex flex-col gap-4 border-t border-ink/15 pt-6 sm:flex-row sm:items-start sm:justify-between">
        <ExportBar holdings={holdings} formats={['xlsx', 'pdf', 'csv', 'json']} />
        <div className="sm:text-right">
          <button
            type="button"
            className={primaryButton}
            disabled={!canContinue}
            aria-describedby={canContinue ? undefined : `${uid}-hint`}
            onClick={onContinue}
          >
            Continue
          </button>
          {!canContinue && (
            <p id={`${uid}-hint`} className="mb-0 mt-2 text-sm text-ink/70">
              Add at least one investment worth more than zero to continue.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
