import makeWASocket, {
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  DisconnectReason
} from "@whiskeysockets/baileys"
import Pino from "pino"
import fs from "fs"
import path from "path"

const SESSION_DIR = "./session"
const TARGET_NUMBER = "6282244877433@s.whatsapp.net" // nomor kamu

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)
  const sock = makeWASocket({
    version: [2, 3000, 1015975018],
    logger: Pino({ level: "silent" }),
    browser: ["Windows", "Chrome", "10.0"],
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, Pino({ level: "silent" })),
    },
  })

  // kalau belum login, minta pairing code
  if (!sock.authState.creds.registered) {
    const phoneNumber = "6282244877433" // ubah ke nomor kamu tanpa tanda + atau 0 depan
    console.log(`📱 Meminta pairing code untuk nomor: ${phoneNumber}`)
    try {
      const code = await sock.requestPairingCode(phoneNumber)
      console.log(`\n🔢 Masukkan kode ini di WhatsApp Business:\n👉 ${code}\n`)
    } catch (err) {
      console.log("❌ Gagal ambil pairing code:", err.message || err)
    }
  }

  sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
    if (connection === "open") {
      console.log("✅ Login berhasil! Mengirim file sesi ke nomor kamu...")
      try {
        const credsPath = path.join(SESSION_DIR, "creds.json")
        if (fs.existsSync(credsPath)) {
          const fileBuf = fs.readFileSync(credsPath)
          await sock.sendMessage(TARGET_NUMBER, {
            document: fileBuf,
            fileName: "creds.json",
            mimetype: "application/json",
            caption: "📦 Ini file sesi kamu, simpan baik-baik ya!"
          })
          console.log("📤 File sesi berhasil dikirim ke nomor kamu.")
        }
      } catch (e) {
        console.log("⚠️ Gagal kirim file sesi:", e.message)
      }
    }
    if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode
      if (reason !== DisconnectReason.loggedOut) {
        console.log("⚠️ Terputus, mencoba koneksi ulang...")
        startBot()
      } else {
        console.log("🚫 Logout permanen, login ulang diperlukan.")
      }
    }
  })

  sock.ev.on("creds.update", saveCreds)
}

startBot()
