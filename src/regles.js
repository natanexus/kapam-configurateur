/**
 * Logique du configurateur, reprise du prototype (prototype-logique.js, 28/09/2026).
 * Fonctions pures : (etat, catalogue indexé) → résultat. Aucun accès au DOM.
 *
 * Écarts volontaires avec le prototype :
 * - véhicule sans grille de prix : prix du kit inconnu (« prix à compléter »), plus de prix « maquette » ;
 * - option, version ou gamme sans prix : masquée (décision Nathan, 20/10/2026) ;
 * - montage et VASP trouvés par slug, VW T5 par plateforme, versions filtrées par marque/plateforme.
 */
import {
  SLUG_MONTAGE, SLUG_VASP, SLUG_BICOLORE, PLATEFORME_VW_T5, SECTION_SERVICES, GAMMES_STRATIFIE, HOUSSES,
} from './config.js'

export const num = (x) => typeof x === 'number' && Number.isFinite(x)
const somme = (l) => l.reduce((t, x) => t + x, 0)

/* ------------------------------------------------------------- état --- */

export const etatVide = () => ({
  etape: 0,
  situation: null,      // je-lai-deja | je-sais-lequel | pas-encore
  marque: null,         // slug
  vehicule: null,       // slug
  longueur: null,       // slug de la longueur
  kit: null,            // slug
  finition: null,       // slug
  montage: null,        // 'soi-meme' | 'atelier'
  vasp: false,
  options: {},          // slug option → true
  versions: {},         // slug option → slug variante (choix unique)
  cases: {},            // slug option → [slug variante] (cases cumulables)
  attributs: { stratifie: '', stratifie2: '', literie: '', sol: '' },
  coordonnees: {},
  demande: null,        // null | 'conseil' | 'sur-mesure'
  horsListe: false,
  vehiculeLibre: {},
})

/* ------------------------------------------------------------ accès --- */

export const vehicule = (e, c) => c.par.vehicules.get(e.vehicule) ?? null
export const longueur = (e, c) => vehicule(e, c)?.longueurs.find((l) => l.slug === e.longueur) ?? null
export const gabarit = (e, c) => longueur(e, c)?.gabarit ?? null
export const kit = (e, c) => c.par.kits.get(e.kit) ?? null
export const finition = (e, c) => c.par.finitions.get(e.finition) ?? null
export const optMontage = (c) => c.par.options.get(SLUG_MONTAGE) ?? null
export const optVasp = (c) => c.par.options.get(SLUG_VASP) ?? null

/** Nom affiché du kit, avec le suffixe du groupe de prix (« Kit Travel universel »). */
export function nomKit(k, e, c) {
  if (!k) return ''
  const suffixe = c.par.groupes.get(vehicule(e, c)?.groupe)?.suffixeKit
  return suffixe ? `${k.nom} ${suffixe}` : k.nom
}

/* ------------------------------------------------------- prix du kit --- */

/** Lignes de grille du véhicule et de sa longueur, ou null si le véhicule n'a pas de grille. */
export function grilleKit(e, c) {
  const v = vehicule(e, c), g = gabarit(e, c)
  if (!v?.groupe) return null
  const lignes = c.grille.filter((x) => x.groupe === v.groupe && x.statut !== 'retire'
    && (x.gabarit === 'toutes' || (g && x.gabarit === g)))
  return lignes.length ? lignes : null
}

/** { prix, dispo, aCompleter } : aCompleter = véhicule sans grille ; dispo = false si la combinaison n'existe pas. */
export function prixKit(e, c, slugKit = e.kit, slugFinition = e.finition) {
  const gr = grilleKit(e, c)
  if (!gr) return { prix: null, dispo: true, aCompleter: true }
  const l = gr.find((x) => x.kit === slugKit && x.finition === slugFinition)
  const prix = l && num(l.prix) ? l.prix : null
  return { prix, dispo: prix !== null, aCompleter: false }
}

export function prixKitMini(e, c, slugKit) {
  const prix = (grilleKit(e, c) ?? []).filter((x) => x.kit === slugKit && num(x.prix)).map((x) => x.prix)
  return prix.length ? Math.min(...prix) : null
}

