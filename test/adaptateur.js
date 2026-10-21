/*
 * Convertit l'extrait du catalogue prototype :
 * - normaliser() : complète les champs omis dans l'extrait (format attendu par le prototype) ;
 * - versCms()    : produit le catalogue au format CMS Webflow, avec les mêmes choix que la migration du 20/10.
 */
import { slugifier } from '../src/catalogue.js'

const OPTION_DEFAUTS = {
  variantes: '', kits_compatibles: [], longueurs_compatibles: [], plateformes_requises: [], finitions_requises: [],
  depend_de: [], incompatible_avec: [], regles: [], visuels: [], statut: 'À valider Willy', montage: null,
  prix_l2: null, prix_best: null, prix_best_l2: null, motif_si_non_disponible: '', motif_si_inclus: null, note_client: null,
}

export function normaliser(extrait) {
  const c = structuredClone(extrait)
  c.vehicules = c.vehicules.map((v) => ({
    statut: 'À valider Willy', plateforme: v.plateforme_code, ...v,
    longueurs: v.longueurs.map(([etiquette, gabarit]) => ({ etiquette, gabarit })),
  }))
  c.options = c.options.map((o) => ({ ...OPTION_DEFAUTS, ...o }))
  c.grille = c.grille.map((g) => ({ statut: 'À valider Willy', ...g }))
  return c
}

export const PLATEFORMES = {
  X82: 'x82', X83: 'x83', C5: 'psa-c5', EMP2: 'psa-emp2', Sud: 'sevel-sud', V362: 'ford-v362', V710: 'ford-v710',
  historique: 'vw-bus-historique', T3: 'vw-t3', T4: 'vw-t4', T5: 'vw-t5', T7: 'vw-t7', Vito: 'mercedes-vito',
}
const STATUTS = { 'À valider Willy': 'a-valider', 'Validé': 'valide', 'Retiré': 'retire', 'À créer': 'a-creer' }
const MONTAGES = { 'Atelier uniquement': 'atelier', 'Imposé en atelier': 'impose', 'Inclus en atelier': 'inclus' }
const GROUPES = { X82: 'x82', 'Kit universel': 'universel', Combi: 'combi' }
const kitCms = (k) => (k === 'Combi T2-T3' ? 'combi' : k.toLowerCase())

/** Slug CMS d'une option prototype (montage et VASP ont un slug réservé). */
const ID_BICOLORE = '3e370bd669cd81ca97bee98459905ce5'
/** Véhicules recommandés du prototype (RECOMMANDES), à valider par Willy. */
const RECOMMANDES = ['3e370bd669cd81dfb3d1c9619bb11e8d', '3e370bd669cd81ea93daddace0c26110', '3e370bd669cd81549d69d9abb3bb316d']
export const slugOption = (o) => (o.section === 'Services & montage' && o.ordre === 1 ? 'montage-atelier'
  : o.section === 'Services & montage' && o.ordre === 2 ? 'homologation-vasp' : o.id === ID_BICOLORE ? 'mobilier-bicolore' : o.id)
export const slugLongueur = (v, i) => `${v.id}-l${i}`
export const slugChoix = (o, i) => `${o.id}--c${i}`
export const slugCase = (o, i) => `${o.id}--m${i}`

