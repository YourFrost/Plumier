import type { Project, Section, TreeNode } from "./types";

export const uid = () =>
  Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

export function newNode(kind: TreeNode["kind"], title: string): TreeNode {
  return { id: uid(), title, kind, synopsis: "", status: "brouillon", words: 0, children: [], aliases: [], labels: [], date: "", moment: "" };
}

export function find(nodes: TreeNode[], id: string): TreeNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    const r = find(n.children, id);
    if (r) return r;
  }
}

export function findParent(nodes: TreeNode[], id: string, parent: TreeNode | null = null): TreeNode | null | undefined {
  for (const n of nodes) {
    if (n.id === id) return parent;
    const r = findParent(n.children, id, n);
    if (r !== undefined) return r;
  }
  return undefined;
}

export function sectionOf(p: Project, id: string): Section | undefined {
  if (find(p.manuscript, id)) return "manuscript";
  if (find(p.notes, id)) return "notes";
}

export function mapNodes(nodes: TreeNode[], fn: (n: TreeNode) => TreeNode): TreeNode[] {
  return nodes.map((n) => {
    const m = fn(n);
    return { ...m, children: mapNodes(m.children, fn) };
  });
}

export function remove(nodes: TreeNode[], id: string): TreeNode[] {
  return nodes.filter((n) => n.id !== id).map((n) => ({ ...n, children: remove(n.children, id) }));
}

export function insert(nodes: TreeNode[], parentId: string | null, index: number, node: TreeNode): TreeNode[] {
  if (parentId === null) {
    const copy = [...nodes];
    copy.splice(Math.min(index, copy.length), 0, node);
    return copy;
  }
  return nodes.map((n) =>
    n.id === parentId
      ? (() => {
          const ch = [...n.children];
          ch.splice(Math.min(index, ch.length), 0, node);
          return { ...n, children: ch };
        })()
      : { ...n, children: insert(n.children, parentId, index, node) },
  );
}

export function isDescendant(node: TreeNode, id: string): boolean {
  return node.children.some((c) => c.id === id || isDescendant(c, id));
}

export function flatten(nodes: TreeNode[]): TreeNode[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children)]);
}

/** Somme des mots d'un nœud et de ses descendants. */
export function totalWords(n: TreeNode): number {
  return n.kind === "doc" ? n.words : n.children.reduce((s, c) => s + totalWords(c), 0) + n.words;
}

export function sectionWords(nodes: TreeNode[]): number {
  return nodes.reduce((s, n) => s + totalWords(n), 0);
}

export const today = () => new Date().toISOString().slice(0, 10);

export const DEFAULT_LABELS = [
  { id: "l-retravailler", name: "À retravailler", color: "#d9534f" },
  { id: "l-flashback", name: "Flashback", color: "#8e6bbf" },
  { id: "l-secondaire", name: "Intrigue secondaire", color: "#4a90d9" },
];

/** Complète un projet créé avec une version plus ancienne de Plumier. */
export function normalizeProject(p: Project): Project {
  const fix = (n: TreeNode): TreeNode => ({
    ...n,
    aliases: n.aliases ?? [],
    labels: n.labels ?? [],
    date: n.date ?? "",
    moment: n.moment ?? "",
    children: (n.children ?? []).map(fix),
  });
  return {
    ...p,
    manuscript: p.manuscript.map(fix),
    notes: p.notes.map(fix),
    goals: { ...p.goals, deadline: p.goals.deadline ?? "" },
    labels: p.labels ?? DEFAULT_LABELS,
    dictionary: p.dictionary ?? [],
    daily: p.daily ?? {},
  };
}