/* ---------------------------------------------------- prix des options --- */

const pourVehicule = (x, v) => (!x.marque || v?.marque === x.marque)
  && (!x.saufMarque || v?.marque !== x.saufMarque)
  && (!x.plateforme || v?.plateforme === x.plateforme)

/** Versions « choix unique » proposables (avec un prix). */
export const versionsChoix = (o, e, c) => o.variantes
  .filter((x) => x.type === 'choix' && num(x.prixTtc) && pourVehicule(x, vehicule(e, c)))

/** Versions « cases cumulables » proposables sur ce véhicule (avec un prix). */
export const versionsCases = (o, e, c) => o.variantes
  .filter((x) => x.type === 'cases' && num(x.prixTtc) && pourVehicule(x, vehicule(e, c)))

/** Une option sans aucun prix n'est pas proposée. */
export const aUnPrix = (o) => num(o.prixTtc)
  || o.variantes.some((x) => (x.type === 'choix' || x.type === 'cases' || x.type === 'palier') && num(x.prixTtc))

/** Prix d'une option selon la version choisie, la finition, la longueur et la plateforme. null = pas de prix. */
export function prixOption(o, e, c) {
  const best = e.finition === 'best'
  const long = gabarit(e, c) === 'long'
  const v = vehicule(e, c)

  if (o.variantes.some((x) => x.type === 'cases')) {
    const dispo = versionsCases(o, e, c)
    if (!dispo.length) return null
    const choisies = e.cases?.[o.slug] ?? []
    const sel = dispo.filter((x) => choisies.includes(x.slug))
    return sel.length ? somme(sel.map((x) => x.prixTtc)) : Math.min(...dispo.map((x) => x.prixTtc))
  }
  if (num(o.prixVwT5) && v?.plateforme === PLATEFORME_VW_T5) return o.prixVwT5
  const choix = versionsChoix(o, e, c)
  if (choix.length) {
    const prixDe = (x) => (best && num(x.prixBest) ? x.prixBest : x.prixTtc)
    const sel = choix.find((x) => x.slug === e.versions?.[o.slug])
    return sel ? prixDe(sel) : Math.min(...choix.map(prixDe))
  }
  if (best && long && num(o.prixBestL2)) return o.prixBestL2
  if (best && num(o.prixBest)) return o.prixBest
  if (long && num(o.prixL2)) return o.prixL2
  return num(o.prixTtc) ? o.prixTtc : null
}

/** Ce que la ligne affiche : { prefixe: 'à partir de' | '+' | 'inclus', montant }. */
export function affichagePrix(o, e, c) {
  const p = prixOption(o, e, c)
  if (p === 0) return { prefixe: 'inclus', montant: 0 }
  const casesVides = o.variantes.some((x) => x.type === 'cases') && !(e.cases?.[o.slug] ?? []).length
  const choixVide = versionsChoix(o, e, c).length > 0 && !e.versions?.[o.slug]
  return { prefixe: casesVides || choixVide ? 'à partir de' : '+', montant: p }
}

/* ------------------------------------------------------ disponibilité --- */

/**
 * { etat: 'ok' | 'masque' | 'bloque' | 'inclus', raison?, motif?, refs? }
 * Tout vient des champs du CMS : aucune compatibilité écrite en dur ici.
 */
