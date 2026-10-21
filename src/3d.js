/**
 * Scène 3D du kit (étape 2.1). Chargée à la demande par main.js (chunk séparé, three.js inclus).
 *
 * - GLB du kit : URL du champ CMS « GLB » (collection Kits), compression meshopt acceptée.
 * - Pièces d'une option : objet vide nommé « opt-<slug 3D ou slug de l'option> » dans le modèle ;
 *   à défaut, correspondance de secours par nom (3d-correspondance.js).
 * - Bois : couleur de la finition choisie (champ « Teinte » de la collection Finitions).
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { CORRESPONDANCE_PAR_NOM, MATERIAUX_BOIS, TEINTES_MATERIAUX } from './3d-correspondance.js'
import { TEINTES_FINITION } from './config.js'

const VUES = [
  { nom: '3/4 avant', theta: 0.75, phi: 1.15 },
  { nom: '3/4 arrière', theta: 3.75, phi: 1.15 },
  { nom: 'Profil', theta: 1.57, phi: 1.3 },
  { nom: 'Plongée', theta: 0.9, phi: 0.45 },
]
const propre = (n) => (n || '').replace(/\.\d{3}$/, '').replace(/_/g, ' ').trim()
const correspond = (nom, motif) => (motif.startsWith('=')
  ? nom.toLowerCase() === motif.slice(1).toLowerCase()
  : nom.toLowerCase().startsWith(motif.toLowerCase()))

/**
 * @param {HTMLElement} conteneur  [data-scene="3d"] de la page Webflow (contient [data-champ="etat-3d"])
 */
