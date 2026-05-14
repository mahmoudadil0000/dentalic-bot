const TelegramBot = require('node-telegram-bot-api');
const dns = require('dns');

// Force Node.js to prefer IPv4 for DNS lookups (Fixes ENOTFOUND on many local machines/Windows)
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

const firebase = require('firebase/app');
require('firebase/firestore');
const https = require('https');
const http = require('http');

// Prevent process from crashing on unhandled errors
process.on('uncaughtException', (err) => {
    console.error('🔥 CRITICAL: Uncaught Exception:', err.message);
    if (err.code === 'ENOTFOUND') console.error('📡 Network/DNS Error detected. Please check internet connection.');
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('🔥 CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

// Cloudinary Config (unsigned upload)
const CLOUDINARY_CLOUD_NAME = 'YOUR_CLOUD_NAME'; // Replace with your Cloudinary cloud name
const CLOUDINARY_UPLOAD_PRESET = 'YOUR_UPLOAD_PRESET'; // Replace with your unsigned upload preset

// Replace with your actual bot token from @BotFather
const token = '8800673686:AAHUbjAoGjy-FzzVcahqklVU-0g3BhYypxQ';

// Initialize the Telegram Bot
const bot = new TelegramBot(token, { polling: true });

// Firebase Configuration from your web project
const firebaseConfig = {
    apiKey: "AIzaSyAKevus2EJpkIaHeuR3DTutSgUOzkZunQg",
    authDomain: "main-admin-and-admin.firebaseapp.com",
    projectId: "main-admin-and-admin",
    storageBucket: "main-admin-and-admin.firebasestorage.app",
    messagingSenderId: "691604476037",
    appId: "1:691604476037:web:9fe647e73de1ea699e19ec",
    measurementId: "G-VSHWQWTW21"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// Fix for GRPC Connection drops in Node.js
try {
    db.settings({
        experimentalForceLongPolling: true,
        merge: true
    });
} catch (e) { /* Settings might already be applied */ }

// Monitor Firestore connection state
db.onSnapshotsInSync(() => {
    // This is called when local state is in sync with the server
    console.log("💎 Firestore Connection: Healthy & Synchronized");
});

// Telegram Bot Error Handlers (Prevents crashes on network blips)
let isOffline = false;
bot.on('polling_error', (error) => {
    if (error.code === 'EFATAL' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
        if (!isOffline) {
            console.error('📡 Network Error: Connection lost. The bot is waiting for internet to return...');
            isOffline = true;
        }
    } else {
        console.error('🤖 Polling Error:', error.message || error);
    }
});

// Detect when connection is back
bot.on('webhook_error', (error) => console.error('Webhook Error:', error));
// Note: node-telegram-bot-api doesn't have a built-in "reconnected" event for polling, 
// but we can log success on any successful interaction.
const userSessions = {};

async function safeDelete(chatId, messageId) {
    try {
        await bot.deleteMessage(chatId, messageId);
    } catch (e) { }
}

async function cleanupChat(chatId, keepMessageId = null, range = 15) {
    if (!keepMessageId) return;

    // Delete messages sequentially with a small delay to avoid crashing the Telegram UI
    for (let i = 1; i <= range; i++) {
        const mid = keepMessageId - i;
        try {
            await bot.deleteMessage(chatId, mid);
            // Small pause between deletions
            await new Promise(resolve => setTimeout(resolve, 50));
        } catch (e) { /* ignore deletion errors */ }
    }
}



const ARABIC_PROVINCES = [
    { id: 'Basra', label: 'البصرة' },
    { id: 'Baghdad', label: 'بغداد' },
    { id: 'Dhi Qar', label: 'ذي قار' },
    { id: 'Maysan', label: 'ميسان' },
    { id: 'Al-Qādisiyyah', label: 'القادسية' },
    { id: 'Muthanna', label: 'المثنى' },
    { id: 'Wasit', label: 'واسط' },
    { id: 'Babil', label: 'بابل' },
    { id: 'Karbala', label: 'كربلاء' },
    { id: 'Najaf', label: 'النجف' },
    { id: 'Saladin', label: 'صلاح الدين' },
    { id: 'Al Anbar', label: 'الأنبار' },
    { id: 'Kirkuk', label: 'كركوك' },
    { id: 'Nineveh', label: 'نينوى' },
    { id: 'Diyala', label: 'ديالى' }
];

const ARABIC_CASES = [
    { id: 'Ortho', label: 'اورثو' },
    { id: 'Medicine', label: 'مدسن' },
    { id: 'Pedo', label: 'بيدو' },
    { id: 'Pros', label: 'بروس' },
    { id: 'Perio', label: 'بريو' },
    { id: 'Operative', label: 'اوبرتف' },
    { id: 'Exo', label: 'اكزو' }
];

const ARABIC_DAYS = [
    { id: 'Sunday', label: 'الأحد' }, { id: 'Monday', label: 'الاثنين' },
    { id: 'Tuesday', label: 'الثلاثاء' }, { id: 'Wednesday', label: 'الأربعاء' },
    { id: 'Thursday', label: 'الخميس' }, { id: 'Saturday', label: 'السبت' }
];

// Upload image from URL to Cloudinary (unsigned)
function uploadToCloudinary(imageUrl) {
    return new Promise((resolve, reject) => {
        // Download the image from Telegram
        const getter = imageUrl.startsWith('https') ? https : http;
        getter.get(imageUrl, (imgRes) => {
            const chunks = [];
            imgRes.on('data', (chunk) => chunks.push(chunk));
            imgRes.on('end', () => {
                const imageBuffer = Buffer.concat(chunks);
                const base64Image = 'data:image/jpeg;base64,' + imageBuffer.toString('base64');

                const postData = JSON.stringify({
                    file: base64Image,
                    upload_preset: CLOUDINARY_UPLOAD_PRESET,
                    folder: 'recharge_receipts'
                });

                const options = {
                    hostname: 'api.cloudinary.com',
                    path: `/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(postData)
                    }
                };

                const req = https.request(options, (res) => {
                    let data = '';
                    res.on('data', (chunk) => data += chunk);
                    res.on('end', () => {
                        try {
                            const result = JSON.parse(data);
                            resolve(result.secure_url || result.url);
                        } catch (e) {
                            reject(e);
                        }
                    });
                });
                req.on('error', reject);
                req.write(postData);
                req.end();
            });
            imgRes.on('error', reject);
        });
    });
}

// Handle /start command
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    const name = msg.from.first_name + (msg.from.last_name ? ' ' + msg.from.last_name : '');
    const username = msg.from.username || 'No Username';

    try {
        // Options for the regular keyboard (Big boxes at the bottom)
        const replyKeyboardOptions = {
            reply_markup: {
                keyboard: [
                    [
                        { text: 'حجز مريض 📓' },
                        { text: 'رصيد البوت 💳' }
                    ],
                    [
                        { text: 'تواصل مع الدعم 🤖' }
                    ]
                ],
                resize_keyboard: true,
                is_persistent: true
            }
        };

        const userRef = db.collection('telegram_users').doc(telegramId);
        const doc = await userRef.get();

        if (doc.exists) {
            const userData = doc.data();

            // Send new menu and save its ID
            const sentMsg = await bot.sendMessage(chatId, "اهلا بك في بوت حجز المرضى. إختر احد الازرار:", replyKeyboardOptions);

            // Delete the old menu message from chat to keep it completely clean
            if (userData.lastMessageId) {
                try {
                    await bot.deleteMessage(chatId, userData.lastMessageId);
                } catch (e) { }
            }
            await cleanupChat(chatId, sentMsg.message_id);
            await cleanupChat(chatId, sentMsg.message_id);
            await userRef.update({
                lastMessageId: sentMsg.message_id,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

        } else {
            // Create new user
            const sentMsg = await bot.sendMessage(chatId, "اهلا بك في بوت حجز المرضى. إختر احد الازرار:", replyKeyboardOptions);
            await cleanupChat(chatId, sentMsg.message_id);
            await cleanupChat(chatId, sentMsg.message_id);

            await userRef.set({
                telegramId: telegramId,
                name: name,
                username: username,
                balance: 0,
                lastMessageId: sentMsg.message_id,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log(`New user registered: ${name} (${telegramId})`);
        }

        // Attempt to delete the user's "/start" message NOW, after sending the bot's message
        // This prevents Telegram from kicking the user out of the chat.
        try {
            await bot.deleteMessage(chatId, msg.message_id);
        } catch (e) { }

    } catch (error) {
        console.error("Error saving user:", error);
    }
});

// Helper to hide the big bottom keyboard
async function hideBottomKeyboard(chatId) {
    try {
        const tempMsg = await bot.sendMessage(chatId, "جاري التحميل...", {
            reply_markup: { remove_keyboard: true }
        });
        await bot.deleteMessage(chatId, tempMsg.message_id);
    } catch (e) { }
}

// Show the main menu with the big bottom keyboard (used on /start and back navigation)
async function showMainMenu(chatId, telegramId) {
    const replyKeyboardOptions = {
        reply_markup: {
            keyboard: [
                [{ text: 'حجز مريض 📓' }, { text: 'رصيد البوت 💳' }],
                [{ text: 'تواصل مع الدعم 🤖' }]
            ],
            resize_keyboard: true,
            is_persistent: true
        }
    };
    try {
        const sentMsg = await bot.sendMessage(chatId, "اهلا بك في بوت حجز المرضى. إختر احد الازرار:", replyKeyboardOptions);
        await cleanupChat(chatId, sentMsg.message_id);
        await cleanupChat(chatId, sentMsg.message_id);
        const userRef = db.collection('telegram_users').doc(telegramId);
        await userRef.update({
            lastMessageId: sentMsg.message_id,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) { }
}
// The "Back" button keyboard for inline menus
const backButtonOptions = {
    reply_markup: {
        inline_keyboard: [
            [{ text: '🔙 عودة للقائمة الرئيسية', callback_data: 'back_to_main' }]
        ]
    }
};

// Handle all messages and keyboard button clicks
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const telegramId = msg.from.id.toString();

    if (text === 'رصيد البوت 💳' || text === 'حجز مريض 📓' || text === 'تواصل مع الدعم 🤖') {
        try {
            const userRef = db.collection('telegram_users').doc(telegramId);
            const doc = await userRef.get();
            let lastMessageId = null;

            if (doc.exists) {
                lastMessageId = doc.data().lastMessageId;
            }

            if (text === 'حجز مريض 📓') {
                userSessions[chatId] = { province: null, cases: [], days: [], lastMessageId: null };
                await showProvinceSelection(chatId);

                // Now delete previous messages
                if (lastMessageId) {
                    try { await bot.deleteMessage(chatId, lastMessageId); } catch (e) { }
                }
                try { await bot.deleteMessage(chatId, msg.message_id); } catch (e) { }
                return;
            }

            let newText = "";
            let currentOptions = backButtonOptions;

            if (text === 'رصيد البوت 💳') {
                newText = `💳 معلومات عن رصيد البوت:
🔘 رصيد البوت هو الوسيلة الي من خلاله تكدر تحجز المرضى.
🔘 مجرد امتلاكك لرصيد البوت راح يخليك تكدر تحجز اي مريض مباشرة اذا كنت تحب تكون اول الناس بالحجز و ما تضيع فرصة.
🔘 تكدر تعبي رصيد شكد متريد و راح يبقه محفوظ بالستم اوتوماتيكيا شوكت متحب تستخدمه موجود، يعني لتخاف كلشي محسوب و ما يضيع حقك.
🔘 في حال حجز اي مريض راح فقط يتم خصم مبلغ المريض و الباقي يضل شوكت ما تحب تستخدمه او تضيف عليه.`;

                currentOptions = {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: 'تعبئة رصيد البوت 💵', callback_data: 'add_balance' },
                                { text: 'معرفة رصيد البوت 🤔', callback_data: 'check_balance' }
                            ],
                            [
                                { text: 'تحويل رصيد البوت 📩', callback_data: 'transfer_balance' }
                            ],
                            [
                                { text: 'العودة 🏠', callback_data: 'back_to_main' }
                            ]
                        ]
                    }
                };
            } else if (text === 'تواصل مع الدعم 🤖') {
                newText = "يرجى التواصل مع الحساب:\n@io_620";
            }

            const sentMsg = await bot.sendMessage(chatId, newText, currentOptions);
            await cleanupChat(chatId, sentMsg.message_id);

            // Now delete previous messages
            if (lastMessageId) {
                try { await bot.deleteMessage(chatId, lastMessageId); } catch (e) { }
            }
            try { await bot.deleteMessage(chatId, msg.message_id); } catch (e) { }

            // Update lastMessageId in Firestore
            await userRef.update({
                lastMessageId: sentMsg.message_id,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Removed hideBottomKeyboard to keep main buttons visible
        } catch (error) {
            console.error(error);
        }
        return; // Important: prevent falling through to generic deletion
    }

    // 2. Handle State-based Text Inputs (like transfer)
    if (text && text !== '/start' && text !== 'رصيد البوت 💳' && text !== 'حجز مريض 📓' && text !== 'تواصل مع الدعم 🤖') {
        try {
            const userRef = db.collection('telegram_users').doc(telegramId);
            const doc = await userRef.get();
            if (doc.exists) {
                const userData = doc.data();
                const state = userData.state;

                if (state === 'transfer_awaiting_username') {
                    const searchUsername = text.replace('@', '').trim();
                    const usersSnapshot = await db.collection('telegram_users').where('username', '==', searchUsername).get();

                    if (usersSnapshot.empty) {
                        const errorMsg = await bot.sendMessage(chatId, "❌ لا يمكنك تحويل الرصيد لهذا المستخدم لأنه لم يستخدم البوت من قبل. اخبره بأن يستخدم البوت ثم حاول مجدداً:", {
                            reply_markup: { inline_keyboard: [[{ text: 'إلغاء ❌', callback_data: 'cancel_transfer' }]] }
                        });
                        try { await bot.deleteMessage(chatId, msg.message_id); } catch (e) { }
                        if (userData.lastMessageId) {
                            try { await bot.deleteMessage(chatId, userData.lastMessageId); } catch (e) { }
                        }
                        await userRef.update({ lastMessageId: errorMsg.message_id });
                        return;
                    }

                    const recipientDoc = usersSnapshot.docs[0];
                    if (recipientDoc.id === telegramId) {
                        const errorMsg = await bot.sendMessage(chatId, "❌ لا يمكنك تحويل الرصيد لنفسك! اكتب معرف مستخدم آخر:", {
                            reply_markup: { inline_keyboard: [[{ text: 'إلغاء ❌', callback_data: 'cancel_transfer' }]] }
                        });
                        try { await bot.deleteMessage(chatId, msg.message_id); } catch (e) { }
                        if (userData.lastMessageId) {
                            try { await bot.deleteMessage(chatId, userData.lastMessageId); } catch (e) { }
                        }
                        await userRef.update({ lastMessageId: errorMsg.message_id });
                        return;
                    }

                    await userRef.update({
                        state: 'transfer_awaiting_amount',
                        transferRecipientId: recipientDoc.id,
                        transferRecipientName: recipientDoc.data().name || searchUsername,
                        transferRecipientUsername: searchUsername
                    });

                    const nextMsg = await bot.sendMessage(chatId, `✅ تم العثور على المستخدم: ${recipientDoc.data().name || searchUsername}\n\nاكتب المبلغ الذي تريد تحويله:`, {
                        reply_markup: { inline_keyboard: [[{ text: 'إلغاء ❌', callback_data: 'cancel_transfer' }]] }
                    });
                    try { await bot.deleteMessage(chatId, msg.message_id); } catch (e) { }
                    if (userData.lastMessageId) {
                        try { await bot.deleteMessage(chatId, userData.lastMessageId); } catch (e) { }
                    }
                    await userRef.update({ lastMessageId: nextMsg.message_id });
                    return;
                }
                else if (state === 'transfer_awaiting_amount') {
                    const amount = parseInt(text.trim());
                    if (isNaN(amount) || amount <= 0) {
                        const errorMsg = await bot.sendMessage(chatId, "❌ مبلغ غير صالح. يرجى إدخال رقم صحيح أكبر من صفر:", {
                            reply_markup: { inline_keyboard: [[{ text: 'إلغاء ❌', callback_data: 'cancel_transfer' }]] }
                        });
                        try { await bot.deleteMessage(chatId, msg.message_id); } catch (e) { }
                        if (userData.lastMessageId) {
                            try { await bot.deleteMessage(chatId, userData.lastMessageId); } catch (e) { }
                        }
                        await userRef.update({ lastMessageId: errorMsg.message_id });
                        return;
                    }

                    if (amount > (userData.balance || 0)) {
                        const errorMsg = await bot.sendMessage(chatId, `❌ رصيدك الحالي (${(userData.balance || 0).toLocaleString()} د.ع) لا يكفي لإتمام التحويل.\nاكتب مبلغاً أقل:`, {
                            reply_markup: { inline_keyboard: [[{ text: 'إلغاء ❌', callback_data: 'cancel_transfer' }]] }
                        });
                        try { await bot.deleteMessage(chatId, msg.message_id); } catch (e) { }
                        if (userData.lastMessageId) {
                            try { await bot.deleteMessage(chatId, userData.lastMessageId); } catch (e) { }
                        }
                        await userRef.update({ lastMessageId: errorMsg.message_id });
                        return;
                    }

                    await userRef.update({
                        state: 'transfer_confirm',
                        transferAmount: amount
                    });

                    const confirmMsg = await bot.sendMessage(chatId, `❓ هل انت متأكد من تحويل مبلغ ${amount.toLocaleString()} د.ع الى المستخدم @${userData.transferRecipientUsername}؟`, {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: 'نعم، متأكد ✅', callback_data: 'confirm_transfer_action' }],
                                [{ text: 'إلغاء ❌', callback_data: 'cancel_transfer' }]
                            ]
                        }
                    });

                    try { await bot.deleteMessage(chatId, msg.message_id); } catch (e) { }
                    if (userData.lastMessageId) {
                        try { await bot.deleteMessage(chatId, userData.lastMessageId); } catch (e) { }
                    }
                    await userRef.update({ lastMessageId: confirmMsg.message_id });
                    return;
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    // 1. Handle Photo Uploads for Receipts
    if (msg.photo) {
        try {
            const userRef = db.collection('telegram_users').doc(telegramId);
            const doc = await userRef.get();
            if (doc.exists && doc.data().state === 'awaiting_receipt') {
                const userData = doc.data();

                // Get the largest photo size and build its Telegram URL
                const photo = msg.photo[msg.photo.length - 1];
                const fileId = photo.file_id;
                const fileInfo = await bot.getFile(fileId);
                const telegramFileUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`;

                // Upload to Cloudinary
                let receiptUrl = telegramFileUrl; // fallback
                try {
                    const cloudinaryUrl = await uploadToCloudinary(telegramFileUrl);
                    if (cloudinaryUrl) receiptUrl = cloudinaryUrl;
                    console.log('Uploaded to Cloudinary:', receiptUrl);
                } catch (uploadErr) {
                    console.error('Cloudinary upload failed, using Telegram URL:', uploadErr.message);
                }

                // Save the recharge request to Firestore
                const reqRef = await db.collection('recharge_requests').add({
                    telegramId: telegramId,
                    username: userData.username,
                    name: userData.name,
                    amount: userData.pendingRechargeAmount,
                    status: 'pending',
                    receiptFileId: fileId,
                    receiptUrl: receiptUrl,
                    userDocId: telegramId,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                // Reset user state and save lastRechargeRequestAt for cooldown
                await userRef.update({
                    state: 'idle',
                    pendingRechargeAmount: firebase.firestore.FieldValue.delete(),
                    lastRechargeRequestAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                // Delete the user's photo message to keep chat clean
                try { await bot.deleteMessage(chatId, msg.message_id); } catch (e) { }

                // Change the current menu to a success message
                if (userData.lastMessageId) {
                    bot.editMessageText(`✅ تم استلام طلب التعبئة بمبلغ ${userData.pendingRechargeAmount.toLocaleString()} د.ع بنجاح!\n\nسيتم مراجعة الوصل وإضافة الرصيد إلى حسابك قريباً. سيتم إشعارك فور قبول الطلب.`, {
                        chat_id: chatId,
                        message_id: userData.lastMessageId,
                        reply_markup: {
                            inline_keyboard: [[{ text: 'العودة 🏠', callback_data: 'back_to_balance_menu' }]]
                        }
                    });
                }
                return; // Stop execution
            }
        } catch (e) {
            console.error(e);
        }
    }

    // Finally, delete any other user message to keep chat clean AFTER everything else is done
    if (text !== '/start' && !msg.photo) {
        try {
            await bot.deleteMessage(chatId, msg.message_id);
        } catch (e) { }
    }
});

// Handle inline button clicks (callback queries)
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;
    const telegramId = query.from.id.toString();

    if (data === 'back_to_main') {
        // Show the main menu again with the big bottom keyboard
        await showMainMenu(chatId, telegramId);

        // Delete the current inline message AFTER
        try {
            await bot.deleteMessage(chatId, messageId);
        } catch (e) { }
        return;
    } else if (data === 'check_balance') {
        try {
            const doc = await db.collection('telegram_users').doc(telegramId).get();
            let balance = 0;
            if (doc.exists) {
                balance = doc.data().balance || 0;
            }

            const backToBalanceOptions = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'العودة 🏠', callback_data: 'back_to_balance_menu' }]
                    ]
                }
            };

            bot.editMessageText(`💰 رصيدك الحالي هو: ${balance}`, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: backToBalanceOptions.reply_markup
            });
        } catch (e) { }
    } else if (data === 'back_to_balance_menu' || data === 'cancel_transfer') {
        if (data === 'cancel_transfer') {
            try {
                await db.collection('telegram_users').doc(telegramId).update({
                    state: 'idle',
                    transferRecipientId: firebase.firestore.FieldValue.delete(),
                    transferRecipientName: firebase.firestore.FieldValue.delete(),
                    transferRecipientUsername: firebase.firestore.FieldValue.delete(),
                    transferAmount: firebase.firestore.FieldValue.delete()
                });
            } catch (e) { }
        }

        const text = `💳 معلومات عن رصيد البوت:
🔘 رصيد البوت هو الوسيلة الي من خلاله تكدر تحجز المرضى.
🔘 مجرد امتلاكك لرصيد البوت راح يخليك تكدر تحجز اي مريض مباشرة اذا كنت تحب تكون اول الناس بالحجز و ما تضيع فرصة.
🔘 تكدر تعبي رصيد شكد متريد و راح يبقه محفوظ بالستم اوتوماتيكيا شوكت متحب تستخدمه موجود، يعني لتخاف كلشي محسوب و ما يضيع حقك.
🔘 في حال حجز اي مريض راح فقط يتم خصم مبلغ المريض و الباقي يضل شوكت ما تحب تستخدمه او تضيف عليه.`;

        const options = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'تعبئة رصيد البوت 💵', callback_data: 'add_balance' },
                        { text: 'معرفة رصيد البوت 🤔', callback_data: 'check_balance' }
                    ],
                    [
                        { text: 'تحويل رصيد البوت 📩', callback_data: 'transfer_balance' }
                    ],
                    [
                        { text: 'العودة 🏠', callback_data: 'back_to_main' }
                    ]
                ]
            }
        };

        bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: options.reply_markup
        });
    } else if (data === 'transfer_balance') {
        try {
            const userDoc = await db.collection('telegram_users').doc(telegramId).get();
            const balance = userDoc.exists ? (userDoc.data().balance || 0) : 0;
            if (balance <= 0) {
                return bot.answerCallbackQuery(query.id, { text: "⚠️ لا يوجد لديك رصيد كافٍ للتحويل!", show_alert: true });
            }

            await db.collection('telegram_users').doc(telegramId).update({
                state: 'transfer_awaiting_username',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            const text = "لمن تريد التحويل؟ اكتب معرف المستخدم (بدون @):";
            const options = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'إلغاء ❌', callback_data: 'cancel_transfer' }]
                    ]
                }
            };
            bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: options.reply_markup
            });
        } catch (e) {
            console.error(e);
        }
    } else if (data === 'confirm_transfer_action') {
        try {
            const userRef = db.collection('telegram_users').doc(telegramId);

            const transferResult = await db.runTransaction(async (transaction) => {
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists) throw new Error("المستخدم غير موجود");

                const userData = userDoc.data();
                if (userData.state !== 'transfer_confirm') throw new Error("الطلب غير صالح");

                const amount = userData.transferAmount;
                const recipientId = userData.transferRecipientId;
                const recipientName = userData.transferRecipientName;
                const recipientUsername = userData.transferRecipientUsername;

                if (!amount || amount <= 0) throw new Error("المبلغ غير صالح");
                if ((userData.balance || 0) < amount) throw new Error("رصيدك غير كافٍ");

                const recipientRef = db.collection('telegram_users').doc(recipientId);
                const recipientDoc = await transaction.get(recipientRef);

                if (!recipientDoc.exists) throw new Error("المستلم غير موجود");

                const recipientData = recipientDoc.data();

                transaction.update(userRef, {
                    balance: (userData.balance || 0) - amount,
                    state: 'idle',
                    transferRecipientId: firebase.firestore.FieldValue.delete(),
                    transferRecipientName: firebase.firestore.FieldValue.delete(),
                    transferRecipientUsername: firebase.firestore.FieldValue.delete(),
                    transferAmount: firebase.firestore.FieldValue.delete(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                transaction.update(recipientRef, {
                    balance: (recipientData.balance || 0) + amount,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                const transRef = db.collection('transactions').doc();
                transaction.set(transRef, {
                    type: 'transfer',
                    senderId: telegramId,
                    recipientId: recipientId,
                    amount: amount,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                return { amount, recipientId, recipientName, recipientUsername };
            });

            const text = `✅ تم تحويل مبلغ ${transferResult.amount.toLocaleString()} د.ع بنجاح الى @${transferResult.recipientUsername}.\n\nالمبلغ المخصوم من رصيدك هو: ${transferResult.amount.toLocaleString()} د.ع`;
            bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [[{ text: 'العودة للمحفظة 💼', callback_data: 'back_to_balance_menu' }]]
                }
            });

            try {
                const recipientText = `🎉 وصلتك حوالة رصيد!\n\nتم استلام مبلغ ${transferResult.amount.toLocaleString()} د.ع من قبل المستخدم @${query.from.username || 'بدون معرف'}.\n\nتم اضافة المبلغ الى رصيدك بنجاح ✅`;
                bot.sendMessage(transferResult.recipientId, recipientText);
            } catch (e) { }

        } catch (e) {
            console.error(e);
            bot.answerCallbackQuery(query.id, { text: typeof e === 'string' ? e : (e.message || "حدث خطأ أثناء التحويل"), show_alert: true });
        }
    } else if (data === 'add_balance') {
        try {
            const userRef = db.collection('telegram_users').doc(telegramId);
            const doc = await userRef.get();
            if (doc.exists) {
                const userData = doc.data();
                if (userData.lastRechargeRequestAt) {
                    const lastReq = userData.lastRechargeRequestAt.toMillis();
                    if (Date.now() - lastReq < 5 * 60 * 1000) {
                        const remainingMinutes = Math.ceil((5 * 60 * 1000 - (Date.now() - lastReq)) / 60000);
                        bot.answerCallbackQuery(query.id, { text: `يرجى الانتظار ${remainingMinutes} دقائق قبل تقديم طلب تعبئة جديد.`, show_alert: true });
                        return;
                    }
                }
            }

            const addBalanceOptions = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '5,000', callback_data: 'amount_5000' }, { text: '10,000', callback_data: 'amount_10000' }],
                        [{ text: '15,000', callback_data: 'amount_15000' }, { text: '20,000', callback_data: 'amount_20000' }],
                        [{ text: '25,000', callback_data: 'amount_25000' }, { text: '30,000', callback_data: 'amount_30000' }],
                        [{ text: '35,000', callback_data: 'amount_35000' }, { text: '40,000', callback_data: 'amount_40000' }],
                        [{ text: '45,000', callback_data: 'amount_45000' }, { text: '50,000', callback_data: 'amount_50000' }],
                        [{ text: 'العودة 🏠', callback_data: 'back_to_balance_menu' }]
                    ]
                }
            };

            bot.editMessageText('💰 إختر مبلغ التعبئة:', {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: addBalanceOptions.reply_markup
            });
        } catch (e) {
            console.error(e);
        }
    } else if (data.startsWith('amount_')) {
        const amount = data.split('_')[1];

        // Save the pending amount to the user's document
        try {
            await db.collection('telegram_users').doc(telegramId).update({
                pendingRechargeAmount: parseInt(amount),
                state: 'awaiting_receipt',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            const text = `لإرسال الطلب، قم بتحويل مبلغ ${parseInt(amount).toLocaleString()} د.ع الى احد الحسابات ادناه:

زين كاش: 07733940374
ماستر كارد: 7137393513

ثم قم (هنا في هذه الرسالة) بإرسال صورة/صور (فقط) للوصل خلال ساعات من تأريخ الدفع لإثبات الدفع وبعد الموافقة سيتم تحويل المبلغ تلقائيا الى رصيدك وسيتم اعلامك حال حدوث ذلك.`;

            const backToAmountsOptions = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'العودة 🏠', callback_data: 'add_balance' }]
                    ]
                }
            };

            bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: backToAmountsOptions.reply_markup
            });
        } catch (e) {
            console.error(e);
        }
    }

    // --- Patient Booking Logic ---
    if (data.startsWith('prov_')) {
        const prov = data.replace('prov_', '');
        if (!userSessions[chatId]) userSessions[chatId] = { cases: [], days: [], lastMessageId: messageId };
        userSessions[chatId].province = prov;
        showProvinceSelection(chatId, true);
    }
    else if (data === 'prev_to_prov') {
        showProvinceSelection(chatId, true);
    }
    else if (data === 'next_province') {
        if (!userSessions[chatId] || !userSessions[chatId].province) {
            return bot.answerCallbackQuery(query.id, { text: "⚠️ يرجى اختيار محافظة واحدة فقط!", show_alert: true });
        }
        showCaseSelection(chatId);
    }
    else if (data.startsWith('case_')) {
        const caseId = data.replace('case_', '');
        if (!userSessions[chatId]) userSessions[chatId] = { cases: [], days: [], lastMessageId: messageId };
        if (userSessions[chatId].cases.includes(caseId)) {
            userSessions[chatId].cases = userSessions[chatId].cases.filter(c => c !== caseId);
        } else {
            userSessions[chatId].cases.push(caseId);
        }
        showCaseSelection(chatId, true);
    }
    else if (data === 'prev_to_cases') {
        showCaseSelection(chatId, true);
    }
    else if (data === 'next_cases') {
        if (!userSessions[chatId] || userSessions[chatId].cases.length === 0) {
            return bot.answerCallbackQuery(query.id, { text: "⚠️ يرجى اختيار حالة واحدة على الأقل!", show_alert: true });
        }
        showDaySelection(chatId);
    }
    else if (data.startsWith('day_')) {
        const day = data.replace('day_', '');
        if (!userSessions[chatId]) userSessions[chatId] = { cases: [], days: [], lastMessageId: messageId };
        if (day === 'All') {
            userSessions[chatId].days = ['All Days'];
        } else {
            userSessions[chatId].days = userSessions[chatId].days.filter(d => d !== 'All Days');
            if (userSessions[chatId].days.includes(day)) {
                userSessions[chatId].days = userSessions[chatId].days.filter(d => d !== day);
            } else {
                userSessions[chatId].days.push(day);
            }
        }
        showDaySelection(chatId, true);
    }
    else if (data === 'next_days') {
        if (!userSessions[chatId] || userSessions[chatId].days.length === 0) {
            return bot.answerCallbackQuery(query.id, { text: "⚠️ يرجى اختيار يوم واحد على الأقل!", show_alert: true });
        }
        userSessions[chatId].currentIndex = 0;
        searchAndShowPatients(chatId, query.id);
        return;
    }
    else if (data === 'next_patient') {
        if (userSessions[chatId] && userSessions[chatId].results && userSessions[chatId].currentIndex < userSessions[chatId].results.length - 1) {
            userSessions[chatId].currentIndex++;
            showPatientResult(chatId);
        } else {
            bot.answerCallbackQuery(query.id, { text: "لا توجد حالات اخرى 🥲", show_alert: true }).catch(() => { });
        }
        return;
    }
    else if (data === 'prev_patient') {
        if (userSessions[chatId] && userSessions[chatId].results && userSessions[chatId].currentIndex > 0) {
            userSessions[chatId].currentIndex--;
            showPatientResult(chatId);
        } else {
            bot.answerCallbackQuery(query.id, { text: "لا توجد حالات اخرى 🥲", show_alert: true }).catch(() => { });
        }
        return;
    }
    else if (data.startsWith('book_')) {
        const patientId = data.replace('book_', '');
        console.log(`User ${telegramId} clicked book for patient ${patientId}`);
        await showBookingConfirmation(chatId, telegramId, patientId, query.id);
        return;
    }
    else if (data.startsWith('confirm_book_')) {
        const patientId = data.replace('confirm_book_', '');
        console.log(`User ${telegramId} confirmed booking for patient ${patientId}`);
        await handleBooking(chatId, telegramId, patientId, query.id);
        return;
    }

    // Acknowledge the button click so it stops loading for any other cases not handled above
    try { await bot.answerCallbackQuery(query.id); } catch (e) { }
});


