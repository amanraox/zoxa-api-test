"use client";

import { Component, type ReactNode } from "react";

/**
 * Contains render errors to one panel. Raw-edited configs can hold shapes the
 * form can't display; that must degrade to a notice, never a blank page.
 * `resetKey` changes (e.g. the edited value) retry rendering.
 */
export class Boundary extends Component<
  { children: ReactNode; label: string; resetKey?: unknown },
  { error: Error | null; key: unknown }
> {
  state = { error: null as Error | null, key: this.props.resetKey };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  static getDerivedStateFromProps(props: { resetKey?: unknown }, state: { key: unknown; error: Error | null }) {
    return props.resetKey !== state.key ? { key: props.resetKey, error: null } : null;
  }

  componentDidCatch(error: Error) {
    console.warn(`[console] ${this.props.label} failed to render:`, error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-lg bg-warn/8 px-3 py-2.5 text-[12px] leading-relaxed text-warn ring-1 ring-warn/25">
          <b>{this.props.label}</b> can&apos;t be shown in the form for this value — edit it in the Raw request tab.
          <div className="mt-1 font-mono text-[11px] opacity-80">{this.state.error.message}</div>
        </div>
      );
    }
    return this.props.children;
  }
}
