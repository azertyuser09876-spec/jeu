# Historique des versions

## 0.7.0 — Le premier colosse

- **Le Veilleur**, gardien des confins : une créature immense à quatre pattes (près de la moitié de l'écran),
  faite de lumière pâle — silhouette, côtes, colonne, queue qui ondule.
- **Marche procédurale** : chaque pied reste planté au sol et ne se lève que quand le corps s'en éloigne trop,
  par paires diagonales ; genoux calculés par cinématique inverse ; chaque pas lourd fait trembler l'écran.
- **Le trouver** : après 15 ombres vaincues, un battement immense s'entend — une flèche dorée bat comme
  un cœur sur le bord de l'écran, vers son repaire lointain (6 500 unités, direction propre à chaque partie).
- **Le combat** : ses attaques sont toujours annoncées — **piétinement** (cercles au sol) et **souffle**
  (cône) — on peut les esquiver. **Trois sceaux** (tête, dos, queue) à briser dans l'ordre à la pulsation.
  **L'armée** frappe ses pattes et remplit une jauge : plein, il **pose un genou à terre** (plus d'attaques,
  sceaux à double dégâts). S'éloigner : il renonce et ses sceaux se referment.
- **Apaisé**, il devient doré, rejoint ton territoire et en fait la ronde : croissance du territoire ×2,
  et ses pas écrasent les ombres qui approchent.
- Jauge de combat (nom, sceaux, genou), bannière de rencontre, repère sur la carte.
- Sauvegarde au format 7.
- 165 tests de logique, 23 vérifications navigateur.

## 0.6.0 — Les zones

- **Le vide se découpe en régions** irrégulières (stables pour une partie), dont la nature dépend
  de la distance au foyer : plus loin, plus riche et plus dangereux.
  - **Le Calme** autour du foyer : sûr, aucune ombre errante.
  - **La Brume** : lumière abondante, brouillard qui resserre la vue.
  - **Les Courants** : un flot qui emporte ta lumière et les particules.
  - **Le Murmure** : ombres nombreuses, lumière rare ×3, échos ×1,5.
  - **L'Éclat** : lumière rare ×6, ombres redoutables, échos ×2.
  - **Le Gouffre** : le fond du vide, lumière rare ×10, échos ×3, massives.
- **Annonce de zone** (nom en grand, description à la découverte), **teinte** de la lumière et de la
  poussière propre à chaque zone, **brouillard** qui se lève en douceur.
- **Carte** des régions explorées (touche M ou bouton en haut à droite), avec territoire et bâtiments.
- Sauvegarde au format 6.
- 146 tests de logique, 21 vérifications navigateur.

## 0.5.0 — Les ombres

- **Marées d'ombres** : attirées par le territoire (dès un rayon de 160), elles arrivent d'une direction
  annoncée (message + flèche violette sur le bord) et grossissent avec le temps.
  **Errante** (attaque le plus proche), **Rôdeuse** (traque les êtres), **Massive** (vise les bâtiments).
  Loin du territoire, des ombres errent aussi près de ta lumière.