// Helper functions for Patient Booking
function showProvinceSelection(chatId, isUpdate = false) {
    const session = userSessions[chatId];
    const keyboard = [];
    for (let i = 0; i < ARABIC_PROVINCES.length; i += 2) {
        const row = [];
        const p1 = ARABIC_PROVINCES[i];
        const p2 = ARABIC_PROVINCES[i + 1];
        row.push({ text: `${session.province === p1.id ? '✅ ' : ''}${p1.label}`, callback_data: `prov_${p1.id}` });
        if (p2) row.push({ text: `${session.province === p2.id ? '✅ ' : ''}${p2.label}`, callback_data: `prov_${p2.id}` });
        keyboard.push(row);
    }
    keyboard.push([
        { text: 'التالي ⏮', callback_data: 'next_province' },
        { text: '🏠 العودة 🏠', callback_data: 'back_to_main' }
    ]);
    const text = "📍 إختر محافظة واحدة فقط";
    const opts = { chat_id: chatId, message_id: session.lastMessageId, reply_markup: { inline_keyboard: keyboard } };
    if (isUpdate) {
        bot.editMessageText(text, opts).catch(() => { });
    } else {
        bot.editMessageText(text, opts).catch(async () => {
            const sentMsg = await bot.sendMessage(chatId, text, { reply_markup: { inline_keyboard: keyboard } });
            session.lastMessageId = sentMsg.message_id;
        });
    }
}

