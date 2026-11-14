import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor as TipTapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { Markdown } from "tiptap-markdown";
import { useStore, nodeById } from "../store";
import { storage } from "../storage";
import { FrenchTypography, setTypoEnabled, typoEnabled } from "../frenchTypo";
import { Comment, Footnote, MentionSuggest, RepetitionHighlight, Typewriter } from "../extensions";
import { registerEditor, unregisterEditor, RELOAD_EVENT } from "../editorRegistry";
import { countWords } from "../tree";
import { SidePanel } from "./SidePanel";

export { flushEditor, RELOAD_EVENT } from "../editorRegistry";

const getMd = (e: TipTapEditor): string => e.storage.markdown.getMarkdown();
const getWords = (e: TipTapEditor): number => e.storage.characterCount.words();

export function Editor({ pane }: { pane: 0 | 1 }) {
  const node = useStore((s) => nodeById(s, s.paneIds[pane]));
  const dir = useStore((s) => s.dir);
  const updateNode = useStore((s) => s.updateNode);
  const section = useStore((s) => s.section);
  const typewriter = useStore((s) => s.typewriter);
  const panel = useStore((s) => s.sidePanel[pane]);
  const setSidePanel = useStore((s) => s.setSidePanel);
  const toggleTypewriter = useStore((s) => s.toggleTypewriter);

  const loaded = useRef<string | null>(null); // id du document actuellement dans l'éditeur
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const dirty = useRef(false);
  const [typo, setTypo] = useState(typoEnabled());

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Il était une fois…" }),
      CharacterCount,
      FrenchTypography,
      Comment,
      Footnote,
      Typewriter,
      RepetitionHighlight,
      MentionSuggest,
      Markdown.configure({ html: true, transformPastedText: true, breaks: false }),
    ],
    editorProps: { attributes: { spellcheck: "true", lang: "fr" } },
    onUpdate: () => {
      if (!loaded.current) return;
      dirty.current = true;
      useStore.setState({ saveState: "saving" });
      clearTimeout(timer.current);
      timer.current = setTimeout(save, 700);
    },
    onSelectionUpdate: ({ editor }) => {
      if (useStore.getState().activePane !== pane) return;
      const { from, to, empty } = editor.state.selection;
      useStore.setState({ selWords: empty ? 0 : countWords(editor.state.doc.textBetween(from, to, " ")) });
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

  useEffect(() => {
    registerEditor(pane, editor, save);
  });
  useEffect(() => () => unregisterEditor(pane), [pane]);

  // Chargement du document affiché dans ce volet
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
    const h = async (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (!editor || !dir || !node || (id && id !== node.id)) return;
      dirty.current = false;
      editor.commands.setContent(await storage.readDoc(dir, node.id), false);
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

  if (!node || node.kind !== "doc") {
    return (
      <div className="placeholder-page">
        <p>Sélectionne une {section === "manuscript" ? "scène" : "fiche"} dans le classeur, ou crées-en une.</p>
      </div>
    );
  }

  const btn = (label: string, title: string, active: boolean, run: () => void) => (
    <button className={active ? "on" : ""} title={title} onMouseDown={(e) => { e.preventDefault(); run(); }}>
      {label}
    </button>
  );
  const c = () => editor!.chain().focus();
  const openTab = (tab: "proof" | "repeat" | "notes") => setSidePanel(pane, panel === tab ? null : tab);

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
          {btn("Note ⁿ", "Note de bas de page (Ctrl+Alt+F)", false, () => { c().insertContent({ type: "footnote", attrs: { text: "" } }).run(); setSidePanel(pane, "notes"); })}
          {btn("💬", "Commentaire sur la sélection (Ctrl+Alt+M)", editor.isActive("comment"), () => { if (!editor.state.selection.empty) { c().setMark("comment", { text: "" }).run(); setSidePanel(pane, "notes"); } else useStore.getState().setToast("Sélectionne d'abord un passage à commenter."); })}
          <span className="sep" />
          {btn(typo ? "FR ✓" : "FR", "Typographie française automatique", typo, () => { setTypoEnabled(!typo); setTypo(!typo); })}
          {btn("⌨", "Mode machine à écrire (Ctrl+Alt+T)", typewriter, toggleTypewriter)}
          <span className="sep" />
          {btn("✓ Correction", "Grammaire et orthographe (F7)", panel === "proof", () => openTab("proof"))}
          {btn("🔁 Répétitions", "Vérifier les répétitions (F8)", panel === "repeat", () => openTab("repeat"))}
          {btn("📝 Notes", "Notes et commentaires (F9)", panel === "notes", () => openTab("notes"))}
          <span className="spacer" />
          {btn("↶", "Annuler (Ctrl+Z)", false, () => c().undo().run())}
          {btn("↷", "Rétablir (Ctrl+Y)", false, () => c().redo().run())}
        </div>
      )}
      <div className="editor-row">
        <div className={`page-scroll ${typewriter ? "typewriter" : ""}`}>
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
        {panel && editor && <SidePanel editor={editor} tab={panel} onTab={(t) => setSidePanel(pane, t)} onClose={() => setSidePanel(pane, null)} />}
      </div>
    </div>
  );
}
