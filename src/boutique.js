/**
 * Filtres de la page catégorie « Kits d'aménagement » de la boutique.
 * Les cartes sont rendues par Webflow (liste CMS) ; le script ne fait que les masquer,
 * les réordonner et compléter prix et chip selon le véhicule choisi.
 *
 * Contrat avec la page Webflow (attributs) :
 *   [data-boutique="kits"]            racine
 *   [data-carte="kit"] data-kit=…     carte d'un kit ; [data-champ="prix"|"chip"|"badge"|"nom"]
 *   [data-select] > [data-champ="libelle-select"] + select   boîte visible d'un select (texte recopié, classe desactive)
 *   [data-filtre="…"]                 contrôles : recherche, marque, modele, longueur (select),
 *                                     agencement, finition, budget, delai (boutons data-valeur), pose (switch), tri
 *   [data-groupe="…"] > [data-action="plier"] + .boutique_groupe_corps   accordéons, tous fermés au chargement (« + » fermé, « − » ouvert)
 *   [data-liste="chips"]              chips des filtres actifs
 *   [data-champ="compteur"|"compteur-haut"|"etat-filtres"]
 *   [data-bloc="aucun-resultat"]      bloc vide, [data-champ="justification"]
 *   [data-action="tout-effacer"|"filtres"]
 */
import { slugifier } from './catalogue.js'
import { num } from './regles.js'
import { euros, pluriel } from './format.js'
import { TEXTES } from './config.js'

/* ------------------------------------------------------------------ état --- */

export const filtresVides = () => ({
  recherche: '', marque: null, vehicule: null, longueur: null,
  agencement: [], finition: [], budget: [], delai: [], pose: false, tri: 'pertinence',
})

const GROUPES_CASES = ['agencement', 'finition', 'budget', 'delai']
const CLES_URL = { recherche: 'q', marque: 'marque', vehicule: 'modele', longueur: 'longueur', agencement: 'agencement', finition: 'finition', budget: 'budget', delai: 'delai', pose: 'pose', tri: 'tri' }

export function filtresDepuisUrl(search) {
  const p = new URLSearchParams(search)
  const f = filtresVides()
  for (const [cle, nom] of Object.entries(CLES_URL)) {
    const v = p.get(nom)
    if (v == null || v === '') continue
    if (GROUPES_CASES.includes(cle)) f[cle] = v.split(',').filter(Boolean)
    else if (cle === 'pose') f.pose = v === '1'
    else f[cle] = v
  }
  return f
}

export function filtresVersUrl(f) {
  const p = new URLSearchParams()
  for (const [cle, nom] of Object.entries(CLES_URL)) {
    const v = f[cle]
    if (GROUPES_CASES.includes(cle)) { if (v.length) p.set(nom, v.join(',')) }
    else if (cle === 'pose') { if (v) p.set(nom, '1') }
    else if (cle === 'tri') { if (v && v !== 'pertinence') p.set(nom, v) }
    else if (v) p.set(nom, v)
  }
  const s = p.toString()
  return s ? '?' + s : ''
}

/** « 0-2200 » → [0, 2200], « 2500- » → [2500, Infinity]. */
export const tranche = (v) => {
  const [a, b] = String(v).split('-')
  return [Number(a) || 0, b === '' || b == null ? Infinity : Number(b)]
}

/* --------------------------------------------------------- catalogue --- */

/**
 * La page n'a pas de liste cachée pour les kits ni les finitions : la grille et le rail les portent déjà.
 * Complète le catalogue brut (avant indexer) depuis les cartes [data-carte="kit"] et les boutons [data-filtre="finition"].
 */
export function completerDepuisPage(brut, racine) {
  if (!brut.kits?.length) {
    brut.kits = [...racine.querySelectorAll('[data-carte="kit"]')].map((el, i) => ({
      slug: el.dataset.kit, nom: el.dataset.nom || el.querySelector('[data-champ="nom"]')?.textContent.trim() || el.dataset.kit,
      sousLibelle: el.dataset.sousLibelle || null, badge: el.dataset.badge || null,
      statut: slugifier(el.dataset.statut || 'a-valider'), ordre: i + 1,
    })).filter((k) => k.slug)
  }
  if (!brut.finitions?.length) {
    brut.finitions = [...racine.querySelectorAll('[data-filtre="finition"][data-valeur]')].map((el, i) => ({
      slug: el.dataset.valeur, nom: el.querySelector('[data-champ="libelle"]')?.textContent.trim() || el.dataset.valeur, ordre: i + 1, statut: 'a-valider',
    }))
  }
  return brut
}

