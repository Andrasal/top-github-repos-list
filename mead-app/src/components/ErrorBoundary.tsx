import { Component, ReactNode } from 'react';

/** Keeps one failing panel from blanking the page; resets when `resetKey` changes. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: unknown; label: string }, { error: Error | null; key?: unknown }> {
  state: { error: Error | null; key?: unknown } = { error: null, key: this.props.resetKey };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  static getDerivedStateFromProps(props: { resetKey?: unknown }, state: { error: Error | null; key?: unknown }) {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }
  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="rounded-xl border border-stone-300 bg-stone-100 p-4 text-sm dark:border-stone-700 dark:bg-stone-900">
          <b>{this.props.label} couldn't display.</b> Change any value to retry. Your recipe is safe.
          <div className="mt-1 text-xs text-stone-500">{this.state.error.message}</div>
        </div>
      );
    }
    return this.props.children;
  }
}
