import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { creerReference } from './reference-prototype.js'
import { normaliser, versCms, slugOption, slugLongueur, slugChoix, slugCase } from './adaptateur.js'
import { indexer } from '../src/catalogue.js'
import * as R from '../src/regles.js'

const extrait = JSON.parse(readFileSync(new URL('./fixtures/prototype-catalogue.json', import.meta.url)))
const proto = normaliser(extrait)
const ref = creerReference(proto)
const brut = versCms(proto)
const cat = indexer(brut)

const arrondi = (n) => Math.round(n * 100) / 100
const etat = (x) => ({ ...R.etatVide(), ...x })
const trafic3 = '3e370bd669cd81dfb3d1c9619bb11e8d'
const t5 = '3e370bd669cd81549d69d9abb3bb316d'

/* ------------------------------------------------ cas connus (Notion) --- */

describe('cas validés dans les règles Notion', () => {
  it('Trafic 3 court : Travel Soft 2 195 €, Travel Best 2 495 €, Madel Best 2 695 €', () => {
    const e = etat({ vehicule: trafic3, longueur: `${trafic3}-l0` })
    expect(R.prixKit(e, cat, 'travel', 'soft').prix).toBe(2195)
    expect(R.prixKit(e, cat, 'travel', 'best').prix).toBe(2495)
    expect(R.prixKit(e, cat, 'madel', 'best').prix).toBe(2695)
  })
  it('combinaison absente de la boutique : finition grisée (Madel Soft long)', () => {
    const e = etat({ vehicule: trafic3, longueur: `${trafic3}-l1` })
    expect(R.prixKit(e, cat, 'madel', 'soft')).toMatchObject({ prix: null, dispo: false, aCompleter: false })
  })
  it('véhicule sans grille : « prix à compléter », plus de prix maquette', () => {
    const e = etat({ vehicule: t5, longueur: `${t5}-l0`, kit: 'travel', finition: 'best' })
    expect(R.prixKit(e, cat)).toMatchObject({ prix: null, aCompleter: true, dispo: true })
    const d = R.devis(e, cat)
    expect(d.lignes[0]).toMatchObject({ type: 'kit', montant: null, aCompleter: true })
    expect(d.incomplet).toBe(true)
  })
  it('kit universel : suffixe « universel » dans le nom du kit', () => {
    const master = '3e670bd669cd8139a9a2e3fcbc9f8e3c'
    const e = etat({ vehicule: master, longueur: `${master}-l0` })
    expect(R.nomKit(cat.par.kits.get('travel'), e, cat)).toBe('Kit Travel universel')
  })
  it('postes imposés : 1 600 € en L1, 1 730 € en L2', () => {
    const somme = (l) => l.reduce((t, x) => t + x.montant, 0)
    expect(somme(R.lignesImposees(etat({ vehicule: trafic3, longueur: `${trafic3}-l0`, montage: 'atelier' }), cat))).toBe(1600)
    expect(somme(R.lignesImposees(etat({ vehicule: trafic3, longueur: `${trafic3}-l1`, montage: 'atelier' }), cat))).toBe(1730)
  })
  it('paliers de montage : 1 850 € jusqu\'à 6 000 €, 2 000 € jusqu\'à 8 000 €, 2 200 € au-delà', () => {
    expect(R.palierMontage(6000, cat).prix).toBe(1850)
    expect(R.palierMontage(6000.01, cat).prix).toBe(2000)
    expect(R.palierMontage(8000, cat).prix).toBe(2000)
    expect(R.palierMontage(12000, cat).prix).toBe(2200)
  })
  it('marchepied réservé au X82, VASP réservée à l\'atelier, chauffages incompatibles', () => {
    const marchepied = cat.par.options.get('3e370bd669cd8185a47bc9a9115d1f82')
    expect(R.disponibilite(marchepied, etat({ vehicule: trafic3 }), cat).etat).toBe('ok')
    expect(R.disponibilite(marchepied, etat({ vehicule: t5 }), cat).etat).toBe('bloque')
    const e = R.nettoyer(etat({ vehicule: trafic3, montage: 'soi-meme', vasp: true }), cat)
    expect(e.vasp).toBe(false)
    const autoterm = cat.par.options.get('3e970bd669cd81d69417c91ef9126a9c')
    const avecEber = etat({ vehicule: trafic3, options: { '3e370bd669cd81a4b819effeecda7fdb': true } })
    expect(R.disponibilite(autoterm, avecEber, cat)).toMatchObject({ etat: 'bloque', raison: 'incompatible' })
  })
  it('chauffage : prix VW T5-T6 par plateforme', () => {
    const eber = cat.par.options.get('3e370bd669cd81a4b819effeecda7fdb')
    expect(R.prixOption(eber, etat({ vehicule: t5 }), cat)).toBe(2100)
    expect(R.prixOption(eber, etat({ vehicule: trafic3 }), cat)).toBe(1800)
  })
})

