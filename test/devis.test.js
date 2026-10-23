// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import HTML from './fixtures/devis.html?raw'
import { lireCatalogue } from '../src/lecture-cms.js'
import { indexer } from '../src/catalogue.js'
import { creerDevis, lireFormules, recommander, ligneTarif } from '../src/devis.js'

const INTERDITS = /panier|commande|achat|caisse|acheter/i

function monter(configuration = null) {
  document.body.innerHTML = HTML
  const racine = document.querySelector('[data-devis]')
  const zone = racine.querySelector('[data-devis-donnees]')
  const devis = creerDevis({ document, racine, formules: lireFormules(zone), catalogue: indexer(lireCatalogue(zone)), configuration })
  devis.rendre()
  return { racine, devis }
}
const visible = (sel) => { const el = document.querySelector(sel); return !!el && !el.closest('[hidden]') }
const clic = (sel) => document.querySelector(sel).dispatchEvent(new MouseEvent('click', { bubbles: true }))
const change = (el) => el.dispatchEvent(new Event('change', { bubbles: true }))

describe('règles', () => {
  it('recommande une formule', () => {
    expect(recommander({ van: 'non' })).toBe('cle-en-main')
    expect(recommander({ van: 'oui', pose: 'soi-meme' })).toBe('kit-diy')
    expect(recommander({ van: 'oui', pose: 'kapam' })).toBe('atelier')
    expect(recommander({ van: 'oui' })).toBeNull()
  })
  it('écrit la ligne de tarif', () => {
    expect(ligneTarif({ prix: 25000, delai: '6 à 12 semaines' })).toBe('À partir de 25 000 € · 6 à 12 semaines')
    expect(ligneTarif({ prix: null, delai: '' })).toBe('')
  })
})

describe('lecture des formules', () => {
  it('lit les trois formules triées, listes découpées par ligne', () => {
    document.body.innerHTML = HTML
    const f = lireFormules(document.querySelector('[data-devis-donnees]'))
    expect(f.map((x) => x.slug)).toEqual(['cle-en-main', 'atelier', 'kit-diy'])
    expect(f[0].inclus).toHaveLength(4); expect(f[0].exclus).toEqual([]); expect(f[0].etapes[2]).toBe('Fabrication & installation')
    expect(f[0].calcom).toBeNull(); expect(f[1].calcom).toBe('https://cal.com/kapam/atelier')
    expect(f[1].statut).toBe('valide'); expect(f[2].statut).toBe('a-valider')
  })
})

