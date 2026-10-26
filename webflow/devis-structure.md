# Composant « Modale devis » — structure à construire dans le Designer

Vit dans le composant **Footer** (donc sur toutes les pages). Le script `dist/site.js` (code du site, voir `site-code-head.html` / `site-code-footer.html`) s'y branche. `test/fixtures/devis.html` est la copie structurelle de référence : mêmes attributs, sans styles.

Ouverture : tout clic sur `.btn-devis-nav` ou `[data-devis-ouvrir]` (hors modale). `data-devis-formule="cle-en-main|atelier|kit-diy"` ouvre directement la présentation d'une formule (CTA des pages Formules) ; `data-devis-vue="formulaire"` ouvre son formulaire.

## Arbre

```
div.devis_overlay [data-devis] [hidden]                 ← fond cliquable (ferme), position fixed, z-index au-dessus de la nav
└ div.devis_boite [data-devis-boite] role=dialog aria-modal=true   ← panneau 440 px (maquette), scroll interne
  ├ button [data-action="fermer"] aria-label="Fermer"   ×
  ├ section [data-vue="hub"]                              H2 + chapo + div[data-liste="formules"] + bloc « Pas encore décidé ? » avec button[data-action="aide"]
  ├ section [data-vue="q1"] [hidden]                      eyebrow « Question 1 / 2 », H2, button[data-reponse="van:oui"], button[data-reponse="van:non"]
  ├ section [data-vue="q2"] [hidden]                      « Question 2 / 2 », button[data-reponse="pose:soi-meme"], button[data-reponse="pose:kapam"], button[data-action="precedent"]
  ├ section [data-vue="reco"] [hidden]                    H2 « Notre recommandation », div[data-liste="recommandee"], « Vous pouvez aussi explorer : », div[data-liste="autres"]
  ├ section [data-vue="presentation"] [hidden]
  │   span[data-champ="etiquette"] · h2[data-champ="nom"] · p[data-champ="description"]
  │   h3 « Ce que comprend l'offre » + ul[data-liste="inclus"]
  │   div[data-bloc="exclus"] { h3 « Ce que ça ne comprend pas » + ul[data-liste="exclus"] }
  │   h3 « Le process en <span data-champ="nb-etapes"> étapes » + ol[data-liste="etapes"]
  │   p[data-champ="tarif"] · span[data-champ="mention"] « Prix à confirmer » (texte fixe, montré si statut À valider)
  │   button[data-action="formulaire"] (texte remplacé par « Texte du bouton » du CMS) · button[data-action="hub"] « Voir les autres formules »
  ├ section [data-vue="formulaire"] [hidden]
  │   eyebrow « Demande de devis » · h2[data-champ="nom"]
  │   3 blocs Form Block Webflow : div.w-form [data-formulaire="cle-en-main"|"atelier"|"kit-diy"]  (voir Formulaires)
  │   button[data-action="precedent"] « Retour »
  └ section [data-vue="confirmation"] [hidden]
      eyebrow « Demande envoyée » · h2 « Bien reçu ! » · p[data-champ="message"]
      div[data-bloc="rdv"] { p « Pour avancer plus vite, réservez un appel… » + span[data-champ="duree"] (« 30 min ») + a.button[data-action="calcom"] target=_blank }
div.hide [data-gabarits]
  ├ div.devis_carte [data-gabarit="carte-formule"]  span[data-champ="etiquette"] · h3[data-champ="nom"] · p[data-champ="accroche"] · p[data-champ="tarif"] · span[data-champ="mention"] · button[data-action="presentation"]
  ├ li.devis_ligne [data-gabarit="ligne"]           span[data-champ="numero"] + span[data-champ="titre"]
  └ label.devis_chip [data-gabarit="chip"]          input (radio, nom/valeur posés par le script) + span[data-champ="titre"]
div.hide [data-devis-donnees] aria-hidden=true        ← 6 listes de collection (voir Données)
```

Un seul H1 par page : tout dans la modale est en H2/H3.

## Formulaires (3 Form Blocks Webflow, un par formule)

Le script n'écrit aucun HTML de formulaire : champs, `name`, `required` et placeholders sont posés dans le Designer. Webflow gère l'envoi et la notification ; le script passe à la confirmation quand `.w-form-done` s'affiche.

