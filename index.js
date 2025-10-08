import makeWASocket, {
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  DisconnectReason
} from "@whiskeysockets/baileys"
import Pino from "pino"

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./session")
  const sock = makeWASocket({
    version: [2, 3000, 1015975018],
    logger: Pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: ["Windows", "Chrome", "10.0"],
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, Pino({ level: "silent" })),
    },
  })

  if (!sock.authState.creds.registered) {
    const phoneNumber = "6282244877433" // ubah ke nomormu
    console.log(`📱 Meminta kode untuk nomor: ${phoneNumber}`)
    try {
      const code = await sock.requestPairingCode(phoneNumber)
      console.log(`\n🔢 Masukkan kode ini ke WhatsApp Business:\n👉 ${code}\n`)
    } catch (err) {
      console.log("❌ Gagal ambil pairing code:", err?.message || err)
    }
  }

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "open") console.log("✅ Login berhasil! Sesi tersimpan di ./session")
    if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode
      if (reason !== DisconnectReason.loggedOut) {
        console.log("⚠️ Terputus, mencoba koneksi ulang...")
        startBot()
      } else {
        console.log("❌ Logout permanen. Jalankan ulang script.")
      }
    }
  })

  sock.ev.on("creds.update", saveCreds)
}

startBot()