function showCaseSelection(chatId, isUpdate = false) {
    const session = userSessions[chatId];
    const keyboard = [];
    for (let i = 0; i < ARABIC_CASES.length; i += 2) {
        const row = [];
        const c1 = ARABIC_CASES[i];
        const c2 = ARABIC_CASES[i + 1];
        row.push({ text: `${session.cases.includes(c1.id) ? '✅ ' : ''}${c1.label}`, callback_data: `case_${c1.id}` });
        if (c2) row.push({ text: `${session.cases.includes(c2.id) ? '✅ ' : ''}${c2.label}`, callback_data: `case_${c2.id}` });
        keyboard.push(row);
    }
    keyboard.push([
        { text: 'التالي ⏮', callback_data: 'next_cases' },
        { text: '🏠 العودة 🏠', callback_data: 'back_to_main' },
        { text: 'السابق ⏮', callback_data: 'prev_to_prov' }
    ]);
    const text = "🦷 إختر الحالات المطلوبة";
    bot.editMessageText(text, { chat_id: chatId, message_id: session.lastMessageId, reply_markup: { inline_keyboard: keyboard } }).catch(() => { });
}

function showDaySelection(chatId, isUpdate = false) {
    const session = userSessions[chatId];
    const keyboard = [];
    for (let i = 0; i < ARABIC_DAYS.length; i += 2) {
        const row = [];
        const d1 = ARABIC_DAYS[i];
        const d2 = ARABIC_DAYS[i + 1];
        row.push({ text: `${session.days.includes(d1.id) ? '✅ ' : ''}${d1.label}`, callback_data: `day_${d1.id}` });
        if (d2) row.push({ text: `${session.days.includes(d2.id) ? '✅ ' : ''}${d2.label}`, callback_data: `day_${d2.id}` });
        keyboard.push(row);
    }
    keyboard.push([{ text: `${session.days.includes('All Days') ? '✅ ' : ''}جميع الايام`, callback_data: 'day_All' }]);
    keyboard.push([
        { text: 'التالي ⏮', callback_data: 'next_days' },
        { text: '🏠 العودة 🏠', callback_data: 'back_to_main' },
        { text: 'السابق ⏮', callback_data: 'prev_to_cases' }
    ]);
    const text = "📅 إختر ايام العيادات";
    bot.editMessageText(text, { chat_id: chatId, message_id: session.lastMessageId, reply_markup: { inline_keyboard: keyboard } }).catch(() => { });
}