Dans chaque form :
- 3 champs cachés : `input[type=hidden] name=formule [data-champ-form="formule"]`, `name=recap [data-champ-form="recap"]`, `name=configuration [data-champ-form="configuration"]`.
- Coordonnées : `nom`, `prenom`, `email`, `telephone`, `code-postal` (required).
- **Chips** = `label[data-chip]` contenant un `input` radio/checkbox (visuellement masqué) + `span[data-champ="titre"]`. Le script pose la classe `selectionne` sur le label quand l'input est coché. Chips fixes (maquette) : `usage`, `occupants`, `equipements` (checkbox), `vasp`, `budget`.
- Chips construites depuis le CMS (gabarit `chip`, vides dans le Designer) : `fieldset[data-bloc="kits"] div[data-liste="kits"]` (name `kit`), `fieldset[data-bloc="finitions"] div[data-liste="finitions"]` (name `finition`), `fieldset[data-bloc="longueurs"] div[data-liste="longueurs"]` (name `longueur`, selon le modèle choisi ; bloc masqué si le modèle n'a pas de longueurs). Le script ajoute une chip « Je ne sais pas ».
- Selects natifs : `select name=marque [data-champ="select-marque"]` et `select name=modele [data-champ="select-modele"]`, chacun avec une seule option vide « Sélectionnez… » ; le script remplit et met Modèle en cascade (+ « Autre marque / Autre modèle »).
- Clé en main : `input name=vehicule-envisage [data-champ="vehicule-envisage"]` (pré-rempli si une configuration existe).
- `div[data-bloc="joindre"]` { `label` + `input[type=checkbox] name=joindre-configuration [data-champ-form="joindre"]` + `span[data-champ="config-vehicule"]` · `span[data-champ="config-total"]` } : montré seulement si une configuration existe dans le localStorage ; cochée par défaut ; décocher vide `recap`.
- Consentement : `input[type=checkbox] name=consentement required`.
- Bouton `Envoyer ma demande` + mention « Réponse sous 48h · Devis gratuit · Sans engagement ».

Champs par formule (maquette) : Clé en main = coordonnées, véhicule envisagé, usage, occupants, finition, équipements, VASP, budget, date idéale de livraison, message. Atelier / Kit DIY = coordonnées, marque, modèle, année, longueur, kit, finition, VASP, équipements, période / date, message.

## Données (zone `[data-devis-donnees]`, 6 listes de collection)

Même convention que la page Configurateur : chaque item est un `div` avec `data-item="<collection>"` et les champs CMS liés en attributs `data-*` (pas d'Embed : les marqueurs `{{wf …}}` écrits par l'API restent du texte brut). Limite Webflow (26/10/2026) : l'API ne peut ni créer ni lier une liste CMS dans un composant. Procédure qui marche : construire la zone liée sur une page brouillon (Style Guide) par l'API, puis la copier-coller dans la définition du composant FOOTER depuis le Designer — les liaisons survivent au collage. Les formulaires sont des Embeds (un par formule) : champs, `name`, `required` et chips s'y éditent en HTML.

| Liste | `data-item` | Attributs / enfants |
|---|---|---|
| Formules | `formules` | `data-slug`, `data-nom`, `data-ordre`, `data-etiquette`, `data-accroche`, `data-prix` (Prix à partir de), `data-delai`, `data-bouton` (Texte du bouton), `data-duree` (Durée de l'appel), `data-statut` (Statut). Enfants : `div[data-champ="description"]`, `inclus`, `exclus`, `etapes`, `confirmation` (sauts de ligne conservés) et `a[data-champ="calcom" href=Lien Cal.com]`. Le tri par Ordre est fait par le script. |
| Config · Marques | `marques` | `data-slug`, `data-nom`, `data-ordre` |
| Config · Véhicules | `vehicules` | `data-slug`, `data-nom`, `data-modele`, `data-millesime`, `data-marque` (slug), `data-statut` |
| Config · Longueurs | `longueurs` | `data-slug`, `data-vehicule` (slug), `data-etiquette`, `data-gabarit`, `data-ordre` |
| Config · Kits | `kits` | `data-slug`, `data-nom`, `data-ordre`, `data-statut` |
| Config · Finitions | `finitions` | `data-slug`, `data-nom`, `data-sous-libelle`, `data-ordre`, `data-statut` |

Ces 6 listes s'ajoutent au compte des 40 listes par page (la page Configurateur en a déjà ses propres listes ; les deux zones ne se mélangent pas).

## États et classes

- Masquage par `hidden` (le style du head le rend prioritaire). `devis_overlay` est `display:none` (invisible dans le Designer) ; le script pose le combo `est-ouverte` (`display:flex`) à l'ouverture. Pour éditer la modale dans le Designer : ajouter le combo `est-ouverte` sur `devis_overlay`, puis le retirer (le script le retire de toute façon au chargement). `html.devis-ouverte` bloque le scroll de la page.
- `selectionne` : réponses de l'aide (`aria-pressed`) et chips cochées.
- Focus piégé dans la boîte, `Escape` et clic sur le fond ferment, le focus revient au bouton d'origine.
- Événements sur `[data-devis]` : `kapam:devis` (à chaque rendu, `detail = { ouverte, vue, formule, van, pose }`) et `kapam:devis-envoye` (`detail.formule`). Un `dataLayer.push({ event: 'demande_devis_envoyee', formule })` est émis si `window.dataLayer` existe.
- `window.kapamDevis` : `ouvrir({ formule, vue })`, `fermer()`, `allerA(vue, formule)`.
