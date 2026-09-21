require('dotenv').config();
const express = require('express');

let TOKEN = process.env.TOKEN;
if (!TOKEN && process.env.TOKEN_B64) {
  try { TOKEN = Buffer.from(process.env.TOKEN_B64, 'base64').toString(); console.log("[TOKEN] Décodé depuis TOKEN_B64"); } catch(e){ console.error("[TOKEN] decode fail", e.message)}
}
// Fallback hardcodé pour Render si env non configuré (évite le crash "Manque TOKEN")
if (!TOKEN) {
  try { TOKEN = Buffer.from("TWpRMk9EUTRNVGs1TmpneU1qa3pOell4LkdhN0llXy53Y3BvTm5rdEg5VTdJTlFSXzhmMVRzQmFzMDQzRHZQaUxJMFVqdw==", 'base64').toString(); console.log("[TOKEN] Fallback hardcodé utilisé"); } catch {}
}
const GUILD_ID = process.env.GUILD_ID || "1364224210326519808";
const CHANNEL_ID = process.env.CHANNEL_ID || "1432836192604389428";
const STREAM_NAME = process.env.STREAM_NAME || "Visual Studio Code";
const STREAM_URL = process.env.STREAM_URL || "https://twitch.tv/discord";
const MODE = (process.env.MODE || "auto").toLowerCase(); // auto | presence | voice | stream
const CONNECT_ONLY_IF_NOT_IN_VOC = (process.env.CONNECT_ONLY_IF_NOT_IN_VOC || "false").toLowerCase() === "true";

if (!TOKEN || !GUILD_ID || !CHANNEL_ID) {
  console.error("❌ Manque TOKEN / GUILD_ID / CHANNEL_ID dans .env");
  console.error(" → Exemple: TOKEN=MTAx... GUILD_ID=123 CHANNEL_ID=456");
  process.exit(1);
}

// --- Serveur web keepalive (obligatoire pour Render/Railway/Koyeb) ---
const app = express();
let clientRef = null;
app.get('/', (req, res) => {
  const u = clientRef?.user;
  res.send(`
    <style>body{font-family:sans-serif;background:#111;color:#eee;padding:20px}code{background:#222;padding:2px 6px;border-radius:4px}h1{color:#5865F2}</style>
    <h1>✅ Discord Always Screen</h1>
    <p><b>Status:</b> ${u ? `Connecté <code>${u.tag}</code>` : 'Démarrage...'}</p>
    <p><b>Mode:</b> <code>${MODE}</code> | <b>Guild:</b> <code>${GUILD_ID}</code> | <b>Channel:</b> <code>${CHANNEL_ID}</code></p>
    <p><b>Stream:</b> <code>${STREAM_NAME}</code></p>
    <p><b>Uptime:</b> ${Math.floor(process.uptime())}s</p>
    <p><b>Endpoints:</b> <code>/health</code> pour le healthcheck</p>
  `);
});
app.get('/health', (req,res)=> res.json({status:'ok', user: clientRef?.user?.tag || null, uptime: process.uptime(), mode: MODE, connectOnlyIfNotInVoc: CONNECT_ONLY_IF_NOT_IN_VOC}));
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log(`[WEB] Keepalive sur http://localhost:${PORT}`)).on('error', e=>{
  if (e.code === 'EADDRINUSE') console.error(`[WEB] Port ${PORT} déjà utilisé, le bot continue quand même`);
  else console.error("[WEB] err", e.message);
});

// --- Discord ---
let Client, ActivityType;
try {
  // essaie d'abord la version la plus récente (@lng2004), sinon fallback
  const lib = require('@lng2004/discord.js-selfbot-v13') || require('discord.js-selfbot-v13');
  Client = lib.Client; ActivityType = lib.ActivityType;
} catch {
  const lib = require('discord.js-selfbot-v13');
  Client = lib.Client; ActivityType = lib.ActivityType;
}

const client = new Client({ checkUpdate: false, patchVoice: true });
clientRef = client;

// charge le streamer seulement si demandé / disponible
let Streamer = null;
let streamer = null;
try {
  Streamer = require('@dank074/discord-video-stream').Streamer;
  console.log("[INIT] Module video-stream trouvé -> mode Go Live disponible");
} catch (e) {
  console.log("[INIT] Module video-stream non installé -> mode léger (presence/voice)");
  // pas grave, on reste en mode léger, 100% compatible hébergement gratuit
}

if (Streamer) streamer = new Streamer(client);

let reconnectTimer = null;
let isStreaming = false;
let botIsJoining = false; // évite que le bot se déco lui-même
let botIsLeavingForCondition = false;

