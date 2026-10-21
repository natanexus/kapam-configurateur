/**
 * Lit les listes CMS cachées de la page (bloc [data-cms-donnees]) et produit le catalogue brut.
 *
 * Structure Webflow attendue, une liste par collection :
 *   <div data-item="options" data-slug="…" data-prix-ttc="…" …>   ← champs liés en attributs
 *     <img data-champ="visuel" src="…">                            ← champs Image
 *     <div data-refs="kits"> … <span data-ref="travel"></span> …   ← multi-références (listes imbriquées)
 *     <span data-champ="recommande"></span>                        ← interrupteur (visibilité conditionnelle)
 *   </div>
 */
import { slugifier } from './catalogue.js'

const STATUTS = { 'À valider Willy': 'a-valider', 'Validé': 'valide', 'Retiré': 'retire', 'À créer': 'a-creer' }
const MONTAGES = { 'Tous montages': 'tous', 'Atelier uniquement': 'atelier', 'Imposé en atelier': 'impose', 'Inclus en atelier': 'inclus' }
const TYPES = { 'Choix unique': 'choix', 'Cases cumulables': 'cases', 'Palier de prix': 'palier' }
const NOMBRES = new Set(['ordre', 'prix', 'prixTtc', 'prixL2', 'prixBest', 'prixBestL2', 'prixVwT5', 'min', 'max'])
const COLLECTIONS = ['marques', 'plateformes', 'groupes', 'kits', 'finitions', 'vehicules', 'longueurs', 'grille', 'options', 'variantes']

export const nombre = (s) => {
  if (s == null || String(s).trim() === '') return null
  const n = Number(String(s).replace(/[\s ]/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

const vide = (v) => (v == null || String(v).trim() === '' ? null : String(v).trim())

/** Image CMS vide : Webflow ajoute w-dyn-bind-empty et ne met pas de src utile. */
const srcImage = (img) => (img && !img.classList.contains('w-dyn-bind-empty') && img.getAttribute('src')) || null

/** Couleur liée en fond dans le Designer (champ CMS Couleur) → « #rrggbb », ou null si non renseignée. */
export function couleur(el) {
  const fond = el.style.backgroundColor || getComputedStyle(el).backgroundColor
  const m = fond && fond.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/)
  if (!m || m[4] === '0') return null
  return '#' + [m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, '0')).join('')
}

function lireItem(el) {
  const brut = { ...el.dataset }
  delete brut.item
  const o = {}
  for (const [cle, valeur] of Object.entries(brut)) o[cle] = NOMBRES.has(cle) ? nombre(valeur) : vide(valeur)

  if (o.statut) o.statut = STATUTS[o.statut] ?? slugifier(o.statut)
  if (o.montage) o.montage = MONTAGES[o.montage] ?? 'tous'
  if (o.type) o.type = TYPES[o.type] ?? slugifier(o.type)
  if (o.gabarit) o.gabarit = slugifier(o.gabarit)
  if (o.section) o.section = slugifier(o.section)

  // Champs portés par des enfants directs (pas ceux des listes imbriquées).
  for (const img of el.querySelectorAll(':scope > img[data-champ]')) o[img.dataset.champ] = srcImage(img)
  const teinte = el.querySelector(':scope > [data-champ="teinte"]')
  if (teinte) o.teinte = couleur(teinte)
  const reco = el.querySelector(':scope > [data-champ="recommande"]')
  if (reco || el.dataset.item === 'vehicules') o.recommande = !!reco && !reco.classList.contains('w-condition-invisible')
  for (const liste of el.querySelectorAll(':scope > [data-refs]')) {
    o[liste.dataset.refs] = [...liste.querySelectorAll('[data-ref]')].map((r) => vide(r.dataset.ref)).filter(Boolean)
  }
  return o
}

/** @returns {import('./catalogue.js').CatalogueBrut} */
export function lireCatalogue(racine = document) {
  const zone = racine.querySelector('[data-cms-donnees]') ?? racine
  const brut = Object.fromEntries(COLLECTIONS.map((c) => [c, []]))
  for (const el of zone.querySelectorAll('[data-item]')) {
    const c = el.dataset.item
    if (brut[c]) brut[c].push(lireItem(el))
  }
  for (const o of brut.options) o.montage ??= 'tous'
  return brut
}
