import { Component, type ReactNode } from 'react';

interface DemoErrorBoundaryProps {
  children: ReactNode;
}

interface DemoErrorBoundaryState {
  failed: boolean;
}

/**
 * A failed lazy chunk (the editor or the chat panel) used to white-screen the
 * whole demo. This keeps the rest of the journey usable and offers a Retry
 * that clears the error state so the import is attempted again.
 */
export class DemoErrorBoundary extends Component<DemoErrorBoundaryProps, DemoErrorBoundaryState> {
  state: DemoErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): DemoErrorBoundaryState {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="rounded-xl border border-ink/15 bg-paper p-5">
          <p className="m-0 font-semibold">Couldn't load this part. Please refresh.</p>
          <button
            type="button"
            onClick={() => this.setState({ failed: false })}
            className="mt-3 rounded-full border border-ink px-4 py-2 text-sm font-semibold text-ink hover:bg-ink/5"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