const vivant = (x) => x.statut !== 'retire' && x.statut !== 'a-creer'

/** Véhicules concernés par le filtre véhicule : un seul, ceux de la marque, ou aucun (tous). */
export function vehiculesCibles(f, c) {
  if (f.vehicule) { const v = c.par.vehicules.get(f.vehicule); return v && vivant(v) ? [v] : [] }
  if (f.marque) return c.vehicules.filter((v) => v.marque === f.marque && vivant(v))
  return null
}

/** Le kit est-il proposé sur le véhicule (ou la marque) filtré ? */
export function kitCompatible(kit, f, c) {
  const cibles = vehiculesCibles(f, c)
  if (!cibles) return true
  return cibles.some((v) => v.kits.includes(kit.slug))
}

/** Lignes de grille qui concernent le kit dans le périmètre du filtre véhicule / longueur. */
export function lignesGrille(kit, f, c) {
  const cibles = vehiculesCibles(f, c)
  const groupes = cibles ? new Set(cibles.map((v) => v.groupe).filter(Boolean)) : null
  const gabarit = f.vehicule && f.longueur
    ? c.par.vehicules.get(f.vehicule)?.longueurs.find((l) => l.slug === f.longueur)?.gabarit ?? null
    : null
  return c.grille.filter((x) => x.kit === kit.slug && x.statut !== 'retire' && num(x.prix)
    && (!groupes || groupes.has(x.groupe))
    && (!gabarit || x.gabarit === 'toutes' || x.gabarit === gabarit))
}

/** Finitions proposées pour ce kit dans le périmètre (slugs). */
export const finitionsDuKit = (kit, f, c) => new Set(lignesGrille(kit, f, c).map((x) => x.finition))

/**
 * Prix affiché sur la carte : { montant, exact } ; montant null = « prix à compléter ».
 * Avec véhicule + longueur et une seule finition filtrée : prix exact ; sinon le plus bas de la grille
 * (affiché sans « à partir de », comme sur la maquette ; exact = false permet de le savoir).
 */
export function prixCarte(kit, f, c) {
  let lignes = lignesGrille(kit, f, c)
  if (f.finition.length) lignes = lignes.filter((x) => f.finition.includes(x.finition))
  if (!lignes.length) return { montant: null, exact: false }
  const prix = lignes.map((x) => x.prix)
  const mini = Math.min(...prix), maxi = Math.max(...prix)
  return { montant: mini, exact: mini === maxi }
}

/** Nom complet du kit avec le suffixe du groupe de prix (« Kit Travel universel »). */
export function nomCarte(kit, f, c) {
  const v = f.vehicule ? c.par.vehicules.get(f.vehicule) : null
  const suffixe = v ? c.par.groupes.get(v.groupe)?.suffixeKit : null
  return suffixe ? `${kit.nom} ${suffixe}` : kit.nom
}

/** Le kit passe-t-il tous les filtres, sauf éventuellement un groupe (pour les compteurs) ? */
export function kitVisible(kit, f, c, sauf = null) {
  if (!vivant(kit)) return false
  if (f.recherche) {
    const q = slugifier(f.recherche)
    if (q && !slugifier(`${kit.nom} ${kit.sousLibelle ?? ''}`).includes(q)) return false
  }
  if (!kitCompatible(kit, f, c)) return false
  if (sauf !== 'agencement' && f.agencement.length && !f.agencement.includes(kit.slug)) return false
  if (sauf !== 'finition' && f.finition.length) {
    const dispo = finitionsDuKit(kit, f, c)
    if (!f.finition.some((x) => dispo.has(x))) return false
  }
  if (sauf !== 'budget' && f.budget.length) {
    const { montant } = prixCarte(kit, { ...f, finition: sauf === 'finition' ? [] : f.finition }, c)
    if (!num(montant)) return false
    if (!f.budget.some((t) => { const [a, b] = tranche(t); return montant >= a && montant < b })) return false
  }
  // Délai et pose : aucune donnée dans le CMS pour les kits (en attente de Willy) ; les groupes restent masqués.
  return true
}

/** Nombre de kits visibles si l'on cochait cette valeur dans ce groupe (les autres filtres restant appliqués). */
export function compteur(groupe, valeur, f, c) {
  const essai = { ...f, [groupe]: [valeur] }
  return c.kits.filter((k) => kitVisible(k, essai, c)).length
}

