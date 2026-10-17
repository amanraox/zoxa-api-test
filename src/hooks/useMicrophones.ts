"use client";

import { useCallback, useEffect, useState } from "react";

/** Audio input devices; labels appear once mic permission has been granted. */
export function useMicrophones(refreshOn: unknown): MediaDeviceInfo[] {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  const refresh = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(all.filter((d) => d.kind === "audioinput" && d.deviceId));
    } catch {
      setDevices([]);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- device enumeration is external state
    void refresh();
    navigator.mediaDevices?.addEventListener?.("devicechange", refresh);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", refresh);
  }, [refresh, refreshOn]);

  return devices;
}
