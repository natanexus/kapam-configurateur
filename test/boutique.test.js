// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import extrait from './fixtures/prototype-catalogue.json'
import SRC from '../src/boutique.js?raw'
import { normaliser, versCms } from './adaptateur.js'
import { indexer } from '../src/catalogue.js'
import {
  creerBoutique, filtresVides, filtresDepuisUrl, filtresVersUrl, kitVisible, prixCarte, compteur, chips, retirer, tranche,
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
        <select data-filtre="marque"><option value="">Marque</option></select>
        <select data-filtre="modele" disabled><option value="">Modèle</option></select>
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
  it('sans filtre, tous les kits vivants sont visibles avec un prix « à partir de »', () => {
    const f = filtresVides()
    for (const k of c.kits) expect(kitVisible(k, f, c)).toBe(true)
    const p = prixCarte(c.par.kits.get('travel'), f, c)
    expect(p.montant).toBeGreaterThan(0)
    expect(p.prefixe).toBe('à partir de')
  })
  it('un Vito 2 ne propose que le Kit Travel', () => {
    const f = { ...filtresVides(), marque: vito.marque, vehicule: vito.slug }
    expect(c.kits.filter((k) => kitVisible(k, f, c)).map((k) => k.slug)).toEqual(['travel'])
  })
  it('Trafic 3 + L2 + Best donne le prix exact de la grille', () => {
    const l2 = trafic.longueurs.find((l) => l.gabarit === 'long')
    const f = { ...filtresVides(), marque: trafic.marque, vehicule: trafic.slug, longueur: l2.slug, finition: ['best'] }
    const ligne = c.grille.find((x) => x.groupe === trafic.groupe && x.kit === 'travel' && x.finition === 'best' && x.gabarit === 'long')
    expect(prixCarte(c.par.kits.get('travel'), f, c)).toEqual({ montant: ligne.prix, prefixe: '' })
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
    modele.value = trafic.slug; modele.dispatchEvent(new Event('change', { bubbles: true }))
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
    const tete = document.querySelector('[data-groupe="agencement"] [data-action="plier"]')
    tete.click()
    expect(document.querySelector('[data-groupe="agencement"] .boutique_groupe_corps').hasAttribute('hidden')).toBe(false)
    expect(tete.getAttribute('aria-expanded')).toBe('true')
  })
  it('lit les filtres depuis l\'URL au chargement', () => {
    const app = creerBoutique({ racine: document.querySelector('[data-boutique]'), catalogue: c, document, history: { replaceState() {} }, location: { search: `?marque=${vito.marque}&modele=${vito.slug}`, pathname: '/x', hash: '' } })
    app.rendre()
    expect(visibles()).toEqual(['travel'])
    expect(prix('travel')).toBe('prix à compléter')
  })
})

describe('mots interdits', () => {
  it('le module n\'écrit aucun mot interdit', () => {
    const src = SRC.toLowerCase()
    for (const mot of ['panier', 'commande', 'achat', 'caisse', 'acheter']) expect(src.includes(mot), mot).toBe(false)
  })
})
