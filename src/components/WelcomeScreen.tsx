import React, { useState } from 'react';
import { PlusCircle, Sparkles } from 'lucide-react';
import { VestoraLogo } from './VestoraLogo';
import {
  ContactMakerModal,
  MakerDeskStrip,
  type ContactTopicId,
} from './ContactMaker';

interface WelcomeScreenProps {
  onChooseSample: () => void;
  onChooseScratch: () => void;
}

/**
 * First-run gate, shown instead of the app while this browser has no saved
 * portfolio. The visitor must pick one card: there is deliberately no Escape
 * handler, no backdrop, and no dismiss path. Both handlers live in App — this
 * component never touches storage or the tour.
 */
export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onChooseSample,
  onChooseScratch,
}) => {
  const [contactOpen, setContactOpen] = useState(false);
  const [contactTopic, setContactTopic] = useState<ContactTopicId>('hello');

  return (
    <div className="min-h-screen bg-mist text-ink flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md flex flex-col items-center text-center">
        <VestoraLogo size={44} />
        <h1 className="mt-4 text-3xl font-bold text-ink tracking-tight text-balance">
          Welcome to Vestora
        </h1>
        <p className="mt-2 text-sm text-ink/70 leading-relaxed text-balance">
          Plan your rebalance in your browser — nothing leaves your device.
        </p>

        <div className="mt-8 w-full space-y-3">
          <button
            type="button"
            autoFocus
            onClick={onChooseSample}
            className="w-full text-left bg-paper border-2 border-level hover:bg-ink/5 rounded-xl p-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
          >
            <span className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2.5 min-w-0">
                <span className="w-8 h-8 rounded-lg bg-mist border border-level/40 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-emerald-700 shrink-0" />
                </span>
                <span className="text-sm font-bold text-ink">Explore with sample data</span>
              </span>
              <span className="px-2 py-0.5 text-2xs font-mono font-semibold uppercase tracking-wider bg-level text-paper rounded-full shrink-0">
                Recommended
              </span>
            </span>
            <span className="block mt-2.5 text-xs text-ink/70 leading-relaxed">
              A realistic portfolio loads so you can explore every tool — you can clear it and
              start fresh anytime.
            </span>
          </button>

          <button
            type="button"
            onClick={onChooseScratch}
            className="w-full text-left bg-paper border border-slate-700 hover:border-ink/40 rounded-xl p-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
          >
            <span className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-mist border border-slate-700 flex items-center justify-center shrink-0">
                <PlusCircle className="w-4 h-4 text-debt shrink-0" />
              </span>
              <span className="text-sm font-bold text-ink">Start from scratch</span>
            </span>
            <span className="block mt-2.5 text-xs text-ink/70 leading-relaxed">
              Begin with an empty ledger and add holdings or import a file when you&apos;re ready.
            </span>
          </button>
        </div>

        <MakerDeskStrip
          compact
          contextLabel="vestorawealths.app (welcome)"
          onOpenContact={(topic) => {
            setContactTopic(topic ?? 'hello');
            setContactOpen(true);
          }}
        />
      </div>

      <ContactMakerModal
        isOpen={contactOpen}
        onClose={() => setContactOpen(false)}
        initialTopic={contactTopic}
        contextLabel="vestorawealths.app (welcome)"
      />
    </div>
  );
};
