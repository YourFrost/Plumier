import { useState } from "react";
import { useStore } from "../store";
import { STRUCTURES } from "../structures";
import { newNode, sectionWords } from "../tree";

export function TemplatesDialog() {
  const { project, setModal, replaceTrees, setToast, setView } = useStore();
  const [id, setId] = useState(STRUCTURES[0].id);
  const empty = !!project && sectionWords(project.manuscript) === 0;
  const [replace, setReplace] = useState(empty);
  if (!project) return null;
  const st = STRUCTURES.find((s) => s.id === id)!;
  const steps = st.acts.reduce((n, a) => n + a.steps.length, 0);

  const apply = () => {
    const folders = st.acts.map((act) => {
      const f = newNode("folder", act.title);
      f.children = act.steps.map((step) => {
        const n = newNode("doc", step.title);
        n.synopsis = step.hint;
        n.status = "idee";
        return n;
      });
      return f;
    });
    replaceTrees({ manuscript: replace ? folders : [...project.manuscript, ...folders] });
    setModal(null);
    setView("corkboard");
    setToast(`Structure « ${st.name} » ajoutée : ${steps} scènes à écrire.`);
  };

  return (
    <div className="modal-back" onClick={() => setModal(null)}>
      <div className="modal templates" onClick={(e) => e.stopPropagation()}>
        <div className="tpl-list">
          <h2>Modèles de structure</h2>
          {STRUCTURES.map((s) => (
            <button key={s.id} className={s.id === id ? "active" : ""} onClick={() => setId(s.id)}>
              <b>{s.name}</b>
              <small>{s.blurb}</small>
            </button>
          ))}
        </div>
        <div className="tpl-preview">
          <h3>{st.name}</h3>
          <p className="muted">{st.blurb} Chaque étape devient une scène au statut « Idée » avec une consigne dans le résumé : tu n'as plus qu'à les remplir et les déplacer.</p>
          {st.acts.map((a) => (
            <div key={a.title} className="tpl-act">
              <b>📁 {a.title}</b>
              {a.steps.map((s) => <div key={s.title} className="tpl-step">📄 {s.title}{s.hint && <small> — {s.hint}</small>}</div>)}
            </div>
          ))}
          <label className="check"><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} /> Remplacer le manuscrit actuel{empty ? " (vide)" : " (⚠ retire l'arborescence actuelle du classeur)"}</label>
          <div className="modal-actions">
            <button onClick={() => setModal(null)}>Annuler</button>
            <button className="primary" onClick={apply}>Ajouter {steps} scènes</button>
          </div>
        </div>
      </div>
    </div>
  );
}
