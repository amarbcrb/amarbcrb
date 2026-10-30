/* Préparation des médias avant envoi au script : réduction des images, encodage base64. */

export function enBase64(blob) {
  return new Promise((ok, ko) => {
    const lecteur = new FileReader();
    lecteur.onload = () => ok(String(lecteur.result).split(',')[1] || '');
    lecteur.onerror = () => ko(lecteur.error);
    lecteur.readAsDataURL(blob);
  });
}

/* réduit l'image pour que son plus grand côté fasse au plus maxCote pixels (jamais agrandie) */
export async function reduireImage(fichier, maxCote, type = 'image/jpeg') {
  const image = await createImageBitmap(fichier);
  const k = Math.min(1, maxCote / Math.max(image.width, image.height));
  const largeur = Math.round(image.width * k), hauteur = Math.round(image.height * k);
  const canvas = document.createElement('canvas');
  canvas.width = largeur;
  canvas.height = hauteur;
  const ctx = canvas.getContext('2d');
  if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, largeur, hauteur); }
  ctx.drawImage(image, 0, 0, largeur, hauteur);
  image.close();
  const blob = await new Promise((ok) => canvas.toBlob(ok, type, 0.9));
  return { base64: await enBase64(blob), type, largeur, hauteur };
}
