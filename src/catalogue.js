/**
 * Catalogue au format du CMS Webflow : des listes à plat, reliées par slug.
 * Le lecteur du DOM (listes CMS cachées) produit ce format ; indexer() fait les jointures.
 *
 * @typedef {'a-valider'|'valide'|'retire'|'a-creer'} Statut
 * @typedef {'court'|'moyen'|'long'|'sans-objet'} Gabarit
 *
 * @typedef {{ slug:string, nom:string, logo?:string, ordre?:number }} Marque
 * @typedef {{ slug:string, nom:string }} Plateforme
 * @typedef {{ slug:string, nom:string, suffixeKit?:string, sousLibelleKits?:string }} Groupe
 * @typedef {{ slug:string, nom:string, sousLibelle?:string, visuel?:string, glb?:string, ordre?:number, statut:Statut }} Kit
 * @typedef {{ slug:string, nom:string, sousLibelle?:string, teinte?:string, texture?:string, ordre?:number, statut:Statut }} Finition
 * @typedef {{ slug:string, nom:string, marque:string, modele:string, millesime?:string, plateforme?:string|null,
 *             groupe?:string|null, kits:string[], photo?:string, recommande?:boolean, argument?:string,
 *             ordre?:number, statut:Statut }} Vehicule
 * @typedef {{ slug:string, vehicule:string, etiquette:string, gabarit:Gabarit, ordre?:number }} Longueur
 * @typedef {{ slug?:string, groupe:string, gabarit:Gabarit|'toutes', kit:string, finition:string, prix:number|null, statut:Statut }} LigneGrille
 * @typedef {{ slug:string, nom:string, section:string, ordre?:number, sousLibelle?:string, noteClient?:string, visuel?:string,
 *             prixTtc?:number|null, prixL2?:number|null, prixBest?:number|null, prixBestL2?:number|null, prixVwT5?:number|null,
 *             montage:'tous'|'atelier'|'impose'|'inclus', motifIndispo?:string, motifInclus?:string, titreVersions?:string,
 *             kits:string[], finitions:string[], plateformes:string[], dependDe:string[], incompatibleAvec:string[],
 *             slug3d?:string, statut:Statut }} Option
 * @typedef {{ slug:string, nom:string, option:string, type:'choix'|'cases'|'palier', prixTtc?:number|null, prixBest?:number|null,
 *             min?:number|null, max?:number|null, marque?:string|null, saufMarque?:string|null, plateforme?:string|null,
 *             ordre?:number }} Variante
 *
 * @typedef {{ marques:Marque[], plateformes:Plateforme[], groupes:Groupe[], kits:Kit[], finitions:Finition[],
 *             vehicules:Vehicule[], longueurs:Longueur[], grille:LigneGrille[], options:Option[], variantes:Variante[] }} CatalogueBrut
 */

const parOrdre = (a, b) => (a.ordre ?? 0) - (b.ordre ?? 0)
const liste = (x) => (Array.isArray(x) ? x : [])
/** Map.groupBy n'existe qu'à partir de Safari 17.4 : version maison. */
const grouper = (l, cle) => l.reduce((m, x) => m.set(cle(x), [...(m.get(cle(x)) ?? []), x]), new Map())

/** Jointures et index par slug. Ne modifie pas l'entrée. */
export function indexer(/** @type {CatalogueBrut} */ brut) {
  const c = structuredClone(brut)
  for (const cle of ['marques', 'plateformes', 'groupes', 'kits', 'finitions', 'vehicules', 'longueurs', 'grille', 'options', 'variantes']) {
    c[cle] = liste(c[cle])
  }
  for (const cle of ['marques', 'kits', 'finitions', 'vehicules', 'options']) c[cle].sort(parOrdre)

  const longueursPar = grouper(c.longueurs.sort(parOrdre), (l) => l.vehicule)
  for (const v of c.vehicules) {
    v.kits = liste(v.kits)
    v.longueurs = longueursPar.get(v.slug) ?? []
  }
  const variantesPar = grouper(c.variantes.sort(parOrdre), (x) => x.option)
  for (const o of c.options) {
    for (const cle of ['kits', 'finitions', 'plateformes', 'dependDe', 'incompatibleAvec']) o[cle] = liste(o[cle])
    o.variantes = variantesPar.get(o.slug) ?? []
  }

  const index = (l) => new Map(l.map((x) => [x.slug, x]))
  c.par = {
    marques: index(c.marques),
    plateformes: index(c.plateformes),
    groupes: index(c.groupes),
    kits: index(c.kits),
    finitions: index(c.finitions),
    vehicules: index(c.vehicules),
    options: index(c.options),
  }
  return c
}

/** « Services & montage » → « services-montage » (clé des sections et des options CMS). */
export const slugifier = (s) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
