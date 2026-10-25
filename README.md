# 🏠 Ma Maison — des cartes animées pour Home Assistant

Un tableau de bord sombre et vivant pour Home Assistant : le ciel suit la vraie météo et la position du soleil, les volets bougent selon leur position réelle et les poubelles s'envolent les jours de grand vent.

> 🇬🇧 *A French Home Assistant dashboard made of animated `custom:button-card` cards (weather, shutters, garage door, smart plugs, temperature, bins…). Install it from HACS and pick « Ma Maison » when adding a dashboard: it builds itself with your own devices, nothing to copy. You can still copy a single card's YAML and replace the example entity IDs.*

<p align="center">
  <img src="images/animations.gif" alt="Cartes animées : météo, volets, poêle à granulés, robot aspirateur" width="100%">
</p>
<p align="center">
  <img src="images/orage.gif" alt="Orage : pluie et éclairs, jusque derrière la fenêtre du volet" width="59%">
  <img src="images/poubelle-vent.gif" alt="Jour de grand vent : le bac s'envole" width="39%">
</p>
<p align="center"><sub>Captures réalisées avec des données fictives.</sub></p>

> Le poêle à granulés, le ballon d'eau chaude, le robot aspirateur et le vidéoprojecteur, visibles sur certaines captures, ainsi que l'agenda, les rappels et le suivi des colis, sont mis de côté pour l'instant : ils reviendront plus tard.

## Démarrage rapide

<a href="https://my.home-assistant.io/redirect/hacs_repository/?owner=Dam29830&repository=ha-ma-maison-cards&category=plugin"><img src="https://my.home-assistant.io/badges/hacs_repository.svg" alt="Ouvrir le dépôt dans HACS" align="absmiddle"></a>&nbsp;<a href="https://ko-fi.com/dam29830"><img src="https://img.shields.io/badge/Ko--fi-Offrir%20un%20caf%C3%A9-FF5E5B?logo=kofi&logoColor=white" alt="Offrir un café sur Ko-fi" align="absmiddle"></a>