/* -------------------------------------- décision : sans prix = masqué --- */

describe('sans prix, on masque', () => {
  const sansPrix = (modif) => {
    const b = structuredClone(brut)
    modif(b)
    return indexer(b)
  }
  it('option sans prix ni version chiffrée : masquée et retirée du devis', () => {
    const slug = '3e370bd669cd8136b429daa2f8d20fcd' // Pack Éclairage LED
    const c = sansPrix((b) => { b.options.find((o) => o.slug === slug).prixTtc = null })
    const e = etat({ vehicule: trafic3, longueur: `${trafic3}-l0`, kit: 'travel', finition: 'soft', options: { [slug]: true } })
    expect(R.disponibilite(c.par.options.get(slug), e, c)).toMatchObject({ etat: 'masque', raison: 'prix' })
    expect(R.nettoyer(e, c).options[slug]).toBeUndefined()
  })
  it('version sans prix : absente de la liste', () => {
    const slug = '3e370bd669cd813db186c68ff95eb469' // Pack Lithium
    const c = sansPrix((b) => { b.variantes.find((x) => x.slug === `${slug}--c1`).prixTtc = null })
    expect(R.versionsChoix(c.par.options.get(slug), etat({}), c).map((x) => x.nom)).toEqual(['Pack 30 A'])
  })
  it('stratifiés DESIGN 2 à 4 sans prix : non proposés, effacés de l\'état', () => {
    expect(R.gammesProposees(cat ? [{ slug: 'a', prix: 0 }, { slug: 'b', prix: null }] : []).map((g) => g.slug)).toEqual(['a'])
    const e = R.nettoyer(etat({ finition: 'best', attributs: { stratifie: 'design-2' } }), cat)
    expect(e.attributs.stratifie).toBe('')
  })
})

/* ------------------------------------- non-régression contre le prototype --- */

