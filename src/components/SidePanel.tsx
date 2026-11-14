import { useEffect, useMemo, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { Mark } from "@tiptap/pm/model";
import { useStore, type PanelTab } from "../store";
import { blocksOf } from "../editorUtils";
import { analyse } from "../repetitions";
import { setRepetitions } from "../extensions";
import { ProofTab } from "./ProofPanel";

const TABS: { id: PanelTab; label: string }[] = [
  { id: "proof", label: "Correction" },
  { id: "repeat", label: "Répétitions" },
  { id: "notes", label: "Notes" },
];

export function SidePanel({ editor, tab, onTab, onClose }: { editor: Editor; tab: PanelTab; onTab: (t: PanelTab) => void; onClose: () => void }) {
  return (
    <aside className="proof">
      <div className="proof-head">
        <div className="seg small">
          {TABS.map((t) => <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => onTab(t.id)}>{t.label}</button>)}
        </div>
        <button onClick={onClose} title="Fermer le panneau">✕</button>
      </div>
      {tab === "proof" && <ProofTab editor={editor} />}
      {tab === "repeat" && <RepeatTab editor={editor} />}
      {tab === "notes" && <NotesTab editor={editor} />}
    </aside>
  );
}

/** Se redessine à chaque modification du document. */
function useDocVersion(editor: Editor): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    const h = () => setV((x) => x + 1);
    editor.on("update", h);
    return () => { editor.off("update", h); };
  }, [editor]);
  return v;
}

/* ------------------------------ Répétitions ------------------------------ */
function RepeatTab({ editor }: { editor: Editor }) {
  const { project, updateProject } = useStore();
  const version = useDocVersion(editor);
  const [windowWords, setWindowWords] = useState(60);
  const [minLength, setMinLength] = useState(4);
  const [active, setActive] = useState<string | null>(null);
  const ignored = project?.ignoredRepeats ?? [];

  const result = useMemo(
    () => analyse(blocksOf(editor), { windowWords, minLength, ignored }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, version, windowWords, minLength, ignored.join("|")],
  );

  useEffect(() => () => setRepetitions(editor, null), [editor]);
  useEffect(() => {
    if (active === "__all") setRepetitions(editor, result.groups.flatMap((g) => g.occurrences));
    else if (active) {
      const g = result.groups.find((x) => x.key === active);
      setRepetitions(editor, g ? g.occurrences : null);
    } else setRepetitions(editor, null);
  }, [active, result, editor]);

  const go = (from: number, to: number) => editor.chain().focus().setTextSelection({ from, to }).scrollIntoView().run();

  return (
    <div className="tab-body">
      <div className="row2">
        <label>Fenêtre
          <select value={windowWords} onChange={(e) => setWindowWords(+e.target.value)}>
            {[20, 40, 60, 100, 200].map((n) => <option key={n} value={n}>{n} mots</option>)}
          </select>
        </label>
        <label>Mots d'au moins
          <select value={minLength} onChange={(e) => setMinLength(+e.target.value)}>
            {[3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} lettres</option>)}
          </select>
        </label>
      </div>
      <button className={active === "__all" ? "on" : ""} onClick={() => setActive(active === "__all" ? null : "__all")}>
        {active === "__all" ? "Masquer le surlignage" : "Tout surligner dans le texte"}
      </button>

      <h4>Répétitions rapprochées <small>({result.groups.length})</small></h4>
      {result.groups.length === 0 && <p className="muted">✓ Aucune répétition dans une fenêtre de {windowWords} mots.</p>}
      {result.groups.map((g, i) => (
        <div key={g.key + i} className={`rep-item ${active === g.key ? "on" : ""}`}>
          <a onClick={() => { setActive(g.key); go(g.occurrences[0].from, g.occurrences[0].to); }}>
            <b>{g.word}</b> <span>×{g.count}</span> <small>en {g.span} mots</small>
          </a>
          <button className="ghost" title="Ne plus signaler ce mot" onClick={() => updateProject({ ignoredRepeats: [...ignored, g.word] })}>Ignorer</button>
        </div>
      ))}

      {result.starts.length > 0 && (
        <>
          <h4>Débuts de phrases identiques</h4>
          {result.starts.map((s, i) => (
            <div key={i} className="rep-item"><a onClick={() => go(s.at.from, s.at.to)}><b>{s.word}</b> <span>×{s.count} de suite</span></a></div>
          ))}
        </>
      )}

      {result.top.length > 0 && (
        <>
          <h4>Mots les plus employés</h4>
          <div className="chips">{result.top.map((t) => <span key={t.word} className="chip">{t.word} · {t.count}</span>)}</div>
        </>
      )}

      {result.adverbs.length > 0 && (
        <>
          <h4>Adverbes en « -ment » <small>({result.adverbs.reduce((a, x) => a + x.count, 0)})</small></h4>
          <div className="chips">{result.adverbs.slice(0, 14).map((t) => <span key={t.word} className="chip">{t.word}{t.count > 1 ? ` · ${t.count}` : ""}</span>)}</div>
        </>
      )}

      {ignored.length > 0 && (
        <details className="dict">
          <summary>Mots ignorés ({ignored.length})</summary>
          {ignored.map((w) => (
            <span key={w} className="chip">{w} <a onClick={() => updateProject({ ignoredRepeats: ignored.filter((x) => x !== w) })}>×</a></span>
          ))}
        </details>
      )}
    </div>
  );
}

