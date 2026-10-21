/* Point d'entrée chargé par la page Webflow « Configurateur ». */
import { lireCatalogue } from './lecture-cms.js'
import { indexer } from './catalogue.js'
import { charger, sauver, surChangement } from './etat.js'
import { creerApp } from './vues.js'

export * from './regles.js'
export { indexer, lireCatalogue, creerApp }

/** Scène 3D : chargée (three.js compris) à la première arrivée sur l'étape 2.1 seulement. */
function brancher3d(racine, catalogue) {
  const conteneur = racine.querySelector('[data-scene="3d"]')
  if (!conteneur) return
  let scene = null, chargement = null, dernier = null
  const pret = () => (chargement ??= import('./3d.js').then((m) => { scene = m.creerScene3d(conteneur); if (window.kapamConfigurateur) window.kapamConfigurateur.scene3d = scene; return scene }))

  const etatEl = conteneur.querySelector('[data-champ="etat-3d"]')
  racine.addEventListener('kapam:configuration', (ev) => {
    const { etat } = ev.detail
    const visible = etat.etape === 3
    const glb = catalogue.par.kits.get(etat.kit)?.glb
    if (!scene && !(visible && glb)) {
      // Rien à charger : three.js n'est pas téléchargé tant qu'aucun kit n'a de modèle.
      if (etatEl && visible) etatEl.textContent = etat.kit ? 'Aperçu 3D bientôt disponible pour ce kit.' : 'Choisissez un kit pour voir l\'aperçu 3D.'
      return
    }
    pret().then((s) => {
      s.appliquer({ etat, catalogue, visible })
      // Option tout juste retenue : la caméra se place dessus.
      const avant = dernier?.options ?? {}
      const nouvelle = Object.keys(etat.options).find((slug) => !avant[slug])
      if (nouvelle && dernier?.kit === etat.kit) s.cadrerSur(nouvelle)
      dernier = etat
    })
  })
  // Clic sur le titre d'une option reliée au modèle : la caméra la vise (fantôme si elle n'est pas retenue).
  racine.addEventListener('click', (ev) => {
    const titre = ev.target.closest('[data-option] [data-champ="titre"]')
    const slug = titre?.closest('[data-option]')?.dataset.option
    if (slug && scene && scene.viser(slug)) ev.stopPropagation()
  }, true)
}

function demarrer() {
  const racine = document.querySelector('[data-configurateur]')
  if (!racine) return
  const catalogue = indexer(lireCatalogue(document))
  const app = creerApp({ document, catalogue, etat: charger(), sauver })
  surChangement((e) => app.remplacer(e))
  brancher3d(racine, catalogue)
  app.rendre()
  document.documentElement.classList.add('config-prete')
  window.kapamConfigurateur = { app, catalogue }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer)
else demarrer()
