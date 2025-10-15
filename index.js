import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion
} from '@whiskeysockets/baileys'
import pino from 'pino'
import fs from 'fs'

// Nomor admin tujuan log
const admin = '6282244877433@s.whatsapp.net'

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info')
    const { version } = await fetchLatestBaileysVersion()
    const sock = makeWASocket({
        version,
        printQRInTerminal: true,
        auth: state,
        logger: pino({ level: 'silent' }),
        markOnlineOnConnect: false,
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,
    })

    // Simpan sesi bila ada perubahan
    sock.ev.on('creds.update', saveCreds)

    // Abaikan telepon masuk
    sock.ev.on('call', async call => {
        for (let id in call) {
            await sock.rejectCall(id)
        }
    })

    // Anti-hapus & anti-view once
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0]
        if (!msg.message) return
        if (msg.key.remoteJid === 'status@broadcast') return
        const from = msg.key.remoteJid

        // Deteksi view once
        if (msg.message?.viewOnceMessage || msg.message?.viewOnceMessageV2) {
            await sock.sendMessage(admin, {
                text: `📸 Pesan sekali lihat dari ${from}:\n\n${JSON.stringify(msg, null, 2)}`
            })
        }

        // Deteksi pesan biasa (log)
        if (!msg.key.fromMe) {
            await sock.sendMessage(admin, {
                text: `💬 Pesan masuk dari ${from}:\n\n${msg.pushName || 'Tanpa nama'}\n${msg.message.conversation || '[Non-teks]'}`,
            })
        }
    })

    // Anti delete (pesan dihapus)
    sock.ev.on('messages.update', async updates => {
        for (let upd of updates) {
            if (upd.update.messageStubType === 1) {
                await sock.sendMessage(admin, {
                    text: `🚫 Pesan dihapus dari ${upd.key.remoteJid}\nID: ${upd.key.id}`
                })
            }
        }
    })

    // Reconnect otomatis
    sock.ev.on('connection.update', update => {
        const { connection, lastDisconnect } = update
        if (connection === 'close') {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut)
                startBot()
        }
    })
}

startBot()
