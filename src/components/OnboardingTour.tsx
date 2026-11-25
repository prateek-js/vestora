import React, { useEffect, useState, useCallback } from 'react';
import {
  ShieldCheck,
  Download,
  Upload,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  CheckCircle2,
} from 'lucide-react';

export interface TourStep {
  id: string;
  selector: string;
  title: string;
  description: string;
  tip: string;
  icon: 'privacy' | 'export' | 'import' | 'explore';
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'privacy',
    selector: '[data-tour="privacy-badge"]',
    title: 'Your data stays strictly on your device',
    description:
      "We don't store your portfolio on any server. Sample numbers load initially so you can explore risk, maturity, and tax analytics safely.",
    tip: 'Because nothing is stored with us, exporting a file lets you keep a permanent copy of your work.',
    icon: 'privacy',
  },
  {
    id: 'export',
    selector: '[data-tour="export-menu"]',
    title: 'Save & Export your progress anytime',
    description:
      'Use Save / Export right in the top bar (or in the Overview & Holdings Ledger) to download your portfolio as Excel (.xlsx), CSV (.csv), JSON, or a printable PDF Wealth Report.',
    tip: 'Exporting as .xlsx or .csv preserves every holding, category, maturity date, and AMFI code.',
    icon: 'export',
  },
  {
    id: 'import',
    selector: '[data-tour="import-card"]',
    title: 'Come back & re-import your saved file',
    description:
      'Whenever you return on any browser or device, upload your previously exported .xlsx or .csv file here (or via Save / Export → Restore Saved File) to pick up right where you left off.',
    tip: 'You can also upload CAMS/KFintech CAS, MF Central, or Bank FD Excel sheets directly.',
    icon: 'import',
  },
  {
    id: 'explore',
    selector: '[data-tour="add-card"]',
    title: 'Build, refresh NAVs & stress-test',
    description:
      'Add individual holdings anytime, sync live mutual fund NAVs under Tools, monitor upcoming maturities on Maturity Radar, and simulate shocks in Stress Lab.',
    tip: 'You can reopen this guide anytime by clicking Tour in the top navigation bar.',
    icon: 'explore',
  },
];

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
  onEnsureOverviewTab: () => void;
}

