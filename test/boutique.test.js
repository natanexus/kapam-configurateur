// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import extrait from './fixtures/prototype-catalogue.json'
import SRC from '../src/boutique.js?raw'
import { normaliser, versCms } from './adaptateur.js'
import { indexer } from '../src/catalogue.js'
import {
  creerBoutique, completerDepuisPage, filtresVides, produitVisible, prixProduit, MODES, PAR_PAGE, filtresDepuisUrl, filtresVersUrl, kitVisible, prixCarte, compteur, chips, retirer, tranche,
} from '../src/boutique.js'

const c = indexer(versCms(normaliser(extrait)))
const trafic = c.vehicules.find((v) => v.modele.startsWith('Trafic 3'))
const vito = c.vehicules.find((v) => v.modele.startsWith('Vito 2'))

/* Page Webflow réduite : rail + grille, comme sur /boutique/kits-amenagement. */
function page() {
  const kits = c.kits.map((k) => `<div class="w-dyn-item"><article data-carte="kit" data-kit="${k.slug}" data-nom="${k.nom}">
      <span data-champ="badge"></span><h3 data-champ="nom">${k.nom}</h3>
      <span data-champ="prix">prix à compléter</span><span data-champ="chip" hidden></span></article></div>`).join('')
  const opt = (g, l) => l.map((x) => `<button type="button" class="boutique_option" data-filtre="${g}" data-valeur="${x.slug}">
      <span data-champ="compteur">0</span><span data-champ="libelle">${x.nom}</span></button>`).join('')
  document.body.innerHTML = `<div data-boutique="kits">
    <div data-bloc="toolbar"><button data-action="filtres"></button><span data-champ="etat-filtres"></span><div data-liste="chips"></div>
      <span data-champ="compteur-haut"></span><select data-filtre="tri"><option value="pertinence">Pertinence</option><option value="prix-croissant">Prix croissant</option><option value="prix-decroissant">Prix décroissant</option></select></div>
    <aside data-rail><span data-champ="compteur"></span><button data-action="tout-effacer"></button>
      <input data-filtre="recherche">
      <div data-groupe="vehicule"><button data-action="plier"><span>Votre véhicule</span><span class="boutique_groupe_icone">−</span></button><div class="boutique_groupe_corps">
        <div data-select="marque" class="boutique_select"><span data-champ="libelle-select">Marque</span><img><select data-filtre="marque"><option value="">Marque</option></select></div>
        <div data-select="modele" class="boutique_select desactive"><span data-champ="libelle-select">Modèle</span><img><select data-filtre="modele" disabled><option value="">Modèle</option></select></div>
        <select data-filtre="longueur" disabled><option value="">Longueur</option></select></div></div>
      <div data-groupe="agencement"><button data-action="plier"><span>Agencement</span><span class="boutique_groupe_icone">+</span></button><div class="boutique_groupe_corps" hidden>${opt('agencement', c.kits)}</div></div>
      <div data-groupe="finition"><div class="boutique_groupe_corps" hidden>${opt('finition', c.finitions)}</div></div>
      <div data-groupe="budget"><div class="boutique_groupe_corps" hidden>${opt('budget', [{ slug: '0-2200', nom: 'Moins de 2 200 €' }, { slug: '2200-2500', nom: '2 200 – 2 500 €' }, { slug: '2500-', nom: 'Plus de 2 500 €' }])}</div></div>
      <div data-groupe="pose" hidden><div class="boutique_groupe_corps" hidden><button type="button" data-filtre="pose" data-valeur="atelier" role="switch" aria-checked="false"><span data-champ="switch"><span data-champ="switch-bouton"></span></span></button></div></div>
    </aside>
    <div data-grille="kits"><div class="w-dyn-list"><div class="w-dyn-items" data-liste="kits">${kits}</div></div>
      <div data-bloc="aucun-resultat" hidden><p data-champ="justification"></p></div></div>
  </div>`
}

const visibles = () => [...document.querySelectorAll('[data-carte="kit"]')].filter((el) => !el.closest('.w-dyn-item').hasAttribute('hidden')).map((el) => el.dataset.kit)
const prix = (slug) => document.querySelector(`[data-kit="${slug}"] [data-champ="prix"]`).textContent
const faux = () => ({ history: { replaceState() {} }, location: { search: '', pathname: '/boutique/kits-amenagement', hash: '' } })

