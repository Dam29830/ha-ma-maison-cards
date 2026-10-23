# Guide d'installation pas à pas

Ce guide part de zéro. Comptez 20 à 30 minutes pour tout installer, moins si vous ne voulez que quelques cartes.

**Sommaire**

1. [Ce qu'il vous faut](#1-ce-quil-vous-faut)
2. [Télécharger les fichiers](#2-télécharger-les-fichiers)
3. [Installer button-card et card-mod (HACS)](#3-installer-button-card-et-card-mod-hacs)
4. [Pouvoir modifier les fichiers de Home Assistant](#4-pouvoir-modifier-les-fichiers-de-home-assistant)
5. [Installer le thème](#5-installer-le-thème)
6. [Installer le package](#6-installer-le-package)
7. [Installer l'agenda et les rappels (facultatif)](#7-installer-lagenda-et-les-rappels-facultatif)
8. [Créer le tableau de bord](#8-créer-le-tableau-de-bord)
9. [Mettre vos propres entités](#9-mettre-vos-propres-entités)
10. [Dépannage](#10-dépannage)

---

## 1. Ce qu'il vous faut

- **Home Assistant** à jour (testé sur la 2026.10), avec un compte administrateur.
- **[HACS](https://hacs.xyz)** installé. Si ce n'est pas le cas, suivez le guide officiel sur [hacs.xyz](https://hacs.xyz) puis revenez ici.
- Les appareils que vous voulez afficher, déjà intégrés à Home Assistant : volets, prises, météo, chauffe-eau, etc. **Vous n'êtes pas obligé de tout avoir** : chaque carte est indépendante, prenez seulement celles qui vous servent.

## 2. Télécharger les fichiers

- **Tout le dépôt** : en haut de la page GitHub, bouton vert **Code** → **Download ZIP**, puis décompressez le fichier.
- **Une seule carte** : ouvrez le fichier voulu dans le dossier [`cartes/`](cartes), puis cliquez sur l'icône **Copy raw file** (deux carrés superposés, en haut à droite du contenu). Le texte est copié, prêt à coller.

Ce que contient le dépôt :

| Dossier / fichier | Rôle |
|---|---|
| `cartes/` | une carte par fichier, à coller dans un tableau existant |
| `dashboard/ma-maison.yaml` | le tableau de bord complet, toutes les cartes rangées en sections |
| `configuration/themes/maison_nuit.yaml` | le thème sombre |
| `configuration/packages/ma_maison.yaml` | les entrées, capteurs, automatisations et le script utilisés par certaines cartes |
| `www/ma-maison-agenda.js` | les cartes Agenda et Rappels (agendas et rappels de l'iPhone) |

## 3. Installer button-card et card-mod (HACS)

1. Ouvrez **HACS** dans la barre latérale.
2. Cherchez **button-card**, ouvrez-le, puis **Télécharger**.
3. Faites de même avec **card-mod**.
4. Rechargez la page (Ctrl + F5 sur PC, Cmd + Maj + R sur Mac). Dans l'application mobile, fermez-la complètement puis rouvrez-la.

Pour vérifier : *Paramètres → Tableaux de bord → ⋮ (en haut à droite) → Ressources* doit lister `button-card.js` et `card-mod.js`.

> button-card fait fonctionner toutes les cartes animées. card-mod ne sert qu'à habiller les cartes natives du tableau complet (graphiques, statistiques, caméra) : sans lui, elles s'affichent simplement avec le style par défaut.

## 4. Pouvoir modifier les fichiers de Home Assistant

Le thème et le package sont des fichiers à copier dans le dossier de configuration de Home Assistant (`/config`).

- **Home Assistant OS** (le cas le plus courant) : *Paramètres → Applications* (anciennement *Modules complémentaires*) → **Boutique** → installez **File editor**, démarrez-le et cochez *Afficher dans la barre latérale*.
- **Home Assistant Container / Core** : modifiez directement les fichiers du dossier de configuration avec votre éditeur habituel.

Dans File editor, l'icône dossier en haut à gauche permet de naviguer, de créer des dossiers et des fichiers. Vous êtes déjà dans `/config`.

## 5. Installer le thème

Les cartes ont leurs propres couleurs, mais elles sont pensées pour ce fond sombre. Étape conseillée, mais facultative.

1. Dans `/config`, créez un dossier `themes` s'il n'existe pas.
2. Dedans, créez un fichier `maison_nuit.yaml` et collez-y le contenu de [`configuration/themes/maison_nuit.yaml`](configuration/themes/maison_nuit.yaml).
3. Ouvrez `/config/configuration.yaml` et ajoutez à la fin :
   ```yaml
   frontend:
     themes: !include_dir_merge_named themes
   ```
   Si une ligne `frontend:` existe déjà, n'en ajoutez pas une deuxième : mettez seulement la ligne `themes: …` en dessous, avec 2 espaces devant.
4. Redémarrez : *Paramètres → Système → ⏻ (en haut à droite) → Redémarrer Home Assistant*.
5. Le tableau complet applique le thème tout seul. Pour l'utiliser partout : cliquez sur votre nom en bas de la barre latérale → **Thème** → `maison_nuit`.

> Le thème est défini pour le **mode sombre**. Si votre appareil est en mode clair, choisissez *Sombre* dans ce même réglage de profil.

## 6. Installer le package

Certaines cartes ont besoin d'entrées, de capteurs calculés et d'automatisations (voir le tableau du [README](README.md#3-le-package--entrées-capteurs-et-automatisations)). Le package les crée tous d'un coup.

1. Dans `/config/configuration.yaml`, ajoutez :
   ```yaml
   homeassistant:
     packages: !include_dir_named packages
   ```
   Si une ligne `homeassistant:` existe déjà, ajoutez seulement la ligne `packages: …` en dessous, avec 2 espaces devant.
2. Dans `/config`, créez un dossier `packages`, puis dedans un fichier `ma_maison.yaml`. Collez-y le contenu de [`configuration/packages/ma_maison.yaml`](configuration/packages/ma_maison.yaml).
3. Adaptez ce fichier à votre installation (Rechercher / Remplacer de votre éditeur) :
   - `weather.forecast_maison` → votre entité météo ;
   - `linky:00000000000000` → votre statistique Linky (*Outils → Statistiques*, cherchez « linky ») ;
   - `sensor.domestic_hot_water_…` → les entités de votre chauffe-eau ;
   - `media_player.projecteur` / `media_player.projecteur_cast` → votre vidéoprojecteur ou votre TV ;
   - `homepod-remplacez-moi` → un identifiant secret de votre choix (lettres, chiffres et tirets), seulement si vous utilisez le HomePod.

   Une carte ne vous intéresse pas ? Supprimez simplement le bloc correspondant (chaque bloc est commenté).
4. Vérifiez : *Outils* (anciennement *Outils de développement*) → onglet **YAML** → **Vérifier la configuration**. Si tout est vert, redémarrez Home Assistant.
5. Saisissez vos valeurs, qui démarrent au minimum : *Paramètres → Appareils et services → Entrées*, cliquez sur chaque entrée et saisissez :
   - « Électricité – prix HP », « prix HC » (en €/kWh), « abonnement » (en €/mois) et « part heures creuses » (en %) ;
   - « Chauffe-eau puissance nominale » (en W, indiquée sur la plaque du ballon) ;
   - « Sacs de granulés » : le nombre de sacs en stock.
6. Pour ne pas attendre la prochaine heure, lancez une fois les automatisations : *Paramètres → Automatisations et scènes*, ouvrez « Météo – prévisions de la semaine (carte animée) » → ⋮ → **Exécuter les actions**. Faites de même pour « Météo — vent max prévu (24 h) » et « Électricité – estimation de la facture du mois ».

## 7. Installer l'agenda et les rappels (facultatif)

Les cartes **Agenda** et **Rappels** affichent les agendas et les rappels de l'iPhone. Ce ne sont pas des button-card : elles tiennent dans un seul fichier JavaScript, à déclarer une fois. Passez cette étape si vous ne les voulez pas.

1. **Relier iCloud** : *Paramètres → Appareils et services → Ajouter une intégration* → **Apple iCloud**. Saisissez votre identifiant Apple et votre mot de passe, puis le code à 6 chiffres qui s'affiche sur l'iPhone. Vos agendas et vos listes de rappels apparaissent comme entités `calendar.…` et `todo.…`.
2. **Copier le fichier** : dans File editor, ouvrez `/config`, créez un dossier `www` s'il n'existe pas, puis dedans un fichier `ma-maison-agenda.js`. Collez-y le contenu de [`www/ma-maison-agenda.js`](www/ma-maison-agenda.js) et enregistrez.
3. **Déclarer la ressource** : *Paramètres → Tableaux de bord → ⋮ (en haut à droite) → Ressources → Ajouter une ressource*. Adresse : `/local/ma-maison-agenda.js`, type : **Module JavaScript**.
4. Rechargez la page (Ctrl + F5 sur PC, Cmd + Maj + R sur Mac). Dans l'application mobile, fermez-la complètement puis rouvrez-la.

Il n'y a aucune entité à remplacer : les cartes trouvent toutes seules les agendas et les listes d'iCloud. La liste « Courses » est laissée de côté par défaut ; les options pour choisir, masquer ou colorer un agenda sont dans le [README](README.md#personnaliser).

> Pour mettre le fichier à jour plus tard, changez aussi l'adresse de la ressource (`/local/ma-maison-agenda.js?v=2`, puis `?v=3`…). Sinon, les appareils gardent l'ancienne version en cache pendant des semaines.

## 8. Créer le tableau de bord

**Le tableau complet**

1. *Paramètres → Tableaux de bord → Ajouter un tableau de bord → Nouveau tableau de bord à partir de zéro*. Donnez-lui un nom, par exemple « Ma Maison ».
2. Ouvrez-le depuis la barre latérale, cliquez sur ✏️ (en haut à droite), puis ⋮ → **Éditeur de configuration brute**.
3. Effacez tout le contenu, collez celui de [`dashboard/ma-maison.yaml`](dashboard/ma-maison.yaml), puis **Enregistrer**.

> Astuce : faites d'abord l'étape 9 dans un éditeur de texte sur votre ordinateur (Rechercher / Remplacer), puis collez le fichier déjà adapté. C'est plus rapide que de corriger carte par carte ensuite.

> Les tableaux contiennent les cartes Agenda et Rappels (titre « Agenda & rappels »). Sans l'étape 7, elles affichent une erreur : faites l'étape 7, ou supprimez ces deux cartes en mode édition (✏️).

**Les versions iPhone et iPad**

Mêmes cartes, réparties en cinq onglets avec une barre d'onglets en bas de l'écran. Elles sont réglées pour l'iPhone 18 Pro Max et pour un iPad M1 en portrait, et fonctionnent sur les autres modèles.

1. Créez un tableau de bord vide nommé exactement « Ma Maison iPhone » (ou « Ma Maison iPad »). Vérifiez que l'adresse proposée est `ma-maison-iphone` (ou `ma-maison-ipad`) : la barre d'onglets l'utilise.
2. Ouvrez-le, puis ✏️ → ⋮ → **Éditeur de configuration brute**, et collez [`dashboard/ma-maison-iphone.yaml`](dashboard/ma-maison-iphone.yaml) (ou [`dashboard/ma-maison-ipad.yaml`](dashboard/ma-maison-ipad.yaml)).
3. Sur le téléphone ou la tablette, ouvrez ce tableau depuis le menu latéral de l'application Home Assistant.

**Ou seulement quelques cartes**, dans un tableau de bord existant :

1. Ouvrez le tableau, ✏️ → **Ajouter une carte**.
2. Tout en bas de la liste, choisissez **Manuel**.
3. Effacez l'exemple, collez le contenu d'un fichier du dossier [`cartes/`](cartes), remplacez les entités indiquées en tête du fichier, puis **Enregistrer**.

## 9. Mettre vos propres entités

Les cartes utilisent des noms d'entités d'exemple (`cover.salon_volet_tele`, `sensor.chambre_temperature`…). Il faut les remplacer par les vôtres.

1. **Trouver l'identifiant d'une entité** : *Paramètres → Appareils et services → Entités*, cherchez l'appareil, cliquez dessus puis sur ⚙️ : l'**ID d'entité** est affiché (par exemple `cover.volet_cuisine`). Vous pouvez aussi consulter *Outils → États*.
2. **Remplacer** : ouvrez le fichier dans un éditeur de texte (Bloc-notes, TextEdit en mode texte brut, VS Code…), utilisez **Rechercher / Remplacer** pour chaque entité d'exemple, enregistrez, puis collez le résultat dans Home Assistant.
3. La liste complète des entités d'exemple et de ce qu'elles représentent est dans le [README](README.md#entités-à-remplacer). Chaque fichier de carte liste aussi, en tête, les entités qu'il utilise.
4. Vous n'avez pas un appareil ? Supprimez la carte : ✏️ → cliquez sur la carte → ⋮ → **Supprimer**.

> Le titre affiché sur une carte est écrit dans son code (champ `info` ou `head`). Pour le changer, cherchez le texte dans la carte et remplacez-le : modifier `name:` ne suffit pas.

## 10. Dépannage

| Problème | Solution |
|---|---|
| « Custom element doesn't exist: button-card » | button-card n'est pas installé ou pas encore chargé. Vérifiez HACS (étape 3), puis rechargez la page avec Ctrl + F5 ou videz le cache de l'application mobile. |
| Une carte affiche « Indisponible » ou reste vide | L'entité n'existe pas sous ce nom. Vérifiez son identifiant dans *Outils → États* et corrigez-le dans la carte. |
| Fond blanc, couleurs différentes des captures | Le thème n'est pas appliqué ou l'appareil est en mode clair : voir l'étape 5. |
| Les prévisions de la semaine restent vides | L'automatisation n'a pas encore tourné, ou votre météo ne s'appelle pas `weather.forecast_maison`. Corrigez le nom dans le package, puis lancez l'automatisation (étape 6.6). |
| La facture du mois reste à 0 € | Saisissez vos tarifs (étape 6.5) et vérifiez l'identifiant de votre statistique Linky (*Outils → Statistiques*). Les données Linky arrivent avec un ou deux jours de retard. |
| « Vérifier la configuration » signale une erreur | Le plus souvent : une clé `homeassistant:` ou `frontend:` présente deux fois dans `configuration.yaml`, ou une indentation décalée. Utilisez des espaces, jamais de tabulations. |
| Les poubelles annoncent les mauvais jours | Réglez la première ligne du champ `head` de chaque carte : voir [Personnaliser](README.md#personnaliser). |
| iPhone / iPad : un onglet de la barre du bas affiche une page vide | L'adresse du tableau n'est pas `ma-maison-iphone` (ou `ma-maison-ipad`). Corrigez-la dans *Paramètres → Tableaux de bord*, ou remplacez ce chemin dans le fichier collé. |
| « Custom element doesn't exist: ma-maison-agenda » (ou `ma-maison-rappels`) | Le fichier n'est pas dans `/config/www/` ou la ressource `/local/ma-maison-agenda.js` n'est pas déclarée : voir l'étape 7, puis rechargez la page. |
| Agenda ou Rappels : « iCloud déconnecté » | Apple redemande le code de double authentification. Le bouton **Ouvrir** de la carte mène à l'intégration Apple iCloud : reconnectez-la avec le code reçu sur l'iPhone. Si elle ne propose pas de le faire, supprimez-la puis ajoutez-la de nouveau (étape 7.1). |
| Agenda ou Rappels : « Aucun agenda » / « Aucune liste » | L'intégration Apple iCloud n'est pas installée, ou vos agendas viennent d'ailleurs (Google, CalDAV…) : ajoutez `platform: all` sous `type:` dans la carte, ou listez vos entités avec `entities:`. |
| Les valeurs du HomePod ne bougent pas | Vérifiez que votre raccourci Apple envoie bien vers `https://<votre-home-assistant>/api/webhook/<votre-identifiant>`, avec le même identifiant que dans le package. |

Un autre souci ? Ouvrez une *Issue* sur la page GitHub du dépôt en décrivant ce que vous voyez, avec une capture si possible.