interface RectBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  isOpen,
  onClose,
  onEnsureOverviewTab,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<RectBox | null>(null);
  const [viewport, setViewport] = useState({ w: 1280, h: 720 });

  const currentStep = TOUR_STEPS[stepIndex] ?? TOUR_STEPS[0];

  const measureTarget = useCallback(() => {
    if (!isOpen) return;
    setViewport({ w: window.innerWidth, h: window.innerHeight });

    const el = document.querySelector(currentStep.selector) as HTMLElement | null;
    if (!el) {
      setTargetRect(null);
      return;
    }

    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) {
      setTargetRect(null);
      return;
    }

    setTargetRect({
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
    });
  }, [isOpen, currentStep.selector]);

  useEffect(() => {
    if (!isOpen) {
      setStepIndex(0);
      return;
    }
    onEnsureOverviewTab();
  }, [isOpen, onEnsureOverviewTab]);

  useEffect(() => {
    if (!isOpen) return;

    const el = document.querySelector(currentStep.selector) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }

    const t1 = window.setTimeout(measureTarget, 80);
    const t2 = window.setTimeout(measureTarget, 320);

    window.addEventListener('resize', measureTarget);
    window.addEventListener('scroll', measureTarget, true);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('resize', measureTarget);
      window.removeEventListener('scroll', measureTarget, true);
    };
  }, [isOpen, stepIndex, currentStep.selector, measureTarget]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        if (stepIndex < TOUR_STEPS.length - 1) setStepIndex((s) => s + 1);
        else onClose();
      } else if (e.key === 'ArrowLeft') {
        setStepIndex((s) => Math.max(0, s - 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, stepIndex, onClose]);

  if (!isOpen) return null;

  const isLast = stepIndex === TOUR_STEPS.length - 1;

  // Compute popover position near the spotlighted element, clamped inside the viewport
  const cardWidth = Math.min(380, viewport.w - 24);
  const estimatedCardHeight = 255;
  let cardStyle: React.CSSProperties;

  if (targetRect && viewport.w >= 640) {
    const pad = 14;
    const spaceBelow = viewport.h - (targetRect.top + targetRect.height);
    const placeBelow = spaceBelow >= estimatedCardHeight + pad || targetRect.top < estimatedCardHeight;

    const rawTop = placeBelow
      ? targetRect.top + targetRect.height + pad
      : targetRect.top - estimatedCardHeight - pad;
    const clampedTop = Math.max(16, Math.min(viewport.h - estimatedCardHeight - 16, rawTop));

    const idealLeft = targetRect.left + targetRect.width / 2 - cardWidth / 2;
    const clampedLeft = Math.max(16, Math.min(viewport.w - cardWidth - 16, idealLeft));

    cardStyle = {
      position: 'fixed',
      top: `${clampedTop}px`,
      left: `${clampedLeft}px`,
      width: `${cardWidth}px`,
    };
  } else {
    cardStyle = {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: `${cardWidth}px`,
    };
  }

  const renderStepIcon = () => {
    switch (currentStep.icon) {
      case 'privacy':
        return <ShieldCheck className="w-4 h-4 text-emerald-700" />;
      case 'export':
        return <Download className="w-4 h-4 text-emerald-700" />;
      case 'import':
        return <Upload className="w-4 h-4 text-emerald-700" />;
      default:
        return <Sparkles className="w-4 h-4 text-amber-700" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Vestora Quick Start Tour"
    >
      {/* Clickable backdrop when spotlight isn't active, or subtle dim overlay */}
      {!targetRect && (
        <div
          className="fixed inset-0 bg-ink/50 backdrop-blur-xs"
          onClick={onClose}
        />
      )}

      {/* Spotlight Cutout Ring */}
      {targetRect && (
        <>
          <div
            className="fixed inset-0"
            onClick={onClose}
            aria-hidden="true"
          />
          <div
            aria-hidden="true"
            className="fixed rounded-xl border-2 border-emerald-500 pointer-events-none transition-all duration-200"
            style={{
              top: `${Math.max(4, targetRect.top - 6)}px`,
              left: `${Math.max(4, targetRect.left - 6)}px`,
              width: `${targetRect.width + 12}px`,
              height: `${targetRect.height + 12}px`,
              boxShadow: '0 0 0 9999px rgba(20, 33, 61, 0.50)',
            }}
          />
        </>
      )}

      {/* Tour Step Card */}
      <div
        style={cardStyle}
        className="z-50 bg-paper border border-slate-700 rounded-xl shadow-ink/10 shadow-2xl p-5 text-ink space-y-3.5 transition-all duration-200"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-mist border border-slate-700 flex items-center justify-center shrink-0">
              {renderStepIcon()}
            </span>
            <span className="text-2xs font-mono uppercase tracking-wider text-emerald-700 font-semibold">
              Step {stepIndex + 1} of {TOUR_STEPS.length}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-ink/70 hover:text-ink rounded-md hover:bg-ink/5 transition-colors"
            aria-label="Close tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <h3 className="text-sm font-bold text-ink leading-snug">
            {currentStep.title}
          </h3>
          <p className="text-xs text-ink/70 mt-1.5 leading-relaxed">
            {currentStep.description}
          </p>
        </div>

        <div className="p-2.5 rounded-lg bg-mist border border-slate-700 text-2xs text-ink/70 leading-relaxed">
          {currentStep.tip}
        </div>

        {/* Step progress dots + Controls */}
        <div className="pt-1 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((step, idx) => (
              <button
                key={step.id}
                type="button"
                onClick={() => setStepIndex(idx)}
                aria-label={`Go to step ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  idx === stepIndex
                    ? 'w-5 bg-emerald-500'
                    : idx < stepIndex
                    ? 'w-2 bg-emerald-500/70'
                    : 'w-2 bg-slate-700 hover:bg-ink/40'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-2 py-1.5 text-2xs font-medium text-ink/70 hover:text-ink transition-colors"
            >
              Skip
            </button>

            {stepIndex > 0 && (
              <button
                type="button"
                onClick={() => setStepIndex((s) => Math.max(0, s - 1))}
                className="px-2.5 py-1.5 text-xs font-medium text-ink bg-mist border border-slate-700 hover:border-ink/40 rounded-lg transition-colors inline-flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (isLast) onClose();
                else setStepIndex((s) => s + 1);
              }}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-700 rounded-lg transition-colors inline-flex items-center gap-1 whitespace-nowrap"
            >
              <span>{isLast ? 'Finish Tour' : 'Next'}</span>
              {isLast ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
