export interface Prefs {
  font: string;
  size: number;
  line: number;
  width: number;
}

export const FONTS = [
  { label: "Georgia (serif)", value: 'Georgia, "Times New Roman", serif' },
  { label: "Palatino", value: '"Palatino Linotype", Palatino, "Book Antiqua", serif' },
  { label: "Cambria", value: "Cambria, Georgia, serif" },
  { label: "Times New Roman", value: '"Times New Roman", Times, serif' },
  { label: "Garamond", value: 'Garamond, "EB Garamond", Georgia, serif' },
  { label: "Segoe UI (sans-serif)", value: '"Segoe UI", system-ui, sans-serif' },
  { label: "Consolas (machine à écrire)", value: 'Consolas, "Courier New", monospace' },
];

export const DEFAULT_PREFS: Prefs = { font: FONTS[0].value, size: 18, line: 1.75, width: 740 };

export const THEMES = [
  { id: "parchemin", label: "Parchemin classique", dark: false },
  { id: "petale", label: "Douceur de pétale", dark: false },
  { id: "marine", label: "Récit marine", dark: true },
  { id: "foret", label: "Forêt mystique", dark: true },
  { id: "academia", label: "Dark academia", dark: true },
  { id: "nuit", label: "Nuit", dark: true },
];

const KEY = "plumier-prefs";
export function loadPrefs(): Prefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULT_PREFS;
  }
}
export function savePrefs(p: Prefs) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
}