export function trier(kits, f, c) {
  if (f.tri !== 'prix-croissant' && f.tri !== 'prix-decroissant') return kits
  const sens = f.tri === 'prix-croissant' ? 1 : -1
  const p = (k) => prixCarte(k, f, c).montant
  return [...kits].sort((a, b) => {
    const pa = p(a), pb = p(b)
    if (!num(pa) && !num(pb)) return 0
    if (!num(pa)) return 1
    if (!num(pb)) return -1
    return (pa - pb) * sens
  })
}

/** Chips des filtres actifs : [{ filtre, valeur, libelle }]. */
export function chips(f, c) {
  const l = []
  if (f.marque) l.push({ filtre: 'marque', valeur: f.marque, libelle: c.par.marques.get(f.marque)?.nom ?? f.marque })
  const v = f.vehicule ? c.par.vehicules.get(f.vehicule) : null
  if (v) l.push({ filtre: 'vehicule', valeur: v.slug, libelle: `${v.modele}${v.millesime ? ' · ' + v.millesime : ''}` })
  const lg = v?.longueurs.find((x) => x.slug === f.longueur)
  if (lg) l.push({ filtre: 'longueur', valeur: lg.slug, libelle: lg.etiquette })
  for (const s of f.agencement) l.push({ filtre: 'agencement', valeur: s, libelle: c.par.kits.get(s)?.nom ?? s })
  for (const s of f.finition) l.push({ filtre: 'finition', valeur: s, libelle: c.par.finitions.get(s)?.nom ?? s })
  for (const t of f.budget) {
    const [a, b] = tranche(t)
    l.push({ filtre: 'budget', valeur: t, libelle: b === Infinity ? `Plus de ${euros(a)}` : a === 0 ? `Moins de ${euros(b)}` : `${euros(a)} – ${euros(b)}` })
  }
  for (const d of f.delai) l.push({ filtre: 'delai', valeur: d, libelle: d })
  if (f.pose) l.push({ filtre: 'pose', valeur: 'atelier', libelle: 'Pose atelier' })
  if (f.recherche) l.push({ filtre: 'recherche', valeur: f.recherche, libelle: `« ${f.recherche} »` })
  return l
}

/** Retire une valeur d'un filtre (chip ×). Renvoie un nouvel état. */
export function retirer(f, filtre, valeur) {
  const g = { ...f }
  if (GROUPES_CASES.includes(filtre)) g[filtre] = f[filtre].filter((x) => x !== valeur)
  else if (filtre === 'pose') g.pose = false
  else if (filtre === 'recherche') g.recherche = ''
  else if (filtre === 'marque') { g.marque = null; g.vehicule = null; g.longueur = null }
  else if (filtre === 'vehicule') { g.vehicule = null; g.longueur = null }
  else if (filtre === 'longueur') g.longueur = null
  return g
}

/* -------------------------------------------------------------- vues --- */

export const ICONE_OUVERT = '−', ICONE_FERME = '+'
const texte = (el, s) => { if (el) el.textContent = s ?? '' }
const montrer = (el, oui) => { if (el) el.toggleAttribute('hidden', !oui) }

