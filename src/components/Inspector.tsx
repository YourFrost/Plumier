import { useEffect, useState } from "react";
import { useStore, selectedNode } from "../store";
import { storage } from "../storage";
import { STATUSES, type SnapshotInfo, type Status, type TreeNode } from "../types";
import { flushEditor, RELOAD_EVENT } from "./Editor";
import { flatten, sectionWords, today } from "../tree";
import { countMentions, namesOf } from "../mentions";
import { LabelPicker } from "./Labels";

export function Inspector() {
  const node = useStore(selectedNode);
  const { project, dir, section, updateNode, updateProject, setToast } = useStore();
  const [snaps, setSnaps] = useState<SnapshotInfo[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [preview, setPreview] = useState("");
  const [links, setLinks] = useState<{ node: TreeNode; where: string; count: number }[]>([]);

  const refresh = async () => {
    if (dir && node?.kind === "doc") setSnaps(await storage.listSnapshots(dir, node.id));
    else setSnaps([]);
  };
  useEffect(() => {
    setOpen(null);
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id, dir]);

  // Liens fiches ↔ scènes : détectés automatiquement par les noms et alias.
  const notesKey = project ? flatten(project.notes).map((n) => n.id + n.title + n.aliases.join()).join("|") : "";
  useEffect(() => {
    if (!project || !dir || !node || node.kind !== "doc") { setLinks([]); return; }
    let stop = false;
    const t = setTimeout(async () => {
      const out: typeof links = [];
      if (section === "notes") {
        const names = namesOf(node);
        for (const sc of flatten(project.manuscript).filter((n) => n.kind === "doc")) {
          const c = countMentions(await storage.readDoc(dir, sc.id), names);
          if (c) out.push({ node: sc, where: "Manuscrit", count: c });
        }
      } else {
        const text = await storage.readDoc(dir, node.id);
        for (const f of flatten(project.notes).filter((n) => n.kind === "doc")) {
          const c = countMentions(text, namesOf(f));
          if (c) out.push({ node: f, where: "Fiches", count: c });
        }
      }
      if (!stop) setLinks(out.sort((a, b) => b.count - a.count));
    }, 500);
    return () => { stop = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id, node?.words, node?.title, node?.aliases.join(), section, dir, notesKey]);

  if (!project || !dir) return null;
  const total = sectionWords(project.manuscript);
  const todayWords = project.daily[today()] ?? 0;
  const pct = (a: number, b: number) => Math.min(100, b > 0 ? Math.round((a / b) * 100) : 0);

  return (
    <aside className="inspector">
      <h3>Objectifs</h3>
      <div className="goal">
        <div className="goal-line">
          <span>Aujourd'hui</span>
          <span>{todayWords.toLocaleString("fr-FR")} / <input type="number" min={0} value={project.goals.daily} onChange={(e) => updateProject({ goals: { ...project.goals, daily: +e.target.value } })} /></span>
        </div>
        <div className="bar"><div style={{ width: pct(todayWords, project.goals.daily) + "%" }} /></div>
      </div>
      <div className="goal">
        <div className="goal-line">
          <span>Livre</span>
          <span>{total.toLocaleString("fr-FR")} / <input type="number" min={0} step={1000} value={project.goals.total} onChange={(e) => updateProject({ goals: { ...project.goals, total: +e.target.value } })} /></span>
        </div>
        <div className="bar"><div style={{ width: pct(total, project.goals.total) + "%" }} /></div>
        <div className="goal-line" style={{ marginTop: 4 }}>
          <span className="muted">Date limite</span>
          <input type="date" style={{ width: 130 }} value={project.goals.deadline} onChange={(e) => updateProject({ goals: { ...project.goals, deadline: e.target.value } })} />
        </div>
      </div>

      {node ? (
        <>
          <h3>{node.kind === "folder" ? "Dossier" : section === "notes" ? "Fiche" : "Scène"}</h3>
          <label>Résumé</label>
          <textarea
            rows={5}
            value={node.synopsis}
            placeholder="En deux ou trois phrases : que se passe-t-il ?"
            onChange={(e) => updateNode(node.id, { synopsis: e.target.value })}
          />
          <label>Statut</label>
          <select value={node.status} onChange={(e) => updateNode(node.id, { status: e.target.value as Status })}>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <p className="muted">{node.words.toLocaleString("fr-FR")} mots</p>

          <label>Étiquettes</label>
          <LabelPicker ids={node.labels} onChange={(labels) => updateNode(node.id, { labels })} />

          {section === "notes" && node.kind === "doc" && (
            <>
              <label>Autres noms (séparés par des virgules)</label>
              <input
                defaultValue={node.aliases.join(", ")}
                key={node.id}
                placeholder="surnom, titre, nom de famille…"
                onBlur={(e) => updateNode(node.id, { aliases: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })}
              />
            </>
          )}

          {section === "manuscript" && node.kind === "doc" && (
            <>
              <label>Dans l'histoire</label>
              <div className="two">
                <input type="date" value={node.date} onChange={(e) => updateNode(node.id, { date: e.target.value })} />
                <input placeholder="moment (matin, Jour 3…)" value={node.moment} onChange={(e) => updateNode(node.id, { moment: e.target.value })} />
              </div>
            </>
          )}

          {node.kind === "doc" && (
            <>
              <h3>{section === "notes" ? "Apparaît dans" : "Présents dans la scène"}</h3>
              <ul className="links">
                {links.length === 0 && <li className="muted">{section === "notes" ? "Nom non trouvé dans le manuscrit." : "Aucune fiche détectée."}</li>}
                {links.map((l) => (
                  <li key={l.node.id}>
                    <a onClick={() => useStore.getState().select(l.node.id)}>{l.node.title}</a>
                    <small>{l.count}×</small>
                  </li>
                ))}
              </ul>
            </>
          )}

          {node.kind === "doc" && (
            <>
              <h3>Instantanés</h3>
              <button
                onClick={async () => {
                  await flushEditor();
                  const md = await storage.readDoc(dir, node.id);
                  await storage.saveSnapshot(dir, node.id, md);
                  await refresh();
                  setToast("Instantané enregistré.");
                }}
              >
                📸 Prendre un instantané
              </button>
              <ul className="snaps">
                {snaps.length === 0 && <li className="muted">Aucun instantané.</li>}
                {snaps.map((s) => (
                  <li key={s.name}>
                    <a
                      onClick={async () => {
                        if (open === s.name) return setOpen(null);
                        setOpen(s.name);
                        setPreview(await storage.readSnapshot(dir, node.id, s.name));
                      }}
                    >
                      {s.label}
                    </a>
                    {open === s.name && (
                      <div className="snap-preview">
                        <pre>{preview.slice(0, 1200) || "(vide)"}{preview.length > 1200 ? "…" : ""}</pre>
                        <button
                          onClick={async () => {
                            if (!confirm("Restaurer cette version ? Le texte actuel sera d'abord sauvegardé dans un instantané.")) return;
                            await flushEditor();
                            await storage.saveSnapshot(dir, node.id, await storage.readDoc(dir, node.id));
                            await storage.writeDoc(dir, node.id, preview);
                            window.dispatchEvent(new Event(RELOAD_EVENT));
                            await refresh();
                            setToast("Version restaurée.");
                          }}
                        >
                          Restaurer
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      ) : (
        <p className="muted">Sélectionne un élément pour voir ses détails.</p>
      )}
    </aside>
  );
}
