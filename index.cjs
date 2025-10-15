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
        generateHighQualityLinkPreview: false
    })

    sock.ev.on('creds.update', saveCreds)

    // Abaikan telepon
    sock.ev.on('call', async call => {
        for (let id in call) await sock.rejectCall(id)
    })

    // Pesan masuk / anti-hapus / anti-view-once
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0]
        if (!msg.message) return
        if (msg.key.remoteJid === 'status@broadcast') return

        const from = msg.key.remoteJid
        const sender = msg.pushName || 'Tanpa Nama'

        // View-once
        if (msg.message?.viewOnceMessage || msg.message?.viewOnceMessageV2) {
            await sock.sendMessage(admin, {
                text: `📸 *Pesan sekali lihat* dari ${sender} (${from})`
            })
            const media = msg.message.viewOnceMessage?.message?.imageMessage ||
                          msg.message.viewOnceMessageV2?.message?.videoMessage
            if (media) {
                const buffer = await sock.downloadMediaMessage(msg)
                await sock.sendMessage(admin, { image: buffer, caption: 'Konten sekali lihat' })
            }
        }

        // Pesan biasa
        if (!msg.key.fromMe) {
            const teks = msg.message.conversation ||
                         msg.message.extendedTextMessage?.text ||
                         '[Non-teks]'
            await sock.sendMessage(admin, {
                text: `💬 *Pesan baru dari* ${sender} (${from}):\n${teks}`
            })
        }
    })

    // Deteksi penghapusan pesan/media/stiker
    sock.ev.on('messages.update', async updates => {
        for (const upd of updates) {
            if (upd.update.messageStubType === 1) {
                const { remoteJid, id, participant } = upd.key
                const chat = remoteJid || 'Tidak diketahui'
                await sock.sendMessage(admin, {
                    text: `🚫 *Pesan dihapus*\nDari: ${participant || chat}\nID: ${id}`
                })

                try {
                    // Ambil pesan terhapus dari penyimpanan sementara
                    const m = await sock.loadMessage(remoteJid, id)
                    if (!m) return

                    const msgContent = m.message
                    if (msgContent?.imageMessage) {
                        const buffer = await sock.downloadMediaMessage(m)
                        await sock.sendMessage(admin, {
                            image: buffer,
                            caption: '🖼️ Gambar yang dihapus'
                        })
                    } else if (msgContent?.videoMessage) {
                        const buffer = await sock.downloadMediaMessage(m)
                        await sock.sendMessage(admin, {
                            video: buffer,
                            caption: '🎞️ Video yang dihapus'
                        })
                    } else if (msgContent?.stickerMessage) {
                        const buffer = await sock.downloadMediaMessage(m)
                        await sock.sendMessage(admin, {
                            sticker: buffer
                        })
                    } else if (msgContent?.documentMessage) {
                        const buffer = await sock.downloadMediaMessage(m)
                        await sock.sendMessage(admin, {
                            document: buffer,
                            fileName: msgContent.documentMessage.fileName || 'file'
                        })
                    } else {
                        const text =
                            msgContent?.conversation ||
                            msgContent?.extendedTextMessage?.text ||
                            '[Pesan non-media dihapus]'
                        await sock.sendMessage(admin, {
                            text: `🗑️ Isi pesan: ${text}`
                        })
                    }
                } catch (e) {
                    console.log('Gagal ambil pesan terhapus', e)
                }
            }
        }
    })

    // Reconnect otomatis
    sock.ev.on('connection.update', update => {
        const { connection, lastDisconnect } = update
        if (connection === 'close' &&
            lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut)
            startBot()
    })
}

startBot()
