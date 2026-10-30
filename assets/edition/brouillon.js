/* Brouillon de l'édition sur le site : gardé sur cet appareil seulement (localStorage), jamais publié sans « Publier ». */
const CLE = 'ab-brouillon';

/* { versionDeBase, contenu, chemins: [chemins modifiés] } ou null */
export function lireBrouillon() {
  try { const b = JSON.parse(localStorage.getItem(CLE)); return b && b.contenu ? b : null; } catch { return null; }
}
export function ecrireBrouillon(b) {
  try { localStorage.setItem(CLE, JSON.stringify(b)); } catch { /* stockage plein ou bloqué */ }
}
export function effacerBrouillon() {
  try { localStorage.removeItem(CLE); } catch { /* idem */ }
}
