import type { Editor } from "@tiptap/react";
import { useStore } from "./store";

/** Éditeurs actuellement montés, par volet. Permet aux raccourcis et à la palette d'agir sur le texte. */
const editors = new Map<number, Editor>();
const flushers = new Map<number, () => Promise<void>>();

export const registerEditor = (pane: number, ed: Editor | null, flush: () => Promise<void>) => {
  if (ed) {
    editors.set(pane, ed);
    flushers.set(pane, flush);
  }
};
export const unregisterEditor = (pane: number) => {
  editors.delete(pane);
  flushers.delete(pane);
};
export const activeEditor = (): Editor | undefined => editors.get(useStore.getState().activePane);
/** Force l'écriture sur disque du texte en cours dans tous les volets. */
export const flushEditor = async () => {
  await Promise.all([...flushers.values()].map((f) => f()));
};
export const RELOAD_EVENT = "plumier:reload";