describe('règles de filtrage', () => {
  it('sans filtre, tous les kits vivants sont visibles avec le prix le plus bas de la grille', () => {
    const f = filtresVides()
    for (const k of c.kits) expect(kitVisible(k, f, c)).toBe(true)
    const p = prixCarte(c.par.kits.get('travel'), f, c)
    expect(p.montant).toBeGreaterThan(0)
    expect(p.exact).toBe(false)
  })
  it('un Vito 2 ne propose que le Kit Travel', () => {
    const f = { ...filtresVides(), marque: vito.marque, vehicule: vito.slug }
    expect(c.kits.filter((k) => kitVisible(k, f, c)).map((k) => k.slug)).toEqual(['travel'])
  })
  it('Trafic 3 + L2 + Best donne le prix exact de la grille', () => {
    const l2 = trafic.longueurs.find((l) => l.gabarit === 'long')
    const f = { ...filtresVides(), marque: trafic.marque, vehicule: trafic.slug, longueur: l2.slug, finition: ['best'] }
    const ligne = c.grille.find((x) => x.groupe === trafic.groupe && x.kit === 'travel' && x.finition === 'best' && x.gabarit === 'long')
    expect(prixCarte(c.par.kits.get('travel'), f, c)).toEqual({ montant: ligne.prix, exact: true })
  })
  it('un véhicule sans grille affiche « prix à compléter » et sort du filtre budget', () => {
    const f = { ...filtresVides(), marque: vito.marque, vehicule: vito.slug }
    expect(prixCarte(c.par.kits.get('travel'), f, c).montant).toBeNull()
    expect(kitVisible(c.par.kits.get('travel'), { ...f, budget: ['0-2200'] }, c)).toBe(false)
  })
  it('les compteurs comptent les kits visibles si l\'on cochait la valeur', () => {
    const f = { ...filtresVides(), marque: trafic.marque, vehicule: trafic.slug }
    expect(compteur('agencement', 'travel', f, c)).toBe(1)
    expect(compteur('agencement', 'combi', f, c)).toBe(0)
    expect(compteur('finition', 'triply', { ...f, agencement: ['mado'] }, c)).toBe(0)   // pas de Mado en Triply dans la grille
  })
  it('tranches et URL', () => {
    expect(tranche('0-2200')).toEqual([0, 2200])
    expect(tranche('2500-')).toEqual([2500, Infinity])
    const f = { ...filtresVides(), marque: 'renault', vehicule: trafic.slug, finition: ['best', 'soft'], tri: 'prix-croissant', recherche: 'tra' }
    expect(filtresDepuisUrl(filtresVersUrl(f))).toEqual(f)
    expect(filtresVersUrl(filtresVides())).toBe('')
  })
  it('chips et retrait en cascade', () => {
    const f = { ...filtresVides(), marque: trafic.marque, vehicule: trafic.slug, longueur: trafic.longueurs[0].slug, budget: ['2500-'] }
    expect(chips(f, c).map((x) => x.filtre)).toEqual(['marque', 'vehicule', 'longueur', 'budget'])
    expect(retirer(f, 'marque', trafic.marque)).toMatchObject({ marque: null, vehicule: null, longueur: null, budget: ['2500-'] })
    expect(chips(f, c).at(-1).libelle).toBe('Plus de 2 500 €')
  })
})

