import type { TreeNode } from "./types";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Noms par lesquels une fiche peut apparaître dans le texte : son titre et ses alias. */
export const namesOf = (n: TreeNode): string[] =>
  [n.title, ...n.aliases].map((s) => s.trim()).filter((s) => s.length >= 2);

/** Nombre d'occurrences (mots entiers, sans tenir compte de la casse). */
export function countMentions(text: string, names: string[]): number {
  if (!names.length || !text) return 0;
  const re = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${names.map(esc).join("|")})(?![\\p{L}\\p{N}_])`, "giu");
  return (text.match(re) ?? []).length;
}
