import { useEffect, useRef, useState } from "react";
import { useStore } from "./store";
import { storage } from "./storage";
import { countMentions, namesOf } from "./mentions";
import { flatten } from "./tree";
import type { TreeNode } from "./types";

export interface Fiche { node: TreeNode; category: string }
export interface Presence {
  ready: boolean;
  scenes: TreeNode[];
  /** Chapitre (dossier parent) de chaque scène */
  chapterOf: Map<string, string>;
  fiches: Fiche[];
  /** fiche → scène → nombre d'occurrences */
  counts: Map<string, Map<string, number>>;
}

const EMPTY: Presence = { ready: false, scenes: [], chapterOf: new Map(), fiches: [], counts: new Map() };

/** Liste à plat des fiches (documents) avec leur catégorie (dossier parent). */
export function ficheList(notes: TreeNode[]): Fiche[] {
  const out: Fiche[] = [];
  const walk = (nodes: TreeNode[], cat: string) => nodes.forEach((n) => (n.kind === "folder" ? walk(n.children, n.title) : out.push({ node: n, category: cat })));
  walk(notes, "");
  return out;
}

/**
 * Présence des fiches dans les scènes : lit tous les textes du manuscrit et compte les mentions
 * (nom + alias). Recalculé, avec un léger délai, quand le texte ou les noms changent.
 */
export function usePresence(): Presence {
  const project = useStore((s) => s.project);
  const dir = useStore((s) => s.dir);
  const [res, setRes] = useState<Presence>(EMPTY);
  const cache = useRef(new Map<string, string>());

  const key = project
    ? flatten(project.manuscript).map((n) => n.id + ":" + n.words).join(",") +
      "|" + flatten(project.notes).map((n) => n.id + n.title + n.aliases.join("/")).join(",")
    : "";

  useEffect(() => {
    if (!project || !dir) return;
    let stop = false;
    const t = setTimeout(async () => {
      const scenes: TreeNode[] = [];
      const chapterOf = new Map<string, string>();
      const walk = (nodes: TreeNode[], chapter: string) =>
        nodes.forEach((n) => {
          if (n.kind === "folder") return walk(n.children, n.title);
          scenes.push(n);
          chapterOf.set(n.id, chapter);
        });
      walk(project.manuscript, "");
      const fiches = ficheList(project.notes);
      const counts = new Map<string, Map<string, number>>(fiches.map((f) => [f.node.id, new Map()]));
      for (const sc of scenes) {
        const ck = sc.id + ":" + sc.words;
        let text = cache.current.get(ck);
        if (text === undefined) { text = await storage.readDoc(dir, sc.id); cache.current.set(ck, text); }
        for (const f of fiches) {
          const c = countMentions(text, namesOf(f.node));
          if (c) counts.get(f.node.id)!.set(sc.id, c);
        }
      }
      if (!stop) setRes({ ready: true, scenes, chapterOf, fiches, counts });
    }, 350);
    return () => { stop = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, dir]);

  return res;
}
