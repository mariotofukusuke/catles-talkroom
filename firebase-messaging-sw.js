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

firebase.messaging();