describe('modale', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('reste fermée au chargement et s\'ouvre depuis la nav sur le hub', () => {
    const { racine } = monter()
    expect(racine.hidden).toBe(true)
    clic('.btn-devis-nav')
    expect(racine.hidden).toBe(false)
    expect(visible('[data-vue="hub"]')).toBe(true)
    const cartes = racine.querySelectorAll('[data-liste="formules"] [data-formule]')
    expect([...cartes].map((c) => c.dataset.formule)).toEqual(['cle-en-main', 'atelier', 'kit-diy'])
    expect(cartes[0].querySelector('[data-champ="tarif"]').textContent).toContain('À partir de')
    expect(cartes[0].querySelector('[data-champ="mention"]').hidden).toBe(false)   // à valider
    expect(cartes[1].querySelector('[data-champ="mention"]').hidden).toBe(true)    // validé
  })

  it('ouvre directement une formule depuis un bouton de page, Escape ferme et rend le focus', () => {
    const { racine } = monter()
    const b = document.querySelector('[data-devis-ouvrir]'); b.focus(); clic('[data-devis-ouvrir]')
    expect(visible('[data-vue="presentation"]')).toBe(true)
    expect(racine.querySelector('[data-vue="presentation"] [data-champ="nom"]').textContent).toBe('Atelier')
    expect(racine.querySelectorAll('[data-liste="inclus"] li')).toHaveLength(2)
    expect(racine.querySelector('[data-bloc="exclus"]').hidden).toBe(false)
    expect(racine.querySelector('[data-liste="etapes"] li [data-champ="numero"]').textContent).toBe('1.')
    expect(racine.querySelector('[data-action="formulaire"]').textContent).toBe('Demander un devis Atelier')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(racine.hidden).toBe(true)
    expect(document.activeElement).toBe(b)
  })

  it('aide à choisir : pas de van → Clé en main sans question 2', () => {
    monter(); clic('.btn-devis-nav'); clic('[data-action="aide"]')
    expect(visible('[data-vue="q1"]')).toBe(true)
    clic('[data-reponse="van:non"]')
    expect(visible('[data-vue="reco"]')).toBe(true)
    expect(document.querySelector('[data-liste="recommandee"] [data-formule]').dataset.formule).toBe('cle-en-main')
    expect(document.querySelectorAll('[data-liste="autres"] [data-formule]')).toHaveLength(2)
  })

  it('aide à choisir : van + pose soi-même → Kit DIY', () => {
    monter(); clic('.btn-devis-nav'); clic('[data-action="aide"]'); clic('[data-reponse="van:oui"]')
    expect(visible('[data-vue="q2"]')).toBe(true)
    clic('[data-reponse="pose:soi-meme"]')
    expect(document.querySelector('[data-liste="recommandee"] [data-formule]').dataset.formule).toBe('kit-diy')
  })

  it('formulaire Atelier : selects en cascade, chips depuis le CMS, champs cachés', () => {
    monter(); clic('[data-devis-ouvrir]'); clic('[data-action="formulaire"]')
    expect(visible('[data-formulaire="atelier"]')).toBe(true)
    expect(visible('[data-formulaire="kit-diy"]')).toBe(false)
    const form = document.querySelector('#devis-atelier')
    expect(form.querySelector('[data-champ-form="formule"]').value).toBe('Atelier')
    const marque = form.querySelector('[data-champ="select-marque"]'), modele = form.querySelector('[data-champ="select-modele"]')
    expect([...marque.options].map((o) => o.value)).toEqual(['', 'renault', 'fiat', 'autre'])   // Tesla : aucun véhicule
    expect(modele.disabled).toBe(true)
    marque.value = 'renault'; change(marque)
    expect(modele.disabled).toBe(false)
    expect([...modele.options].map((o) => o.textContent)).toEqual(['Sélectionnez le modèle', 'Trafic 3 · 2014+', 'Autre modèle'])
    expect(form.querySelector('[data-bloc="longueurs"]').hidden).toBe(true)
    modele.value = 'renault-trafic-3'; change(modele)
    expect(form.querySelector('[data-bloc="longueurs"]').hidden).toBe(false)
    expect([...form.querySelectorAll('[data-liste="longueurs"] input')].map((i) => i.value)).toEqual(['trafic-3-l1', 'trafic-3-l2', 'je-ne-sais-pas'])
    expect([...form.querySelectorAll('[data-liste="kits"] input')].map((i) => i.value)).toEqual(['travel', 'madel', 'je-ne-sais-pas'])
    expect(form.querySelector('[data-liste="finitions"] [data-champ="titre"]').textContent).toBe('Soft — essentiel')
    const chip = form.querySelector('[data-liste="kits"] [data-chip]')
    chip.querySelector('input').checked = true; change(chip.querySelector('input'))
    expect(chip.classList.contains('selectionne')).toBe(true)
    expect(form.querySelector('[data-bloc="joindre"]').hidden).toBe(true)   // pas de configuration
    expect(form.querySelector('[data-champ-form="recap"]').value).toBe('')
  })

  it('pré-remplit depuis la configuration et joint le récapitulatif (décochable)', () => {
    const configuration = { marque: 'renault', vehicule: 'renault-trafic-3', longueur: 'trafic-3-l2', kit: 'travel', finition: 'best', resume: { recap: 'Kit Travel : 2 495 €', total: 2495 } }
    monter(configuration); clic('[data-devis-ouvrir]'); clic('[data-action="formulaire"]')
    const form = document.querySelector('#devis-atelier')
    expect(form.querySelector('[data-champ="select-marque"]').value).toBe('renault')
    expect(form.querySelector('[data-champ="select-modele"]').value).toBe('renault-trafic-3')
    expect(form.querySelector('[data-liste="longueurs"] input:checked').value).toBe('trafic-3-l2')
    expect(form.querySelector('[data-liste="kits"] input:checked').value).toBe('travel')
    expect(form.querySelector('[data-liste="finitions"] input:checked').value).toBe('best')
    const joindre = form.querySelector('[data-champ-form="joindre"]')
    expect(joindre.closest('[data-bloc]').hidden).toBe(false); expect(joindre.checked).toBe(true)
    expect(form.querySelector('[data-champ-form="recap"]').value).toBe('Kit Travel : 2 495 €')
    expect(form.querySelector('[data-champ="config-total"]').textContent).toBe('2 495 €')
    joindre.checked = false; change(joindre)
    expect(form.querySelector('[data-champ-form="recap"]').value).toBe('')
  })

  it('passe à la confirmation quand Webflow affiche le bloc de succès', async () => {
    const { racine } = monter(); clic('[data-devis-ouvrir]'); clic('[data-action="formulaire"]')
    const events = []; racine.addEventListener('kapam:devis-envoye', (e) => events.push(e.detail.formule))
    document.querySelector('[data-formulaire="atelier"] .w-form-done').style.display = 'block'
    await new Promise((r) => setTimeout(r, 0))
    expect(visible('[data-vue="confirmation"]')).toBe(true)
    expect(document.querySelector('[data-champ="message"]').textContent).toBe('Votre demande est enregistrée.')
    expect(document.querySelector('[data-bloc="rdv"]').hidden).toBe(false)
    expect(document.querySelector('[data-action="calcom"]').getAttribute('href')).toBe('https://cal.com/kapam/atelier')
    expect(document.querySelector('[data-champ="duree"]').textContent).toBe('15 min')
    expect(events).toEqual(['atelier'])
  })

  it('masque l\'encart RDV sans lien Cal.com', () => {
    const { devis } = monter(); devis.ouvrir({ formule: 'kit-diy', vue: 'confirmation' })
    expect(document.querySelector('[data-bloc="rdv"]').hidden).toBe(true)
  })

  it('n\'emploie aucun mot interdit dans les textes rendus', () => {
    const { racine, devis } = monter(); devis.ouvrir()
    for (const vue of ['hub', 'presentation', 'formulaire', 'confirmation']) devis.allerA(vue, 'atelier')
    expect(racine.textContent).not.toMatch(INTERDITS)
  })
})