- **Le territoire brûle les ombres** qui y entrent : une marée finit toujours par s'éteindre.
- **Vitalité** : ta lumière peut être blessée (anneau autour d'elle, voile violet), se régénère
  (plus vite dans le territoire) ; à zéro, elle se **disperse** et renaît au foyer en perdant 10 % de sa lumière.
- **La pulsation blesse les ombres.** Les ombres vaincues laissent des **échos ◆**, seconde ressource.
- **L'armée**, en combat automatique : **Gardien** (mêlée), **Étincelle** (traits à distance),
  **Veilleuse** (soigne les êtres et ta lumière). Ordres de groupe : **garder** le territoire,
  **escorter** ta lumière, **chasser** au loin (barre d'ordres ou touches G, E, C).
- **Les êtres et les bâtiments peuvent tomber** : un être vaincu se rallume au foyer après 20 s,
  un bâtiment éteint ne fonctionne plus jusqu'à ce que les bâtisseurs le réparent. Les ombres au foyer
  rongent ta réserve de lumière.
- **Tour de lumière** (bâtiment, lumière + échos) qui tire sur les ombres.
- **5 améliorations de combat** : Brûlure, Intensité, Vigueur, Tranchant (en échos), Résonance.
- Sauvegarde au format 5.
- 131 tests de logique, 19 vérifications navigateur ; robot d'équilibrage avec les combats.

## 0.4.0 — Vie autonome

- **Les bâtisseurs**, deuxième espèce : ils vivent au foyer (hors population, 2 au plus).
- **Bâtiments** : tu achètes un plan, la colonie choisit l'emplacement (à la bonne distance du foyer,
  loin des autres) et le construit seule. **Nid** (+4 places), **Prisme** (relais de dépôt loin du foyer,
  lumière ×1,25), **Phare** (+25 % de croissance du territoire, faisceau tournant).
- **Interactions** : les lueurs ravitaillent les chantiers actifs sur leur chemin ; deux êtres oisifs
  qui se croisent dansent un instant ensemble.
- **Absence** : les chantiers avancent pendant que tu n'es pas là.
- Amélioration Ardeur (vitesse de construction).
- **Équilibrage** : Éclat et Ferveur réglées pour que le revenu ne s'emballe plus (test garde-fou ajouté).
- Sauvegarde au format 4.
- 109 tests de logique, 17 vérifications navigateur.

## 0.3.0 — Premières lueurs

- **Le jardin** : la lumière naît d'elle-même dans le territoire, d'autant plus qu'il est grand.
- **Les lueurs**, premiers êtres autonomes : chacune repère la lumière libre la plus proche, la réserve
  (deux lueurs ne visent jamais la même), la ramasse, et rapporte sa charge au foyer, qui s'illumine.
  Sans travail, elles flânent dans le territoire. Le joueur peut aussi récolter le jardin.
- **Améliorations** : Agilité, Charge, Ferveur (onglet êtres), Floraison (territoire).
  Population limitée à 6 pour l'instant.
- **Absence** : les êtres continuent au rythme mesuré avant ton départ.
- Sauvegarde au format 3 (migration depuis la 0.2).
- 93 tests de logique, 16 vérifications navigateur.

## 0.2.0 — Le territoire

- **Le foyer** : en revenant à l'origine, on l'allume (✦ 150). Un territoire de lumière naît autour de lui.
- **Le territoire grandit lentement**, toujours, même sans toi : sa surface croît à vitesse constante,
  son rayon de plus en plus doucement. Contour organique, lueurs qui dérivent à l'intérieur.
- **Rayonnement** : le territoire produit de la lumière selon sa surface. Dans le territoire,
  la pulsation se recharge deux fois plus vite.
- **3 améliorations de territoire** : Expansion, Fertilité, Mémoire.
- **Absence** : au retour (page rouverte ou onglet réaffiché), le territoire a grandi et rayonné —
  écran « pendant ton absence ». Durée prise en compte : 4 h, +1 h par niveau de Mémoire.
- **Boutique en onglets** (touche Tab), catalogue générique d'achats, messages discrets.
- Sauvegarde au format 2 : les parties de la 0.1 se chargent sans perte.
- 79 tests de logique, 15 vérifications navigateur.

## 0.1.0 — Le noyau

Première version jouable : une lumière seule dans le vide.

- **Déplacement** à la souris / au doigt maintenu, ou au clavier (ZQSD, WASD, flèches).
- **Vide infini** rempli de particules de lumière qui naissent en fondu autour du joueur ;
  particules rares dorées (×10).
- **Attraction et récolte** : les particules attrapées poursuivent la lumière.
- **Pulsation** (Espace) : une onde attrape tout ce qu'elle traverse, puis se recharge.
- **5 améliorations** : Portée, Élan, Éclat, Densité, Pulsation.
- **Interface progressive** : rien au départ, chaque élément apparaît quand il devient utile.
- **Sauvegarde automatique** versionnée (format 1), avec migrations et nettoyage des données abîmées.
- **Menu** (Échap) : pause, contrôles, statistiques, recommencer.
- **Ambiance** : poussière en parallaxe, foyer d'origine, traînée, vignettage, ouverture.
- 55 tests de logique, test de fumée navigateur, robot d'équilibrage.
