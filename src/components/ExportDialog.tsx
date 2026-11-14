import { useState } from "react";
import { useStore } from "../store";
import { storage, isDesktop, type ExportFormat } from "../storage";
import { compileManuscript, finalizeMarkdown, type CompileOptions } from "../compile";
import { flushEditor } from "../editorRegistry";
import { buildBookHtml, DEFAULT_PDF, openPrintPreview, PAGE_FORMATS, PDF_FONTS, type PageFormat, type PdfOptions } from "../pdfBook";

type Fmt = ExportFormat | "pdf";
const FORMATS: { value: Fmt; label: string }[] = [
  { value: "pdf", label: "PDF (mise en page livre)" },
  { value: "docx", label: "Word (.docx)" },
  { value: "epub", label: "Livre numérique (.epub)" },
  { value: "odt", label: "LibreOffice (.odt)" },
  { value: "html", label: "Page web (.html)" },
  { value: "md", label: "Markdown (.md)" },
];

const loadPdf = (): PdfOptions => {
  try { return { ...DEFAULT_PDF, ...JSON.parse(localStorage.getItem("plumier-pdf") ?? "{}") }; } catch { return DEFAULT_PDF; }
};

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const { project, dir, setToast } = useStore();
  const [fmt, setFmt] = useState<Fmt>("pdf");
  const [opt, setOpt] = useState<CompileOptions>({ sceneTitles: false, separator: "* * *", skipIdeas: true });
  const [pdf, setPdf] = useState<PdfOptions>(loadPdf());
  const [busy, setBusy] = useState(false);
  if (!project || !dir) return null;

  const setPdfOpt = (p: Partial<PdfOptions>) => {
    const n = { ...pdf, ...p };
    setPdf(n);
    try { localStorage.setItem("plumier-pdf", JSON.stringify(n)); } catch { /* ignore */ }
  };

  const run = async () => {
    setBusy(true);
    try {
      await flushEditor();
      const raw = await compileManuscript(dir, project.manuscript, opt);
      if (fmt === "pdf") {
        const md = finalizeMarkdown(raw, "pdf");
        const html = buildBookHtml(md, project.title, project.author, pdf);
        onClose();
        openPrintPreview(html, pdf, "Aperçu du livre. Dans la fenêtre d'impression, choisis « Enregistrer au format PDF ».");
        return;
      }
      const out = await storage.exportBook(dir, finalizeMarkdown(raw, "pandoc"), project.title, project.author, fmt);
      if (out) {
        setToast("Exporté : " + out);
        onClose();
      }
    } catch (e) {
      setToast("Échec de l'export : " + String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal export" onClick={(e) => e.stopPropagation()}>
        <h2>Exporter le livre</h2>
        <label>Format</label>
        <select value={fmt} onChange={(e) => setFmt(e.target.value as Fmt)}>
          {FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={opt.sceneTitles} onChange={(e) => setOpt({ ...opt, sceneTitles: e.target.checked })} /> Afficher les titres des scènes</label>
        <label className="check"><input type="checkbox" checked={opt.skipIdeas} onChange={(e) => setOpt({ ...opt, skipIdeas: e.target.checked })} /> Ignorer les éléments au statut « Idée »</label>
        {!opt.sceneTitles && (
          <>
            <label>Séparateur entre scènes</label>
            <input value={opt.separator} onChange={(e) => setOpt({ ...opt, separator: e.target.value })} />
          </>
        )}

        {fmt === "pdf" && (
          <div className="pdf-opts">
            <label>Format de page
              <select value={pdf.page} onChange={(e) => setPdfOpt({ page: e.target.value as PageFormat })}>
                {Object.entries(PAGE_FORMATS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </label>
            <label>Police
              <select value={pdf.font} onChange={(e) => setPdfOpt({ font: e.target.value })}>
                {PDF_FONTS.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
              </select>
            </label>
            <div className="row2">
              <label>Taille : {pdf.fontPt} pt<input type="range" min={9} max={14} step={0.5} value={pdf.fontPt} onChange={(e) => setPdfOpt({ fontPt: +e.target.value })} /></label>
              <label>Interligne : {pdf.line.toFixed(2)}<input type="range" min={1.1} max={1.9} step={0.05} value={pdf.line} onChange={(e) => setPdfOpt({ line: +e.target.value })} /></label>
              <label>Marges : {pdf.marginMm} mm<input type="range" min={10} max={30} value={pdf.marginMm} onChange={(e) => setPdfOpt({ marginMm: +e.target.value })} /></label>
            </div>
            <div className="checks">
              <label className="check"><input type="checkbox" checked={pdf.titlePage} onChange={(e) => setPdfOpt({ titlePage: e.target.checked })} /> Page de titre</label>
              <label className="check"><input type="checkbox" checked={pdf.pageNumbers} onChange={(e) => setPdfOpt({ pageNumbers: e.target.checked })} /> Numéros de page</label>
              <label className="check"><input type="checkbox" checked={pdf.chapterNewPage} onChange={(e) => setPdfOpt({ chapterNewPage: e.target.checked })} /> Chaque chapitre sur une nouvelle page</label>
              <label className="check"><input type="checkbox" checked={pdf.justify} onChange={(e) => setPdfOpt({ justify: e.target.checked })} /> Texte justifié</label>
              <label className="check"><input type="checkbox" checked={pdf.hyphens} onChange={(e) => setPdfOpt({ hyphens: e.target.checked })} /> Césure automatique des mots</label>
            </div>
            <p className="muted small">Les notes de bas de page sont placées en fin de chapitre. Les commentaires ne sont jamais exportés.</p>
          </div>
        )}
        {fmt !== "pdf" && fmt !== "md" && isDesktop && <p className="muted">Nécessite <b>Pandoc</b> installé sur le PC (pandoc.org).</p>}
        {fmt !== "pdf" && !isDesktop && <p className="muted">Version navigateur : seuls l'export PDF et Markdown sont disponibles.</p>}
        <div className="modal-actions">
          <button onClick={onClose}>Annuler</button>
          <button className="primary" disabled={busy} onClick={run}>{busy ? "Préparation…" : fmt === "pdf" ? "Aperçu et PDF…" : "Exporter…"}</button>
        </div>
      </div>
    </div>
  );
}