export function creerBoutique({ racine, catalogue: c, document: doc = document, history: hist = globalThis.history, location: loc = globalThis.location }) {
  let f = filtresDepuisUrl(loc?.search ?? '')
  const q = (s) => racine.querySelector(s)
  const qa = (s) => [...racine.querySelectorAll(s)]
  const cartes = qa('[data-carte="kit"]')
  const liste = q('[data-liste="kits"]') ?? cartes[0]?.parentElement?.parentElement
  const items = cartes.map((el) => ({ el, slug: el.dataset.kit, item: el.closest('.w-dyn-item') ?? el }))
  const ordreInitial = items.map((x) => x.item)
  const selMarque = q('[data-filtre="marque"]'), selModele = q('[data-filtre="modele"]'), selLongueur = q('[data-filtre="longueur"]')

  /* ---- selects du véhicule : options depuis le catalogue ---- */
  function remplir(select, options, vide, valeur) {
    if (!select) return
    const premier = select.querySelector('option')
    select.innerHTML = ''
    const o0 = doc.createElement('option'); o0.value = ''; o0.textContent = premier?.textContent || vide
    select.append(o0)
    for (const { valeur: v, libelle } of options) { const o = doc.createElement('option'); o.value = v; o.textContent = libelle; select.append(o) }
    select.value = options.some((o) => o.valeur === valeur) ? valeur : ''
    select.disabled = !options.length
    // Boîte visible (texte + chevron) autour du select natif transparent.
    const boite = select.closest('[data-select]')
    if (boite) {
      texte(boite.querySelector('[data-champ="libelle-select"]'), select.selectedOptions[0]?.textContent ?? o0.textContent)
      boite.classList.toggle('desactive', select.disabled)
    }
  }
  function rendreSelects() {
    const marques = c.marques.filter((m) => c.vehicules.some((v) => v.marque === m.slug && vivant(v)))
    remplir(selMarque, marques.map((m) => ({ valeur: m.slug, libelle: m.nom })), 'Marque', f.marque)
    const modeles = f.marque ? c.vehicules.filter((v) => v.marque === f.marque && vivant(v)) : []
    remplir(selModele, modeles.map((v) => ({ valeur: v.slug, libelle: `${v.modele}${v.millesime ? ' · ' + v.millesime : ''}` })), 'Modèle', f.vehicule)
    const longueurs = f.vehicule ? (c.par.vehicules.get(f.vehicule)?.longueurs ?? []) : []
    remplir(selLongueur, longueurs.map((l) => ({ valeur: l.slug, libelle: l.etiquette })), 'Longueur / empattement', f.longueur)
  }

  /* ---- cartes ---- */
  function rendreCartes() {
    const visibles = trier(c.kits.filter((k) => kitVisible(k, f, c)), f, c)
    const slugsVisibles = new Set(visibles.map((k) => k.slug))
    for (const { el, slug, item } of items) {
      const kit = c.par.kits.get(slug)
      montrer(item, !!kit && slugsVisibles.has(slug))
      if (!kit) continue
      texte(el.querySelector('[data-champ="nom"]'), nomCarte(kit, f, c))
      const { montant } = prixCarte(kit, f, c)
      texte(el.querySelector('[data-champ="prix"]'), num(montant) ? euros(montant) : TEXTES.prixACompleter)
      const chip = el.querySelector('[data-champ="chip"]')
      const v = f.vehicule ? c.par.vehicules.get(f.vehicule) : null
      const lg = v?.longueurs.find((x) => x.slug === f.longueur)
      texte(chip, lg ? lg.etiquette : v ? v.modele : '')
      montrer(chip, !!v)
      const badge = el.querySelector('[data-champ="badge"]')
      montrer(badge, !!badge?.textContent.trim())
    }
    // Ordre : tri par prix, ou ordre du CMS.
    if (liste) {
      const ordre = f.tri === 'pertinence' ? ordreInitial : visibles.map((k) => items.find((x) => x.slug === k.slug)?.item).filter(Boolean)
      for (const node of ordre) liste.append(node)
    }
    const n = visibles.length, total = c.kits.filter(vivant).length
    texte(q('[data-champ="compteur"]'), `${pluriel(n, 'kit')} sur ${total}`)
    texte(q('[data-champ="compteur-haut"]'), pluriel(n, 'kit'))
    montrer(q('[data-bloc="aucun-resultat"]'), n === 0)
    if (n === 0) texte(q('[data-champ="justification"]'), justification())
    return visibles
  }

  function justification() {
    const v = f.vehicule ? c.par.vehicules.get(f.vehicule) : null
    const bouts = []
    if (v) bouts.push(`sur ${v.nom}`)
    else if (f.marque) bouts.push(`chez ${c.par.marques.get(f.marque)?.nom ?? f.marque}`)
    if (f.finition.length) bouts.push(`en finition ${f.finition.map((s) => c.par.finitions.get(s)?.nom ?? s).join(' ou ')}`)
    if (f.budget.length) bouts.push('dans cette fourchette de prix')
    if (f.recherche) bouts.push(`pour « ${f.recherche} »`)
    return `Aucun kit n'est proposé ${bouts.join(', ') || 'avec ces critères'}. Retirez un filtre, ou demandez-nous un devis sur mesure : chaque kit est découpé aux gabarits de votre véhicule.`
  }

  /* ---- rail : cases, compteurs, chips, état ---- */
  function rendreRail() {
    for (const el of qa('[data-filtre][data-valeur]')) {
      const g = el.dataset.filtre, v = el.dataset.valeur
      if (g === 'pose') {
        el.setAttribute('aria-checked', String(f.pose))
        el.querySelector('[data-champ="switch"]')?.classList.toggle('selectionne', f.pose)
        el.querySelector('[data-champ="switch-bouton"]')?.classList.toggle('selectionne', f.pose)
        continue
      }
      if (!GROUPES_CASES.includes(g)) continue
      const coche = f[g].includes(v)
      el.classList.toggle('selectionne', coche)
      el.setAttribute('aria-pressed', String(coche))
      texte(el.querySelector('[data-champ="compteur"]'), String(compteur(g, v, f, c)))
    }
    const zone = q('[data-liste="chips"]')
    if (zone) {
      zone.innerHTML = ''
      for (const ch of chips(f, c)) {
        const b = doc.createElement('button')
        b.type = 'button'; b.className = 'boutique_chip'
        b.dataset.action = 'retirer'; b.dataset.filtre = ch.filtre; b.dataset.valeur = ch.valeur
        b.setAttribute('aria-label', `Retirer le filtre ${ch.libelle}`)
        b.textContent = `${ch.libelle} ×`
        zone.append(b)
      }
    }
    const nb = chips(f, c).length
    texte(q('[data-champ="etat-filtres"]'), nb ? `${pluriel(nb, 'filtre')} appliqué${nb > 1 ? 's' : ''}` : 'Aucun filtre appliqué')
    const r = q('[data-filtre="recherche"]'); if (r && r.value !== f.recherche) r.value = f.recherche
    const t = q('[data-filtre="tri"]'); if (t) t.value = f.tri
  }

  function rendre() {
    rendreSelects()
    const visibles = rendreCartes()
    rendreRail()
    if (hist?.replaceState && loc) hist.replaceState(null, '', (loc.pathname ?? '') + filtresVersUrl(f) + (loc.hash ?? ''))
    racine.dispatchEvent(new CustomEvent('kapam:boutique', { bubbles: true, detail: { filtres: { ...f }, visibles: visibles.map((k) => k.slug) } }))
  }

  /**
   * Ouvre ou ferme un groupe du rail. L'état vient de aria-expanded (une seule source) ;
   * le corps est masqué par hidden ET display:none en ligne, pour ne pas dépendre du style du head
   * (sinon le display:flex de la classe gagne et le corps reste visible sous un « + »).
   */
  function plier(groupe, ouvert) {
    if (!groupe) return
    const tete = groupe.querySelector(':scope > [data-action="plier"]')
    const corps = groupe.querySelector(':scope > .boutique_groupe_corps')
    tete?.setAttribute('aria-expanded', String(ouvert))
    texte(tete?.querySelector('.boutique_groupe_icone'), ouvert ? ICONE_OUVERT : ICONE_FERME)
    if (corps) { corps.hidden = !ouvert; corps.style.display = ouvert ? '' : 'none' }
  }
  // Au chargement, tous les groupes sont fermés.
  for (const g of qa('[data-groupe]')) plier(g, false)

  function changer(g) { f = { ...f, ...g }; rendre() }

  /* ---- interactions ---- */
  racine.addEventListener('change', (ev) => {
    const el = ev.target.closest('[data-filtre]'); if (!el) return
    const v = el.value || null
    switch (el.dataset.filtre) {
      case 'marque': return changer({ marque: v, vehicule: null, longueur: null })
      case 'modele': return changer({ vehicule: v, longueur: null, marque: v ? c.par.vehicules.get(v)?.marque ?? f.marque : f.marque })
      case 'longueur': return changer({ longueur: v })
      case 'tri': return changer({ tri: v ?? 'pertinence' })
    }
  })
  let minuterie = null
  racine.addEventListener('input', (ev) => {
    const el = ev.target.closest('[data-filtre="recherche"]'); if (!el) return
    clearTimeout(minuterie)
    minuterie = setTimeout(() => changer({ recherche: el.value.trim() }), 150)
  })
  racine.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-action], [data-filtre][data-valeur]'); if (!el) return
    const { action, filtre, valeur } = el.dataset
    if (action === 'retirer') return changer(retirer(f, filtre, valeur))
    if (action === 'tout-effacer') return changer({ ...filtresVides(), tri: f.tri })
    if (action === 'plier') return plier(el.closest('[data-groupe]'), el.getAttribute('aria-expanded') !== 'true')
    if (action === 'filtres') {
      const rail = q('[data-rail]'); const cache = rail?.hasAttribute('hidden')
      montrer(rail, cache); el.setAttribute('aria-expanded', String(!!cache)); return
    }
    if (filtre === 'pose') return changer({ pose: !f.pose })
    if (GROUPES_CASES.includes(filtre)) {
      const l = f[filtre].includes(valeur) ? f[filtre].filter((x) => x !== valeur) : [...f[filtre], valeur]
      return changer({ [filtre]: l })
    }
  })

  return { rendre, changer, get filtres() { return { ...f } }, remplacer(nf) { f = { ...filtresVides(), ...nf }; rendre() } }
}
