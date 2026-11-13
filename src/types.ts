export type Status = "idee" | "brouillon" | "revise" | "final";

export const STATUSES: { value: Status; label: string; color: string }[] = [
  { value: "idee", label: "Idée", color: "#9aa0a6" },
  { value: "brouillon", label: "Brouillon", color: "#e0a030" },
  { value: "revise", label: "Révisé", color: "#4a90d9" },
  { value: "final", label: "Final", color: "#3fa56b" },
];

export type NodeKind = "folder" | "doc";
export type Section = "manuscript" | "notes";

export interface TreeNode {
  id: string;
  title: string;
  kind: NodeKind;
  synopsis: string;
  status: Status;
  words: number;
  children: TreeNode[];
}

export interface Project {
  version: 1;
  title: string;
  author: string;
  manuscript: TreeNode[];
  notes: TreeNode[];
  goals: { total: number; daily: number };
  /** mots écrits par jour (clé AAAA-MM-JJ) */
  daily: Record<string, number>;
}

export interface SnapshotInfo {
  name: string; // horodatage, sert aussi de nom de fichier
  label: string;
}
