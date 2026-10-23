/* Point d'entrée chargé sur toutes les pages (code du site, dist/site.js) : modale « Demander un devis ». */
import { lireCatalogue } from './lecture-cms.js'
import { indexer } from './catalogue.js'
import { charger } from './etat.js'
import { creerDevis, lireFormules } from './devis.js'

export { creerDevis, lireFormules }

function demarrer() {
  const racine = document.querySelector('[data-devis]')
  if (!racine) return
  const zone = racine.querySelector('[data-devis-donnees]') ?? racine
  const catalogue = indexer(lireCatalogue(zone))
  const formules = lireFormules(zone)
  const devis = creerDevis({ document, racine, formules, catalogue, configuration: charger() })
  devis.rendre()
  document.documentElement.classList.add('devis-prete')
  window.kapamDevis = devis
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer)
else demarrer()
