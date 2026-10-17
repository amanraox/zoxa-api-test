/** Three-stop colour palettes shared by every orb (primary, secondary, highlight). */

export type Palette = readonly [string, string, string];

export const PALETTES: ReadonlyArray<{ id: string; name: string; colors: Palette }> = [
  { id: "cyan", name: "Cyan", colors: ["#06b6d4", "#3b82f6", "#a5f3fc"] },
  { id: "ember", name: "Ember", colors: ["#ff5a1f", "#ff2e6e", "#ffc46b"] },
  { id: "glacier", name: "Glacier", colors: ["#2f7dff", "#3ee0e0", "#e8f6ff"] },
  { id: "aurora", name: "Aurora", colors: ["#1fd18b", "#6a5cff", "#c6ff7a"] },
  { id: "orchid", name: "Orchid", colors: ["#b14dff", "#ff5fb8", "#7fd6ff"] },
  { id: "solar", name: "Solar", colors: ["#ffb020", "#ff5418", "#fff1c2"] },
  { id: "graphite", name: "Graphite", colors: ["#9aa0ad", "#5b6170", "#ffffff"] },
];

export const isHexColor = (v: string) => /^#[0-9a-f]{6}$/i.test(v.trim());

export function hexToRgb(hex: string): [number, number, number] {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return [1, 1, 1];
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
