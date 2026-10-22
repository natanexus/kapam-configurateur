/* Point d'entrée chargé par les pages catégorie de la boutique (dist/boutique.js). */
import { lireCatalogue } from './lecture-cms.js'
import { indexer } from './catalogue.js'
import { creerBoutique, completerDepuisPage } from './boutique.js'

export * from './boutique.js'
export { indexer, lireCatalogue }

function demarrer() {
  const racine = document.querySelector('[data-boutique]')
  if (!racine) return
  const catalogue = indexer(completerDepuisPage(lireCatalogue(document), racine))
  const app = creerBoutique({ racine, catalogue, document })
  app.rendre()
  document.documentElement.classList.add('boutique-prete')
  window.kapamBoutique = { app, catalogue }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer)
else demarrer()
