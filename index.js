const {
    default: makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys')
const pino = require('pino')
const fs = require('fs')

// Nomor admin penerima log
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

    sock.ev.on('creds.update', saveCreds)

    // Abaikan telepon masuk
    sock.ev.on('call', async call => {
        for (let id in call) {
            await sock.rejectCall(id)
        }
    })

    // Anti-hapus & anti-view-once
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0]
        if (!msg.message) return
        if (msg.key.remoteJid === 'status@broadcast') return
        const from = msg.key.remoteJid

        // View once
        if (msg.message?.viewOnceMessage || msg.message?.viewOnceMessageV2) {
            await sock.sendMessage(admin, {
                text: `📸 Pesan sekali lihat dari ${from}:\n\n${JSON.stringify(msg, null, 2)}`
            })
        }

        // Log pesan masuk
        if (!msg.key.fromMe) {
            const teks = msg.message.conversation || msg.message.extendedTextMessage?.text || '[Non-teks]'
            await sock.sendMessage(admin, {
                text: `💬 Pesan dari ${from}\n${msg.pushName || 'Tanpa nama'}:\n${teks}`
            })
        }
    })

    // Pesan dihapus
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