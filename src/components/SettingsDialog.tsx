import { useEffect, useState } from "react";
import { useStore } from "../store";
import { COMMANDS, keysOf, loadBindings, saveBindings, eventToKeys, prettyKeys, type Bindings } from "../commands";
import { FONTS, THEMES } from "../prefs";
import { isDesktop, storage } from "../storage";
import { loadBackup, saveBackup, runBackup, type BackupSettings } from "../backup";
import { appVersion, autoUpdateEnabled, checkForUpdate, installUpdate, setAutoUpdate } from "../updater";

type Tab = "look" | "keys" | "backup" | "update" | "about";
const TABS: { id: Tab; label: string }[] = [
  { id: "look", label: "Apparence" },
  { id: "keys", label: "Raccourcis" },
  { id: "backup", label: "Sauvegarde" },
  { id: "update", label: "Mises à jour" },
  { id: "about", label: "À propos" },
];

export function SettingsDialog() {
  const setModal = useStore((s) => s.setModal);
  const [tab, setTab] = useState<Tab>("look");
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setModal(null); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [setModal]);

  return (
    <div className="modal-back" onClick={() => setModal(null)}>
      <div className="modal settings" onClick={(e) => e.stopPropagation()}>
        <div className="settings-side">
          <h2>Réglages</h2>
          {TABS.map((t) => <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>{t.label}</button>)}
        </div>
        <div className="settings-body">
          {tab === "look" && <Look />}
          {tab === "keys" && <Keys />}
          {tab === "backup" && <Backup />}
          {tab === "update" && <Updates />}
          {tab === "about" && <About />}
          <div className="modal-actions"><button className="primary" onClick={() => setModal(null)}>Fermer</button></div>
        </div>
      </div>
    </div>
  );
}