export function versCms(p) {
  const actifs = p.options.filter((o) => o.statut !== 'Retiré')
  const idVersSlug = new Map(actifs.map((o) => [o.id, slugOption(o)]))
  const variantes = []

  for (const o of actifs) {
    const s = slugOption(o)
    if (o.versions_multiples) {
      o.versions_multiples.split('|').map((x) => x.trim()).filter(Boolean).forEach((x, i) => {
        const m = x.match(/^(.*?)\s*=\s*([\d.,]+)\s*(?:\[(si|hors):([^\]]+)\])?\s*$/)
        const tag = m[4]?.trim()
        variantes.push({ slug: slugCase(o, i), nom: m[1].trim(), option: s, type: 'cases', prixTtc: Number(m[2]), ordre: i + 1,
          marque: m[3] === 'si' && tag === 'Ford' ? 'ford' : null,
          saufMarque: m[3] === 'hors' && tag === 'Ford' ? 'ford' : null,
          plateforme: m[3] === 'si' && tag === 'T5' ? 'vw-t5' : null })
      })
    }
    if (o.variantes && o.variantes.includes('|')) {
      o.variantes.split('|').map((x) => x.trim()).filter(Boolean).forEach((x, i) => {
        const m = x.match(/^(.*?)\s*=\s*([\d.,]+)\s*(?:\/\s*([\d.,]+))?\s*$/)
        variantes.push({ slug: slugChoix(o, i), nom: m[1].trim(), option: s, type: 'choix', ordre: i + 1,
          prixTtc: Number(m[2]), prixBest: m[3] ? Number(m[3]) : null })
      })
    }
    if (o.paliers_de_prix) {
      o.paliers_de_prix.split('|').map((x) => x.trim()).forEach((x, i) => {
        const r = x.match(/^(\d+)\s*(?:-\s*(\d+)|\+)\s*=\s*([\d.,]+)$/)
        variantes.push({ slug: `palier-${i + 1}`, nom: x, option: s, type: 'palier', ordre: i + 1,
          min: Number(r[1]), max: r[2] ? Number(r[2]) : null, prixTtc: Number(r[3]) })
      })
    }
  }

  const vehicules = p.vehicules.filter((v) => v.statut !== 'Retiré')
  return {
    marques: [...new Set(vehicules.map((v) => v.marque))].map((nom, i) => ({ slug: slugifier(nom), nom, ordre: i + 1 })),
    plateformes: Object.entries(PLATEFORMES).map(([nom, slug]) => ({ slug, nom })),
    groupes: [
      { slug: 'x82', nom: 'Renault X82' },
      { slug: 'universel', nom: 'Kit universel', suffixeKit: 'universel' },
      { slug: 'combi', nom: 'VW Combi' },
    ],
    kits: p.kits.map((k, i) => ({ slug: k.code.toLowerCase(), nom: k.nom, ordre: i + 1, statut: 'a-valider' })),
    finitions: p.finitions.map((f, i) => ({ slug: f.code.toLowerCase(), nom: f.nom, ordre: i + 1, statut: 'a-valider' })),
    vehicules: vehicules.map((v, i) => ({
      slug: v.id, nom: `${v.marque} ${v.modele}`, marque: slugifier(v.marque), modele: v.modele, ordre: i + 1,
      plateforme: PLATEFORMES[v.plateforme_code] ?? null,
      groupe: v.kit_universel ? 'universel' : v.kits.includes('Combi') ? 'combi' : v.plateforme_code === 'X82' ? 'x82' : null,
      kits: v.kits.map(kitCms), statut: STATUTS[v.statut], recommande: RECOMMANDES.includes(v.id),
    })),
    longueurs: vehicules.flatMap((v) => v.longueurs.map((l, i) => ({ slug: slugLongueur(v, i), vehicule: v.id, etiquette: l.etiquette, gabarit: l.gabarit, ordre: i + 1 }))),
    grille: p.grille.filter((g) => g.statut !== 'Retiré').map((g) => ({
      groupe: GROUPES[g.groupe], gabarit: g.longueur.toLowerCase(), kit: g.kit.toLowerCase(), finition: g.finition.toLowerCase(),
      prix: g.prix_ttc, statut: STATUTS[g.statut],
    })),
    options: actifs.map((o) => ({
      slug: slugOption(o), nom: o.nom, section: slugifier(o.section), ordre: o.ordre,
      prixTtc: o.prix_ttc ?? null, prixL2: o.prix_l2, prixBest: o.prix_best, prixBestL2: o.prix_best_l2, prixVwT5: o.prix_vw_t5 ?? null,
      montage: MONTAGES[o.montage] ?? 'tous', motifIndispo: o.motif_si_non_disponible || '', motifInclus: o.motif_si_inclus || '',
      kits: o.kits_compatibles.filter((k) => k !== 'Universel').map(kitCms),
      finitions: o.finitions_requises.map((f) => f.toLowerCase()),
      plateformes: o.plateformes_requises.map((x) => PLATEFORMES[x]),
      dependDe: o.depend_de.filter((id) => idVersSlug.has(id)).map((id) => idVersSlug.get(id)),
      incompatibleAvec: o.incompatible_avec.filter((id) => idVersSlug.has(id)).map((id) => idVersSlug.get(id)),
      statut: STATUTS[o.statut],
    })),
    variantes,
  }
}
