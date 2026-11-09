// Nettoyage du HTML des notes avant affichage (défense contre un fichier d'import piégé).
// Le contenu stocké n'est jamais modifié : seul le rendu est filtré.
import DOMPurify from "dompurify";

/**
 * Conserve la mise en forme produite par l'éditeur (titres, gras, italique, souligné,
 * barré, listes, code, citations, séparateurs, liens) et supprime tout ce qui peut
 * exécuter du code : scripts, gestionnaires d'événements (onerror…), URL javascript:,
 * iframes, formulaires, styles et SVG/MathML.
 */
export function sanitizeNoteHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "form", "input", "button", "textarea", "select"],
    FORBID_ATTR: ["style", "target"],
  });
}