1. Dans **HACS**, téléchargez **Ma Maison** (bouton ci-dessus), puis **[button-card](https://github.com/custom-cards/button-card)** et **[card-mod](https://github.com/thomasloven/lovelace-card-mod)**.
2. *Paramètres → Tableaux de bord → Ajouter un tableau de bord*, puis choisissez **Ma Maison** dans la liste.
3. C'est tout : le tableau se construit avec **vos** appareils. Rien à copier, aucune entité à remplacer.

Détails, réglages et limites : [le tableau automatique](#le-tableau-automatique-recommandé).

Vous préférez une seule carte ? Ouvrez-la dans le dossier [`cartes/`](cartes), copiez-la (icône *Copy raw file*), puis dans votre tableau de bord : ✏️ → *Ajouter une carte* → *Manuel* → collez, et remplacez les entités d'exemple indiquées en tête du fichier.

Pour le thème, le package et l'installation à la main, suivez le **[guide d'installation pas à pas](INSTALLATION.md)**, avec une section dépannage.

Sur iPhone ou sur iPad, deux tableaux tout prêts vous attendent : [versions iPhone et iPad](#versions-iphone-et-ipad).

## Sommaire

- [Aperçu du tableau complet](#aperçu-du-tableau-complet)
- [Versions iPhone et iPad](#versions-iphone-et-ipad)
- [Les cartes](#les-cartes)
- [Soutenir le projet](#soutenir-le-projet)
- [Installation](#installation) : [le tableau automatique](#le-tableau-automatique-recommandé) · [à la main](#installation-à-la-main) · [guide pas à pas](INSTALLATION.md)
- [Entités à remplacer](#entités-à-remplacer)
- [Personnaliser](#personnaliser)
- [Crédits](#crédits)

## Aperçu du tableau complet

Vue *Sections* sur 3 colonnes, thème `maison_nuit` :

<img src="images/apercu.png" alt="Tableau de bord Ma Maison complet" width="100%">

Les graphiques sur 24 h, les statistiques Linky et la caméra sont des cartes natives de Home Assistant : elles font partie du [tableau complet](dashboard/ma-maison.yaml) mais n'apparaissent pas sur cette capture.

## Versions iPhone et iPad

Les mêmes cartes, réorganisées pour le tactile en cinq onglets : **Accueil**, **Commandes**, **Chauffage**, **Climat** et **Énergie**. Une barre d'onglets en bas de l'écran permet de passer de l'un à l'autre au pouce.

| Fichier | Réglé pour | Mise en page |
|---|---|---|
| [`dashboard/ma-maison-iphone.yaml`](dashboard/ma-maison-iphone.yaml) | **iPhone 18 Pro Max** (440 × 956 points) | une colonne, l'essentiel en haut de chaque onglet |
| [`dashboard/ma-maison-ipad.yaml`](dashboard/ma-maison-ipad.yaml) | **iPad M1 en portrait** (iPad Air 5 : 820 × 1180 points ; iPad Pro 11 po : 834 × 1194) | deux colonnes ; chaque onglet tient sur un seul écran, pratique pour un iPad posé en écran central de la maison |

<p align="center">
  <img src="images/iphone.png" alt="Version iPhone : onglets Accueil, Commandes et Chauffage" width="100%">
</p>
<p align="center">
  <img src="images/ipad.png" alt="Version iPad en portrait : onglets Accueil et Commandes" width="100%">
</p>

Ils fonctionnent aussi sur les autres iPhone et iPad : sur un écran plus petit, il faut simplement faire défiler un peu plus.

Deux réglages en plus par rapport au tableau complet : les boutons des cartes occupent toute la place prévue pour eux (plus faciles à toucher), et les petites cartes Température et Humidité remplissent leur case.

**Avec le tableau automatique**, rien à faire : il prend la disposition iPhone, iPad ou ordinateur selon l'écran qui l'affiche, et la barre d'onglets suit l'adresse du tableau.

**À la main** : créez un tableau de bord vide nommé « Ma Maison iPhone » (ou « Ma Maison iPad »). Home Assistant remplit son adresse d'après le titre : elle doit être `ma-maison-iphone` (ou `ma-maison-ipad`), car la barre d'onglets l'utilise. Ouvrez-le, puis ✏️ → ⋮ → *Éditeur de configuration brute* et collez le fichier. Avec une autre adresse, remplacez `/ma-maison-iphone/` (ou `/ma-maison-ipad/`) partout dans le fichier.

## Les cartes

Chaque fichier du dossier [`cartes/`](cartes) est une carte prête à coller. En tête de fichier : ce qu'elle fait, les entités à remplacer et ce dont elle a besoin.

| Aperçu | Carte |
|:--:|---|
| <img src="images/cartes/01-presence.png" alt="Présence" width="300"> | **Présence** · [`01-presence.yaml`](cartes/01-presence.yaml)<br>Maison animée (fumée, fenêtres allumées) qui s'éclaire quand quelqu'un est là. Deux personnes : avatar, statut, distance de la maison, heure du dernier changement.<br><sub>Nécessite : button-card (HACS)</sub> |
| <img src="images/cartes/02-meteo.png" alt="Météo" width="300"> | **Météo** · [`02-meteo.yaml`](cartes/02-meteo.yaml)<br>Ciel animé selon la météo actuelle et l'heure (soleil, nuages, pluie, neige, orage, brouillard, vent, nuit étoilée), avec température et détails.<br><sub>Nécessite : button-card (HACS)</sub> |
| <img src="images/cartes/03-previsions.png" alt="Prévisions de la semaine" width="300"> | **Prévisions de la semaine** · [`03-previsions.yaml`](cartes/03-previsions.yaml)<br>Prévisions sur 6 jours avec icônes animées, mini / maxi, pluie et vent.<br><sub>Nécessite : button-card (HACS) + input_text.meteo_previsions_semaine et son automatisation (package)</sub> |
| <img src="images/cartes/04-volets-facade.png" alt="Tous les volets (façade)" width="300"> | **Tous les volets (façade)** · [`04-volets-facade.yaml`](cartes/04-volets-facade.yaml)<br>Façade avec 5 fenêtres : chaque volet suit sa vraie position et, volets ouverts, le ciel derrière les vitres suit le soleil réel et la météo (nuages, pluie, orage, neige, nuit). Boutons monter / stop / descendre pour tous les volets.<br><sub>Nécessite : button-card (HACS) + un groupe de volets (cover.tous_les_volets)</sub> |
| <img src="images/cartes/05-volet.png" alt="Volet" width="300"> | **Volet** · [`05-volet.yaml`](cartes/05-volet.yaml)<br>Une fenêtre et son volet animé (position, mouvement), avec le même ciel animé et les boutons monter / stop / descendre. Dupliquez la carte pour chaque volet.<br><sub>Nécessite : button-card (HACS)</sub> |
| <img src="images/cartes/06-porte-garage.png" alt="Porte de garage" width="300"> | **Porte de garage** · [`06-porte-garage.yaml`](cartes/06-porte-garage.yaml)<br>Porte de garage animée (ouverture, fermeture, état) avec boutons ouvrir / fermer.<br><sub>Nécessite : button-card (HACS)</sub> |
| <img src="images/cartes/07-prise.png" alt="Prise connectée" width="300"> | **Prise connectée** · [`07-prise.yaml`](cartes/07-prise.yaml)<br>Prise animée : appui = marche / arrêt, appui long = détails.<br><sub>Nécessite : button-card (HACS)</sub> |
| <img src="images/cartes/08-radiateur.png" alt="Radiateur sur prise" width="300"> | **Radiateur sur prise** · [`08-radiateur.yaml`](cartes/08-radiateur.yaml)<br>Radiateur branché sur une prise qui mesure la puissance : animation de chauffe quand il consomme (Chauffe / En veille / Éteint). Appui = marche / arrêt.<br><sub>Nécessite : button-card (HACS) + une prise avec mesure de puissance</sub> |
| <img src="images/cartes/11-puissance.png" alt="Puissance instantanée" width="300"> | **Puissance instantanée** · [`11-puissance.yaml`](cartes/11-puissance.yaml)<br>Consommation électrique en direct (W) avec jauge animée. Même carte pour le chauffe-eau et le radiateur : changez l'entité, le libellé « Consommation » écrit dans le champ info, et la pleine échelle de la jauge (w / 2400).<br><sub>Nécessite : button-card (HACS)</sub> |
| <img src="images/cartes/12-cout-en-direct.png" alt="Coût en direct" width="300"> | **Coût en direct** · [`12-cout-en-direct.yaml`](cartes/12-cout-en-direct.yaml)<br>Ce que coûte l'appareil en ce moment, en €/h (tarif heures pleines / creuses).<br><sub>Nécessite : button-card (HACS) + capteur sensor.chauffe_eau_cout_horaire (package)</sub> |
| <img src="images/cartes/13-mode-chauffe-eau.png" alt="Mode du chauffe-eau" width="300"> | **Mode du chauffe-eau** · [`13-mode-chauffe-eau.yaml`](cartes/13-mode-chauffe-eau.yaml)<br>Choix du mode (Manuel, Éco+, Programmé) en un appui, et bouton Boost.<br><sub>Nécessite : button-card (HACS) + chauffe-eau Atlantic Cozytouch</sub> |
| <img src="images/cartes/14-temperature.png" alt="Température" width="300"> | **Température** · [`14-temperature.yaml`](cartes/14-temperature.yaml)<br>Thermomètre animé avec la température de la pièce. Dupliquez-la pour chaque capteur.<br><sub>Nécessite : button-card (HACS)</sub> |
| <img src="images/cartes/15-humidite.png" alt="Humidité" width="300"> | **Humidité** · [`15-humidite.yaml`](cartes/15-humidite.yaml)<br>Goutte animée avec le taux d'humidité et un avis (air sec, confortable, humide…).<br><sub>Nécessite : button-card (HACS)</sub> |
| <img src="images/cartes/16-sacs-granules.png" alt="Stock de sacs de granulés" width="300"> | **Stock de sacs de granulés** · [`16-sacs-granules.yaml`](cartes/16-sacs-granules.yaml)<br>Stock de sacs avec boutons − (sac versé), + et « Livraison » (palette livrée), alerte stock bas.<br><sub>Nécessite : button-card (HACS) + counter.sacs_de_granules (package)</sub> |
| <img src="images/cartes/17-facture-electricite.png" alt="Facture d&#x27;électricité du mois" width="300"> | **Facture d'électricité du mois** · [`17-facture-electricite.yaml`](cartes/17-facture-electricite.yaml)<br>Estimation de la facture du mois et dépense à date, calculées depuis le Linky et vos tarifs.<br><sub>Nécessite : button-card (HACS) + intégration ha-linky + entrées « Électricité » et leur automatisation (package)</sub> |
| <img src="images/cartes/19-poubelle-jaune.png" alt="Poubelle jaune (emballages)" width="300"> | **Poubelle jaune (emballages)** · [`19-poubelle-jaune.yaml`](cartes/19-poubelle-jaune.yaml)<br>Compte à rebours jusqu'à la prochaine collecte, alerte la veille, report des jours fériés, envol animé du bac quand il y a du vent ; appui = « bac rangé à l'abri » pour la journée.<br><sub>Nécessite : button-card (HACS) + vent max prévu, input_datetime et script poubelle (package)</sub> |
| <img src="images/cartes/20-poubelle-bleue.png" alt="Poubelle bleue (ordures ménagères)" width="300"> | **Poubelle bleue (ordures ménagères)** · [`20-poubelle-bleue.yaml`](cartes/20-poubelle-bleue.yaml)<br>Même principe que la poubelle jaune, avec son propre calendrier et son animation.<br><sub>Nécessite : button-card (HACS) + vent max prévu, input_datetime et script poubelle (package)</sub> |

## Soutenir le projet

Les cartes sont gratuites et le resteront. Si elles vous plaisent, vous pouvez offrir un café : les dons servent à acheter de nouveaux appareils connectés pour créer de nouvelles cartes, gratuites elles aussi.

**Prochaines cartes** : un robot tondeuse et une machine à café. Une idée d'appareil à animer ? Dites-le dans votre message.

[![Offrir un café sur Ko-fi](https://img.shields.io/badge/Ko--fi-Offrir%20un%20caf%C3%A9-FF5E5B?logo=kofi&logoColor=white)](https://ko-fi.com/dam29830)

## Installation

### Le tableau automatique (recommandé)

[![Ouvrir le dépôt dans HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=Dam29830&repository=ha-ma-maison-cards&category=plugin)

1. **Télécharger** : le bouton ci-dessus ouvre le dépôt dans HACS (sinon *HACS → ⋮ → Dépôts personnalisés*, adresse `https://github.com/Dam29830/ha-ma-maison-cards`, type **Tableau de bord**). Cliquez sur **Télécharger**, puis faites de même pour **button-card** et **card-mod**.
2. **Créer le tableau** : *Paramètres → Tableaux de bord → Ajouter un tableau de bord*, choisissez **Ma Maison** dans la liste, donnez-lui un nom, puis **Créer**.
3. Ouvrez-le : c'est prêt.

Sans HACS : copiez [`dist/ma-maison-agenda.js`](dist/ma-maison-agenda.js) dans `/config/www/` et déclarez la ressource `/local/ma-maison-agenda.js` (*Paramètres → Tableaux de bord → ⋮ → Ressources → Ajouter une ressource*, type **Module JavaScript**) ; la suite est identique.

**Ce qu'il trouve tout seul**

| Carte | Ce qu'il cherche |
|---|---|
| Présence | les deux premières personnes, la vôtre d'abord |
| Météo | votre météo (Met.no) |
| Volets | chaque volet roulant ; la façade dès deux volets (ses boutons pilotent tous les volets, ou votre groupe de volets s'il existe) |
| Porte de garage | une porte de type « garage » |
| Prises | les prises connectées rangées dans une pièce |
| Radiateur | un interrupteur nommé « radiateur » qui mesure la puissance |
| Eau chaude | un chauffe-eau Atlantic Cozytouch |
| Températures et humidité | une carte par pièce : le capteur choisi dans les réglages de la pièce, sinon celui qui s'y trouve |
| Caméras | jusqu'à quatre caméras |
| Linky | la statistique de [ha-linky](https://github.com/bokub/ha-linky) |
| Prévisions, poubelles, facture, tarifs, granulés, HomePod | apparaissent dès que le [package](#3-le-package--entrées-capteurs-et-automatisations) est installé |

Une carte sans appareil correspondant est simplement masquée. La disposition suit l'écran : ordinateur, iPhone ou iPad, avec la barre d'onglets en bas.

**Régler** : ✏️ en haut à droite du tableau ouvre ses réglages dans un éditeur visuel (ou en YAML). Un champ laissé vide reste en détection automatique.

| Réglage | À quoi il sert | Exemple |
|---|---|---|
| `etage` | n'afficher que les appareils d'un étage (ceux sans pièce restent) : pratique si Home Assistant gère deux maisons | `etage: ma_maison` |
| `affichage` | imposer une disposition : `ordinateur`, `iphone` ou `ipad` (`auto` par défaut) | `affichage: ipad` |
| `meteo`, `garage`, `radiateur`, `poele`, `chauffe_eau` | choisir l'entité ; `false` masque la carte | `garage: cover.mon_portail` |
| `personnes`, `volets`, `prises`, `cameras` | choisir la liste | `prises: [switch.prise_tele]` |
| `pieces` | pièces des cartes température et humidité | `pieces: [salon, chambre]` |
| `poubelle_jaune`, `poubelle_bleue` | jours de collecte (`jours`, `semaines` : `toutes`, `paires` ou `impaires`, `heure`, `feries` : `report` ou `aucun`) | `poubelle_jaune: {jours: [mardi], semaines: impaires, heure: 7}` |
| `masquer` | cartes à cacher : `poubelles`, `eau_chaude`, `temperatures`, `electricite`, `cameras`… | `masquer: [cameras]` |
| `exclure` | entités à ignorer dans la détection | `exclure: [cover.velux]` |

Plus rares : `volets_groupe`, `radiateur_puissance` et `linky`. Un exemple complet, en YAML :

```yaml
strategy:
  type: custom:ma-maison
  etage: ma_maison
  prises: [switch.prise_salle_de_bain]
  poubelle_jaune: {jours: [mardi], semaines: impaires, heure: 7, feries: report}
```

**Modifier carte par carte** : ✏️ → *Prendre le contrôle*. Home Assistant transforme le tableau en tableau classique, vos entités déjà en place ; il ne se met alors plus à jour tout seul.

**Pour aller plus loin** : le [thème](#2-le-thème-maison_nuit-conseillé) et le [package](#3-le-package--entrées-capteurs-et-automatisations) s'installent à la main, HACS ne sachant pas le faire. Les cartes qui en dépendent apparaissent ensuite d'elles-mêmes.

### Installation à la main

Téléchargez le dépôt avec le bouton vert **Code → Download ZIP**, ou copiez seulement les fichiers qui vous intéressent. Première fois avec Home Assistant ? Le **[guide pas à pas](INSTALLATION.md)** détaille chaque clic.

#### 1. Prérequis

- **Home Assistant** récent (testé sur **2026.10**), pour la vue *Sections* et les cartes *Titre*.
- **[HACS](https://hacs.xyz)** avec :
  - **[button-card](https://github.com/custom-cards/button-card)** (testé en 7.x) : toutes les cartes animées ;
  - **[card-mod](https://github.com/thomasloven/lovelace-card-mod)** : uniquement pour habiller les cartes natives (graphiques, statistiques, caméra…).

#### 2. Le thème `maison_nuit` (conseillé)

Les cartes ont leurs propres couleurs, mais elles sont pensées pour ce fond ardoise.

1. Copiez [`configuration/themes/maison_nuit.yaml`](configuration/themes/maison_nuit.yaml) dans `/config/themes/`.
2. Dans `configuration.yaml`, une seule fois :
   ```yaml
   frontend:
     themes: !include_dir_merge_named themes
   ```
3. Redémarrez Home Assistant. Le thème est défini pour le **mode sombre**.

#### 3. Le package : entrées, capteurs et automatisations

Certaines cartes s'appuient sur des entrées et des automatisations. Tout est réuni dans un seul fichier :

1. Dans `configuration.yaml`, une seule fois :
   ```yaml
   homeassistant:
     packages: !include_dir_named packages
   ```
2. Copiez [`configuration/packages/ma_maison.yaml`](configuration/packages/ma_maison.yaml) dans `/config/packages/`.
3. Adaptez les entités listées en tête du fichier, vérifiez la configuration (*Outils → YAML*), puis redémarrez.
4. Saisissez vos tarifs dans les entrées « Électricité – prix HP », « prix HC », « abonnement » et « part heures creuses » (*Paramètres → Appareils et services → Entrées*, puis cliquez sur l'entrée), ainsi que la puissance de votre ballon dans « Chauffe-eau puissance nominale ». Elles démarrent au minimum (0, ou 500 W pour le ballon).

Vous n'utilisez qu'une partie des cartes ? Supprimez les blocs inutiles du package.

| Carte | Ce qu'il lui faut dans le package |
|---|---|
| Prévisions de la semaine | `input_text.meteo_previsions_semaine` + automatisation « prévisions de la semaine » |
| Poubelles | `input_number.vent_max_prevu_24_h` + automatisation « vent max », `input_datetime.bac_jaune_a_l_abri` / `bac_bleu_a_l_abri`, `script.poubelle_a_l_abri` |
| Facture d'électricité | entrées `input_number.electricite_*` + automatisation « facture du mois » (et l'intégration [ha-linky](https://github.com/bokub/ha-linky)) |
| Puissance et coût du chauffe-eau | `sensor.chauffe_eau_puissance`, `sensor.chauffe_eau_cout_horaire`, `input_number.chauffe_eau_puissance_nominale` |
| Sacs de granulés | `counter.sacs_de_granules` |
| Température / humidité du HomePod | `input_text.homepod_temperature`, `input_text.homepod_humidite` + automatisation « relevé HomePod » (webhook) |

#### 4. Ajouter les cartes

**Tout le tableau d'un coup** : créez un tableau de bord vide (*Paramètres → Tableaux de bord → Ajouter un tableau de bord → Nouveau tableau de bord à partir de zéro*), ouvrez-le, puis ✏️ → ⋮ → *Éditeur de configuration brute* et collez [`dashboard/ma-maison.yaml`](dashboard/ma-maison.yaml).

**Pour un iPhone ou un iPad** : même méthode avec [`dashboard/ma-maison-iphone.yaml`](dashboard/ma-maison-iphone.yaml) ou [`dashboard/ma-maison-ipad.yaml`](dashboard/ma-maison-ipad.yaml), dans un tableau nommé « Ma Maison iPhone » ou « Ma Maison iPad » (voir [Versions iPhone et iPad](#versions-iphone-et-ipad)).

**Ou carte par carte** : ✏️ *Modifier le tableau de bord* → *Ajouter une carte* → *Manuel*, puis collez le contenu d'un fichier de [`cartes/`](cartes).

Il reste à remplacer les entités d'exemple par les vôtres (Ctrl/Cmd + F dans l'éditeur).

## Entités à remplacer

Avec le [tableau automatique](#le-tableau-automatique-recommandé), ce remplacement est fait pour vous. Pour une installation à la main, les noms d'entités sont des exemples : remplacez-les par les vôtres, dans les cartes comme dans le package.

| Entité d'exemple | À remplacer par |
|---|---|
| `person.personne_1`, `person.personne_2` | les deux personnes du foyer |
| `zone.home`, `sun.sun` | présentes par défaut dans Home Assistant |
| `weather.forecast_maison` | votre météo (Met.no crée `weather.forecast_<nom de la maison>`) |
| `cover.tous_les_volets` | un groupe de volets (*Paramètres → Entrées → Groupe → Volet*) |
| `cover.salon_volet_tele`, `cover.salon_volet_entree`, `cover.cuisine_volet_cuisine`, `cover.chambre_volet_chambre`, `cover.chambre_damis_volet_chambre_damis` | vos volets, avec leur position |
| `cover.porte_de_garage` | votre porte de garage |
| `switch.prise_salle_de_bain` | une prise connectée |
| `switch.radiateur_salle_de_bain`, `sensor.radiateur_salle_de_bain_puissance` | une prise qui mesure la puissance d'un radiateur |
| `sensor.domestic_hot_water_*`, `switch.domestic_hot_water_boost_eau_chaude`, `select.domestic_hot_water_mode_eau_chaude` | un chauffe-eau Atlantic piloté par Cozytouch |
| `sensor.chambre_temperature`, `sensor.chambre_humidite`, `sensor.garage_*`, `sensor.salon_temperature`, `sensor.salon_humidite`, `sensor.salon_poele_a_granules_air_temperature` | vos capteurs de température et d'humidité |
| `input_text.homepod_temperature`, `input_text.homepod_humidite` | la température et l'humidité d'un HomePod, envoyées par un raccourci Apple (voir [Personnaliser](#personnaliser)) |
| `linky:00000000000000` | la statistique de votre compteur Linky ([ha-linky](https://github.com/bokub/ha-linky)) |
| `camera.garage` | une caméra |

## Personnaliser

- **Poubelles** : avec le tableau automatique, réglez les jours dans ses réglages (`poubelle_jaune`, `poubelle_bleue`). À la main, le calendrier est sur la première ligne du champ `head` de chaque carte, par exemple `const DAYS=[2], W=1, H=7, MODE="report";`. `DAYS` : jours de collecte (0 = lundi … 6 = dimanche, plusieurs jours possibles : `[1, 3]`) ; `W` : `1` = semaines impaires, `0` = paires, `null` = toutes ; `H` : heure de passage ; `MODE` : `"report"` décale la collecte après un jour férié, `"aucun"` ne décale pas. Le bac s'envole quand le vent prévu atteint 50 km/h ; un appui sur la carte le déclare « rangé à l'abri » pour la journée.
- **Sacs de granulés** : alerte « stock bas » à 6 sacs ou moins. La carte affiche le stock « sur » le `maximum` du compteur (72, une palette) et le bouton « Livraison » remet le compteur à sa valeur `initial` (72 dans le package).
- **Humidité** : air sec sous 35 %, confortable jusqu'à 60 %, un peu humide jusqu'à 70 %, très humide au-delà.
- **Chauffe-eau** : la puissance affichée et le coût en direct viennent de `input_number.chauffe_eau_puissance_nominale` : saisissez celle de votre ballon (souvent 1 500 à 3 000 W, indiquée sur sa plaque).
- **HomePod** : Home Assistant ne lit pas directement les capteurs du HomePod. Dans l'app Raccourcis (ou Maison), créez une automatisation, par exemple à heure fixe ou quand la température de la pièce change, qui récupère la température et l'humidité mesurées par le HomePod et les envoie en `POST` JSON `{"temperature": 20.5, "humidite": 48}` à `https://<votre-home-assistant>/api/webhook/<votre-identifiant>`. Remplacez `homepod-remplacez-moi` dans le package par un identifiant aléatoire et gardez-le secret : il sert de clé.
- **Numéro sur les poubelles** : remplacez `12` dans `<span class="jnum">12</span>` (bac jaune) et `<span class="bnum">12</span>` (bac bleu), ainsi que `n° 12` dans le titre du drapeau, par votre propre numéro.
- **Titres des cartes** : le titre affiché est écrit dans le HTML de la carte (champ `info` ou `head`) ; modifier `name:` ne suffit pas, cherchez le texte dans la carte et remplacez-le.

## Modifier le dépôt

Le fichier installé par HACS, [`dist/ma-maison-agenda.js`](dist/ma-maison-agenda.js), est construit à partir de [`src/`](src) et des trois tableaux du dossier [`dashboard/`](dashboard). Après avoir modifié l'un d'eux :

```bash
python3 outils/construire.py                                   # reconstruit dist/ma-maison-agenda.js
node outils/tester.mjs tests/maison-fictive.json '{}' iphone   # génère le tableau d'une maison fictive et le vérifie
```

Les entités d'exemple des tableaux sont celles que la stratégie remplace : gardez-les telles quelles dans `dashboard/`.

## Crédits
- Damien Joulou-Bénardeau
- Style inspiré des tableaux de bord de [TechEnClair](https://github.com/mirasandalucia/TechEnClair) (licence MIT).
- Construit avec [button-card](https://github.com/custom-cards/button-card) et [card-mod](https://github.com/thomasloven/lovelace-card-mod) ; icônes [Material Design Icons](https://pictogrammers.com/library/mdi/).
- Conçu avec l'aide de Claude (Anthropic).

## Licence

[MIT](LICENSE) : libre de copier, modifier et partager.