export function disponibilite(o, e, c) {
  if (o.statut === 'retire' || o.statut === 'a-creer') return { etat: 'masque', raison: 'statut' }
  if (!aUnPrix(o)) return { etat: 'masque', raison: 'prix' }
  if (o.kits.length && e.kit && !o.kits.includes(e.kit)) return { etat: 'masque', raison: 'kit' }

  const v = vehicule(e, c)
  const noms = (slugs, index) => slugs.map((s) => index.get(s)?.nom ?? s).join(' ou ')

  if (o.finitions.length && e.finition && !o.finitions.includes(e.finition)) {
    return { etat: 'bloque', raison: 'finition', motif: o.motifIndispo || `Nécessite la finition ${noms(o.finitions, c.par.finitions)}.` }
  }
  if (o.plateformes.length && !(v?.plateforme && o.plateformes.includes(v.plateforme))) {
    return { etat: 'bloque', raison: 'plateforme', motif: o.motifIndispo || `Réservé aux plateformes ${noms(o.plateformes, c.par.plateformes)}.` }
  }
  for (const dep of o.dependDe) {
    if (!e.options[dep]) {
      return { etat: 'bloque', raison: 'dependance', refs: [dep], motif: o.motifIndispo || `Nécessite « ${c.par.options.get(dep)?.nom ?? dep} ».` }
    }
  }
  if (o.montage === 'atelier' && e.montage !== 'atelier') {
    return { etat: 'bloque', raison: 'atelier', motif: o.motifIndispo || "Posée uniquement par l'atelier Kapam : disponible avec la formule clé en main." }
  }
  if (o.montage === 'inclus' && e.montage === 'atelier') {
    return { etat: 'inclus', raison: 'inclus', motif: o.motifInclus || "Déjà compris dans les postes ajoutés d'office avec le montage à l'atelier." }
  }
  for (const inc of o.incompatibleAvec) {
    if (e.options[inc]) {
      return { etat: 'bloque', raison: 'incompatible', refs: [inc], motif: o.motifIndispo || `Incompatible avec « ${c.par.options.get(inc)?.nom ?? inc} ».` }
    }
  }
  return { etat: 'ok' }
}

/* ----------------------------------------------------- montage atelier --- */

/** Longueur tarifaire des postes imposés : court et moyen → L1, long → L2, sinon L1 à confirmer. */
export function tarifAtelier(e, c) {
  const g = gabarit(e, c)
  if (g === 'long') return { cle: 'L2', certain: true }
  if (g === 'court' || g === 'moyen') return { cle: 'L1', certain: true }
  return { cle: 'L1', certain: false }
}

/** Postes « Imposé en atelier », au tarif de la longueur. */
export function lignesImposees(e, c) {
  if (e.montage !== 'atelier') return []
  const t = tarifAtelier(e, c)
  return c.options
    .filter((o) => o.montage === 'impose' && o.statut !== 'retire')
    .map((o) => ({ option: o.slug, nom: o.nom, montant: t.cle === 'L2' && num(o.prixL2) ? o.prixL2 : o.prixTtc, cle: t.cle, certain: t.certain }))
}

/** Paliers du montage (variantes « Palier de prix » de l'option montage-atelier). */
export function paliersMontage(c) {
  return (optMontage(c)?.variantes ?? [])
    .filter((x) => x.type === 'palier' && num(x.prixTtc))
    .map((x) => ({ min: num(x.min) ? x.min : 0, max: num(x.max) ? x.max : Infinity, prix: x.prixTtc }))
    .sort((a, b) => a.min - b.min)
}

/** Palier atteint pour une base (kit + options + postes imposés, hors montage et VASP). */
export function palierMontage(base, c) {
  const paliers = paliersMontage(c)
  const p = paliers.find((x) => base <= x.max) ?? paliers.at(-1)
  return p ? { ...p } : { min: null, max: null, prix: optMontage(c)?.prixTtc ?? null }
}

/* ------------------------------------------------------------- devis --- */

const supplement = (liste, slug) => liste.find((g) => g.slug === slug)?.prix
export const gammesProposees = (liste) => liste.filter((g) => num(g.prix))

/**
 * Lignes du récapitulatif. Chaque ligne : { type, montant, ... } ; le libellé est construit par la vue.
 * total = somme des montants connus ; incomplet = au moins un montant inconnu.
 */
