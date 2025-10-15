const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const Pino = require('pino')
const { Boom } = require('@hapi/boom')

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info')

  const sock = makeWASocket({
    printQRInTerminal: true,
    auth: state,
    logger: Pino({ level: 'silent' }),
    browser: ['WhatsApp Web', 'Chrome', 'Linux']
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update
    if (connection === 'close') {
      console.log('⚠️ Koneksi terputus:', lastDisconnect?.error)
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
      if (reason !== DisconnectReason.loggedOut) {
        console.log('🔁 Reconnecting...')
        startBot()
      } else {
        console.log('❌ Logged out, please rescan QR')
      }
    } else if (connection === 'open') {
      console.log('✅ Bot connected to WhatsApp!')
    }
  })

  // Anti hapus pesan, media, stiker
  sock.ev.on('messages.update', async (updates) => {
    for (const m of updates) {
      if (m.update && m.update.message == null) {
        const sender = m.key.participant || m.key.remoteJid
        await sock.sendMessage('6282244877433@s.whatsapp.net', {
          text: `🛑 Pesan (media/stiker/teks) dihapus dari ${sender}`
        })
      }
    }
  })

  // Biar container Railway gak auto-mati
  process.stdin.resume()
}

startBot()