export function creerScene3d(conteneur) {
  const doc = conteneur.ownerDocument
  const etatEl = conteneur.querySelector('[data-champ="etat-3d"]')
  const canvas = doc.createElement('canvas')
  canvas.className = 'config_scene3d_canvas'   // stylée dans le Designer
  conteneur.insertBefore(canvas, conteneur.firstChild)
  const boutons = doc.createElement('div')
  boutons.className = 'config_scene3d_vues'
  boutons.setAttribute('role', 'group'); boutons.setAttribute('aria-label', 'Point de vue')
  for (const [i, v] of VUES.entries()) {
    const b = doc.createElement('button')
    b.type = 'button'; b.className = 'config_scene3d_vue'; b.textContent = v.nom; b.dataset.vue = String(i)
    b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false')
    b.addEventListener('click', () => vue(i))
    boutons.appendChild(b)
  }
  conteneur.appendChild(boutons)

  const message = (t) => { if (etatEl) { etatEl.textContent = t ?? ''; etatEl.hidden = !t } }

  /* ----------------------------------------------------------- scène --- */
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(38, 3 / 2, 0.05, 200)
  const rendu = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  rendu.setPixelRatio(Math.min(doc.defaultView.devicePixelRatio || 1, 2))
  scene.add(new THREE.AmbientLight(0xffffff, 0.9))
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8172, 0.9))
  const k1 = new THREE.DirectionalLight(0xffffff, 2.2); k1.position.set(4, 6, 5); scene.add(k1)
  const k2 = new THREE.DirectionalLight(0xffffff, 0.9); k2.position.set(-5, 3, -4); scene.add(k2)

  let theta = VUES[0].theta, phi = VUES[0].phi, dist = 6, distV = 6, base = 6
  const cible = new THREE.Vector3(), cibleV = new THREE.Vector3(), centre = new THREE.Vector3()
  let modele = null, prete = false, actif = false, urlChargee = null
  const pieces = new Map()      // slug option → [meshes]
  let finitionTeinte = null

  function placer() {
    camera.position.set(
      cible.x + dist * Math.sin(phi) * Math.sin(theta),
      cible.y + dist * Math.cos(phi),
      cible.z + dist * Math.sin(phi) * Math.cos(theta))
    camera.lookAt(cible)
  }
  function vue(i) {
    theta = VUES[i].theta; phi = VUES[i].phi; distV = base; cibleV.copy(centre)
    boutons.querySelectorAll('[data-vue]').forEach((b, j) => { b.setAttribute('aria-pressed', String(j === i)); b.classList.toggle('selectionne', j === i) })
  }
  function cadrerSur(objets) {
    const b = new THREE.Box3()
    for (const o of objets) if (o.visible) b.expandByObject(o)
    if (b.isEmpty()) return
    cibleV.copy(b.getCenter(new THREE.Vector3()))
    distV = Math.max(0.9, Math.min(base, b.getSize(new THREE.Vector3()).length() * 2.1))
  }
  function taille() {
    const w = conteneur.clientWidth, h = conteneur.clientHeight
    if (!w || !h) return
    rendu.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix()
  }
  new (doc.defaultView.ResizeObserver)(taille).observe(conteneur)

  /* ---------------------------------------------------------- souris --- */
  let drag = false, pan = false, lx = 0, ly = 0
  canvas.addEventListener('contextmenu', (e) => e.preventDefault())
  canvas.addEventListener('pointerdown', (e) => { drag = true; pan = e.shiftKey || e.button === 2; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId) })
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return
    const dx = e.clientX - lx, dy = e.clientY - ly
    if (pan) {
      const k = dist * 0.0016
      cibleV.addScaledVector(new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0), -dx * k)
        .addScaledVector(new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1), dy * k)
    } else {
      theta -= dx * 0.008
      phi = Math.max(0.12, Math.min(1.55, phi - dy * 0.006))
    }
    lx = e.clientX; ly = e.clientY
  })
  for (const t of ['pointerup', 'pointercancel']) canvas.addEventListener(t, () => { drag = false; pan = false })
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); distV = Math.max(0.5, Math.min(base * 2.2, distV + e.deltaY * 0.0012 * base)) }, { passive: false })

  /* --------------------------------------------------------- teintes --- */
  function teinter() {
    if (!modele) return
    const bois = new THREE.Color(finitionTeinte ?? TEINTES_FINITION.soft)
    modele.traverse((o) => {
      if (!o.isMesh) return
      for (const m of [].concat(o.material)) {
        const nom = (m.name || '').trim()
        if (MATERIAUX_BOIS.includes(nom)) m.color.copy(bois)
        else if (TEINTES_MATERIAUX[nom]) m.color.set(TEINTES_MATERIAUX[nom])
        if (m.transparent && m.opacity >= 1) { m.transparent = false; m.depthWrite = true; m.needsUpdate = true }
      }
    })
  }

  /* ------------------------------------------------------- chargement --- */
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)

  function relierPieces(options) {
    pieces.clear()
    const meshes = []; modele.traverse((o) => { if (o.isMesh) meshes.push(o) })
    const vides = new Map(); modele.traverse((o) => { const m = /^opt-(.+)$/.exec(propre(o.name)); if (m) vides.set(m[1], o) })
    for (const o of options) {
      const vide = vides.get(o.slug3d || o.slug) ?? vides.get(o.slug)
      let liste = []
      if (vide) vide.traverse((x) => { if (x.isMesh) liste.push(x) })
      else if (CORRESPONDANCE_PAR_NOM[o.nom]) {
        const motifs = CORRESPONDANCE_PAR_NOM[o.nom]
        liste = meshes.filter((x) => {
          const noms = [propre(x.name)]; if (x.parent && x.parent !== modele) noms.push(propre(x.parent.name))
          return noms.some((n) => motifs.some((p) => correspond(n, p)))
        })
      }
      if (liste.length) { pieces.set(o.slug, liste); for (const x of liste) x.visible = false }
    }
  }

  function charger(url, options) {
    if (!url || url === urlChargee) return Promise.resolve(prete)
    urlChargee = url; prete = false
    message('Chargement du kit…')
    if (modele) { scene.remove(modele); modele = null }
    return new Promise((resoudre) => {
      loader.load(url, (gltf) => {
        modele = gltf.scene; scene.add(modele)
        const b = new THREE.Box3().setFromObject(modele)
        centre.copy(b.getCenter(new THREE.Vector3()))
        base = b.getSize(new THREE.Vector3()).length() * 0.85
        dist = distV = base; cible.copy(centre); cibleV.copy(centre)
        relierPieces(options)
        teinter()
        prete = true
        message('')
        vue(0); taille()
        resoudre(true)
      }, undefined, (err) => {
        message("Le kit n'a pas pu être chargé en 3D.")
        console.warn('[kapam 3D]', err)
        resoudre(false)
      })
    })
  }

  ;(function boucle() {
    doc.defaultView.requestAnimationFrame(boucle)
    if (!actif || !prete) return
    cible.lerp(cibleV, 0.12); dist += (distV - dist) * 0.12
    placer(); rendu.render(scene, camera)
  })()

  /* ----------------------------------------------- lien avec l'état --- */
  const FANTOME = new THREE.MeshStandardMaterial({ color: 0xc98a2b, transparent: true, opacity: 0.55, depthWrite: false })
  let apercu = null
  function finApercu() {
    if (!apercu) return
    clearTimeout(apercu.t)
    for (const o of apercu.liste) { o.material = o.userData.matOrig; o.visible = false }
    apercu = null
  }

  return {
    /** À chaque rendu de la page : montre les pièces des options retenues, teinte le bois. */
    appliquer({ etat, catalogue, visible }) {
      actif = !!visible
      const k = catalogue.par.kits.get(etat.kit)
      const f = catalogue.par.finitions.get(etat.finition)
      finitionTeinte = f?.teinte ?? TEINTES_FINITION[f?.slug] ?? null
      if (!k?.glb) { message('Aperçu 3D bientôt disponible pour ce kit.'); return }
      charger(k.glb, catalogue.options).then((ok) => {
        if (!ok) return
        finApercu(); teinter()
        for (const [slug, liste] of pieces) for (const o of liste) o.visible = !!etat.options[slug]
        taille()
      })
    },
    /** Centre la caméra sur une option (fantôme 3,5 s si elle n'est pas retenue). */
    viser(slug) {
      const liste = pieces.get(slug); if (!liste || !prete) return false
      finApercu()
      const b = new THREE.Box3(); for (const o of liste) b.expandByObject(o)
      if (b.isEmpty()) return false
      cibleV.copy(b.getCenter(new THREE.Vector3()))
      distV = Math.max(0.9, Math.min(base, b.getSize(new THREE.Vector3()).length() * 2.1))
      const caches = liste.filter((o) => !o.visible)
      if (caches.length) {
        for (const o of caches) { o.userData.matOrig = o.material; o.material = FANTOME; o.visible = true }
        apercu = { liste: caches, t: setTimeout(finApercu, 3500) }
      }
      return true
    },
    cadrerSur: (slug) => { const l = pieces.get(slug); if (l) cadrerSur(l) },
    aDesPieces: (slug) => pieces.has(slug),
    vue,
  }
}
