# Configurateur Kapam — code Webflow

Logique du configurateur, reprise du prototype du 28/09/2026, sur les données du CMS Webflow (collections `Config ·`).

```
npm install
npm test        # règles + non-régression contre le prototype
npm run build   # dist/main.js, servi par jsDelivr (tag de version, jamais @main)
```

## Structure

| Fichier | Rôle |
|---|---|
| `src/config.js` | Ce qui n'est pas dans le CMS : slugs lus par le code, sections, nuanciers, clé de stockage |
| `src/catalogue.js` | Format du catalogue (listes à plat du CMS) et `indexer()` : jointures par slug |
| `src/regles.js` | Fonctions pures : `disponibilite`, `prixOption`, `prixKit`, `grilleKit`, `devis`, `palierMontage`, `lignesImposees`, `nettoyer`… |
| `src/lecture-cms.js` | `lireCatalogue()` : lit les listes CMS cachées de la page et produit le catalogue brut |
| `src/format.js` | Euros (espaces insécables), pluriels, libellés des lignes du devis, récapitulatif texte |
| `src/etat.js` | localStorage (`kapam.config.v1`, 30 jours), synchronisation entre onglets |
| `src/vues.js` | `creerApp()` : clone les gabarits, remplit les `data-champ`, pose les états, gère les clics et le formulaire |
| `src/main.js` | Point d'entrée : lecture du CMS → `indexer` → état → `creerApp().rendre()` ; expose `window.kapamConfigurateur` |
| `src/3d.js`, `src/3d-correspondance.js` | Scène 3D (three.js, chunk `dist/3d.js` chargé à l'étape 2.1 si le kit a un GLB) ; pièces par objets vides `opt-<slug>`, secours par nom |
| `scripts/` | `glb-exemple.mjs` (GLB de test), `page-test.mjs` + `fumee.mjs` (`npm run page-test` : page locale + Chromium headless) |
| `webflow/code-head.html`, `webflow/code-footer.html` | Code à coller dans les paramètres de la page Webflow (style anti-flash, balise script) |
| `test/reference-prototype.js` | Fonctions du prototype recopiées telles quelles (référence) |
| `test/adaptateur.js` | Catalogue prototype → format CMS, avec les choix de la migration du 20/10 |
| `test/regles.test.js` | Cas Notion, décisions, 4 000 configurations comparées au prototype, mots interdits |
| `test/lecture-cms.test.js` | Lecture d'un extrait HTML tel que Webflow le publie |
| `test/fixtures/page.html`, `test/vues.test.js` | Copie structurelle de la page Webflow et parcours complet (marque → devis → confirmation) |

## Écarts volontaires avec le prototype

- Véhicule sans grille de prix : prix du kit inconnu (« prix à compléter »), plus de prix « maquette ».
- Option, version ou gamme sans prix : masquée (décision du 20/10/2026).
- Montage et VASP trouvés par slug, prix VW T5 par plateforme `vw-t5`, versions filtrées par marque / plateforme (champs Variantes).
- État : slugs partout (`versions`, `cases`) au lieu des libellés.
- Les lignes du devis sont structurées (`type`, `montant`, …) : les libellés sont écrits par les vues.

## Contrat avec la page Webflow « Configurateur »

| Sélecteur | Rôle |
|---|---|
| `[data-configurateur]` | Racine de l'application |
| `[data-etape="1.1" … "3.2"]` | Étapes (index 0 à 5 dans l'état) ; le script masque les inactives (`hidden`). `data-scene` = scène de gauche, `data-suivante` = libellé de la barre basse. 3.2 vit dans le bloc de confirmation du formulaire |
| `[data-scene="marques\|modeles\|vehicule\|3d"]` | Contenus de la scène de gauche |
| `[data-liste="…"]` | Conteneurs remplis par clonage (marques, modeles, longueurs, kits, finitions, upsell, nuanciers, options, postes-imposes, vasp, preparation, recap, resume-demande, recommandes) |
| `[data-section="…"]` | Bloc d'options d'une section CMS (clé = nom de section en slug) |
| `[data-bloc="…"]` | Blocs affichés ou non selon l'état (pas-encore, hors-liste, montage, detail-pose, vasp, preparation, recap, couleurs) |
| `[data-champ="…"]` | Texte ou image à remplir (compteur, total, nom-kit, etape-suivante, total-soi-meme, total-atelier…) |
| `[data-action="…"]` | Boutons : precedent, suivant, ouvrir-resume, hors-liste, changer-vehicule, comparer-kits, demander-devis, detail-option, ajouter |
| `[data-situation]`, `[data-montage]`, `[data-demande]` | Choix statiques |
| `[data-gabarits] [data-gabarit="…"]` | Gabarits cachés : carte, choix, ligne-option, case-version, select-versions, pastille, ligne-recap, upsell |
| `#demande-devis` | Formulaire natif « Demande de devis » ; champs cachés `[data-champ-form]` (type, reference, vehicule, total, recap, config) ; `[data-coord]` sur les champs visibles |
| `[data-cms-donnees] [data-item]` | Listes CMS cachées, lues par `lireCatalogue()` |
| `[data-zone="confirmation"]` | Bloc de succès du formulaire Webflow : quand il s'affiche, le script passe à 3.2 |

Attributs posés par le script sur les clones : `data-marque`, `data-vehicule`, `data-longueur`, `data-kit`, `data-finition`, `data-option`, `data-version` (choix unique), `data-case` (cases cumulables), `data-nuance` + `data-valeur`, `data-vasp`.

États (classes combo) : `selectionne`, `bloque`, `inclus`. Masquage par l'attribut `hidden` (le style du head le rend prioritaire sur les classes).

Évènements émis sur `[data-configurateur]` : `kapam:configuration` (à chaque rendu, `detail = { etat, devis }`, pour le module 3D et le drawer), `kapam:comparer-kits`, `kapam:detail-option`.

## Mise en place dans Webflow

1. Coller `webflow/code-head.html` dans le head de la page et `webflow/code-footer.html` avant `</body>` (version jsDelivr épinglée).
2. Les réglages du formulaire (adresse de notification, réponse automatique) se font dans Webflow → Forms ; le script remplit les champs cachés `data-champ-form` avant l'envoi.

## 3D

- GLB du kit : champ CMS « GLB » (collection Kits), compressé avec `npx gltf-transform meshopt entree.glb sortie.glb`, hébergé dans `assets/` du dépôt (jsDelivr).
- Dans Blender, les pièces d'une option sont regroupées sous un objet vide `opt-<slug 3D>` (champ « Slug 3D » de l'option, sinon son slug). Tant que ce n'est pas fait, `3d-correspondance.js` relie par nom, comme le prototype.
- Le bois prend la teinte de la finition (champ « Teinte »). Clic sur le titre d'une option reliée : la caméra la vise (fantôme 3,5 s si non retenue).
- Classes à styler dans le Designer : `config_scene3d_canvas`, `config_scene3d_vues` (boutons `config_lien` avec `aria-pressed`).

## À venir

Drawers (résumé, détail d'option, comparateur de kits), nuanciers avec décors quand Willy fournit références et photos, lot mobile.
