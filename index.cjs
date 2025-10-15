import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import Pino from 'pino'
import { Boom } from '@hapi/boom'

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info')

  const sock = makeWASocket({
    printQRInTerminal: true, // sementara aktifkan biar kelihatan di log
    auth: state,
    logger: Pino({ level: 'silent' }),
    browser: ['Chrome (Linux)', '', '']
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update
    if (connection === 'close') {
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

  // supaya Railway nggak langsung stop
  process.stdin.resume()

  // anti hapus pesan
  sock.ev.on('messages.update', async (msgUpdate) => {
    for (const m of msgUpdate) {
      if (m.update && m.update.message == null) {
        const original = m.key.remoteJid
        const sender = m.key.participant
        console.log(`🛑 Pesan dihapus dari ${sender}`)
        await sock.sendMessage('6282244877433@s.whatsapp.net', { text: `Pesan dihapus dari ${sender}` })
      }
    }
  })
}

startBot()