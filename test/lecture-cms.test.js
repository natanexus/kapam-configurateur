// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { lireCatalogue, nombre } from '../src/lecture-cms.js'
import { indexer } from '../src/catalogue.js'
import * as R from '../src/regles.js'

/* Extrait du HTML tel que Webflow le publie (listes w-dyn-*, attributs liés, image vide, visibilité conditionnelle). */
const HTML = `
<div class="hide" data-cms-donnees aria-hidden="true">
  <div class="w-dyn-list"><div role="list" class="w-dyn-items">
    <div role="listitem" class="w-dyn-item"><div data-item="marques" data-slug="renault" data-nom="Renault" data-ordre="8">
      <img data-champ="logo" src="" class="w-dyn-bind-empty" alt=""></div></div>
  </div></div>
  <div class="w-dyn-list"><div role="list" class="w-dyn-items">
    <div role="listitem" class="w-dyn-item"><div data-item="plateformes" data-slug="x82" data-nom="Renault X82"></div></div>
  </div></div>
  <div class="w-dyn-list"><div role="list" class="w-dyn-items">
    <div role="listitem" class="w-dyn-item"><div data-item="groupes" data-slug="x82" data-nom="X82" data-suffixe-kit="" data-sous-libelle-kits=""></div></div>
  </div></div>
  <div class="w-dyn-list"><div role="list" class="w-dyn-items">
    <div role="listitem" class="w-dyn-item"><div data-item="kits" data-slug="travel" data-nom="Kit Travel" data-sous-libelle="Le plus complet · 13 options" data-ordre="1" data-statut="À valider Willy" data-glb="">
      <img data-champ="visuel" src="https://cdn.example/travel.webp" alt=""></div></div>
  </div></div>
  <div class="w-dyn-list"><div role="list" class="w-dyn-items">
    <div role="listitem" class="w-dyn-item"><div data-item="finitions" data-slug="best" data-nom="Best" data-sous-libelle="Stratifié" data-ordre="3" data-statut="À valider Willy">
      <div data-champ="teinte" class="config_teinte" style="background-color: rgb(142, 108, 75)"></div></div></div>
    <div role="listitem" class="w-dyn-item"><div data-item="finitions" data-slug="soft" data-nom="Soft" data-ordre="1" data-statut="À valider Willy">
      <div data-champ="teinte" class="config_teinte"></div></div></div>
  </div></div>
  <div class="w-dyn-list"><div role="list" class="w-dyn-items">
    <div role="listitem" class="w-dyn-item"><div data-item="vehicules" data-slug="renault-trafic-3" data-nom="Renault Trafic 3 · 2014+" data-modele="Trafic 3"
      data-millesime="2014+" data-marque="renault" data-plateforme="x82" data-groupe="x82" data-argument="Le plus aménagé" data-ordre="2" data-statut="À valider Willy">
      <img data-champ="photo" src="https://cdn.example/trafic.webp" alt="">
      <span data-champ="recommande"></span>
      <div data-refs="kits" class="w-dyn-list"><div class="w-dyn-items"><div class="w-dyn-item"><span data-ref="travel"></span></div></div></div>
    </div></div>
    <div role="listitem" class="w-dyn-item"><div data-item="vehicules" data-slug="vw-t4" data-nom="VW T4" data-modele="T4" data-marque="volkswagen" data-plateforme="vw-t4" data-groupe="" data-statut="À valider Willy">
      <span data-champ="recommande" class="w-condition-invisible"></span>
      <div data-refs="kits" class="w-dyn-list"><div class="w-dyn-empty"></div></div>
    </div></div>
  </div></div>
  <div class="w-dyn-list"><div role="list" class="w-dyn-items">
    <div role="listitem" class="w-dyn-item"><div data-item="longueurs" data-slug="trafic-3-l1h1" data-vehicule="renault-trafic-3" data-etiquette="Court (L1H1)" data-gabarit="Court" data-ordre="1"></div></div>
  </div></div>
  <div class="w-dyn-list"><div role="list" class="w-dyn-items">
    <div role="listitem" class="w-dyn-item"><div data-item="grille" data-groupe="x82" data-gabarit="Court" data-kit="travel" data-finition="best" data-prix="2495" data-statut="À valider Willy"></div></div>
  </div></div>
  <div class="w-dyn-list"><div role="list" class="w-dyn-items">
    <div role="listitem" class="w-dyn-item"><div data-item="options" data-slug="meuble-haut-2-placards" data-nom="Meuble haut 2 placards" data-section="Options du kit"
      data-ordre="2" data-prix-ttc="390" data-prix-l2="450" data-prix-best="490" data-prix-best-l2="570" data-prix-vw-t5="" data-montage="Tous montages"
      data-statut="À valider Willy" data-note-client="Il faut « vérifier » l'empattement &amp; la hauteur">
      <img data-champ="visuel" src="" class="w-dyn-bind-empty" alt="">
      <div data-refs="kits"><div class="w-dyn-items"><div class="w-dyn-item"><span data-ref="travel"></span></div><div class="w-dyn-item"><span data-ref="madel"></span></div></div></div>
      <div data-refs="finitions"><div class="w-dyn-empty"></div></div>
      <div data-refs="plateformes"><div class="w-dyn-empty"></div></div>
      <div data-refs="dependDe"><div class="w-dyn-empty"></div></div>
      <div data-refs="incompatibleAvec"><div class="w-dyn-empty"></div></div>
    </div></div>
    <div role="listitem" class="w-dyn-item"><div data-item="options" data-slug="prise-ext" data-nom="Pack Prise EXT 230V" data-section="Électricité" data-ordre="3,5"
      data-prix-ttc="49,90" data-montage="Tous montages" data-statut="À valider Willy"></div></div>
  </div></div>
  <div class="w-dyn-list"><div role="list" class="w-dyn-items">
    <div role="listitem" class="w-dyn-item"><div data-item="variantes" data-slug="prise-avec" data-nom="Avec câble adaptateur" data-option="prise-ext" data-type="Choix unique" data-prix-ttc="69.89" data-ordre="2"></div></div>
  </div></div>
</div>`

