import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor as TipTapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { Markdown } from "tiptap-markdown";
import { useStore, selectedNode } from "../store";
import { storage } from "../storage";
import { FrenchTypography, setTypoEnabled, typoEnabled } from "../frenchTypo";
import { ProofPanel } from "./ProofPanel";

/* Permet à d'autres composants (instantanés, export, recherche) de forcer l'écriture en cours. */
let flushNow: () => Promise<void> = async () => {};
export const flushEditor = () => flushNow();
export const RELOAD_EVENT = "plumier:reload";

const getMd = (e: TipTapEditor): string => e.storage.markdown.getMarkdown();
const getWords = (e: TipTapEditor): number => e.storage.characterCount.words();

export function Editor() {
  const node = useStore(selectedNode);
  const dir = useStore((s) => s.dir);
  const updateNode = useStore((s) => s.updateNode);
  const section = useStore((s) => s.section);

  const loaded = useRef<string | null>(null); // id du document actuellement dans l'éditeur
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const dirty = useRef(false);
  const [proof, setProof] = useState(false);
  const [typo, setTypo] = useState(typoEnabled());

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Il était une fois…" }),
      CharacterCount,
      FrenchTypography,
      Markdown.configure({ html: false, transformPastedText: true, breaks: false }),
    ],
    editorProps: { attributes: { spellcheck: "true", lang: "fr" } },
    onUpdate: () => {
      if (!loaded.current) return;
      dirty.current = true;
      useStore.setState({ saveState: "saving" });
      clearTimeout(timer.current);
      timer.current = setTimeout(save, 700);
    },
  });

  async function save() {
    clearTimeout(timer.current);
    const id = loaded.current;
    const d = useStore.getState().dir;
    if (!editor || !id || !d || !dirty.current) return;
    dirty.current = false;
    try {
      await storage.writeDoc(d, id, getMd(editor));
      useStore.getState().recordWords(id, getWords(editor));
    } catch (e) {
      useStore.setState({ saveState: "error", toast: "Échec de la sauvegarde : " + String(e) });
    }
  }
  flushNow = save;

  // Chargement du document sélectionné
  useEffect(() => {
    if (!editor || !dir) return;
    let cancelled = false;
    (async () => {
      await save(); // écrire l'ancien avant de changer
      loaded.current = null;
      if (!node || node.kind !== "doc") {
        editor.commands.clearContent(false);
        return;
      }
      const md = await storage.readDoc(dir, node.id);
      if (cancelled) return;
      editor.commands.setContent(md, false);
      loaded.current = node.id;
      dirty.current = false;
      if (getWords(editor) !== node.words) useStore.getState().recordWords(node.id, getWords(editor));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, dir, node?.id]);

  // Rechargement externe (restauration d'un instantané)
  useEffect(() => {
    const h = async () => {
      if (!editor || !dir || !node) return;
      dirty.current = false;
      const md = await storage.readDoc(dir, node.id);
      editor.commands.setContent(md, false);
      useStore.getState().recordWords(node.id, getWords(editor));
    };
    window.addEventListener(RELOAD_EVENT, h);
    return () => window.removeEventListener(RELOAD_EVENT, h);
  });

  useEffect(() => {
    const onHide = () => void save();
    window.addEventListener("beforeunload", onHide);
    return () => {
      window.removeEventListener("beforeunload", onHide);
      void save();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // Ctrl+S : forcer la sauvegarde
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save().then(() => useStore.setState({ saveState: "saved" }));
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  if (!node || node.kind !== "doc") {
    return (
      <div className="placeholder-page">
        <p>Sélectionne une {section === "manuscript" ? "scène" : "fiche"} dans le classeur, ou crée-en une.</p>
      </div>
    );
  }

  const btn = (label: string, title: string, active: boolean, run: () => void) => (
    <button className={active ? "on" : ""} title={title} onMouseDown={(e) => { e.preventDefault(); run(); }}>
      {label}
    </button>
  );
  const c = () => editor!.chain().focus();

  return (
    <div className="editor-wrap">
      {editor && (
        <div className="toolbar">
          {btn("G", "Gras (Ctrl+B)", editor.isActive("bold"), () => c().toggleBold().run())}
          {btn("I", "Italique (Ctrl+I)", editor.isActive("italic"), () => c().toggleItalic().run())}
          {btn("S", "Barré", editor.isActive("strike"), () => c().toggleStrike().run())}
          <span className="sep" />
          {btn("H1", "Titre", editor.isActive("heading", { level: 1 }), () => c().toggleHeading({ level: 1 }).run())}
          {btn("H2", "Sous-titre", editor.isActive("heading", { level: 2 }), () => c().toggleHeading({ level: 2 }).run())}
          <span className="sep" />
          {btn("❝", "Citation", editor.isActive("blockquote"), () => c().toggleBlockquote().run())}
          {btn("• —", "Liste à puces", editor.isActive("bulletList"), () => c().toggleBulletList().run())}
          {btn("1.", "Liste numérotée", editor.isActive("orderedList"), () => c().toggleOrderedList().run())}
          {btn("＊＊＊", "Séparateur de scène", false, () => c().setHorizontalRule().run())}
          <span className="sep" />
          {btn(typo ? "FR ✓" : "FR", "Typographie française automatique (guillemets, espaces insécables…)", typo, () => { setTypoEnabled(!typo); setTypo(!typo); })}
          {btn("✓ Correction", "Grammaire et orthographe (LanguageTool)", proof, () => setProof(!proof))}
          <span className="sep" />
          {btn("↶", "Annuler (Ctrl+Z)", false, () => c().undo().run())}
          {btn("↷", "Rétablir (Ctrl+Y)", false, () => c().redo().run())}
        </div>
      )}
      <div className="editor-row">
      <div className="page-scroll">
        <div className="page">
          <input
            className="doc-title"
            value={node.title}
            onChange={(e) => updateNode(node.id, { title: e.target.value })}
            placeholder="Titre"
          />
          <EditorContent editor={editor} />
        </div>
      </div>
      {proof && editor && <ProofPanel editor={editor} onClose={() => setProof(false)} />}
      </div>
    </div>
  );
}

export function useLiveWords(): number {
  const node = useStore(selectedNode);
  return node?.words ?? 0;
}
