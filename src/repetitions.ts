import type { Block } from "./editorUtils";

/** Mots-outils français ignorés par l'analyse. */
const STOP = new Set(
  `alors aucun aussi autre avant avec avoir bien cela celle celui cependant chaque comme comment dans depuis donc dont elle elles encore entre était étaient étant être eux fait faire fois leur leurs lors mais même merci moins notre nous nôtre pour pourtant puis quand quel quelle quelles quels quoi sans sera seront ses soit sont sous suis sur tant tous tout toute toutes très votre vous vôtre avait avaient avez avons ceux cette ces cet chez dont elle était eût hors ici ils jamais jusque lequel lesquels madame monsieur non nos notre ont par parce pas peu peut plus plusieurs pourquoi près que quelque qui rien selon sinon son sur toujours trop une vers voici voilà vos votre`
    .split(/\s+/),
);

export interface Token { key: string; word: string; from: number; to: number; idx: number }

export interface Group {
  key: string;
  word: string;
  count: number;
  /** Étendue en nombre de mots entre la première et la dernière occurrence */
  span: number;
  occurrences: { from: number; to: number }[];
}

export interface Analysis {
  groups: Group[];
  top: { word: string; count: number }[];
  starts: { word: string; count: number; at: { from: number; to: number } }[];
  adverbs: { word: string; count: number }[];
  totalWords: number;
}

const stem = (w: string) => (w.length > 4 && /[sx]$/.test(w) ? w.slice(0, -1) : w);
const NOT_ADVERBS = new Set(["moment", "vêtement", "mouvement", "sentiment", "vraiment", "document", "appartement", "monument", "instrument", "tempérament", "sacrement", "ornement", "ciment", "aliment", "logement", "gouvernement", "bâtiment", "événement", "changement", "commencement", "ajustement"]);

export function tokenize(blocks: Block[]): Token[] {
  const out: Token[] = [];
  let idx = 0;
  const re = /\p{L}+/gu;
  for (const b of blocks) {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(b.text))) {
      const word = m[0];
      out.push({ key: stem(word.toLowerCase()), word, from: b.pos + m.index, to: b.pos + m.index + word.length, idx: idx++ });
    }
  }
  return out;
}

export interface Options { windowWords: number; minLength: number; ignored: string[] }

export function analyse(blocks: Block[], opt: Options): Analysis {
  const tokens = tokenize(blocks);
  const ignored = new Set(opt.ignored.map((w) => stem(w.toLowerCase())));
  const byKey = new Map<string, Token[]>();
  for (const t of tokens) {
    if (t.word.length < opt.minLength || STOP.has(t.word.toLowerCase()) || ignored.has(t.key)) continue;
    (byKey.get(t.key) ?? byKey.set(t.key, []).get(t.key)!).push(t);
  }

  // Répétitions rapprochées : suites d'occurrences séparées par au plus `windowWords` mots
  const groups: Group[] = [];
  for (const [key, list] of byKey) {
    if (list.length < 2) continue;
    let run: Token[] = [list[0]];
    const flush = () => {
      if (run.length >= 2) {
        groups.push({
          key,
          word: run[0].word.toLowerCase(),
          count: run.length,
          span: run[run.length - 1].idx - run[0].idx,
          occurrences: run.map((t) => ({ from: t.from, to: t.to })),
        });
      }
    };
    for (let i = 1; i < list.length; i++) {
      if (list[i].idx - list[i - 1].idx <= opt.windowWords) run.push(list[i]);
      else { flush(); run = [list[i]]; }
    }
    flush();
  }
  groups.sort((a, b) => b.count - a.count || a.occurrences[0].from - b.occurrences[0].from);

  // Mots les plus fréquents
  const top = [...byKey.entries()]
    .map(([, l]) => ({ word: l[0].word.toLowerCase(), count: l.length }))
    .filter((x) => x.count >= 3)
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  // Débuts de phrases identiques (3 de suite ou plus)
  const starts: Analysis["starts"] = [];
  const firsts: { word: string; from: number; to: number }[] = [];
  for (const b of blocks) {
    const re = /(?:^|[.!?…»]\s+)(\p{L}+)/gu;
    let m: RegExpExecArray | null;
    while ((m = re.exec(b.text))) {
      const w = m[1];
      const off = m.index + m[0].length - w.length;
      firsts.push({ word: w.toLowerCase(), from: b.pos + off, to: b.pos + off + w.length });
    }
  }
  for (let i = 0; i < firsts.length; ) {
    let j = i;
    while (j + 1 < firsts.length && firsts[j + 1].word === firsts[i].word) j++;
    if (j - i + 1 >= 3) starts.push({ word: firsts[i].word, count: j - i + 1, at: { from: firsts[i].from, to: firsts[j].to } });
    i = j + 1;
  }

  // Adverbes en -ment
  const adv = new Map<string, number>();
  for (const t of tokens) {
    const w = t.word.toLowerCase();
    if (w.length > 6 && w.endsWith("ment") && !NOT_ADVERBS.has(w)) adv.set(w, (adv.get(w) ?? 0) + 1);
  }
  const adverbs = [...adv.entries()].map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count);

  return { groups, top, starts, adverbs, totalWords: tokens.length };
}
