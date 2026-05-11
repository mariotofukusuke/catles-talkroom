const { onValueCreated } = require('firebase-functions/v2/database');
const { initializeApp }  = require('firebase-admin/app');
const { getDatabase }    = require('firebase-admin/database');
const { getMessaging }   = require('firebase-admin/messaging');
const crypto             = require('crypto');

initializeApp();

exports.sendPushOnMessage = onValueCreated(
  {
    ref: 'rooms/{roomId}/messages/{messageId}',
    region: 'asia-southeast1',
    instance: 'catles-talkroom-default-rtdb'
  },
  async (event) => {
    const { roomId } = event.params;
    const msg = event.data.val();
    if (!msg || !msg.role) return null;

    const senderRole    = msg.role;
    const recipientRole = senderRole === 'seller' ? 'buyer' : 'seller';
    const db = getDatabase();

    // 受信者がトークルームを開いていたら通知しない
    const presenceSnap = await db.ref(`rooms/${roomId}/presence/${recipientRole}`).get();
    if (presenceSnap.val() === true) return null;

    // FCMトークン取得（sellerはグローバル多端末、buyerはルーム単位）
    let tokens;
    if (recipientRole === 'seller') {
      const snap = await db.ref('sellerFcmTokens').get();
      const obj = snap.val() || {};
      tokens = Object.entries(obj).map(([key, token]) => ({
        token,
        cleanupRef: db.ref(`sellerFcmTokens/${key}`)
      }));
    } else {
      const snap = await db.ref(`rooms/${roomId}/fcmTokens/buyer`).get();
      const token = snap.val();
      tokens = token
        ? [{ token, cleanupRef: db.ref(`rooms/${roomId}/fcmTokens/buyer`) }]
        : [];
    }
    if (!tokens.length) return null;

    // 注文情報（表示名に使用）
    const infoSnap = await db.ref(`rooms/${roomId}/info`).get();
    const info = infoSnap.val() || {};

    const senderName = senderRole === 'seller'
      ? 'CATLES'
      : (info.buyerName || 'お客様');

    const body = msg.text
      ? msg.text.slice(0, 80)
      : msg.imageUrl
        ? 'ファイルが届きました'
        : 'メッセージが届きました';

    const link = `https://mariotofukusuke.github.io/catles-talkroom/catles-talkroom_v2.html?room=${roomId}&role=${recipientRole}`;

    await Promise.all(tokens.map(async ({ token, cleanupRef }) => {
      try {
        await getMessaging().send({
          token,
          notification: {
            title: `${senderName} からメッセージ`,
            body
          },
          webpush: {
            headers: { Urgency: 'high' },
            notification: {
              icon: 'https://mariotofukusuke.github.io/catles-talkroom/icon-192.png',
              badge: 'https://mariotofukusuke.github.io/catles-talkroom/badge-72.png'
            },
            fcmOptions: { link }
          }
        });
      } catch (e) {
        if (e.code === 'messaging/registration-token-not-registered') {
          await cleanupRef.remove();
        } else {
          console.error('FCM送信エラー:', e);
        }
      }
    }));

    return null;
  }
);

exports.generateRoomToken = onValueCreated(
  {
    ref: 'rooms/{roomId}/info',
    region: 'asia-southeast1',
    instance: 'catles-talkroom-default-rtdb'
  },
  async (event) => {
    const { roomId } = event.params;
    const db = getDatabase();
    const tokenRef = db.ref(`rooms/${roomId}/token`);

    const existing = await tokenRef.get();
    if (existing.exists()) return null;

    const token = crypto.randomBytes(32).toString('hex');
    await tokenRef.set(token);
    return null;
  }
);

exports.shopifyOrdersCreate = require('./shopify-orders-create').shopifyOrdersCreate;
