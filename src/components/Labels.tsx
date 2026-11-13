import { useState } from "react";
import { useStore } from "../store";
import { uid } from "../tree";
import type { Label } from "../types";

/** Pastilles colorées d'un élément (lecture seule). */
export function LabelDots({ ids, max = 4 }: { ids: string[]; max?: number }) {
  const labels = useStore((s) => s.project?.labels ?? []);
  const shown = ids.map((id) => labels.find((l) => l.id === id)).filter(Boolean) as Label[];
  return (
    <>
      {shown.slice(0, max).map((l) => (
        <span key={l.id} className="ldot" title={l.name} style={{ background: l.color }} />
      ))}
    </>
  );
}

/** Étiquettes en texte, pour les cartes. */
export function LabelChips({ ids }: { ids: string[] }) {
  const labels = useStore((s) => s.project?.labels ?? []);
  const shown = ids.map((id) => labels.find((l) => l.id === id)).filter(Boolean) as Label[];
  if (!shown.length) return null;
  return (
    <div className="chips">
      {shown.map((l) => (
        <span key={l.id} className="chip on" style={{ background: l.color, borderColor: l.color }}>{l.name}</span>
      ))}
    </div>
  );
}

/** Sélecteur d'étiquettes + gestion (renommer, couleur, supprimer, créer). */
export function LabelPicker({ ids, onChange }: { ids: string[]; onChange: (ids: string[]) => void }) {
  const { project, updateProject, deleteLabel } = useStore();
  const [manage, setManage] = useState(false);
  if (!project) return null;
  const labels = project.labels;
  const toggle = (id: string) => onChange(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  const patch = (id: string, p: Partial<Label>) => updateProject({ labels: labels.map((l) => (l.id === id ? { ...l, ...p } : l)) });

  return (
    <div>
      <div className="chips">
        {labels.map((l) => (
          <button key={l.id} className={`chip ${ids.includes(l.id) ? "on" : ""}`} style={ids.includes(l.id) ? { background: l.color, borderColor: l.color } : { borderColor: l.color }} onClick={() => toggle(l.id)}>
            {l.name}
          </button>
        ))}
        {labels.length === 0 && <span className="muted">Aucune étiquette.</span>}
      </div>
      <a className="small-link" onClick={() => setManage(!manage)}>{manage ? "Terminer" : "Gérer les étiquettes"}</a>
      {manage && (
        <div className="label-manage">
          {labels.map((l) => (
            <div key={l.id} className="label-row">
              <input type="color" value={l.color} onChange={(e) => patch(l.id, { color: e.target.value })} />
              <input value={l.name} onChange={(e) => patch(l.id, { name: e.target.value })} />
              <button title="Supprimer" onClick={() => confirm(`Supprimer l'étiquette « ${l.name} » ?`) && deleteLabel(l.id)}>🗑</button>
            </div>
          ))}
          <button onClick={() => updateProject({ labels: [...labels, { id: "l-" + uid(), name: "Nouvelle étiquette", color: "#3fa56b" }] })}>＋ Nouvelle étiquette</button>
        </div>
      )}
    </div>
  );
}