async function searchAndShowPatients(chatId, queryId) {
    const session = userSessions[chatId];
    if (!session) return;

    const searchingMsg = await bot.sendMessage(chatId, "🔍 جاري البحث عن حالات مطابقة...");
    session.searchingMessageId = searchingMsg.message_id;

    try {
        console.log(`Searching patients in ${session.province} for cases: ${session.cases} and days: ${session.days}`);
        const snapshot = await db.collection('patients')
            .where('governorate', '==', session.province)
            .where('status', '==', 'Available')
            .get();

        console.log(`Found ${snapshot.size} Available patients in ${session.province}`);

        let matches = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            const pCases = data.caseTypes || [];
            const pDaysStr = data.clinicDays || '';

            // 1. Case Filtering
            const hasCase = Array.isArray(pCases) && pCases.some(c => session.cases.includes(c));

            // 2. Day Filtering
            let hasDay = false;
            if (session.days.includes('All Days')) {
                hasDay = true;
            } else {
                const pDays = pDaysStr.split(', ').map(d => d.trim());
                hasDay = pDays.includes('All Days') || pDays.some(d => session.days.includes(d));
            }

            if (hasCase && hasDay) {
                matches.push({ id: doc.id, ...data });
            }
        });

        console.log(`Total filtered matches: ${matches.length}`);

        // Delete "Searching..." message
        try { await bot.deleteMessage(chatId, session.searchingMessageId); } catch (e) { }

        if (matches.length === 0) {
            if (queryId) {
                bot.answerCallbackQuery(queryId, { text: "لا يوجد نتائج حالياً 🥲", show_alert: true }).catch(() => { });
            }

            const noResultsText = `❌ عذراً، لم نجد أي حالات "متاحة" تطابق خياراتك حالياً:
📍 المحافظة: ${ARABIC_PROVINCES.find(p => p.id === session.province)?.label || session.province}
🦷 الحالات: ${session.cases.map(c => ARABIC_CASES.find(x => x.id === c)?.label || c).join(', ')}
📅 الأيام: ${session.days.includes('All Days') ? 'جميع الأيام' : session.days.map(d => ARABIC_DAYS.find(x => x.id === d)?.label || d).join(', ')}

يرجى المحاولة لاحقاً أو تغيير الفلاتر.`;

            const sentMsg = await bot.sendMessage(chatId, noResultsText, backButtonOptions);
            session.lastMessageId = sentMsg.message_id;
            return;
        }

        session.results = matches;
        session.currentIndex = 0;
        session.resultMessages = []; // Track IDs of messages sent for this result
        showPatientResult(chatId);

    } catch (e) {
        console.error(e);
        bot.sendMessage(chatId, "حدث خطأ أثناء البحث.");
    }
}