describe('page Webflow', () => {
  beforeEach(page)
  it('remplit les selects, masque les cartes et met l\'URL à jour', () => {
    const faux1 = faux()
    const app = creerBoutique({ racine: document.querySelector('[data-boutique]'), catalogue: c, document, ...faux1 })
    app.rendre()
    expect(visibles()).toHaveLength(c.kits.length)
    expect(document.querySelector('[data-champ="compteur"]').textContent).toBe(`${c.kits.length} kits sur ${c.kits.length}`)
    const marque = document.querySelector('[data-filtre="marque"]')
    expect([...marque.options].map((o) => o.value)).toContain('renault')
    marque.value = 'renault'; marque.dispatchEvent(new Event('change', { bubbles: true }))
    const modele = document.querySelector('[data-filtre="modele"]')
    expect(modele.disabled).toBe(false)
    expect(document.querySelector('[data-select="marque"] [data-champ="libelle-select"]').textContent).toBe(c.par.marques.get('renault').nom)
    expect(document.querySelector('[data-select="modele"]').classList.contains('desactive')).toBe(false)
    modele.value = trafic.slug; modele.dispatchEvent(new Event('change', { bubbles: true }))
    expect(document.querySelector('[data-select="modele"] [data-champ="libelle-select"]').textContent).toContain('Trafic 3')
    expect(visibles()).not.toContain('combi')
    expect(document.querySelector('[data-kit="travel"] [data-champ="chip"]').textContent).toBe('Trafic 3')
    expect(document.querySelector('[data-liste="chips"]').children).toHaveLength(2)
    expect(document.querySelector('[data-champ="etat-filtres"]').textContent).toBe('2 filtres appliqués')
    expect(app.filtres.vehicule).toBe(trafic.slug)
    // Agencement coché puis décoché par la chip
    document.querySelector('[data-filtre="agencement"][data-valeur="travel"]').click()
    expect(visibles()).toEqual(['travel'])
    document.querySelector('[data-action="retirer"][data-filtre="agencement"]').click()
    expect(visibles().length).toBeGreaterThan(1)
    // Aucun résultat
    document.querySelector('[data-filtre="recherche"]').value = 'zzz'
    app.changer({ recherche: 'zzz' })
    expect(visibles()).toEqual([])
    expect(document.querySelector('[data-bloc="aucun-resultat"]').hasAttribute('hidden')).toBe(false)
    expect(document.querySelector('[data-champ="justification"]').textContent).toContain('« zzz »')
    document.querySelector('[data-action="tout-effacer"]').click()
    expect(visibles()).toHaveLength(c.kits.length)
  })
  it('trie par prix et replie les groupes', () => {
    const app = creerBoutique({ racine: document.querySelector('[data-boutique]'), catalogue: c, document, ...faux() })
    app.rendre()
    app.changer({ tri: 'prix-decroissant' })
    const ordre = [...document.querySelectorAll('[data-liste="kits"] [data-carte]')].map((el) => el.dataset.kit)
    const montants = ordre.map((s) => prixCarte(c.par.kits.get(s), app.filtres, c).montant).filter((x) => x != null)
    expect([...montants].sort((a, b) => b - a)).toEqual(montants)
    // Tous fermés au chargement, même le groupe véhicule ouvert dans le HTML.
    for (const g of document.querySelectorAll('[data-groupe]')) {
      const t = g.querySelector('[data-action="plier"]'), corps = g.querySelector('.boutique_groupe_corps')
      if (!t) continue
      expect(t.getAttribute('aria-expanded')).toBe('false')
      expect(t.querySelector('.boutique_groupe_icone').textContent).toBe('+')
      expect(corps.hidden).toBe(true)
      expect(corps.style.display).toBe('none')
    }
    const tete = document.querySelector('[data-groupe="agencement"] [data-action="plier"]')
    const corps = document.querySelector('[data-groupe="agencement"] .boutique_groupe_corps')
    const icone = tete.querySelector('.boutique_groupe_icone')
    tete.click()
    expect([tete.getAttribute('aria-expanded'), icone.textContent, corps.hidden, corps.style.display]).toEqual(['true', '−', false, ''])
    icone.click()   // clic sur l'icône elle-même
    expect([tete.getAttribute('aria-expanded'), icone.textContent, corps.hidden, corps.style.display]).toEqual(['false', '+', true, 'none'])
    tete.click()
    expect(icone.textContent).toBe('−')
    // Un rendu (filtre changé) ne touche pas à l'état des groupes.
    app.changer({ recherche: 'tra' })
    expect(icone.textContent).toBe('−')
    expect(corps.hidden).toBe(false)
  })
  it('lit les filtres depuis l\'URL au chargement', () => {
    const app = creerBoutique({ racine: document.querySelector('[data-boutique]'), catalogue: c, document, history: { replaceState() {} }, location: { search: `?marque=${vito.marque}&modele=${vito.slug}`, pathname: '/x', hash: '' } })
    app.rendre()
    expect(visibles()).toEqual(['travel'])
    expect(prix('travel')).toBe('prix à compléter')
  })
})

describe('lecture de la page', () => {
  it('complète les kits et finitions absents de la zone cachée depuis les cartes et le rail', () => {
    page()
    const brut = completerDepuisPage({ kits: [], finitions: [] }, document.querySelector('[data-boutique]'))
    expect(brut.kits.map((k) => k.slug)).toEqual(c.kits.map((k) => k.slug))
    expect(brut.kits[0]).toMatchObject({ nom: c.kits[0].nom, statut: 'a-valider', ordre: 1 })
    expect(brut.finitions.map((f) => f.slug)).toEqual(c.finitions.map((f) => f.slug))
    expect(brut.finitions[0].nom).toBe(c.finitions[0].nom)
    const deja = completerDepuisPage({ kits: [{ slug: 'x' }], finitions: [{ slug: 'y' }] }, document.querySelector('[data-boutique]'))
    expect(deja.kits).toEqual([{ slug: 'x' }])
  })
})