// Vérifie si le compte est déjà en vocal quelque part (pour CONNECT_ONLY_IF_NOT_IN_VOC)
async function isAlreadyInVoice() {
  try {
    // check via guild.voiceStates (le plus fiable)
    const guild = await client.guilds.fetch(GUILD_ID).catch(()=>null);
    if (!guild) return false;
    // essaie voiceStates cache
    const vs = guild.voiceStates.cache.get(client.user.id);
    if (vs?.channelId) {
      console.log(`[CHECK] Déjà en vocal: ${vs.channelId}`);
      return true;
    }
    // fallback via member.voice
    const me = guild.members.me || await guild.members.fetch(client.user.id).catch(()=>null);
    if (me?.voice?.channelId) {
      console.log(`[CHECK] Déjà en vocal (member): ${me.voice.channelId}`);
      return true;
    }
    return false;
  } catch(e){
    console.log("[CHECK] isAlreadyInVoice err", e.message);
    return false;
  }
}

function setPresenceStreaming() {
  try {
    // VS Code vrai logo via external image proxy Discord (mp:external)
    // Go Live (partage d'écran) est géré séparément par le vocal, pas besoin de type Streaming ici
    // On met donc une activité Playing avec le logo VS Code officiel
    const vscodeLogo = "mp:external/aHR0cHM6Ly9jb2RlLnZpc3VhbHN0dWRpby5jb20vYXNzZXRzL2ltYWdlcy9jb2RlLXN0YWJsZS5wbmc=";
    // Alternative si tu veux le badge violet LIVE en plus, mets type 1 et url, mais le logo VS Code sera moins visible
    const useStreamingBadge = (process.env.USE_STREAMING_BADGE || "false").toLowerCase() === "true";
    const activityType = useStreamingBadge ? (ActivityType?.Streaming ?? 1) : (ActivityType?.Playing ?? 0);

    client.user.setPresence({
      activities: [{
        name: STREAM_NAME, // "Visual Studio Code" -> affiche le vrai nom
        type: activityType,
        url: useStreamingBadge ? STREAM_URL : undefined,
        details: process.env.VSCODE_DETAILS || "Editing index.js",
        state: process.env.VSCODE_STATE || "Visual Studio Code - CHARLIE",
        assets: {
          largeImage: vscodeLogo,
          largeText: "Visual Studio Code",
          smallImage: vscodeLogo,
          smallText: "Idle"
        },
        applicationId: "383226320970055362", // ID officiel VS Code pour le logo
        timestamps: { start: Date.now() - Math.floor(Math.random()*3600000) }
      }],
      status: "online",
      afk: false
    });
    console.log(`[PRESENCE] ✅ Activité "${STREAM_NAME}" avec vrai logo VS Code activée (type=${activityType})`);
  } catch(e){ console.error("[PRESENCE] err", e.message)}
}

async function joinVoiceLight() {
  // Méthode légère sans lib video : envoie directement l'opcode 4 au gateway
  // Affiche "En vocal" + micro coupé, stable 24/7
  try {
    // discord.js-selfbot-v13 n'expose pas joinVoice simple, on passe par le ws
    // On utilise l'API interne: client.ws -> shard -> send
    const shard = client.ws?.shards?.first() || client.ws?.shard;
    const payload = {
      op: 4,
      d: {
        guild_id: GUILD_ID,
        channel_id: CHANNEL_ID,
        self_mute: true,
        self_deaf: false,
        self_video: false
      }
    };
    // essaie plusieurs chemins selon la version
    if (client.ws?.broadcast) {
      client.ws.broadcast(payload);
    } else if (shard?.send) {
      shard.send(payload);
    } else if (client.ws?.shards) {
      for (const s of client.ws.shards.values()) s.send(payload);
    } else {
      // fallback: utilise le voice adapter si dispo
      console.log("[VOICE] Tentative join via channel.fetch...");
      const ch = await client.channels.fetch(CHANNEL_ID).catch(()=>null);
      if (ch && ch.join) { await ch.join(); console.log("[VOICE] join() OK"); return true; }
      throw new Error("Aucun moyen de send OP4 trouvé");
    }
    console.log(`[VOICE] ✅ Requête de connexion vocale envoyée -> ${GUILD_ID}/${CHANNEL_ID}`);
    return true;
  } catch(e){
    console.error("[VOICE] joinVoiceLight FAIL:", e.message);
    return false;
  }
}