function Look() {
  const { theme, setTheme, prefs, setPrefs } = useStore();
  return (
    <>
      <h3>Thème</h3>
      <div className="themes">
        {THEMES.map((t) => (
          <button key={t.id} className={`theme-card ${theme === t.id ? "on" : ""}`} data-theme={t.id} onClick={() => setTheme(t.id)}>
            <span>Aa</span>
            <small>{t.label}</small>
          </button>
        ))}
      </div>
      <h3>Texte</h3>
      <label>Police
        <select value={prefs.font} onChange={(e) => setPrefs({ font: e.target.value })}>
          {FONTS.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
        </select>
      </label>
      <label>Taille : {prefs.size} px
        <input type="range" min={14} max={26} value={prefs.size} onChange={(e) => setPrefs({ size: +e.target.value })} />
      </label>
      <label>Interligne : {prefs.line.toFixed(2)}
        <input type="range" min={1.3} max={2.2} step={0.05} value={prefs.line} onChange={(e) => setPrefs({ line: +e.target.value })} />
      </label>
      <label>Largeur de la page : {prefs.width} px
        <input type="range" min={560} max={980} step={10} value={prefs.width} onChange={(e) => setPrefs({ width: +e.target.value })} />
      </label>
      <div className="preview-text" style={{ fontFamily: prefs.font, fontSize: prefs.size, lineHeight: prefs.line }}>
        La pluie atteignit le quai avec la marée, et le phare éteint semblait l'attendre depuis un siècle.
      </div>
    </>
  );
}

function Keys() {
  const [b, setB] = useState<Bindings>(loadBindings());
  const [listening, setListening] = useState<string | null>(null);
  const setToast = useStore((s) => s.setToast);

  useEffect(() => {
    if (!listening) return;
    const h = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") return setListening(null);
      const keys = e.key === "Backspace" || e.key === "Delete" ? "" : eventToKeys(e);
      if (!keys && e.key !== "Backspace" && e.key !== "Delete") return; // modificateur seul
      const next = { ...b };
      if (keys) {
        const clash = COMMANDS.find((c) => c.id !== listening && keysOf(c, next) === keys);
        if (clash) { next[clash.id] = ""; setToast(`« ${prettyKeys(keys)} » était utilisé par « ${clash.label} » : ce raccourci a été retiré.`); }
      }
      next[listening] = keys;
      setB(next);
      saveBindings(next);
      setListening(null);
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [listening, b, setToast]);

  const groups = [...new Set(COMMANDS.map((c) => c.group))];
  return (
    <>
      <p className="muted">Clique sur un raccourci puis appuie sur la nouvelle combinaison. <b>Retour arrière</b> supprime le raccourci, <b>Échap</b> annule. Raccourcis du texte (Ctrl+B, Ctrl+I, Ctrl+Z…) : standards, non modifiables.</p>
      <button onClick={() => { setB({}); saveBindings({}); }}>Tout rétablir</button>
      {groups.map((g) => (
        <div key={g}>
          <h3>{g}</h3>
          {COMMANDS.filter((c) => c.group === g).map((c) => {
            const k = keysOf(c, b);
            const changed = c.id in b && b[c.id] !== (c.keys ?? "");
            return (
              <div key={c.id} className="key-row">
                <span>{c.label}</span>
                <button className={`keycap ${listening === c.id ? "listen" : ""}`} onClick={() => setListening(c.id)}>
                  {listening === c.id ? "Appuie sur les touches…" : k ? prettyKeys(k) : "— aucun —"}
                </button>
                {changed && <a title="Rétablir" onClick={() => { const n = { ...b }; delete n[c.id]; setB(n); saveBindings(n); }}>↺</a>}
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

function Backup() {
  const [cfg, setCfg] = useState<BackupSettings>(loadBackup());
  const update = (p: Partial<BackupSettings>) => { const n = { ...cfg, ...p }; setCfg(n); saveBackup(n); };
  const { project } = useStore();
  const last = cfg.last ? new Date(cfg.last).toLocaleString("fr-FR") : "jamais";
  return (
    <>
      <h3>Sauvegarde automatique</h3>
      <p className="muted">Plumier crée une archive .zip datée de tout le projet (texte, fiches, instantanés) dans le dossier de ton choix, par exemple un dossier OneDrive ou une clé USB. Elle ne se déclenche que si le projet a changé.</p>
      <label className="check"><input type="checkbox" checked={cfg.enabled} onChange={(e) => update({ enabled: e.target.checked })} /> Activer la sauvegarde automatique</label>
      <label>Dossier de destination
        <div className="two">
          <input readOnly value={cfg.dir} placeholder={isDesktop ? "Aucun dossier choisi" : "Non disponible dans le navigateur"} />
          <button disabled={!isDesktop} onClick={async () => { const d = await storage.pickFolder("Dossier des sauvegardes"); if (d) update({ dir: d }); }}>Choisir…</button>
        </div>
      </label>
      <div className="row2">
        <label>Fréquence
          <select value={cfg.intervalMin} onChange={(e) => update({ intervalMin: +e.target.value })}>
            {[[5, "Toutes les 5 minutes"], [15, "Toutes les 15 minutes"], [30, "Toutes les 30 minutes"], [60, "Toutes les heures"], [180, "Toutes les 3 heures"], [1440, "Une fois par jour"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label>Archives conservées
          <select value={cfg.keep} onChange={(e) => update({ keep: +e.target.value })}>
            {[5, 10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <p className="muted">Dernière sauvegarde : {last}</p>
      <button className="primary" disabled={!project} onClick={() => runBackup(true)}>Sauvegarder maintenant</button>
      <p className="muted small">Pour restaurer : décompresse l'archive, puis ouvre le dossier obtenu avec « Ouvrir un projet ».</p>
    </>
  );
}

function Updates() {
  const { update } = useStore();
  const [auto, setAuto] = useState(autoUpdateEnabled());
  const [msg, setMsg] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState<number | null>(null);
  const [version, setVersion] = useState("");
  useEffect(() => { appVersion().then(setVersion); }, []);

  const check = async () => {
    setBusy(true);
    setMsg("Recherche…");
    const r = await checkForUpdate();
    setBusy(false);
    setMsg(r.status === "uptodate" ? "✓ Plumier est à jour." : r.status === "available" ? `Version ${r.info.version} disponible.` : r.message);
  };
  const install = async () => {
    setBusy(true);
    try { await installUpdate(setPct); } catch (e) { setMsg("Échec : " + String((e as Error).message ?? e)); setBusy(false); }
  };

  return (
    <>
      <h3>Mises à jour</h3>
      <p>Version installée : <b>{version}</b></p>
      <label className="check"><input type="checkbox" checked={auto} onChange={(e) => { setAuto(e.target.checked); setAutoUpdate(e.target.checked); }} /> Chercher une mise à jour au démarrage</label>
      <button disabled={busy} onClick={check}>Vérifier maintenant</button>
      {msg && <p className="muted">{msg}</p>}
      {update && (
        <div className="update-box">
          <b>Plumier {update.version}</b>
          {update.notes && <pre>{update.notes}</pre>}
          <button className="primary" disabled={busy} onClick={install}>{pct !== null ? `Téléchargement… ${pct} %` : "Installer et redémarrer"}</button>
        </div>
      )}
    </>
  );
}

function About() {
  const [v, setV] = useState("");
  useEffect(() => { appVersion().then(setV); }, []);
  return (
    <>
      <h3>Plumier</h3>
      <p>Version {v}</p>
      <p className="muted">Logiciel d'écriture et de planification de romans. Tes projets sont des dossiers de fichiers Markdown, lisibles partout. Aucun compte, aucun abonnement, aucune IA.</p>
    </>
  );
}
