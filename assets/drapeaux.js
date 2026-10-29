/* Drapeaux des langues, dessinés en SVG (sans dépendance). Format 3:2, recadrés en rond par le CSS. */
const D = {
  fr: '<rect width="10" height="20" fill="#0055a4"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#ef4135"/>',
  arabe: '<rect width="30" height="20" fill="#007a3d"/><circle cx="15" cy="10" r="5.6" fill="none" stroke="#fff" stroke-width=".9"/><path d="M16.9 7.2A3.4 3.4 0 1 0 16.9 12.8A2.7 2.7 0 1 1 16.9 7.2Z" fill="#fff"/>',
  amazigh: '<rect width="30" height="6.67" fill="#0072c6"/><rect y="6.67" width="30" height="6.67" fill="#3a9d23"/><rect y="13.33" width="30" height="6.67" fill="#f9dd16"/><path d="M15 3.5V16.5M11 4Q11 9 15 9Q19 9 19 4M11 16Q11 11 15 11Q19 11 19 16" fill="none" stroke="#e1251b" stroke-width="1.4" stroke-linecap="round"/>',
  gb: '<rect width="30" height="20" fill="#012169"/><path d="M0 0 30 20M30 0 0 20" stroke="#fff" stroke-width="4"/><path d="M0 0 30 20M30 0 0 20" stroke="#c8102e" stroke-width="1.6"/><path d="M15 0V20M0 10H30" stroke="#fff" stroke-width="6.5"/><path d="M15 0V20M0 10H30" stroke="#c8102e" stroke-width="4"/>',
  us: '<rect width="30" height="20" fill="#b22234"/><rect y="1.54" width="30" height="1.54" fill="#fff"/><rect y="4.62" width="30" height="1.54" fill="#fff"/><rect y="7.69" width="30" height="1.54" fill="#fff"/><rect y="10.77" width="30" height="1.54" fill="#fff"/><rect y="13.85" width="30" height="1.54" fill="#fff"/><rect y="16.92" width="30" height="1.54" fill="#fff"/><rect width="13" height="10.77" fill="#3c3b6e"/>',
  es: '<rect width="30" height="20" fill="#aa151b"/><rect y="5" width="30" height="10" fill="#f1bf00"/>',
  dz: '<rect width="15" height="20" fill="#006233"/><rect x="15" width="15" height="20" fill="#fff"/><path d="M19.23 7.33A5 5 0 1 0 19.23 12.67A4 4 0 1 1 19.23 7.33Z" fill="#d21034"/><path d="M17.70 10.00L18.99 9.56L19.01 8.19L19.83 9.29L21.14 8.88L20.35 10.00L21.14 11.12L19.83 10.71L19.01 11.81L18.99 10.44Z" fill="#d21034"/>',
  de: '<rect width="30" height="6.67"/><rect y="6.67" width="30" height="6.67" fill="#dd0000"/><rect y="13.33" width="30" height="6.67" fill="#ffce00"/>',
  it: '<rect width="10" height="20" fill="#009246"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#ce2b37"/>',
};

/* chaîne SVG du drapeau, ou '' si le code est inconnu */
export const drapeauSvg = (code) => (D[code] ? `<svg viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${D[code]}</svg>` : '');
