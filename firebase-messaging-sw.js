importScripts('https://www.gstatic.com/firebasejs/12.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAABNAG7dbMMvuVnwgYtqXvFxnzVum6nQA",
  authDomain: "catles-talkroom.firebaseapp.com",
  databaseURL: "https://catles-talkroom-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "catles-talkroom",
  storageBucket: "catles-talkroom.firebasestorage.app",
  messagingSenderId: "1078200374386",
  appId: "1:1078200374386:web:b974b2fa56c08b56b3deeb"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const data = payload.data || {};
  const title = data.title || '新しいメッセージ';
  const body  = data.body  || 'メッセージが届きました';
  self.registration.showNotification(title, {
    body,
    icon: 'https://mariotofukusuke.github.io/catles-talkroom/icon-192.png',
    badge: 'https://mariotofukusuke.github.io/catles-talkroom/badge-72.png',
    data: { link: data.link }
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const link = event.notification.data?.link;
  if (!link) return;
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      if (client.url.includes(link) && 'focus' in client) return client.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow(link);
  })());
});
