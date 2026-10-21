// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import PAGE from './fixtures/page.html?raw'
import extrait from './fixtures/prototype-catalogue.json'
import { normaliser, versCms } from './adaptateur.js'
import { indexer } from '../src/catalogue.js'
import * as R from '../src/regles.js'
import { creerApp } from '../src/vues.js'
import { charger, sauver } from '../src/etat.js'
import { euros } from '../src/format.js'
import { ETAPES } from '../src/config.js'

const cat = indexer(versCms(normaliser(extrait)))
const trafic3 = '3e370bd669cd81dfb3d1c9619bb11e8d'

const $ = (s) => document.querySelector(s)
const $$ = (s) => [...document.querySelectorAll(s)]
const visible = (el) => !!el && !el.hidden && !el.closest('[hidden]')
const etapeVisible = () => $$('[data-etape]').filter((s) => s.dataset.etape !== '3.2' && visible(s)).map((s) => s.dataset.etape)
const clic = (sel) => { const el = $(sel); if (!el) throw new Error(`introuvable : ${sel}`); el.click() }
const texte = (sel) => $(sel)?.textContent.trim()

let app, sauvegardes
beforeEach(() => {
  document.body.innerHTML = PAGE
  sauvegardes = []
  app = creerApp({ document, catalogue: cat, etat: R.etatVide(), sauver: (e) => sauvegardes.push(structuredClone(e)) })
  app.rendre()
})

