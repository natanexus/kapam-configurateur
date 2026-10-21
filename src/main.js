/* Point d'entrée chargé par la page Webflow « Configurateur ». */
import { lireCatalogue } from './lecture-cms.js'
import { indexer } from './catalogue.js'
import { charger, sauver, surChangement } from './etat.js'
import { creerApp } from './vues.js'

export * from './regles.js'
export { indexer, lireCatalogue, creerApp }

function demarrer() {
  if (!document.querySelector('[data-configurateur]')) return
  const catalogue = indexer(lireCatalogue(document))
  const app = creerApp({ document, catalogue, etat: charger(), sauver })
  surChangement((e) => app.remplacer(e))
  app.rendre()
  document.documentElement.classList.add('config-prete')
  window.kapamConfigurateur = { app, catalogue }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer)
else demarrer()