describe('mots interdits', () => {
  it('le module n\'écrit aucun mot interdit', () => {
    const src = SRC.toLowerCase()
    for (const mot of ['panier', 'commande', 'achat', 'caisse', 'acheter']) expect(src.includes(mot), mot).toBe(false)
  })
})

/* ---------------------------------------------------------------- Accessoires --- */

const accessoires = c.options.filter((o) => o.montage !== 'impose' && o.statut !== 'retire')
const SECTIONS_PAGE = ['options-du-kit', 'vitrage-isolation-aeration', 'parois-plafond-plancher', 'electricite', 'mise-en-eau', 'wc-electromenager', 'chauffage', 'accessoires']

function pageProduits() {
  const cartes = accessoires.map((o) => `<div class="w-dyn-item"><article data-carte="produit" data-produit="${o.slug}" data-nom="${o.nom}">
      <span data-champ="badge"></span><h3 data-champ="nom">${o.nom}</h3>
      <span data-champ="prix">prix à compléter</span><span data-champ="chip" hidden></span></article></div>`).join('')
  const opt = (g, l) => l.map((x) => `<button type="button" class="boutique_option" data-filtre="${g}" data-valeur="${x.slug}">
      <span data-champ="compteur">0</span><span data-champ="libelle">${x.nom}</span></button>`).join('')
  document.body.innerHTML = `<div data-boutique="produits">
    <div data-bloc="toolbar"><span data-champ="etat-filtres"></span><div data-liste="chips"></div><span data-champ="compteur-haut"></span>
      <select data-filtre="tri"><option value="pertinence">Pertinence</option><option value="prix-croissant">Prix croissant</option><option value="prix-decroissant">Prix décroissant</option></select></div>
    <aside data-rail><span data-champ="compteur"></span><button data-action="tout-effacer"></button><input data-filtre="recherche">
      <div data-groupe="vehicule"><button data-action="plier"><span>Votre véhicule</span><span class="boutique_groupe_icone">+</span></button><div class="boutique_groupe_corps" hidden>
        <select data-filtre="marque"><option value="">Marque</option></select>
        <select data-filtre="modele" disabled><option value="">Modèle</option></select>
        <select data-filtre="longueur" disabled><option value="">Longueur</option></select></div></div>
      <div data-groupe="type"><div class="boutique_groupe_corps" hidden>${opt('type', SECTIONS_PAGE.map((s) => ({ slug: s, nom: s })))}</div></div>
      <div data-groupe="kit"><div class="boutique_groupe_corps" hidden>${opt('kit', c.kits)}</div></div>
      <div data-groupe="budget"><div class="boutique_groupe_corps" hidden>${opt('budget', [{ slug: '0-100', nom: 'Moins de 100 €' }, { slug: '100-500', nom: '100 – 500 €' }, { slug: '500-', nom: 'Plus de 500 €' }])}</div></div>
    </aside>
    <div data-grille="produits"><div class="w-dyn-list"><div class="w-dyn-items" data-liste="produits">${cartes}</div></div>
      <a data-tuile-edito="6" hidden>Tuile</a>
      <div data-bloc="aucun-resultat" hidden><p data-champ="justification"></p></div>
      <nav data-liste="pagination" hidden></nav></div>
  </div>`
}
const visiblesProduits = () => [...document.querySelectorAll('[data-carte="produit"]')].filter((el) => !el.closest('.w-dyn-item').hasAttribute('hidden')).map((el) => el.dataset.produit)