/* --------------------------- Notes et commentaires --------------------------- */
interface Fn { pos: number; text: string; context: string }
interface Cm { from: number; to: number; text: string; quote: string; mark: Mark }

function collect(editor: Editor): { fns: Fn[]; cms: Cm[] } {
  const fns: Fn[] = [];
  const cms: Cm[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "footnote") {
      const ctx = editor.state.doc.textBetween(Math.max(0, pos - 40), pos, " ", " ");
      fns.push({ pos, text: node.attrs.text, context: "…" + ctx.slice(-40) });
    }
    if (node.isInline) {
      for (const m of node.marks) {
        if (m.type.name !== "comment") continue;
        const last = cms[cms.length - 1];
        if (last && last.mark === m && last.to === pos) { last.to = pos + node.nodeSize; last.quote += node.text ?? ""; }
        else cms.push({ from: pos, to: pos + node.nodeSize, text: m.attrs.text, quote: node.text ?? "", mark: m });
      }
    }
  });
  return { fns, cms };
}

function NotesTab({ editor }: { editor: Editor }) {
  useDocVersion(editor);
  const { fns, cms } = collect(editor);

  const setFootnote = (pos: number, text: string) => editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { text }));
  const delFootnote = (pos: number) => editor.view.dispatch(editor.state.tr.delete(pos, pos + 1));
  const setComment = (c: Cm, text: string) => {
    const type = editor.schema.marks.comment;
    editor.view.dispatch(editor.state.tr.removeMark(c.from, c.to, c.mark).addMark(c.from, c.to, type.create({ text })));
  };
  const delComment = (c: Cm) => editor.view.dispatch(editor.state.tr.removeMark(c.from, c.to, c.mark));
  const firstEmpty = fns.findIndex((f) => !f.text);
  const firstEmptyCm = cms.findIndex((c) => !c.text);

  return (
    <div className="tab-body">
      <h4>Notes de bas de page <small>({fns.length})</small></h4>
      {fns.length === 0 && <p className="muted">Aucune. Place le curseur dans le texte puis clique sur « Note ⁿ ».</p>}
      {fns.map((f, i) => (
        <div key={f.pos} className="note-item">
          <div className="note-top">
            <a onClick={() => editor.chain().focus().setNodeSelection(f.pos).scrollIntoView().run()}><b>{i + 1}</b> <small>{f.context}</small></a>
            <button className="ghost" onClick={() => delFootnote(f.pos)} title="Supprimer">🗑</button>
          </div>
          <textarea rows={2} autoFocus={i === firstEmpty && cms.length === 0 || (i === firstEmpty && firstEmptyCm < 0)} value={f.text} placeholder="Texte de la note…" onChange={(e) => setFootnote(f.pos, e.target.value)} />
        </div>
      ))}
      <h4>Commentaires <small>({cms.length})</small></h4>
      {cms.length === 0 && <p className="muted">Aucun. Sélectionne un passage puis clique sur 💬.</p>}
      {cms.map((c, i) => (
        <div key={`${c.from}-${c.to}`} className="note-item cm-item">
          <div className="note-top">
            <a onClick={() => editor.chain().focus().setTextSelection({ from: c.from, to: c.to }).scrollIntoView().run()}>« {c.quote.length > 50 ? c.quote.slice(0, 50) + "…" : c.quote} »</a>
            <button className="ghost" onClick={() => delComment(c)} title="Supprimer le commentaire">🗑</button>
          </div>
          <textarea rows={2} autoFocus={i === firstEmptyCm && fns.every((f) => f.text)} value={c.text} placeholder="Ton commentaire…" onChange={(e) => setComment(c, e.target.value)} />
        </div>
      ))}
      <p className="muted small">Les commentaires ne sont jamais exportés. Les notes de bas de page le sont (Word, EPUB, PDF).</p>
    </div>
  );
}
