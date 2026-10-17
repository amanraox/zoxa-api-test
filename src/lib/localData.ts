/** Every `zoxa-console:*` localStorage key — the console's whole local footprint. */
export function clearLocalData() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("zoxa-console:")) localStorage.removeItem(k);
  } catch {
    /* storage unavailable */
  }
}
