/* Création d'éléments sans innerHTML pour le contenu : seuls les liens http(s), mailto: et internes (#…, /…) passent. */
import { lienSur } from './model.js';

const hrefSur = (v) => lienSur(v) || /^#/.test(v) || /^mailto:[^\s]+$/.test(v);
/* blob: : adresses créées par la page elle-même (fichiers de dossiers protégés) */
const srcSur = (v) => lienSur(v) || /^\/(?!\/)/.test(v) || /^data:image\//.test(v) || /^blob:/.test(v);

/* crée un élément : attrs (class, href, src… filtrés), enfants = nœuds ou textes */
export function el(tag, attrs = {}, ...enfants) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (v === undefined || v === null || v === false) return;
    if (k === 'href' && !hrefSur(String(v))) return;
    if (k === 'src' && !srcSur(String(v))) return;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v; /* réservé aux icônes écrites dans ce fichier */
    else e.setAttribute(k, v === true ? '' : String(v));
  });
  enfants.flat().forEach((x) => { if (x !== null && x !== undefined && x !== false) e.append(x instanceof Node ? x : String(x)); });
  return e;
}