function mulberry32(graine) {
  return () => {
    graine |= 0; graine = (graine + 0x6d2b79f5) | 0
    let t = Math.imul(graine ^ (graine >>> 15), 1 | graine)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function tirer(rand, v) {
  const pick = (l) => l[Math.floor(rand() * l.length)]
  const li = Math.floor(rand() * v.longueurs.length)
  const kitCode = pick(v.kits)
  const finCode = pick(['Soft', 'Triply', 'Best'])
  const p = {
    vehiculeId: v.id, longueur: v.longueurs[li].etiquette, kit: kitCode, finition: finCode,
    montage: pick(['soi-meme', 'atelier', null]), vasp: rand() < 0.5, options: {},
    attributs: { literie: pick(['', 'Tissu', 'Velours']), stratifie: pick(['', 'DESIGN 1']), stratifie2: pick(['', 'DESIGN 1']) },
  }
  const n = {
    ...R.etatVide(), vehicule: v.id, longueur: slugLongueur(v, li), kit: kitCode === 'Combi' ? 'combi' : kitCode.toLowerCase(),
    finition: finCode.toLowerCase(), montage: p.montage, vasp: p.vasp, options: {}, versions: {}, cases: {},
    attributs: { literie: p.attributs.literie.toLowerCase(), stratifie: p.attributs.stratifie ? 'design-1' : '', stratifie2: p.attributs.stratifie2 ? 'design-1' : '', sol: '' },
  }
  for (const o of ref.C.options) {
    if (o.section === 'Services & montage' || o.statut === 'Retiré' || rand() > 0.35) continue
    p.options[o.id] = true; n.options[slugOption(o)] = true
    if (o.choix && rand() < 0.7) {
      const i = Math.floor(rand() * o.choix.valeurs.length)
      p.attributs[o.choix.cle] = o.choix.valeurs[i].v; n.versions[o.id] = slugChoix(o, i)
    }
    if (o.multi) {
      const idx = o.multi.map((_, i) => i).filter(() => rand() < 0.5)
      p.attributs['m_' + o.id] = idx.map((i) => o.multi[i].v); n.cases[o.id] = idx.map((i) => slugCase(o, i))
    }
  }
  return { p, n }
}

function comparer(p, n) {
  const r = ref.calculer(p)
  const d = R.devis(R.nettoyer(n, cat), cat)
  const optRef = Object.fromEntries(r.devis.lignes.filter((l) => l.id).map((l) => [slugOption(proto.options.find((o) => o.id === l.id)), l.montant]))
  const optNew = Object.fromEntries(d.lignes.filter((l) => l.type === 'option').map((l) => [l.option, l.montant]))
  return { r, d, optRef, optNew }
}

describe('non-régression : mêmes devis que le prototype', () => {
  const avecGrille = proto.vehicules.filter((v) => ref.calculer({ vehiculeId: v.id, longueur: v.longueurs[0].etiquette, options: {}, attributs: {} }).grille)
  const sansGrille = proto.vehicules.filter((v) => !avecGrille.includes(v))

  it('le jeu de test couvre X82, universel et Combi', () => {
    expect(avecGrille.length).toBe(12)
  })

  it('3 000 configurations sur véhicules avec grille : totaux, kit, montage et options identiques', () => {
    const rand = mulberry32(2026)
    const ecarts = []
    for (let i = 0; i < 3000; i++) {
      const v = avecGrille[Math.floor(rand() * avecGrille.length)]
      const { p, n } = tirer(rand, v)
      const { r, d, optRef, optNew } = comparer(p, n)
      const kitR = r.devis.lignes.find((l) => l.libelle?.startsWith('Prix du kit'))?.montant ?? null
      const kitN = d.lignes.find((l) => l.type === 'kit')?.montant ?? null
      const monR = r.devis.lignes.find((l) => l.libelle?.startsWith('Pose atelier'))?.montant ?? null
      const monN = d.lignes.find((l) => l.type === 'montage')?.montant ?? null
      const ok = arrondi(r.devis.total) === d.total && r.devis.incomplet === d.incomplet && kitR === kitN
        && (monR === null ? monN === null : arrondi(monR) === arrondi(monN))
        && JSON.stringify(Object.keys(optRef).sort()) === JSON.stringify(Object.keys(optNew).sort())
        && Object.keys(optRef).every((k) => arrondi(optRef[k]) === arrondi(optNew[k]))
      if (!ok) ecarts.push({ i, v: v.modele, p, ref: r.devis, nouveau: d })
    }
    expect(ecarts.slice(0, 1)).toEqual([])
  })

  it('1 000 configurations sur véhicules sans grille : options identiques, kit « prix à compléter »', () => {
    const rand = mulberry32(7)
    const ecarts = []
    for (let i = 0; i < 1000; i++) {
      const v = sansGrille[Math.floor(rand() * sansGrille.length)]
      const { p, n } = tirer(rand, v)
      const { d, optRef, optNew } = comparer(p, n)
      const kitN = d.lignes.find((l) => l.type === 'kit')
      const ok = (!kitN || (kitN.montant === null && kitN.aCompleter && d.incomplet))
        && JSON.stringify(Object.keys(optRef).sort()) === JSON.stringify(Object.keys(optNew).sort())
        && Object.keys(optRef).every((k) => arrondi(optRef[k]) === arrondi(optNew[k]))
      if (!ok) ecarts.push({ i, v: v.modele, optRef, optNew })
    }
    expect(ecarts.slice(0, 1)).toEqual([])
  })

  it('estimation() ne modifie pas l\'état', () => {
    const e = etat({ vehicule: trafic3, longueur: `${trafic3}-l0`, kit: 'travel', finition: 'best', montage: 'soi-meme' })
    const copie = structuredClone(e)
    expect(R.estimation('atelier', e, cat).lignes.some((l) => l.type === 'montage')).toBe(true)
    expect(e).toEqual(copie)
  })
})

/* ----------------------------------------------------- mots interdits --- */

describe('mots interdits', () => {
  it('aucun dans src/', () => {
    const interdits = /\b(panier|commandes?|achats?|caisse|acheter)\b/i
    const trouves = readdirSync(new URL('../src/', import.meta.url), { recursive: true })
      .filter((f) => /\.(js|css|html)$/.test(f))
      .flatMap((f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8').split('\n')
        .map((l, i) => [f, i + 1, l]).filter(([, , l]) => interdits.test(l)))
    expect(trouves).toEqual([])
  })
})
