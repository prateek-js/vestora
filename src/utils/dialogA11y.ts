import { useEffect } from 'react';
import type { RefObject } from 'react';

// Broad candidate query; every filter below lives in this function so the
// contract is verifiable without a DOM engine (the Node test runner has none).
const FOCUSABLE_SELECTOR = [
  'a',
  'area',
  'button',
  'input',
  'select',
  'textarea',
  'iframe',
  'object',
  'embed',
  'summary',
  '[tabindex]',
  '[contenteditable]',
].join(', ');

/**
 * Visible, enabled, focusable elements inside `container`, in DOM order.
 *
 * Shared by the app's dialogs and the demo chat panel (Task 9): keep the
 * contract stable — disabled controls, explicit `tabindex="-1"` nodes, hidden
 * (zero-box) nodes, and `aria-hidden="true"` nodes are all skipped here, so
 * callers can trust the result is already usable as a focus trap's list.
 */
export function getFocusable(container: HTMLElement): HTMLElement[] {
  const candidates = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
  const focusable: HTMLElement[] = [];
  for (const el of Array.from(candidates)) {
    if (el.hasAttribute('disabled')) continue;
    if (el.getAttribute('tabindex') === '-1') continue;
    // A node with a zero box (display:none / hidden ancestor, detached
    // subtree) cannot receive focus; skip it.
    if (el.offsetWidth <= 0 && el.offsetHeight <= 0) continue;
    if (el.getAttribute('aria-hidden') === 'true') continue;
    focusable.push(el);
  }
  return focusable;
}

/**
 * Next trap index for a Tab/Shift+Tab press in a dialog with `count`
 * focusable elements. Wrap-around: Tab on the last returns 0, Shift+Tab on
 * the first returns count−1; a single-focusable dialog holds its index.
 */
export function nextFocusIndex(current: number, count: number, shift: boolean): number {
  if (count <= 1) return count === 1 ? 0 : current;
  if (shift) return current === 0 ? count - 1 : current - 1;
  return current === count - 1 ? 0 : current + 1;
}

export interface UseDialogA11yOptions {
  /** Whether the dialog is currently open. Flipping this re-arms the trap. */
  open: boolean;
  /** The dialog surface element (not the fixed backdrop). */
  dialogRef: RefObject<HTMLElement | null>;
  /** The element focus returns to when the dialog closes. */
  restoreFocusRef?: RefObject<HTMLElement | null>;
  /** Extra targets to focus on open (e.g. the composer's textarea) before falling back to the first focusable. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Called on Escape while the dialog is open (the owner still owns closing). */
  onEscape?: () => void;
}

/**
 * Dialog keyboard behaviour shared by the app drawer and the demo panel:
 * focus moves into the dialog on open (initial target first, then the first
 * focusable), Tab/Shift+Tab cycle only inside it, Escape reports to `onEscape`,
 * and focus restores to the launcher on close.
 *
 * `open` flips the trap: false is a no-op, true arms it after the dialog has
 * rendered (the ref is populated by then). The hook is browser-verified only —
 * the Node test runner has no DOM, so the unit tests cover
 * `getFocusable`/`nextFocusIndex` and the drawer walk covers this hook.
 */
export function useDialogA11y({ open, dialogRef, restoreFocusRef, initialFocusRef, onEscape }: UseDialogA11yOptions): void {
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusables = getFocusable(dialog);
    if (focusables.length === 0) return;

    const initial = initialFocusRef?.current;
    if (initial && focusables.includes(initial)) {
      initial.focus();
    } else {
      focusables[0].focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onEscape?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const current = getFocusable(dialog);
      if (current.length === 0) return;
      const active = document.activeElement as HTMLElement | null;
      const index = active ? current.indexOf(active) : -1;
      // Focus inside the dialog (or entering from the backdrop): resolve to the
      // neighbour; already outside means the browser is bringing focus in, and
      // the next cycle corrects it.
      if (index === -1) return;
      e.preventDefault();
      const next = nextFocusIndex(index, current.length, e.shiftKey);
      current[next].focus();
    };

    dialog.addEventListener('keydown', onKeyDown);
    return () => {
      dialog.removeEventListener('keydown', onKeyDown);
      const launcher = restoreFocusRef?.current;
      // Only reclaim focus if it is still ours to reclaim: if the user already
      // moved focus elsewhere (e.g. the demo panel handed it to a heading after
      // a chapter change), stay out of the way.
      if (launcher && (document.activeElement === document.body || dialog.contains(document.activeElement))) {
        launcher.focus();
        return;
      }
      const stillInside = document.activeElement instanceof Node && dialog.contains(document.activeElement);
      if (stillInside) {
        (document.activeElement as HTMLElement).blur();
      }
    };
    // onEscape is read through a stable effect closure; callers pass an
    // inline arrow today and a state-setter is stable enough for the trap's
    // lifetime. dialogRef/restoreFocusRef/initialFocusRef are refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dialogRef, restoreFocusRef, initialFocusRef]);
}