async function showPatientResult(chatId) {
    const session = userSessions[chatId];
    const p = session.results[session.currentIndex];

    // Keep track of old messages to delete AFTER sending new results
    const oldLastMessageId = session.lastMessageId;
    const oldResultMessages = session.resultMessages ? [...session.resultMessages] : [];

    session.lastMessageId = null;
    session.resultMessages = [];

    const rawPhones = p.phoneNumbers || [];
    let maskedPhones = 'رقم مخفي';
    if (rawPhones.length > 0) maskedPhones = rawPhones.map(num => num.substring(0, 6) + 'XXXX').join(' | ');

    // Translation helpers
    const translateProv = (id) => ARABIC_PROVINCES.find(x => x.id === id)?.label || id;
    const translateCase = (id) => ARABIC_CASES.find(x => x.id === id)?.label || id;
    const translateDay = (id) => {
        if (id === 'All Days') return 'جميع الايام';
        return ARABIC_DAYS.find(x => x.id === id)?.label || id;
    };

    const translatedProv = translateProv(p.governorate);
    const translatedCases = (p.caseTypes || []).map(translateCase).join(' | ');
    const translatedDays = (p.clinicDays || '').split(', ').map(d => translateDay(d.trim())).join(', ');

    const text = `📍 المحافظة: ${translatedProv} | ${p.city || 'غير محدد'}
🦷 الحالة: ${translatedCases}
👥 عدد الاشخاص: ${p.numberOfPersons || 1}
📅 ايام التواجد: ${translatedDays}
☎️ الرقم: \`${maskedPhones}\`
📝 ملاحظة: ${p.notes || 'لا يوجد'}`;

    const keyboard = [
        [{ text: `🔄 🟢 ${(p.price || 0).toLocaleString()} د.ع 🟢 🔄`, callback_data: `book_${p.id}` }],
        [
            { text: 'التالي ⏮', callback_data: 'next_patient' },
            { text: '🏠 العودة 🏠', callback_data: 'back_to_main' },
            { text: 'السابق ⏮', callback_data: 'prev_patient' }
        ]
    ];

    const opts = { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } };
    let rawImages = [];
    if (Array.isArray(p.imageUrls)) rawImages = p.imageUrls;
    else if (typeof p.imageUrls === 'string') rawImages = [p.imageUrls];
    else if (p.imageUrl) rawImages = [p.imageUrl];

    const images = rawImages.filter(url => {
        return url && (typeof url === 'string') && (
            url.startsWith('http') ||
            url.startsWith('https') ||
            url.startsWith('//') ||
            url.startsWith('data:image')
        );
    }).map(url => {
        if (url.startsWith('//')) return `https:${url}`;
        if (url.startsWith('data:image')) {
            try {
                const parts = url.split(',');
                if (parts.length > 1) {
                    const base64Data = parts[1];
                    return Buffer.from(base64Data, 'base64');
                }
            } catch (e) {
                console.error("Failed to parse base64 image:", e.message);
            }
        }
        return url;
    });

    try {
        if (images.length > 1) {
            // 1. Send the gallery (photos only)
            const media = images.map(img => ({ type: 'photo', media: img }));
            const mediaGroup = await bot.sendMediaGroup(chatId, media);
            mediaGroup.forEach(m => session.resultMessages.push(m.message_id));

            // 2. Send the details with the keyboard
            const detailsMsg = await bot.sendMessage(chatId, text, opts);
            session.resultMessages.push(detailsMsg.message_id);
        } else if (images.length === 1) {
            const photoMsg = await bot.sendPhoto(chatId, images[0], { caption: text, ...opts });
            session.resultMessages.push(photoMsg.message_id);
        } else {
            const textMsg = await bot.sendMessage(chatId, text, opts);
            session.resultMessages.push(textMsg.message_id);
        }
    } catch (sendError) {
        console.error("Error sending patient result:", sendError.message);
        console.log("Attempting high-reliability fallback for images...");

        try {
            // Send the text details first
            const textMsg = await bot.sendMessage(chatId, text, opts);
            session.resultMessages.push(textMsg.message_id);

            // Try to deliver each image with downloading fallback
            if (images.length > 0) {
                for (const img of images) {
                    try {
                        if (Buffer.isBuffer(img)) {
                            // Already a Buffer (from Base64)
                            const imgMsg = await bot.sendPhoto(chatId, img);
                            session.resultMessages.push(imgMsg.message_id);
                        } else {
                            // It's a URL, try downloading and sending as Buffer (more reliable)
                            try {
                                const buffer = await downloadImage(img);
                                const imgMsg = await bot.sendPhoto(chatId, buffer);
                                session.resultMessages.push(imgMsg.message_id);
                            } catch (e) {
                                // If download fails, try sending URL directly as absolute last resort
                                const imgMsg = await bot.sendPhoto(chatId, img);
                                session.resultMessages.push(imgMsg.message_id);
                            }
                        }
                    } catch (e) {
                        console.error(`Failed to deliver image: ${e.message}`);
                    }
                }
            }
        } catch (finalError) {
            console.error("Critical failure in showPatientResult:", finalError.message);
        }
    }

    // Now delete old messages AFTER new ones are sent
    if (oldLastMessageId) {
        await cleanupChat(chatId, oldLastMessageId);
        try { await bot.deleteMessage(chatId, oldLastMessageId); } catch (e) { }
    }
    if (oldResultMessages && oldResultMessages.length > 0) {
        for (const mid of oldResultMessages) {
            try { await bot.deleteMessage(chatId, mid); } catch (e) { }
        }
    }
}

