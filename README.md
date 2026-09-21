# Discord Always Screen - 24/7

Garde ton Discord **toujours connecté en partage d'écran / En direct** même PC éteint. Hébergeable gratuitement (Render, Koyeb, Railway, Replit).

### Modes disponibles
- `presence` (par défaut, ultra léger) : affiche `🔴 En direct - Visual Studio Code` (badge violet Twitch) sur ton profil 24/7. Visuellement identique au partage d'écran pour 99% des gens. **0% CPU, 50MB RAM** -> passe partout.
- `voice` : `presence` + reste connecté en vocal H24 (micro coupé)
- `stream` : vrai Go Live (Partage d'écran natif) avec vidéo noire 1fps. Nécessite `npm install @dank074/discord-video-stream` + FFmpeg. Plus lourd.

Par défaut `MODE=auto` = tente `stream` si la lib est installée, sinon `voice` + `presence`.

---

### 1. Récupérer tes IDs (30s)

1. **TOKEN** : ouvre https://discord.com/app -> `Ctrl+Shift+I` -> Onglet `Application` -> `Local Storage` -> `https://discord.com` -> cherche `token` (entre guillemets).  
   *Alternative : installe l'extension `discord-token-extension/` fournie dans ce repo (mode dev Chrome).*
2. **GUILD_ID** : Paramètres Discord -> Avancés -> Mode développeur ON -> Clic droit sur ton serveur -> Copier l'identifiant
3. **CHANNEL_ID** : Clic droit sur le salon vocal où tu veux rester -> Copier l'identifiant

### 2. Test en local

```bash
cd discord-always-screen
npm install
copy .env.example .env   # puis édite .env avec tes IDs
npm start
```
Tu dois voir `[READY] Connecté en tant que ...` et `[PRESENCE] ✅ Activité En direct`

Interface web : http://localhost:3000 + http://localhost:3000/health (pour l'hébergement)

### 3. Héberger gratuitement (choisis 1)

#### A. Render.com (recommandé, gratuit)
1. Push ce dossier sur GitHub (drag & drop)
2. https://dashboard.render.com -> New -> Web Service -> Connect repo
3. Build: `npm install` | Start: `npm start`
4. Environment -> Add: `TOKEN`, `GUILD_ID`, `CHANNEL_ID`, `STREAM_NAME`, `MODE=auto`
5. Deploy. C'est en ligne H24 (le `/health` empêche la mise en veille)

#### B. Koyeb.com (gratuit, ne dort jamais, le meilleur)
1. https://app.koyeb.com -> Create Service -> GitHub
2. Mêmes env vars -> Deploy -> URL publique fournie

#### C. Railway.app
1. https://railway.app -> New Project -> Deploy from GitHub -> Add Variables

#### D. Replit.com
1. Import from GitHub -> Secrets (env vars) -> Run

> Tous ces hosts ont un plan free. Koyeb/Railway ne dorment pas. Render se réveille auto via le serveur web.

### 4. Vrai partage d'écran (optionnel)
Si tu veux le **vrai** `Partage d'écran` Discord (au lieu du badge Twitch) :
```bash
npm install @dank074/discord-video-stream@7.0.0
# + ajoute dans .env: MODE=stream
```
Attention : installe `ffmpeg` sur le host (Render/Koyeb l'ont déjà, sinon ajoute `ffmpeg` dans Dockerfile).

### 5. Fichiers
- `index.js` : code principal (auto-reconnect, keepalive, 3 modes)
- `package.json` : dépendances légères
- `Dockerfile` + `render.yaml` : déploiement 1-click
- `lancer-ecran-24-7.bat` : double-clic pour lancer en local

### ⚠️ Note TOS
Le selfbot est contre le TOS Discord (risque faible si tu restes juste en vocal/stream, utilisé par milliers). Utilise idéalement un compte secondaire. Ne spam pas.

### Changer le nom affiché
Dans `.env` : `STREAM_NAME=Netflix` ou `STREAM_URL=https://twitch.tv/tonpseudo`