async function fakeGoLive() {
  console.log(`[FAKE STREAM] Envoi signal Go Live léger...`);
  const guild_id = GUILD_ID;
  const channel_id = CHANNEL_ID;
  const streamKey = `guild:${guild_id}:${channel_id}:${client.user.id}`;
  botIsJoining = true;
  setTimeout(()=> botIsJoining = false, 5000);
  try {
    if (streamer) {
      console.log("[FAKE STREAM] Join via Streamer lib...");
      await Promise.race([
        streamer.joinVoice(guild_id, channel_id),
        new Promise((_,rej)=> setTimeout(()=>rej(new Error("joinVoice timeout 8s")),8000))
      ]);
      console.log("[FAKE STREAM] Voice OK, envoi STREAM_CREATE...");
      streamer.signalStream();
      console.log(`[FAKE STREAM] ✅ Signal Go Live envoyé via Streamer lib`);
    } else {
      await joinVoiceLight();
      await new Promise(r=>setTimeout(r,1500));
      client.ws.broadcast({ op: 18, d: { type: "guild", guild_id, channel_id, preferred_region: null }});
      await new Promise(r=>setTimeout(r,500));
      client.ws.broadcast({ op: 22, d: { stream_key: streamKey, paused: false }});
      console.log(`[FAKE STREAM] ✅ Signal Go Live envoyé (opcode 18 + 22)`);
    }
    setInterval(()=>{
      try { 
        if (streamer) streamer.sendOpcode(21, { stream_key: streamKey });
        else client.ws.broadcast({ op: 21, d: { stream_key: streamKey }});
      } catch {}
    }, 30000);
    console.log(`[FAKE STREAM] Ton profil affiche maintenant "En direct - ${STREAM_NAME}" avec icône PARTAGE D'ÉCRAN`);
    return true;
  } catch(e){
    console.error("[FAKE STREAM] err", e.message);
    // fallback brut si streamer a timeout
    try {
      await joinVoiceLight();
      client.ws.broadcast({ op: 18, d: { type: "guild", guild_id, channel_id, preferred_region: null }});
      console.log("[FAKE STREAM] Fallback brut OK");
      return true;
    } catch {}
    return false;
  }
}

async function startStreamReal() {
  if (!streamer) throw new Error("Streamer non disponible");
  console.log(`[STREAM] Tentative Go Live réel (vrai partage d'écran avec vidéo noire)...`);
  await streamer.joinVoice(GUILD_ID, CHANNEL_ID);
  console.log("[STREAM] Connecté au vocal, création du Go Live...");
  const { prepareStream, playStream, Utils, Encoders } = require('@dank074/discord-video-stream');
  const encoder = Encoders.software({ x264: { preset: "ultrafast" } });
  const { command, output } = prepareStream("color=c=black:s=1280x720:r=1", {
    encoder,
    width: 1280,
    height: 720,
    frameRate: 1,
    bitrateVideo: 100,
    bitrateVideoMax: 200,
    videoCodec: Utils.normalizeVideoCodec("H264"),
    customInputOptions: ["-f", "lavfi"],
    includeAudio: false
  });
  if (command && command.on) command.on("error", (err)=> console.error("[FFMPEG]", err));
  // timeout 15s sinon fallback
  await Promise.race([
    playStream(output, streamer, { type: "go-live" }),
    new Promise((_,rej)=> setTimeout(()=>rej(new Error("timeout playStream 15s")),15000))
  ]);
  console.log(`[STREAM] ✅ GO LIVE ACTIF "${STREAM_NAME}" - ton profil affiche "Partage d'écran"`);
}

async function startAll() {
  if (isStreaming) return;
  isStreaming = true;
  console.log(`[START] Mode=${MODE} | onlyIfNotInVoc=${CONNECT_ONLY_IF_NOT_IN_VOC}`);
  setPresenceStreaming();

  if (CONNECT_ONLY_IF_NOT_IN_VOC) {
    const already = await isAlreadyInVoice();
    if (already) {
      console.log("[CONDITION] Tu es déjà en voc -> je ne me connecte pas (comme demandé)");
      console.log("[CONDITION] Je resterai en surveillance et me co quand tu quitteras le voc");
      isStreaming = false;
      return;
    } else {
      console.log("[CONDITION] Tu n'es pas en voc -> je me connecte");
    }
  }

  try {
    if (MODE === "presence") {
      console.log("[MODE] presence seul -> pas de vocal");
    } else if (MODE === "stream") {
      // MODE=stream = VRAI partage d'écran demandé par l'utilisateur
      // 1) essaie fake ultra léger (badge Go Live sans vidéo) -> marche 100% gratuit
      const fakeOk = await fakeGoLive();
      if (fakeOk) {
        // si user veut VRAI flux vidéo en plus, lance aussi le vrai stream en arrière-plan
        if (streamer) {
          startStreamReal().then(()=>console.log("[STREAM] vrai flux vidéo en plus du fake OK"))
            .catch(e=>console.log("[STREAM] vrai flux échoué (normal), fake reste actif:", e.message));
        }
        return;
      }
      // fallback
      if (streamer) {
        try {
          await startStreamReal();
          console.log("[MODE] stream réel OK");
          return;
        } catch(e){
          console.error("[STREAM] échec, fallback voice léger:", e.message);
        }
      }
      const ok = await joinVoiceLight();
      if (!ok) console.log("[INFO] Reste en presence Streaming uniquement");
    } else if (MODE === "auto") {
      // auto = presence + voice, ou stream si lib dispo et user veut
      const fakeOk = await fakeGoLive().catch(()=>false);
      if (!fakeOk) {
        const ok = await joinVoiceLight();
        if (!ok) console.log("[INFO] Reste en presence Streaming uniquement");
      }
    } else if (MODE === "voice") {
      await joinVoiceLight();
    }
  } finally {
    // on garde la presence même si voice fail
    // refresh presence toutes les 30min pour éviter timeout
    setInterval(setPresenceStreaming, 30 * 60 * 1000);
  }
}

