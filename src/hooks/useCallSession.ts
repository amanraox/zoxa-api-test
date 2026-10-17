"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { CallSession, type CallState } from "@/lib/call/session";

const SERVER_STATE = new CallSession().getSnapshot();

/** One CallSession for the component's lifetime; released on unmount / page hide. */
export function useCallSession(): { session: CallSession; state: CallState } {
  const [session] = useState(() => new CallSession());
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, () => SERVER_STATE);

  useEffect(() => {
    const onHide = () => session.dispose();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      session.dispose();
    };
  }, [session]);

  return { session, state };
}
