import { useEffect, useState } from "react";
import { useStore, selectedNode } from "../store";
import { streakOf } from "../tree";

export function StatusBar() {
  const { project, sessionStart, sessionWords, selWords, saveState, update, setModal } = useStore();
  const node = useStore(selectedNode);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 20_000);
    return () => clearInterval(t);
  }, []);
  if (!project) return null;

  const minutes = Math.max(0, Math.round((Date.now() - sessionStart) / 60000));
  const streak = streakOf(project.daily);
  const goal = node?.kind === "doc" ? node.goal : 0;
  const nf = (n: number) => n.toLocaleString("fr-FR");

  return (
    <footer className="statusbar">
      {node?.kind === "doc" && (
        <span>
          {goal > 0 ? (
            <>
              {nf(node.words)} / {nf(goal)} mots
              <span className="mini-bar"><i style={{ width: Math.min(100, (node.words / goal) * 100) + "%" }} /></span>
            </>
          ) : (
            <>{nf(node.words)} mots</>
          )}
        </span>
      )}
      {selWords > 0 && <span className="sel">Sélection : {nf(selWords)} mot{selWords > 1 ? "s" : ""}</span>}
      <span className="spacer" />
      <span title="Mots écrits depuis l'ouverture du projet">Session : {nf(Math.max(0, sessionWords))} mots · {minutes} min</span>
      <span title="Jours consécutifs d'écriture">Série : {streak} j</span>
      {update && <a className="upd" onClick={() => setModal("settings")}>⬆ Mise à jour {update.version} disponible</a>}
      <span className={`save ${saveState}`}>{saveState === "saving" ? "Enregistrement…" : saveState === "error" ? "⚠ Erreur" : "✓ Enregistré"}</span>
    </footer>
  );
}
