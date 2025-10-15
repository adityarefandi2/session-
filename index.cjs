// ------------------------------
// WhatsApp Silent Bot (No Read / No Online / Anti Delete / Anti ViewOnce)
// ------------------------------
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const P = require("pino");

// Folder penyimpanan sesi
const SESSION_FOLDER = "./session";

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_FOLDER);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: P({ level: "silent" }),
    printQRInTerminal: false,
    browser: ["RailwaySilentBot", "Chrome", "1.0.0"],
    auth: state,
    // jangan kirim notifikasi typing, online, read receipt
    markOnlineOnConnect: false,
    sendPresence: false,
    shouldIgnoreJid: () => true
  });

  // Jangan kirim receipt read/delivered
  sock.readMessages = async () => {};
  sock.sendPresenceUpdate = async () => {};
  sock.sendReceipts = async () => {};

  // Auto save creds
  sock.ev.on("creds.update", saveCreds);

  // Anti hapus pesan (termasuk media & stiker)
  sock.ev.on("messages.delete", async (m) => {
    try {
      const msg = m.messages[0];
      const sender = msg.key.remoteJid;
      const type = Object.keys(msg.message)[0];
      await sock.sendMessage("6282244877433@s.whatsapp.net", {
        text: `🚫 Pesan dihapus!\nDari: ${sender}\nTipe: ${type}`
      });
    } catch (e) {}
  });

  // Anti sekali lihat (termasuk media)
  sock.ev.on("messages.upsert", async (m) => {
    const msg = m.messages[0];
    if (!msg.message) return;
    const type = Object.keys(msg.message)[0];

    if (type === "viewOnceMessageV2" || type === "viewOnceMessage") {
      const mediaMsg = msg.message.viewOnceMessageV2
        ? msg.message.viewOnceMessageV2.message
        : msg.message.viewOnceMessage.message;
      msg.message = mediaMsg;
      await sock.sendMessage("6282244877433@s.whatsapp.net", {
        text: "👀 Pesan sekali lihat terdeteksi!"
      });
      await sock.sendMessage("6282244877433@s.whatsapp.net", msg.message);
    }
  });

  // Abaikan panggilan (supaya tidak crash)
  sock.ev.on("call", (call) => {
    console.log("📞 Call ignored from:", call.from);
  });

  // Reconnect otomatis
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) startBot();
    } else if (connection === "open") {
      console.log("✅ Bot connected silently (no online mark, no read receipts).");
    }
  });
}

startBot();
process.stdin.resume()