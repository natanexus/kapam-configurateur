/* Page de test locale : structure Webflow + listes CMS générées depuis le catalogue prototype + dist/main.js. Usage : node scripts/page-test.mjs dossier/ */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { normaliser, versCms } from '../test/adaptateur.js'
import { fabriquer } from './glb-exemple.mjs'

const dossier = process.argv[2]
mkdirSync(dossier, { recursive: true })
const extrait = JSON.parse(readFileSync(new URL('../test/fixtures/prototype-catalogue.json', import.meta.url)))
const brut = versCms(normaliser(extrait))
const frigo = brut.options.find((o) => o.nom.startsWith('Frigo Vitrifrigo'))
if (process.env.GLB) copyFileSync(process.env.GLB, `${dossier}/kit-test.glb`)   // GLB=chemin/vers/kit.glb : vrai modèle
else writeFileSync(`${dossier}/kit-test.glb`, await fabriquer(`opt-${frigo.slug}`))
brut.kits.find((k) => k.slug === 'travel').glb = 'kit-test.glb'
brut.finitions.forEach((f) => { f.teinte = { soft: '#dcb584', triply: '#cfa163', best: '#8e6c4b' }[f.slug] })

const INV = { 'a-valider': 'À valider Willy', valide: 'Validé', retire: 'Retiré', 'a-creer': 'À créer' }
const MONT = { tous: 'Tous montages', atelier: 'Atelier uniquement', impose: 'Imposé en atelier', inclus: 'Inclus en atelier' }
const TYPES = { choix: 'Choix unique', cases: 'Cases cumulables', palier: 'Palier de prix' }
const ech = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
const kebab = (k) => k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())
const REFS = ['kits', 'finitions', 'plateformes', 'dependDe', 'incompatibleAvec']
let html = '<div class="hide" data-cms-donnees>'
for (const [coll, items] of Object.entries(brut)) {
  html += '<div class="w-dyn-list"><div role="list" class="w-dyn-items">'
  for (const it of items) {
    const attrs = [], enfants = []
    for (const [k, v] of Object.entries(it)) {
      if (v == null) continue
      if (REFS.includes(k) && Array.isArray(v)) { enfants.push(`<div data-refs="${k}"><div class="w-dyn-items">${v.map((r) => `<div class="w-dyn-item"><span data-ref="${ech(r)}"></span></div>`).join('')}</div></div>`); continue }
      if (k === 'recommande') { enfants.push(`<span data-champ="recommande"${v ? '' : ' class="w-condition-invisible"'}></span>`); continue }
      if (k === 'teinte') { enfants.push(`<div data-champ="teinte" style="background-color:${v}"></div>`); continue }
      const val = k === 'statut' ? INV[v] : k === 'montage' ? MONT[v] : k === 'type' ? TYPES[v] : v
      attrs.push(`data-${kebab(k)}="${ech(val)}"`)
    }
    html += `<div role="listitem" class="w-dyn-item"><div data-item="${coll}" ${attrs.join(' ')}>${enfants.join('')}</div></div>`
  }
  html += '</div></div>'
}
html += '</div>'
const page = readFileSync(new URL('../test/fixtures/page.html', import.meta.url), 'utf8')
const head = readFileSync(new URL('../webflow/code-head.html', import.meta.url), 'utf8')
writeFileSync(`${dossier}/index.html`, `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Test configurateur</title>${head}
<style>[data-scene="3d"]{height:400px;position:relative}</style></head><body>${page}${html}<script type="module" src="./main.js"></script></body></html>`)
copyFileSync('dist/main.js', `${dossier}/main.js`); copyFileSync('dist/3d.js', `${dossier}/3d.js`)
console.log('page écrite dans', dossier, '— option 3D :', frigo.slug)
