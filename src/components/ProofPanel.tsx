import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { useStore } from "../store";

/** Serveurs LanguageTool proposés. Le local garde le texte sur le PC. */
const SERVERS = [
  { id: "local", label: "Local (localhost:8081)", url: "http://localhost:8081/v2/check" },
  { id: "public", label: "Service en ligne languagetool.org", url: "https://api.languagetool.org/v2/check" },
];

interface Issue {
  id: number;
  block: number;
  start: number; // décalage dans le bloc
  length: number;
  original: string;
  message: string;
  type: string;
  rule: string;
  replacements: string[];
}

interface Block { text: string; pos: number }

function blocksOf(editor: Editor): Block[] {
  const out: Block[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.isTextblock) {
      out.push({ text: node.textBetween(0, node.content.size, "\n", "\n"), pos: pos + 1 });
      return false;
    }
  });
  return out;
}

export function ProofPanel({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const { project, updateProject, setToast } = useStore();
  const [server, setServer] = useState(() => localStorage.getItem("plumier-lt") ?? "local");
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!project) return null;

  const dict = new Set(project.dictionary.map((w) => w.toLowerCase()));
  const url = SERVERS.find((s) => s.id === server)!.url;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const blocks = blocksOf(editor);
      const starts: number[] = [];
      let acc = 0;
      blocks.forEach((b) => { starts.push(acc); acc += b.text.length + 2; });
      const text = blocks.map((b) => b.text).join("\n\n");
      if (!text.trim()) { setIssues([]); return; }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ text, language: "fr", level: "default" }),
      });
      if (!res.ok) throw new Error(`Le serveur a répondu ${res.status}.`);
      const data = await res.json();

      const found: Issue[] = [];
      for (const m of data.matches ?? []) {
        let b = 0;
        starts.forEach((st, idx) => { if (st <= m.offset) b = idx; });
        const original = text.slice(m.offset, m.offset + m.length);
        if (m.rule?.issueType === "misspelling" && dict.has(original.toLowerCase())) continue;
        found.push({
          id: found.length,
          block: b,
          start: m.offset - starts[b],
          length: m.length,
          original,
          message: m.message,
          type: m.rule?.issueType ?? "",
          rule: m.rule?.id ?? "",
          replacements: (m.replacements ?? []).slice(0, 4).map((r: { value: string }) => r.value),
        });
      }
      setIssues(found);
    } catch (e) {
      setIssues(null);
      setError(
        server === "local"
          ? "Impossible de joindre LanguageTool en local. Lance-le avec :\njava -cp languagetool-server.jar org.languagetool.server.HTTPServer --port 8081 --allow-origin \"*\"\n(ou choisis le service en ligne ci-dessus)."
          : "Impossible de joindre le service : " + String((e as Error).message ?? e),
      );
    } finally {
      setBusy(false);
    }
  };

  /** Retrouve la position réelle de l'erreur dans le document actuel (qui a pu changer). */
  const locate = (i: Issue): { from: number; to: number } | null => {
    const blocks = blocksOf(editor);
    const b = blocks[i.block];
    if (!b) return null;
    let s = i.start;
    if (b.text.slice(s, s + i.length) !== i.original) {
      s = b.text.indexOf(i.original);
      if (s < 0) return null;
    }
    return { from: b.pos + s, to: b.pos + s + i.length };
  };

  const drop = (i: Issue, delta = 0) =>
    setIssues((list) =>
      (list ?? [])
        .filter((x) => x.id !== i.id)
        .map((x) => (delta && x.block === i.block && x.start > i.start ? { ...x, start: x.start + delta } : x)),
    );

  const goTo = (i: Issue) => {
    const r = locate(i);
    if (!r) return setToast("Ce passage a changé : relance la vérification.");
    editor.chain().focus().setTextSelection(r).scrollIntoView().run();
  };

  const apply = (i: Issue, value: string) => {
    const r = locate(i);
    if (!r) return setToast("Ce passage a changé : relance la vérification.");
    editor.view.dispatch(editor.state.tr.insertText(value, r.from, r.to));
    drop(i, value.length - i.length);
  };

  const addWord = (i: Issue) => {
    updateProject({ dictionary: [...project.dictionary, i.original] });
    setIssues((list) => (list ?? []).filter((x) => x.original.toLowerCase() !== i.original.toLowerCase()));
  };

  const icon = (t: string) => (t === "misspelling" ? "🔴" : t === "grammar" ? "🟠" : t === "style" ? "🔵" : "🟡");

  return (
    <aside className="proof">
      <div className="proof-head">
        <b>Correction</b>
        <button onClick={onClose} title="Fermer">✕</button>
      </div>
      <select value={server} onChange={(e) => { setServer(e.target.value); localStorage.setItem("plumier-lt", e.target.value); }}>
        {SERVERS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      {server === "public" && <p className="warn">⚠ Le texte de la scène est envoyé à un service tiers pour être analysé.</p>}
      <button className="primary" disabled={busy} onClick={run}>{busy ? "Analyse…" : "Vérifier la scène"}</button>
      {error && <pre className="proof-error">{error}</pre>}
      {issues && issues.length === 0 && <p className="muted">✓ Aucun problème détecté.</p>}
      {issues && issues.length > 0 && <p className="muted">{issues.length} remarque{issues.length > 1 ? "s" : ""}</p>}
      <div className="issues">
        {issues?.map((i) => (
          <div key={i.id} className="issue">
            <div className="issue-top" onClick={() => goTo(i)}>
              <span>{icon(i.type)}</span>
              <b>{i.original || "…"}</b>
            </div>
            <div className="issue-msg">{i.message}</div>
            <div className="issue-actions">
              {i.replacements.map((r) => <button key={r} onClick={() => apply(i, r)}>{r === "" ? "(supprimer)" : r}</button>)}
              <button className="ghost" onClick={() => drop(i)}>Ignorer</button>
              {i.type === "misspelling" && <button className="ghost" onClick={() => addWord(i)}>Ajouter au dictionnaire</button>}
            </div>
          </div>
        ))}
      </div>
      {project.dictionary.length > 0 && (
        <details className="dict">
          <summary>Dictionnaire personnel ({project.dictionary.length})</summary>
          {project.dictionary.map((w) => (
            <span key={w} className="chip">{w} <a onClick={() => updateProject({ dictionary: project.dictionary.filter((x) => x !== w) })}>×</a></span>
          ))}
        </details>
      )}
    </aside>
  );
}
