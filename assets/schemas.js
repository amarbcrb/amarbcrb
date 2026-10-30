/* Champs de chaque liste du contenu, pour les feuilles de modification (édition sur le site).
   type : texte (défaut), multiligne, date (AAAA-MM), fin (date + « en cours »), puces (liste séparée par des virgules),
   select (options(c) → [{ valeur, libelle }]), media (image, GIF, vidéo, YouTube). */
import { DRAPEAUX, TYPES_LIEN } from './model.js';

const DATEES = [{ cle: 'titre', libelle: 'Titre' }, { cle: 'lieu', libelle: 'Lieu' }, { cle: 'debut', libelle: 'Début', type: 'date' },
  { cle: 'fin', libelle: 'Fin', type: 'fin' }, { cle: 'description', libelle: 'Description', type: 'multiligne' }, { cle: 'image', libelle: 'Image', type: 'media' }];
const NOUVEAU_DATE = { titre: '', lieu: '', debut: '', fin: null, enCours: false, description: '', image: null };
const options = (o) => () => Object.entries(o).map(([valeur, libelle]) => ({ valeur, libelle }));

export const SCHEMAS = {
  'parcours.formation': { libelle: 'une formation', prefixe: 'f', trie: true, nouveau: NOUVEAU_DATE, champs: DATEES },
  'parcours.experience': { libelle: 'une expérience', prefixe: 'e', trie: true, nouveau: NOUVEAU_DATE, champs: DATEES },
  'parcours.engagement': { libelle: 'un engagement', prefixe: 'g', trie: true, nouveau: NOUVEAU_DATE, champs: DATEES },
  'parcours.competences': { libelle: 'une compétence', prefixe: 'c', nouveau: { domaine: '', resume: '', techniques: [], image: null },
    champs: [{ cle: 'domaine', libelle: 'Domaine' }, { cle: 'resume', libelle: 'Résumé', type: 'multiligne' }, { cle: 'techniques', libelle: 'Techniques (séparées par des virgules)', type: 'puces' },
      { cle: 'image', libelle: 'Image', type: 'media' }] },
  'parcours.certifications': { libelle: 'une certification', prefixe: 'k', nouveau: { titre: '', organisme: '', annee: '', url: '', image: null },
    champs: [{ cle: 'titre', libelle: 'Titre' }, { cle: 'organisme', libelle: 'Organisme' }, { cle: 'annee', libelle: 'Année' },
      { cle: 'url', libelle: 'Lien du certificat (https://…)', type: 'url' }, { cle: 'image', libelle: 'Affiche', type: 'media' }] },
  'parcours.langues': { libelle: 'une langue', prefixe: 'l', nouveau: { langue: '', niveau: '', drapeau: '' },
    champs: [{ cle: 'langue', libelle: 'Langue' }, { cle: 'niveau', libelle: 'Niveau' },
      { cle: 'drapeau', libelle: 'Drapeau', type: 'select', options: () => [{ valeur: '', libelle: 'Automatique (selon la langue)' }, ...options(DRAPEAUX)()] }] },
  'parcours.interets': { libelle: 'un intérêt', prefixe: 'i', nouveau: { titre: '', texte: '', image: null },
    champs: [{ cle: 'titre', libelle: 'Titre' }, { cle: 'texte', libelle: 'Texte', type: 'multiligne' }, { cle: 'image', libelle: 'Image', type: 'media' }] },
  'accueil.reperes': { libelle: 'un repère', prefixe: 'r', nouveau: { valeur: '', libelle: '' },
    champs: [{ cle: 'valeur', libelle: 'Valeur (ex. 2022, 6 ans)' }, { cle: 'libelle', libelle: 'Libellé' }] },
  'accueil.domaines': { libelle: 'un domaine', prefixe: 'd', nouveau: { titre: '', texte: '', image: null, lien: '' },
    champs: [{ cle: 'titre', libelle: 'Titre' }, { cle: 'texte', libelle: 'Texte', type: 'multiligne' }, { cle: 'image', libelle: 'Image', type: 'media' },
      { cle: 'lien', libelle: 'Lien du bouton « Découvrir » (#portfolio, #liens… ou https://…)' }] },
  'liens.items': { libelle: 'un lien', prefixe: 'u', trie: true, nouveau: { url: '', titre: '', description: '', image: '', categorie: '', date: '', bouton: '', type: '', media: null, avis: '' },
    champs: [{ cle: 'url', libelle: 'Adresse', type: 'url' }, { cle: 'titre', libelle: 'Titre' }, { cle: 'description', libelle: 'Description', type: 'multiligne' },
      { cle: 'avis', libelle: 'Mon avis (une phrase, affichée sur la carte)', type: 'multiligne' },
      { cle: 'categorie', libelle: 'Catégorie', type: 'select', options: (c) => c.liens.categories.map((x) => ({ valeur: x.id, libelle: x.nom })) },
      { cle: 'type', libelle: 'Type', type: 'select', options: () => [{ valeur: '', libelle: 'Automatique' }, ...options(TYPES_LIEN)()] },
      { cle: 'media', libelle: 'Mon image (remplace l\'aperçu)', type: 'media' }, { cle: 'image', libelle: 'Image de l\'aperçu (adresse)', type: 'url' },
      { cle: 'bouton', libelle: 'Texte du bouton (« Ouvrir » par défaut)' }, { cle: 'date', libelle: 'Date (AAAA-MM-JJ)' }] },
  'liens.categories': { libelle: 'une catégorie', prefixe: 'cat', nouveau: { nom: '' }, champs: [{ cle: 'nom', libelle: 'Nom' }] },
  'contact.autres': { libelle: 'un lien de contact', prefixe: 'a', nouveau: { label: '', url: '' },
    champs: [{ cle: 'label', libelle: 'Nom' }, { cle: 'url', libelle: 'Adresse (https://…)', type: 'url' }] },
  'contact.ouvertA': { libelle: 'une ligne « Ouvert à »', prefixe: 'o', nouveau: { titre: '', detail: '' },
    champs: [{ cle: 'titre', libelle: 'Titre' }, { cle: 'detail', libelle: 'Détail' }] },
  cartes: { libelle: 'une carte', prefixe: 'ct', nouveau: { titre: '', texte: '', media: null, lien: '', bouton: '' },
    champs: [{ cle: 'titre', libelle: 'Titre' }, { cle: 'texte', libelle: 'Texte', type: 'multiligne' }, { cle: 'media', libelle: 'Image, GIF ou vidéo', type: 'media' },
      { cle: 'lien', libelle: 'Lien (#onglet ou https://…)' }, { cle: 'bouton', libelle: 'Texte du bouton (« Ouvrir » par défaut)' }] },
  rangees: { libelle: 'une rangée', prefixe: 'rg', nouveau: { titre: '', cartes: [] }, champs: [{ cle: 'titre', libelle: 'Titre' }] },
  /* coordonnées (un objet, pas une liste) */
  contact: { libelle: 'les coordonnées', champs: [{ cle: 'email', libelle: 'E-mail' }, { cle: 'linkedin', libelle: 'LinkedIn (https://…)', type: 'url' }] },
};

/* schéma d'une liste : « pages.tab1.rangees#rg1.cartes » → cartes, « pages.tab1.rangees » → rangees */
export function schemaDe(liste) {
  if (SCHEMAS[liste]) return SCHEMAS[liste];
  if (/^pages\.[^.]+\.rangees#[^.]+\.cartes$/.test(liste)) return SCHEMAS.cartes;
  if (/^pages\.[^.]+\.rangees$/.test(liste)) return SCHEMAS.rangees;
  return null;
}