async function showBookingConfirmation(chatId, telegramId, patientId, queryId) {
    // 1. Answer immediately to stop the loading spinner and prevent UI glitches
    if (queryId) try { await bot.answerCallbackQuery(queryId); } catch (e) { }

    try {
        const userDoc = await db.collection('telegram_users').doc(telegramId).get();
        const patientDoc = await db.collection('patients').doc(patientId).get();

        if (!userDoc.exists || !patientDoc.exists) return;

        const userData = userDoc.data();
        const patientData = patientDoc.data();
        const price = patientData.price || 0;

        if ((userData.balance || 0) < price) {
            return bot.sendMessage(chatId, "⚠️ لا يوجد رصيد كافي يرجى التعبئة و المحاولة مجددا");
        }

        const session = userSessions[chatId];
        const oldResultMessages = (session && session.resultMessages) ? [...session.resultMessages] : [];
        if (session) session.resultMessages = [];

        const termsText = `⚖️ *قبل الحجز*

* تأكد العنوان: البيشنت أقل من ٥ كم منك أو إنت الأقرب إله في حال هو بعيد اصلا
* تأكد من أيام تواجدك وأيام تواجده.
* راجع الحالة + العمر + الملاحظات وكل التفاصيل المهمة.
――――――――――
💳 *الرصيد والحجز*

* الحجز يحتاج رصيد بالبوت.
* من تضغط “تأكيد” ينخصم مبلغ البيشنت فوراً من رصيدك.
* بعد التأكيد يطلعلك تفاصيل البيشنت ورقمه.
――――――――――
📞 *التواصل والالتزام*

* لازم تتواصل ويا البيشنت خلال 24 ساعة، وإلا يسقط حقك بالتعويض.
* إذا ما رد: حاول خلال 48 ساعة وبأوقات مختلفة.
* احتفظ بسكرينات تثبت محاولات الاتصال.
――――――――――
💬 *شلون تبدي الحچي ويا البيشنت*

* ابدي دائماً: “حضرتك طالب/ة علاج أسنانك؟”
* بعدها: “وياك دكتور/ة (فلان)، نحدد موعد يوم (كذا) بمكان (كذا) باعتباره الأقرب إلك حتى نسويلك معاينة ونبدي.”
* ممنوع تذكر: قناة/منشور/بوت/فلوس/حجز حفاظاً على الخصوصية وسمعتك.
――――――――――
🦷 *أسلوب التعامل الطبي*

* لا تبدي بسالفة القلع بالبداية حتى لو الحالة أكزو.
* اسأله: “شنو تحتاج بالضبط؟” وخلي الشكوى بكلامه هو.
* كوله: “نحدد موعد نسوي معاينة ونبدي.”
* يوم يجي: افحص بهدوء، وبعدين وضّح ببساطة: “هاي جذور، ما يصير طخم فوكاهم” واشرح خطوة خطوة.
* إذا سأل عن الزراعة: “مو متوفرة عدنه، بالعيادات الخاصة وعلى حسابك، تقريباً ٣٥٠$ للسن الواحد” وبعدها: “المتوفر عدنه طخم متحرك.”
* شرح الطخم المتحرك: “يتشال بس قبل النوم، مو قبل الأكل، ويعتبر دائمي ويمشي سنين.”
――――――――――
⚠️ *أخطاء لازم تتجنبها*

* الاستعجال بالحچي.
* مصطلحات طبية هواي.
* تخويف البيشنت بالبداية.
* عدم سماع كلامه زين.
* تذكر: البيشنت يحب ينسمع قبل لا ينفهم.
――――――――――
🛡 *التعويض*

* تگدر تطلب تعويض من الدعم بأي وقت إذا الخلل مو منك.
* دزلنه الكيس للادارة و سكرينات تثبت المشكلة.
* أي مخالفة للشروط أعلاه تسقط حقك بالتعويض.
――――――――――
📸 *التوثيق*

* صوّر قبل/بعد العلاج.
* أخذ رأي البيشنت بفيديو قصير و ارسلهم النه.
* مقابل التوثيق يرجعلك نص مبلغ البيشنت رصيد بحسابك.
* وإذا تحب ننشر الحالة بالقناة بدون كشف هوية البيشنت.
――――――――――
📒 *لإتمام الحجز إضغط "تأكيد الحجز"*`;

        const keyboard = [
            [{ text: '✅ تأكيد الحجز ✅', callback_data: `confirm_book_${patientId}` }],
            [
                { text: 'السابق ⏮', callback_data: 'prev_patient' },
                { text: 'العودة 🏠', callback_data: 'back_to_main' }
            ]
        ];

        const sentMsg = await bot.sendMessage(chatId, termsText, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } });
        await cleanupChat(chatId, sentMsg.message_id);
        if (session) session.lastMessageId = sentMsg.message_id;

        // Delete previous result messages AFTER showing confirmation
        if (oldResultMessages.length > 0) {
            for (const mid of oldResultMessages) {
                try { await bot.deleteMessage(chatId, mid); } catch (e) { }
            }
        }

    } catch (e) {
        console.error(e);
    }
}