describe('règles accessoires', () => {
  const f0 = filtresVides()
  it('les postes imposés en atelier ne sont jamais proposés', () => {
    for (const o of c.options.filter((o) => o.montage === 'impose')) expect(produitVisible(o, f0, c)).toBe(false)
    expect(MODES.produits.articles(c).some((o) => o.montage === 'impose')).toBe(false)
  })
  it('prix : le plus bas des déclinaisons, exact quand il n\'y en a qu\'un', () => {
    const meuble = c.options.find((o) => o.nom.startsWith('Meuble haut'))
    expect(prixProduit(meuble, f0, c)).toEqual({ montant: 390, exact: false })
    const l2 = trafic.longueurs.find((l) => l.gabarit === 'long')
    expect(prixProduit(meuble, { ...f0, marque: trafic.marque, vehicule: trafic.slug, longueur: l2.slug }, c).montant).toBe(450)
    const conv = c.options.find((o) => o.nom.startsWith('Pack Convertisseur'))
    expect(prixProduit(conv, f0, c).montant).toBe(Math.min(...conv.variantes.filter((x) => x.type === 'choix').map((x) => x.prixTtc)))
    const simple = c.options.find((o) => o.nom === 'WC Chimique')
    expect(prixProduit(simple, f0, c)).toEqual({ montant: 110, exact: true })
  })
  it('le marchepied X82 disparaît sur un Vito, et les options du Mado sur un Vito (Travel seul)', () => {
    const marchepied = c.options.find((o) => o.nom === 'Marchepied latéral')
    const fVito = { ...f0, marque: vito.marque, vehicule: vito.slug }
    expect(produitVisible(marchepied, f0, c)).toBe(true)
    expect(produitVisible(marchepied, fVito, c)).toBe(false)
    expect(produitVisible(marchepied, { ...f0, marque: trafic.marque, vehicule: trafic.slug }, c)).toBe(true)
    const mado = c.options.find((o) => o.nom === 'Tablette cuisine MADO')
    expect(produitVisible(mado, fVito, c)).toBe(false)
    expect(produitVisible(mado, { ...f0, kit: ['mado'] }, c)).toBe(true)
    expect(produitVisible(mado, { ...f0, kit: ['travel'] }, c)).toBe(false)
    const sansKit = c.options.find((o) => o.nom === 'WC Chimique')
    expect(produitVisible(sansKit, { ...f0, kit: ['travel'] }, c)).toBe(true)   // pas de kit précisé = tous les kits
  })
  it('type et budget', () => {
    expect(accessoires.filter((o) => produitVisible(o, { ...f0, type: ['chauffage'] }, c)).every((o) => o.section === 'chauffage')).toBe(true)
    const chers = accessoires.filter((o) => produitVisible(o, { ...f0, budget: ['500-'] }, c))
    expect(chers.length).toBeGreaterThan(0)
    expect(chers.every((o) => prixProduit(o, f0, c).montant >= 500)).toBe(true)
  })
})

describe('page Accessoires', () => {
  beforeEach(pageProduits)
  it('pagine par 12, place la tuile après la 6e carte, et filtre', () => {
    const app = creerBoutique({ racine: document.querySelector('[data-boutique]'), catalogue: c, document, ...faux() })
    app.rendre()
    const total = accessoires.length
    expect(total).toBeGreaterThan(PAR_PAGE)
    expect(visiblesProduits()).toHaveLength(PAR_PAGE)
    expect(document.querySelector('[data-champ="compteur"]').textContent).toBe(`${total} accessoires sur ${total}`)
    const nav = document.querySelector('[data-liste="pagination"]')
    expect(nav.hasAttribute('hidden')).toBe(false)
    expect(nav.querySelector('[aria-current="page"]').textContent).toBe('1')
    // Tuile après la 6e carte visible
    const tuile = document.querySelector('[data-tuile-edito]')
    expect(tuile.hasAttribute('hidden')).toBe(false)
    const avant = [...document.querySelectorAll('[data-liste="produits"] > *')].filter((n) => !n.hasAttribute('hidden'))
    expect(avant.indexOf(tuile)).toBe(6)
    // Page 2
    nav.querySelector('[data-valeur="2"]').click()
    expect(app.filtres.page).toBe(2)
    expect(visiblesProduits()).toHaveLength(Math.min(PAR_PAGE, total - PAR_PAGE))
    // Un filtre ramène en page 1 ; type chauffage = 2 produits → plus de tuile ni de pagination
    document.querySelector('[data-filtre="type"][data-valeur="chauffage"]').click()
    expect(app.filtres.page).toBe(1)
    expect(visiblesProduits()).toHaveLength(2)
    expect(tuile.hasAttribute('hidden')).toBe(true)
    expect(nav.hasAttribute('hidden')).toBe(true)
    expect(document.querySelector('[data-liste="chips"]').textContent).toContain('Chauffage')
    // Kits lus depuis le rail
    expect(app.filtres.kit).toEqual([])
    document.querySelector('[data-filtre="kit"][data-valeur="mado"]').click()
    expect(document.querySelector('[data-liste="chips"]').textContent).toContain('Kit Mado')
  })
  it('lit les kits du rail quand la zone cachée n\'en a pas', () => {
    const brut = completerDepuisPage({ kits: [], finitions: [] }, document.querySelector('[data-boutique]'))
    expect(brut.kits.map((k) => k.slug)).toEqual(c.kits.map((k) => k.slug))
  })
})
