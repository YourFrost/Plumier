import { useState } from "react";
import { useStore } from "../store";
import { recentProjects } from "../storage";

export function Welcome() {
  const { createProject, openProject } = useStore();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const recent = recentProjects();

  return (
    <div className="welcome">
      <div className="welcome-card">
        <h1>🪶 Plumier</h1>
        <p className="muted">Écrire, planifier, structurer. Tes textes restent des fichiers simples sur ton disque.</p>

        <h2>Nouveau projet</h2>
        <input placeholder="Titre du livre" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        <input placeholder="Auteur (facultatif)" value={author} onChange={(e) => setAuthor(e.target.value)} />
        <button className="primary" disabled={!title.trim()} onClick={() => createProject(title.trim(), author.trim())}>
          Créer le projet…
        </button>

        <h2>Ouvrir</h2>
        <button onClick={() => openProject()}>📂 Ouvrir un projet existant…</button>
        {recent.length > 0 && (
          <ul className="recent">
            {recent.map((d) => (
              <li key={d}>
                <a onClick={() => openProject(d)} title={d}>{d.split(/[\\/]/).pop()}<small>{d}</small></a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