async function handleBooking(chatId, telegramId, patientId, queryId) {
    try {
        const userRef = db.collection('telegram_users').doc(telegramId);
        const patientRef = db.collection('patients').doc(patientId);

        let successData = null;

        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            const patientDoc = await transaction.get(patientRef);

            if (!userDoc.exists || !patientDoc.exists) throw "بيانات مفقودة ❌";

            const userData = userDoc.data();
            const patientData = patientDoc.data();
            const price = patientData.price || 0;

            if (patientData.status !== 'Available') throw "هذه الحالة لم تعد متوفرة ❌";
            if ((userData.balance || 0) < price) throw "لا يوجد رصيد كافي يرجى التعبئة و المحاولة مجددا";

            const newBalance = userData.balance - price;

            // Transactional Updates
            transaction.update(userRef, {
                balance: newBalance,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            transaction.update(patientRef, {
                status: 'Used',
                bookedBy: telegramId,
                bookedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Log Transaction
            const transRef = db.collection('transactions').doc();
            const logProv = ARABIC_PROVINCES.find(x => x.id === patientData.governorate)?.label || patientData.governorate || 'غير محدد';
            const logName = patientData.patientName || 'مريض';

            transaction.set(transRef, {
                telegramId: telegramId.toString(),
                type: 'purchase',
                amount: -price,
                details: `حجز مريض: ${logName} (${logProv})`,
                relatedId: patientId,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Log to System Activity for Main Admin
            const systemLogRef = db.collection('system_logs').doc();
            transaction.set(systemLogRef, {
                type: 'telegram_booking',
                details: `حجز مريض: ${logName} (${logProv}) من قبل المستخدم (${userData.username || telegramId})`,
                userName: userData.username || 'Telegram User',
                userId: telegramId.toString(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Prepare success data for outside use
            const translateProv = (id) => ARABIC_PROVINCES.find(x => x.id === id)?.label || id;
            const translateCase = (id) => ARABIC_CASES.find(x => x.id === id)?.label || id;
            const translateDay = (id) => (id === 'All Days' ? 'جميع الايام' : ARABIC_DAYS.find(x => x.id === id)?.label || id);

            const images = patientData.imageUrls || (patientData.imageUrl ? [patientData.imageUrl] : []);

            successData = {
                price,
                newBalance,
                patientName: patientData.patientName || 'غير متوفر',
                images: images,
                phoneNumbers: (patientData.phoneNumbers || []).join(' | '),
                location: `${translateProv(patientData.governorate)} | ${patientData.city || 'غير محدد'}`,
                cases: (patientData.caseTypes || []).map(translateCase).join(' | '),
                days: (patientData.clinicDays || '').split(', ').map(d => translateDay(d.trim())).join(', '),
                notes: patientData.notes || 'لا يوجد'
            };
        });

        // After transaction success
        if (successData) {
            const successText = `✅ *تم الحجز بنجاح وتم خصم المبلغ من رصيدك*
━━━━━━━━━━━━━━
💰 *المبلغ المخصوم:* ${successData.price.toLocaleString()} د.ع
💳 *رصيدك المتبقي:* ${successData.newBalance.toLocaleString()} د.ع

💎 *بيانات المريض بالكامل:*
👤 *اسم المريض:* ${successData.patientName}
☎️ *رقم الهاتف:* \`${successData.phoneNumbers}\`
📍 *المحافظة:* ${successData.location}
🦷 *الحالة:* ${successData.cases}
📅 *ايام التواجد:* ${successData.days}
📝 *ملاحظة:* ${successData.notes}
━━━━━━━━━━━━━━
⚠️ *ملاحظة:* يرجى التواصل مع المريض فوراً لترتيب الموعد.`;

            const session = userSessions[chatId];
            const options = {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: 'العودة للقائمة الرئيسية 🏠', callback_data: 'back_to_main' }]]
                }
            };

            // Robust image delivery for booking success
            let rawImages = [];
            if (Array.isArray(successData.images)) rawImages = successData.images;
            else if (typeof successData.images === 'string') rawImages = [successData.images];

            const processedImages = rawImages.filter(url => {
                return url && (typeof url === 'string') && (
                    url.startsWith('http') ||
                    url.startsWith('https') ||
                    url.startsWith('//') ||
                    url.startsWith('data:image')
                );
            }).map(url => {
                if (url.startsWith('//')) return `https:${url}`;
                if (url.startsWith('data:image')) {
                    try {
                        const parts = url.split(',');
                        if (parts.length > 1) return Buffer.from(parts[1], 'base64');
                    } catch (e) { console.error("Base64 parse error:", e); }
                }
                return url;
            });

            try {
                if (processedImages.length > 1) {
                    // Try media group
                    try {
                        const media = processedImages.map(img => ({ type: 'photo', media: img }));
                        const mediaGroup = await bot.sendMediaGroup(chatId, media);
                        if (session) mediaGroup.forEach(m => session.resultMessages.push(m.message_id));

                        const detailsMsg = await bot.sendMessage(chatId, successText, options);
                        if (session) session.resultMessages.push(detailsMsg.message_id);
                    } catch (mediaError) {
                        // Fallback to text + individual photos
                        const detailsMsg = await bot.sendMessage(chatId, successText, options);
                        if (session) session.resultMessages.push(detailsMsg.message_id);
                        for (const img of processedImages) {
                            try {
                                const buffer = Buffer.isBuffer(img) ? img : (img.startsWith('http') ? await downloadImage(img) : img);
                                const imgMsg = await bot.sendPhoto(chatId, buffer);
                                if (session) session.resultMessages.push(imgMsg.message_id);
                            } catch (e) { console.log("Success image fallback fail:", e.message); }
                        }
                    }
                } else if (processedImages.length === 1) {
                    try {
                        const img = processedImages[0];
                        const buffer = Buffer.isBuffer(img) ? img : (img.startsWith('http') ? await downloadImage(img) : img);
                        const sentMsg = await bot.sendPhoto(chatId, buffer, { caption: successText, ...options });
                        if (session) session.resultMessages.push(sentMsg.message_id);
                    } catch (photoError) {
                        const sentMsg = await bot.sendMessage(chatId, successText, options);
                        if (session) session.resultMessages.push(sentMsg.message_id);
                    }
                } else {
                    const sentMsg = await bot.sendMessage(chatId, successText, options);
                    if (session) session.resultMessages.push(sentMsg.message_id);
                }
            } catch (deliveryError) {
                console.error("Booking success delivery error:", deliveryError);
                // Last ditch effort: send just text
                await bot.sendMessage(chatId, successText, options).catch(e => console.error("Final fail:", e));
            }

            // Delete terms message
            if (session && session.lastMessageId) {
                bot.deleteMessage(chatId, session.lastMessageId).catch(() => { });
            }
        }

    } catch (e) {
        console.error(e);
        bot.answerCallbackQuery(queryId, { text: typeof e === 'string' ? e : "حدث خطأ أثناء الحجز", show_alert: true });
    }
}

// Global listener for pending notifications from admin dashboard
// When admin updates balance or approves recharge, a doc is written to 'pending_notifications'.
// The bot picks it up, sends the Telegram message, and marks it as 'sent'.
db.collection('pending_notifications').where('status', '==', 'pending').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
            const notifDoc = change.doc;
            const notif = notifDoc.data();
            const telegramId = notif.telegramId;
            if (!telegramId) return;

            try {
                const userRef = db.collection('telegram_users').doc(telegramId);
                const userDoc = await userRef.get();
                const userData = userDoc.exists ? userDoc.data() : {};

                // 1. Cleanup old messages if requested
                if (notif.cleanupOldMessage && notif.oldMessageId) {
                    const baseId = parseInt(notif.oldMessageId);
                    for (let i = 0; i <= 5; i++) {
                        try {
                            await bot.deleteMessage(telegramId, (baseId - i).toString());
                        } catch (e) { /* message might already be deleted */ }
                    }
                }

                // Also delete any result messages if user is in a search session
                const session = userSessions[telegramId];
                if (session && session.resultMessages) {
                    for (const mid of session.resultMessages) {
                        try { await bot.deleteMessage(telegramId, mid); } catch (e) { }
                    }
                    session.resultMessages = [];
                }

                // 2. Send the notification message
                const keyboard = {
                    inline_keyboard: [[{ text: 'العودة للواجهة الرئيسية 🏠', callback_data: 'back_to_main' }]]
                };

                const sentMsg = await bot.sendMessage(telegramId, notif.text, {
                    reply_markup: keyboard
                });

                // 3. Update lastMessageId in user's Firestore doc
                if (userDoc.exists) {
                    await userRef.update({
                        lastMessageId: sentMsg.message_id,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }

                // 4. Mark notification as sent (so it won't be processed again)
                await db.collection('pending_notifications').doc(notifDoc.id).update({
                    status: 'sent',
                    sentAt: firebase.firestore.FieldValue.serverTimestamp(),
                    sentMessageId: sentMsg.message_id
                });

                console.log(`✅ Notification sent to ${telegramId} (type: ${notif.type})`);
            } catch (err) {
                console.error(`❌ Failed to process notification for ${telegramId}:`, err);
                // Mark as failed so we can debug later
                try {
                    await db.collection('pending_notifications').doc(notifDoc.id).update({
                        status: 'failed',
                        error: err.message || String(err),
                        failedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                } catch (e) { }
            }
        }
    });
});

// Helper to download image from URL to Buffer
function downloadImage(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Status ${res.statusCode}`));
                return;
            }
            const data = [];
            res.on('data', (chunk) => data.push(chunk));
            res.on('end', () => resolve(Buffer.concat(data)));
        }).on('error', reject);
    });
}

console.log("Bot is running...");
