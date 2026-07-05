importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDfaFRkI54m7T4gvhd9nDGNeahFQtaXJtk",
  authDomain: "csep-bce3c.firebaseapp.com",
  projectId: "csep-bce3c",
  storageBucket: "csep-bce3c.firebasestorage.app",
  messagingSenderId: "206099383232",
  appId: "1:206099383232:web:4fea5b4f9a51e7730efe25"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  const d = payload.data || {};
  self.registration.showNotification(d.title || 'CSEP 기사앱', {
    body: d.body || '',
    tag: 'csep-' + (d.reception_id || Date.now()),
    vibrate: [300, 100, 300]
  });
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window' }).then(function (list) {
    for (const c of list) { if (c.url.includes('/engineer') && 'focus' in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow('/engineer/');
  }));
});