export function devis(e, c) {
  const lignes = []
  const k = kit(e, c), f = finition(e, c)
  if (k && f) {
    const pk = prixKit(e, c)
    lignes.push({ type: 'kit', kit: k.slug, nomKit: nomKit(k, e, c), finition: f.slug, nomFinition: f.nom,
      longueur: longueur(e, c)?.etiquette ?? null, montant: pk.prix, aCompleter: pk.aCompleter })
  }
  let indexMontage = -1
  if (e.montage === 'atelier' && optMontage(c)) { indexMontage = lignes.length; lignes.push(null) }
  const w = optVasp(c)
  if (e.vasp && w) lignes.push({ type: 'vasp', option: w.slug, nom: w.nom, montant: w.prixTtc })

  for (const o of c.options) {
    if (o.section === SECTION_SERVICES || o.slug === SLUG_MONTAGE || o.slug === SLUG_VASP) continue
    if (!e.options[o.slug]) continue
    if (['bloque', 'masque', 'inclus'].includes(disponibilite(o, e, c).etat)) continue
    const choisies = versionsCases(o, e, c).filter((x) => (e.cases?.[o.slug] ?? []).includes(x.slug))
    const version = versionsChoix(o, e, c).find((x) => x.slug === e.versions?.[o.slug])
    lignes.push({ type: 'option', option: o.slug, nom: o.nom,
      versions: choisies.length ? choisies.map((x) => x.nom) : version ? [version.nom] : [],
      montant: prixOption(o, e, c) })
  }

  const a = e.attributs ?? {}
  for (const [cle, liste, type] of [['stratifie', GAMMES_STRATIFIE, 'stratifie'], ['stratifie2', GAMMES_STRATIFIE, 'stratifie2'], ['literie', HOUSSES, 'literie']]) {
    const prix = supplement(liste, a[cle])
    if (num(prix) && prix > 0) lignes.push({ type, valeur: a[cle], nom: liste.find((g) => g.slug === a[cle]).nom, montant: prix })
  }

  if (indexMontage >= 0) {
    const vasp = e.vasp && w ? w.prixTtc : 0
    const postes = lignesImposees(e, c)
    const finitions = somme(postes.map((x) => x.montant))
    const base = somme(lignes.filter((l) => l && num(l.montant)).map((l) => l.montant)) - vasp + finitions
    const p = palierMontage(base, c)
    lignes[indexMontage] = { type: 'montage', option: SLUG_MONTAGE, nom: optMontage(c).nom, palier: p, postes,
      montantPose: p.prix, montantPostes: finitions, montant: num(p.prix) ? p.prix + finitions : null }
  }

  const total = somme(lignes.filter((l) => num(l.montant)).map((l) => l.montant))
  const incomplet = lignes.some((l) => !num(l.montant))
  return { lignes, total: Math.round(total * 100) / 100, incomplet }
}

/** Total si le client choisissait ce montage, sans toucher à l'état. */
export const estimation = (mode, e, c) => devis({ ...e, montage: mode, vasp: mode === 'atelier' ? e.vasp : false }, c)

/* ------------------------------------------------------------ cohérence --- */

/** Retire ce qui n'est plus disponible, pour que le total reste honnête. Renvoie un nouvel état. */
export function nettoyer(e0, c) {
  const e = structuredClone(e0)
  e.attributs ??= {}
  if (e.kit && e.finition && vehicule(e, c) && !prixKit(e, c).dispo) e.finition = null
  if (e.finition !== 'best') { e.attributs.stratifie = ''; e.attributs.stratifie2 = '' }
  if (!e.options[SLUG_BICOLORE]) e.attributs.stratifie2 = ''
  for (const [cle, liste] of [['stratifie', GAMMES_STRATIFIE], ['stratifie2', GAMMES_STRATIFIE], ['literie', HOUSSES]]) {
    if (e.attributs[cle] && !num(supplement(liste, e.attributs[cle]))) e.attributs[cle] = ''
  }
  if (e.montage !== 'atelier') e.vasp = false

  let change
  do {
    change = false
    for (const slug of Object.keys(e.options)) {
      const o = c.par.options.get(slug)
      if (!o || ['bloque', 'masque'].includes(disponibilite(o, e, c).etat)) {
        delete e.options[slug]; delete e.versions?.[slug]; delete e.cases?.[slug]
        change = true
      }
    }
  } while (change)
  return e
}

/** L'étape peut-elle être validée ? Index des étapes Webflow : 0 = 1.1, 1 = 1.2, 2 = 1.3, 3 = 2.1, 4 = 3.1, 5 = 3.2. */
export function etapeComplete(e, c) {
  switch (e.etape) {
    case 0: return !!e.marque
    case 1: return !!vehicule(e, c)
    case 2: return !!vehicule(e, c) && !!longueur(e, c)
    case 3: return !!e.kit && !!e.finition && !!e.montage
    default: return true
  }
}
