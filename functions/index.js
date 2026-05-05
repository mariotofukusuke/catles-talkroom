const { onValueCreated } = require('firebase-functions/v2/database');
const { initializeApp }  = require('firebase-admin/app');
const { getDatabase }    = require('firebase-admin/database');
const { getMessaging }   = require('firebase-admin/messaging');

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

    // FCMトークン取得
    const tokenSnap = await db.ref(`rooms/${roomId}/fcmTokens/${recipientRole}`).get();
    const token = tokenSnap.val();
    if (!token) return null;

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

    try {
      await getMessaging().send({
        token,
        notification: {
          title: `${senderName} からメッセージ`,
          body
        },
        webpush: {
          fcmOptions: {
            link: `https://catles-talkroom.web.app/?room=${roomId}&role=${recipientRole}`
          }
        }
      });
    } catch (e) {
      // 無効トークンを削除
      if (e.code === 'messaging/registration-token-not-registered') {
        await db.ref(`rooms/${roomId}/fcmTokens/${recipientRole}`).remove();
      } else {
        console.error('FCM送信エラー:', e);
      }
    }

    return null;
  }
);
