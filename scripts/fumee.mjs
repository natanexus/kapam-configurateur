/* Test de fumée dans Chromium : charge la page de test, va jusqu'à 2.1, vérifie la 3D. Usage : node scripts/fumee.mjs dossier/ */
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const dossier = process.argv[2]
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary' }
const srv = createServer((req, res) => {
  const f = join(dossier, req.url === '/' ? 'index.html' : req.url.split('?')[0])
  if (!existsSync(f)) { res.writeHead(404); res.end(); return }
  res.writeHead(200, { 'content-type': TYPES[f.slice(f.lastIndexOf('.'))] ?? 'application/octet-stream' }); res.end(readFileSync(f))
}).listen(0)
const port = srv.address().port
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const erreurs = []
page.on('pageerror', (e) => erreurs.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') erreurs.push(`${m.type()}: ${m.text()}`) })
await page.goto(`http://localhost:${port}/`)
const r = await page.evaluate(async (attente) => {
  const app = window.kapamConfigurateur.app
  const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
  document.querySelector('[data-liste="marques"] [data-marque="renault"]').click()
  document.querySelector('[data-liste="modeles-liste"] [data-vehicule="3e370bd669cd81dfb3d1c9619bb11e8d"]').click()
  document.querySelector('[data-liste="longueurs"] [data-longueur]').click()
  document.querySelector('[data-action="suivant"]').click()
  document.querySelector('[data-liste="kits"] [data-kit="travel"]').click()
  document.querySelector('[data-liste="finitions"] [data-finition="best"]').click()
  await dodo(attente)
  const scene = document.querySelector('[data-scene="3d"]')
  const s3 = window.kapamConfigurateur.scene3d
  const reliees = s3 ? window.kapamConfigurateur.catalogue.options.filter((o) => s3.aDesPieces(o.slug)).map((o) => o.nom) : []
  const canvas = scene.querySelector('canvas')
  const frigo = document.querySelector('[data-option="3e370bd669cd81d98cf9fd1868ad89c2"]')
  frigo?.querySelector('[data-champ="case"]').click()
  await dodo(800)
  return { etape: app.etat().etape, canvas: !!canvas, taille: canvas && [canvas.width, canvas.height], etat3d: scene.querySelector('[data-champ="etat-3d"]').textContent,
    etat3dCache: scene.querySelector('[data-champ="etat-3d"]').hidden, vues: scene.querySelectorAll('[data-vue]').length, frigo: !!frigo, options: app.etat().options, reliees }
}, Number(process.env.ATTENTE ?? 2500))
await page.screenshot({ path: join(dossier, 'capture.png') })
await browser.close(); srv.close()
console.log(JSON.stringify(r, null, 1)); console.log('erreurs :', erreurs.length ? erreurs : 'aucune')
