# ✦ Shevardex — Bot Discord

Bot de cartes à collectionner pour le serveur Discord. Il lit `cards.json` (géré par le site) et maintient sa propre base de données SQLite pour les collections joueurs.

---

## Structure des fichiers

```
bot/
├── bot.js                 ← Point d'entrée du bot
├── deploy-commands.js     ← Script à lancer UNE FOIS pour enregistrer les slash commands
├── database.js            ← Initialisation SQLite
├── package.json
├── .env                   ← À créer (voir ci-dessous)
├── data/
│   └── shevardex.db       ← Créé automatiquement au premier lancement
├── commands/
│   ├── multi.js           ← /multi
│   ├── collection.js      ← /collection
│   ├── liste.js           ← /liste
│   ├── info.js            ← /info
│   ├── wish.js            ← /wish
│   ├── echange.js         ← /echange
│   ├── addpull.js         ← /add-pull [staff]
│   └── change_tirage.js   ← /change-tirage [staff]
└── utils/
    ├── cards.js            ← Lecture de cards.json
    ├── gacha.js            ← Logique de tirage pondéré
    ├── player.js           ← Pulls, recharge, cooldown
    ├── search.js           ← Recherche floue (insensible casse/accents)
    └── embeds.js           ← Helpers d'embeds Discord
```

---

## Où placer le dossier bot/ sur le serveur

Le dossier `bot/` doit être **à côté** du dossier du site, comme ceci :

```
~/shevardex/
├── server.js
├── index.html
├── cards.json          ← Le bot lit CE fichier
├── config.json
├── uploads/
└── bot/                ← Le bot est ici
    ├── bot.js
    └── ...
```

Le bot remonte d'un niveau (`../`) pour accéder à `cards.json`. Ce chemin est défini dans `utils/cards.js`.

---

## Installation

### 1. Créer l'application Discord

1. Va sur https://discord.com/developers/applications
2. **New Application** → donne un nom au bot
3. Onglet **Bot** → copie le **Token** (garde-le secret)
4. Onglet **OAuth2 → General** → copie le **Client ID**
5. Toujours dans **Bot** : active les options `Guilds` et `applications.commands` dans les **Privileged Gateway Intents** si demandé
6. Pour inviter le bot : **OAuth2 → URL Generator** → coche `bot` + `applications.commands` → coche les permissions `Send Messages`, `Embed Links`, `Read Message History` → copie et ouvre l'URL générée

### 2. Configurer le .env

Dans le dossier `bot/`, crée un fichier `.env` (copie `.env.example`) :

```bash
cp .env.example .env
nano .env
```

Remplis les valeurs :
```
DISCORD_TOKEN=ton_token_ici
CLIENT_ID=ton_client_id_ici
GUILD_ID=l_id_de_ton_serveur_discord
CARDS_PATH=/home/user/shevardex/cards.json
```

- **DISCORD_TOKEN** : le token de ton bot (onglet Bot sur le portail développeur)
- **CLIENT_ID** : l'identifiant de ton application Discord
- **GUILD_ID** : l'identifiant de ton serveur Discord — active le mode développeur (Paramètres → Avancé), puis clic droit sur le serveur → "Copier l'identifiant"
- **CARDS_PATH** : chemin absolu vers `cards.json` sur le serveur (le fichier produit par le site). Si absent, le bot cherche `../../cards.json` par défaut, ce qui correspond à la structure où `bot/` est placé à côté des fichiers du site.

### 3. Installer les dépendances

```bash
cd ~/shevardex/bot
npm install
```

### 4. Déployer les slash commands (une seule fois)

```bash
npm run deploy
```

Tu dois voir : `✅ Commandes déployées avec succès !`

### 5. Lancer le bot en permanence avec PM2

```bash
pm2 start bot.js --name shevardex-bot
pm2 save
```

Vérifie qu'il tourne :
```bash
pm2 status
pm2 logs shevardex-bot
```

---

## Commandes disponibles

| Commande | Description |
|---|---|
| `/multi` | Lance toutes vos invocations disponibles |
| `/collection [@joueur]` | Affiche votre collection (ou celle d'un autre) |
| `/liste` | Affiche tous les personnages du jeu |
| `/info [personnage]` | Détails d'un personnage |
| `/wish [personnage]` | Booste le drop d'un perso pour le prochain /multi |
| `/echange [@joueur]` | Propose un échange de carte |
| `/add-pull [@joueur] [n]` | *(Staff)* Ajoute des pulls à un joueur |
| `/change-tirage voir` | *(Staff)* Affiche la config actuelle |
| `/change-tirage recharge [n]` | *(Staff)* Pulls regagnés par heure |
| `/change-tirage max-pulls [n]` | *(Staff)* Cap maximum de pulls |
| `/change-tirage wish-boost [n]` | *(Staff)* Multiplicateur du wish |
| `/change-tirage role-staff [@role]` | *(Staff)* Définit le rôle staff |

---

## Système de pulls

- Chaque joueur commence avec **10 pulls**.
- Il regagne **+1 pull par heure** (modifiable via `/change-tirage recharge`).
- Le cap est de **10 pulls** (modifiable via `/change-tirage max-pulls`).
- `/multi` consomme **tous les pulls disponibles** d'un coup.
- Le staff peut donner des pulls bonus avec `/add-pull`.

## Système de wish

- `/wish [nom du perso]` active un boost pour **un seul /multi**.
- La carte souhaitée a **5× plus de chances** d'être tirée dans sa rareté (modifiable via `/change-tirage wish-boost`).
- Le wish est consommé au prochain `/multi`, qu'il soit exaucé ou non.

## Système d'échange

1. `/echange @joueur` → le joueur cible accepte ou refuse
2. Les deux joueurs cliquent sur **"Proposer ma carte"** et tapent le nom d'une carte de leur collection
3. En cas d'ambiguïté, un menu de sélection apparaît
4. Les deux doivent **confirmer** pour finaliser l'échange
5. L'échange expire automatiquement après **10 minutes** sans activité

## Recherche de personnages

La recherche est insensible à la casse et aux accents :
- `aelindra` → trouve "Aelindra la Tissatempête"
- `tiss` → trouve "Aelindra la Tissatempête"
- `ephe` → trouve "Sylvane l'Éphémère"

En cas de plusieurs résultats, un menu déroulant s'affiche pour choisir.

---

## Commandes utiles au quotidien

```bash
pm2 status                  # état du bot
pm2 logs shevardex-bot      # logs en temps réel
pm2 restart shevardex-bot   # redémarrer après une mise à jour
```

---

## Ajouter de nouvelles cartes

Il suffit d'utiliser le **site d'administration** (shevardex.zalax.xyz). Le bot lit `cards.json` à chaque tirage, donc les nouvelles cartes sont disponibles immédiatement sans redémarrer le bot.