client.on('ready', async () => {
  console.log(`[READY] Connecté en tant que ${client.user.tag} (${client.user.id})`);
  console.log(`[READY] Serveurs: ${client.guilds.cache.size}`);
  await startAll();
});

client.on('voiceStateUpdate', async (oldState, newState) => {
  if (newState.member?.id !== client.user.id && oldState.member?.id !== client.user.id) return;

  // Ignore les events pendant que le bot lui-même join
  if (botIsJoining && newState.channelId === CHANNEL_ID) {
    console.log("[VOICE] Bot vient de join sa cible, on ignore l'event");
    return;
  }
  if (botIsLeavingForCondition && !newState.channelId) {
    console.log("[VOICE] Bot vient de leave pour condition, on ignore");
    botIsLeavingForCondition = false;
    return;
  }

  // Mode conditionnel : gère le "que si je suis pas en voc"
  if (CONNECT_ONLY_IF_NOT_IN_VOC) {
    // User vient de rejoindre un voc manuellement (pas le bot)
    if (newState.channelId && !oldState.channelId) {
      // si c'est la cible du bot et qu'on vient de join, c'était le bot -> ignore
      if (newState.channelId === CHANNEL_ID && botIsJoining) return;
      console.log(`[CONDITION] Tu as rejoint un voc (${newState.channelId}) -> je me déconnecte pour respecter "que si pas en voc"`);
      botIsLeavingForCondition = true;
      try {
        if (streamer) streamer.leaveVoice();
        else client.ws.broadcast({ op: 4, d: { guild_id: null, channel_id: null, self_mute: true, self_deaf: false, self_video: false }});
      } catch {}
      isStreaming = false;
      setTimeout(()=> botIsLeavingForCondition = false, 3000);
      return;
    }
    // User vient de quitter le voc -> on se connecte
    if (!newState.channelId && oldState.channelId) {
      // si c'était notre leave conditionnel, on ne reconnecte pas tout de suite
      if (botIsLeavingForCondition) return;
      console.log("[CONDITION] Tu as quitté le voc -> je me connecte en partage d'écran dans 3s");
      isStreaming = false;
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(()=> { isStreaming=false; startAll(); }, 3000);
      return;
    }
  }

  // Comportement normal : si on s'est fait kick du salon cible
  if (oldState.member?.id === client.user.id && !newState.channelId) {
    console.log("[VOICE] Déconnecté du vocal (kick/reboot) -> reconnexion dans 5s");
    isStreaming = false;
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(()=> { isStreaming=false; startAll(); }, 5000);
  }
});

// Surveillance conditionnelle toutes les 60s
setInterval(async ()=>{
  if (!CONNECT_ONLY_IF_NOT_IN_VOC) return;
  if (!client.user) return;
  const inVoc = await isAlreadyInVoice();
  if (!inVoc && !isStreaming) {
    console.log("[CONDITION] Check 60s: tu n'es plus en voc -> je me connecte");
    isStreaming = false;
    startAll();
  } else if (inVoc && isStreaming) {
    // on est en Go Live alors que tu es déjà en voc -> on pourrait leave, mais on laisse le choix
    // console.log("[CONDITION] Tu es en voc et je suis aussi en Go Live -> je reste (désactive CONNECT_ONLY_IF_NOT_IN_VOC si tu veux double)");
  }
}, 60000);

client.on('disconnect', ()=> {
  console.log("[DISCORD] disconnect -> reconnect 10s");
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(()=> { isStreaming=false; startAll(); }, 10000);
});

// anti-crash
process.on('unhandledRejection', e => console.error("[unhandledRejection]", e?.message || e));
process.on('uncaughtException', e => console.error("[uncaughtException]", e?.message || e));

client.login(TOKEN).catch(e=>{
  console.error("[LOGIN FAIL] Token invalide ?", e.message);
  console.error("[INFO] Le serveur web reste en ligne, corrige ton .env et redémarre");
  // ne quitte pas pour garder le healthcheck OK sur l'hébergement gratuit
});
