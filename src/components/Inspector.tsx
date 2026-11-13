import { useEffect, useState } from "react";
import { useStore, selectedNode } from "../store";
import { storage } from "../storage";
import { STATUSES, type SnapshotInfo, type Status } from "../types";
import { flushEditor, RELOAD_EVENT } from "./Editor";
import { sectionWords, today } from "../tree";

export function Inspector() {
  const node = useStore(selectedNode);
  const { project, dir, section, updateNode, updateProject, setToast } = useStore();
  const [snaps, setSnaps] = useState<SnapshotInfo[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [preview, setPreview] = useState("");

  const refresh = async () => {
    if (dir && node?.kind === "doc") setSnaps(await storage.listSnapshots(dir, node.id));
    else setSnaps([]);
  };
  useEffect(() => {
    setOpen(null);
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id, dir]);

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