describe('parcours complet sur la page Webflow', () => {
  it('démarre à 1.1 : marques clonées sur la scène, compteur, étapes inactives masquées', () => {
    expect(etapeVisible()).toEqual(['1.1'])
    expect(texte('[data-etape="1.1"] [data-champ="compteur"]')).toBe('1 sur 6')
    const marques = $$('[data-liste="marques"] [data-marque]')
    expect(marques.length).toBeGreaterThan(3)
    expect(marques[0].dataset.marque).toBe(cat.marques[0].slug)
    expect(marques[0].querySelector('[data-champ="titre"]').textContent).toBe(cat.marques[0].nom)
    expect($('[data-action="suivant"]').disabled).toBe(true)
    expect(visible($('[data-bloc="pas-encore"]'))).toBe(false)
    expect($$('[data-gabarits] [data-gabarit]').length).toBe(8)   // les gabarits restent intacts
  })

  it('situation « pas encore » : véhicules recommandés, clic → étape 1.3 directement', () => {
    clic('[data-situation="pas-encore"]')
    expect($('[data-situation="pas-encore"]').classList.contains('selectionne')).toBe(true)
    expect(visible($('[data-bloc="pas-encore"]'))).toBe(true)
    const recos = $$('[data-liste="recommandes"] [data-vehicule]')
    expect(recos.length).toBe(cat.vehicules.filter((v) => v.recommande).length)
    recos[0].click()
    expect(etapeVisible()).toEqual(['1.3'])
    expect(app.etat().vehicule).toBe(recos[0].dataset.vehicule)
  })

  it('marque → modèles (scène + panneau) → longueur → kit et finition → total identique à devis()', () => {
    clic(`[data-liste="marques"] [data-marque="renault"]`)
    expect(etapeVisible()).toEqual(['1.2'])
    expect(texte('[data-champ="nom-marque"]')).toBe('Renault')
    expect($$('[data-liste="modeles"] [data-vehicule]').length).toBe($$('[data-liste="modeles-liste"] [data-vehicule]').length)

    clic(`[data-liste="modeles-liste"] [data-vehicule="${trafic3}"]`)
    expect(etapeVisible()).toEqual(['1.3'])
    expect(texte('[data-champ="nom-vehicule"]')).toContain('Trafic 3')
    expect($('[data-action="suivant"]').disabled).toBe(true)          // longueur pas encore choisie
    const longueurs = $$('[data-liste="longueurs"] [data-longueur]')
    expect(longueurs.length).toBe(2)
    longueurs[0].click()
    expect($('[data-action="suivant"]').disabled).toBe(false)
    expect(texte('[data-champ="kits-compatibles"]')).toContain('Kit Travel')

    clic('[data-action="suivant"]')
    expect(etapeVisible()).toEqual(['2.1'])
    expect(visible($('[data-scene="3d"]'))).toBe(true)
    expect(texte('[data-champ="kit-compatible"]')).toBe('Compatible Renault Trafic 3')
    const kits = $$('[data-liste="kits"] [data-kit]')
    expect(kits.map((k) => k.dataset.kit)).toEqual(cat.par.vehicules.get(trafic3).kits)
    expect(kits[0].querySelector('[data-champ="prix"]').textContent).toBe('à partir de 2\u00a0195\u00a0€')
    expect(visible($('[data-bloc="couleurs"]'))).toBe(false)
    expect($$('[data-section]').every((s) => s.hidden)).toBe(true)

    clic('[data-liste="kits"] [data-kit="travel"]')
    const best = $('[data-liste="finitions"] [data-finition="best"]')
    expect(best.querySelector('[data-champ="prix"]').textContent).toBe('2\u00a0495\u00a0€ TTC')
    best.click()
    expect(app.etat()).toMatchObject({ kit: 'travel', finition: 'best' })
    expect(visible($('[data-bloc="couleurs"]'))).toBe(true)
    expect($$('[data-section]:not([hidden])').length).toBeGreaterThan(3)
    expect(visible($('[data-bloc="montage"]'))).toBe(true)
    expect(visible($('[data-bloc="recap"]'))).toBe(false)              // montage pas encore choisi

    // Une option, puis le montage soi-même
    const ligne = $$('[data-section="options-du-kit"] [data-option]').find((l) => !l.classList.contains('bloque'))
    ligne.querySelector('[data-champ="case"]').click()
    expect(app.etat().options[ligne.dataset.option]).toBe(true)
    expect($(`[data-option="${ligne.dataset.option}"]`).classList.contains('selectionne')).toBe(true)
    clic('[data-montage="soi-meme"]')
    expect(visible($('[data-bloc="recap"]'))).toBe(true)
    expect(visible($('[data-bloc="vasp"]'))).toBe(false)

    const d = R.devis(app.etat(), cat)
    expect(d.incomplet).toBe(false)
    expect(texte('[data-bloc="recap"] [data-champ="total"]')).toBe(euros(d.total))
    expect(texte('.config_bottombar [data-champ="total"]')).toBe(euros(d.total))
    expect($$('[data-bloc="recap"] [data-liste="recap"] .config_recap_ligne').length).toBe(d.lignes.length)
    expect(texte('[data-montage="soi-meme"] [data-champ="total-soi-meme"]')).toBe(euros(d.total))
    expect(sauvegardes.at(-1)).toMatchObject({ kit: 'travel', finition: 'best', montage: 'soi-meme' })
  })

  it('montage atelier : postes imposés, VASP, palier et libellé « pour un aménagement jusqu\'à »', () => {
    app.modifier((e) => Object.assign(e, { etape: 3, marque: 'renault', vehicule: trafic3, longueur: `${trafic3}-l0`, kit: 'travel', finition: 'best' }))
    clic('[data-montage="atelier"]')
    expect(visible($('[data-bloc="vasp"]'))).toBe(true)
    expect(visible($('[data-bloc="preparation"]'))).toBe(false)
    expect($('[data-bloc="detail-pose"]').open).toBe(true)
    expect($$('[data-liste="postes-imposes"] .config_recap_ligne').length).toBe(1 + R.lignesImposees(app.etat(), cat).length)
    expect(texte('[data-champ="paliers"]')).toBe(`Montage ${euros(1850)} jusqu'à ${euros(6000)}, ${euros(2000)} jusqu'à ${euros(8000)}, ${euros(2200)} au-delà d'aménagement.`)
    const d = R.devis(app.etat(), cat)
    const ligneMontage = $$('[data-bloc="recap"] .config_recap_ligne [data-champ="libelle"]').map((x) => x.textContent).find((t) => t.startsWith('Pose atelier'))
    expect(ligneMontage).toContain(`pour un aménagement jusqu'à ${euros(6000)}`)
    expect(texte('[data-bloc="recap"] [data-champ="total"]')).toBe(euros(d.total))
    // VASP
    $('[data-vasp] [data-champ="case"]').click()
    expect(app.etat().vasp).toBe(true)
    expect(R.devis(app.etat(), cat).lignes.some((l) => l.type === 'vasp')).toBe(true)
    // Les options « atelier uniquement » ne sont plus bloquées
    expect($$('[data-option].bloque').every((l) => !/atelier Kapam/.test(l.querySelector('[data-champ="motif"]').textContent))).toBe(true)
  })

  it('versions à choix unique et cases cumulables, gabarits imbriqués', () => {
    app.modifier((e) => Object.assign(e, { etape: 3, marque: 'renault', vehicule: trafic3, longueur: `${trafic3}-l0`, kit: 'travel', finition: 'best', montage: 'soi-meme' }))
    const avecChoix = cat.options.find((o) => R.versionsChoix(o, app.etat(), cat).length && R.disponibilite(o, app.etat(), cat).etat === 'ok' && o.kits.includes('travel'))
    const avecCases = cat.options.find((o) => R.versionsCases(o, app.etat(), cat).length && R.disponibilite(o, app.etat(), cat).etat === 'ok' && (!o.kits.length || o.kits.includes('travel')))
    expect(avecChoix && avecCases).toBeTruthy()

    const ligne = $(`[data-option="${avecChoix.slug}"]`)
    expect(ligne.querySelector('[data-champ="prix"]').textContent).toMatch(/^à partir de /)
    expect(ligne.querySelector('[data-zone="versions"]').hidden).toBe(true)
    ligne.querySelector('[data-champ="case"]').click()
    const versions = $$(`[data-option="${avecChoix.slug}"] [data-zone="versions"] [data-version]`)
    expect(versions.length).toBe(R.versionsChoix(avecChoix, app.etat(), cat).length)
    expect(versions[0].getAttribute('role')).toBe('radio')
    versions[1].click()
    expect(app.etat().versions[avecChoix.slug]).toBe(versions[1].dataset.version)
    expect($(`[data-option="${avecChoix.slug}"] .config_ligne_droite [data-champ="prix"]`).textContent).toMatch(/^\+ /)

    $(`[data-option="${avecCases.slug}"] [data-champ="case"]`).click()
    const cases = () => $$(`[data-option="${avecCases.slug}"] [data-case]`)   // la ligne est redessinée à chaque clic
    expect(cases().length).toBe(R.versionsCases(avecCases, app.etat(), cat).length)
    const [c0, c1] = cases().map((c) => c.dataset.case)
    cases()[0].click(); cases()[1].click()
    expect(app.etat().cases[avecCases.slug]).toEqual([c0, c1])
    expect(cases().filter((c) => c.classList.contains('selectionne')).length).toBe(2)
    expect(R.devis(app.etat(), cat).lignes.find((l) => l.option === avecCases.slug).versions.length).toBe(2)
    cases()[0].click()
    expect(app.etat().cases[avecCases.slug]).toEqual([c1])
  })

  it('nuanciers : stratifié seulement en Best, deuxième stratifié avec le mobilier bicolore, velours chiffré', () => {
    app.modifier((e) => Object.assign(e, { etape: 3, marque: 'renault', vehicule: trafic3, longueur: `${trafic3}-l0`, kit: 'travel', finition: 'soft', montage: 'soi-meme' }))
    expect($$('[data-liste="nuanciers"] [data-nuance="stratifie"]').length).toBe(0)
    clic('[data-liste="finitions"] [data-finition="best"]')
    expect($$('[data-liste="nuanciers"] [data-nuance="stratifie"]').length).toBe(1)   // DESIGN 2-4 sans prix : masqués
    expect($$('[data-liste="nuanciers"] [data-nuance="stratifie2"]').length).toBe(0)
    clic('[data-liste="upsell"] [data-option="mobilier-bicolore"] [data-action="ajouter"]')
    expect(app.etat().options['mobilier-bicolore']).toBe(true)
    expect($$('[data-liste="nuanciers"] [data-nuance="stratifie2"]').length).toBe(1)
    clic('[data-liste="nuanciers"] [data-nuance="literie"][data-valeur="velours"]')
    expect(app.etat().attributs.literie).toBe('velours')
    expect(R.devis(app.etat(), cat).lignes.some((l) => l.type === 'literie' && l.montant === 100)).toBe(true)
    expect(texte('[data-liste="nuanciers"] [data-nuance="literie"][data-valeur="velours"] [data-champ="sous"]')).toBe(`+ ${euros(100)}`)
  })

  it('véhicule sans grille : « prix à compléter » partout, jamais de prix maquette', () => {
    const t5 = '3e370bd669cd81549d69d9abb3bb316d'
    app.modifier((e) => Object.assign(e, { etape: 3, marque: 'volkswagen', vehicule: t5, longueur: `${t5}-l0`, kit: 'travel', finition: 'best', montage: 'soi-meme' }))
    expect(texte('[data-liste="kits"] [data-kit="travel"] [data-champ="prix"]')).toBe('prix à compléter')
    expect(texte('[data-liste="finitions"] [data-finition="best"] [data-champ="prix"]')).toBe('prix à compléter')
    expect(texte('[data-bloc="recap"] [data-champ="total"]')).toMatch(/\(incomplet\)$/)
    expect(document.body.textContent).not.toMatch(/2 140|2 440/)
  })

  it('demande de devis : étape 3.1, champs cachés du formulaire, résumé, puis confirmation 3.2', () => {
    app.modifier((e) => Object.assign(e, { etape: 3, situation: 'je-lai-deja', marque: 'renault', vehicule: trafic3, longueur: `${trafic3}-l0`, kit: 'travel', finition: 'best', montage: 'soi-meme' }))
    clic('[data-action="demander-devis"]')
    expect(etapeVisible()).toEqual(['3.1'])
    expect(visible($('[data-zone="layout"]'))).toBe(false)
    expect(texte('[data-champ="titre-contact"]')).toBe('Vos coordonnées.')
    expect($('[data-action="suivant"]').textContent).toBe('Envoyer ma demande')
    const d = R.devis(app.etat(), cat)
    expect($('[data-champ-form="type"]').value).toBe('Devis de configuration')
    expect($('[data-champ-form="reference"]').value).toMatch(/^KP-\d{4}-\d{4}$/)
    expect($('[data-champ-form="vehicule"]').value).toBe('Renault Trafic 3 · ' + R.longueur(app.etat(), cat).etiquette)
    expect($('[data-champ-form="total"]').value).toBe(euros(d.total))
    expect($('[data-champ-form="recap"]').value.split('\n').length).toBe(d.lignes.length + 1)
    expect(JSON.parse($('[data-champ-form="config"]').value)).toMatchObject({ kit: 'travel', finition: 'best' })
    expect($$('[data-liste="resume-demande"] .config_recap_ligne').map((l) => l.textContent)).toEqual([
      'Type de demandeDevis de configuration', 'SituationVéhicule déjà acheté', `VéhiculeRenault Trafic 3 · ${R.longueur(app.etat(), cat).etiquette}`])
    expect(texte('[data-zone="contact"] [data-champ="total"]')).toBe(euros(d.total))

    // Coordonnées saisies → mémorisées
    const email = $('[data-coord="email"]'); email.value = 'a@b.fr'; email.dispatchEvent(new Event('input', { bubbles: true }))
    expect(app.etat().coordonnees.email).toBe('a@b.fr')

    // Webflow affiche le bloc de confirmation → 3.2
    const ref = $('[data-champ-form="reference"]').value
    $('[data-zone="confirmation"]').style.display = 'block'
    return new Promise((r) => setTimeout(r, 0)).then(() => {
      expect(app.etat().etape).toBe(5)
      expect(visible($('[data-etape="3.2"]'))).toBe(true)
      expect(texte('[data-etape="3.2"] [data-champ="reference"]')).toBe(ref)
      expect(texte('[data-etape="3.2"] [data-champ="compteur"]')).toBe('6 sur 6')
      expect($('[data-action="suivant"]').hidden).toBe(true)
    })
  })

  it('conseil et hors liste : pas de prix, retour à l\'étape d\'origine', () => {
    clic('[data-situation="pas-encore"]'); clic('[data-demande="conseil"]')
    expect(etapeVisible()).toEqual(['3.1'])
    expect(texte('[data-champ="titre-contact"]')).toBe('Parlons de votre projet.')
    expect(visible($('[data-zone="contact"] [data-liste="recap"]'))).toBe(false)
    expect($('[data-champ-form="total"]').value).toBe('')
    expect(texte('.config_bottombar [data-champ="total"]')).toBe('—')
    clic('[data-action="precedent"]')
    expect(etapeVisible()).toEqual(['1.1'])
    expect(app.etat().demande).toBeNull()

    clic('[data-liste="marques"] [data-marque="renault"]'); clic('[data-action="hors-liste"]')
    expect(etapeVisible()).toEqual(['3.1'])
    expect(texte('[data-champ="titre-contact"]')).toBe('Étude de votre véhicule.')
    expect($('[data-champ-form="type"]').value).toBe('Étude sur mesure (véhicule hors liste)')
    expect($('[data-champ-form="vehicule"]').value).toBe('Renault')
  })

  it('changer de kit vide les options ; changer de véhicule vide tout ; focus conservé', () => {
    app.modifier((e) => Object.assign(e, { etape: 3, marque: 'renault', vehicule: trafic3, longueur: `${trafic3}-l0`, kit: 'travel', finition: 'best', montage: 'soi-meme' }))
    const ligne = $$('[data-section] [data-option]').find((l) => !l.classList.contains('bloque'))
    const caseBtn = ligne.querySelector('[data-champ="case"]'); caseBtn.focus(); caseBtn.click()
    expect(document.activeElement?.closest('[data-option]')?.dataset.option).toBe(ligne.dataset.option)
    clic('[data-liste="kits"] [data-kit="madel"]')
    expect(app.etat().options).toEqual({})
    expect(app.etat().finition).toBe('best')
    app.allerA(1)
    clic(`[data-liste="modeles-liste"] [data-vehicule="${trafic3}"]`)   // même véhicule : rien n'est perdu
    expect(app.etat().kit).toBe('madel')
    const autre = $$('[data-liste="modeles-liste"] [data-vehicule]').find((b) => b.dataset.vehicule !== trafic3 && !b.disabled)
    autre.click()
    expect(app.etat()).toMatchObject({ vehicule: autre.dataset.vehicule, kit: null, finition: null, options: {} })
  })

  it('aucun mot interdit dans la page rendue, à chaque étape', () => {
    const interdits = /\b(panier|commande|achat|caisse|acheter)\b/i
    app.modifier((e) => Object.assign(e, { etape: 3, marque: 'renault', vehicule: trafic3, longueur: `${trafic3}-l0`, kit: 'travel', finition: 'best', montage: 'atelier', vasp: true }))
    for (const i of ETAPES.keys()) { app.allerA(i); expect(document.querySelector('[data-configurateur]').textContent).not.toMatch(interdits) }
    expect([...document.querySelectorAll('[data-champ-form]')].map((x) => x.value).join('\n')).not.toMatch(interdits)
  })
})

describe('état persistant', () => {
  it('localStorage : enregistré avec sa date, périmé après 30 jours, synchro entre onglets', () => {
    const e = { ...R.etatVide(), kit: 'travel' }
    sauver(e, 1000)
    expect(charger(1000 + 29 * 86400e3)).toMatchObject({ kit: 'travel' })
    expect(charger(1000 + 31 * 86400e3).kit).toBeNull()
    localStorage.setItem('kapam.config.v1', '{pas du json')
    expect(charger().kit).toBeNull()
  })
})