document.body.innerHTML = HTML
const brut = lireCatalogue(document)
const cat = indexer(brut)

describe('lecture des listes CMS', () => {
  it('nombres : point, virgule, vide', () => {
    expect(nombre('44.95')).toBe(44.95)
    expect(nombre('49,90')).toBe(49.9)
    expect(nombre('1 850')).toBe(1850)
    expect(nombre('')).toBeNull()
  })
  it('options : valeurs CMS converties (statut, montage, section, prix, références)', () => {
    const o = brut.options.find((x) => x.slug === 'meuble-haut-2-placards')
    expect(o).toMatchObject({ section: 'options-du-kit', statut: 'a-valider', montage: 'tous', prixTtc: 390, prixBestL2: 570, prixVwT5: null,
      kits: ['travel', 'madel'], finitions: [], dependDe: [], visuel: null })
    expect(o.noteClient).toBe('Il faut « vérifier » l\'empattement & la hauteur')
    expect(brut.options.find((x) => x.slug === 'prise-ext')).toMatchObject({ section: 'electricite', ordre: 3.5, prixTtc: 49.9 })
  })
  it('véhicules : références simples en slug, recommandé, multi-référence vide', () => {
    const [trafic, t4] = brut.vehicules
    expect(trafic).toMatchObject({ marque: 'renault', plateforme: 'x82', groupe: 'x82', recommande: true, kits: ['travel'], photo: 'https://cdn.example/trafic.webp' })
    expect(t4).toMatchObject({ groupe: null, recommande: false, kits: [] })
  })
  it('teinte des finitions : couleur liée en fond, vide = null', () => {
    expect(brut.finitions.find((f) => f.slug === 'best').teinte).toBe('#8e6c4b')
    expect(brut.finitions.find((f) => f.slug === 'soft').teinte).toBeNull()
  })
  it('gabarits et types de variantes', () => {
    expect(brut.longueurs[0].gabarit).toBe('court')
    expect(brut.grille[0]).toMatchObject({ gabarit: 'court', prix: 2495 })
    expect(brut.variantes[0]).toMatchObject({ type: 'choix', option: 'prise-ext', prixTtc: 69.89 })
  })
  it('bout en bout : Trafic 3 court, Travel Best, meuble haut → 2 495 + 490 €', () => {
    const e = { ...R.etatVide(), vehicule: 'renault-trafic-3', longueur: 'trafic-3-l1h1', kit: 'travel', finition: 'best', montage: 'soi-meme',
      options: { 'meuble-haut-2-placards': true } }
    const d = R.devis(R.nettoyer(e, cat), cat)
    expect(d.total).toBe(2985)
    expect(d.incomplet).toBe(false)
  })
})
