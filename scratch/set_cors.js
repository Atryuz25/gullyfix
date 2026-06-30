const { initializeApp, cert } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');
const serviceAccount = require('../service-account.json');

try {
  initializeApp({
    credential: cert(serviceAccount),
    storageBucket: 'gullyfixx.firebasestorage.app'
  });
} catch(e) {}

async function setCors() {
  const corsConfig = [
    {
      origin: ['*'],
      method: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD', 'OPTIONS'],
      maxAgeSeconds: 3600,
      responseHeader: ['*']
    }
  ];

  const bucketsToTry = ['gullyfixx.firebasestorage.app', 'gullyfixx.appspot.com'];
  
  for (const b of bucketsToTry) {
    console.log(`Trying bucket: ${b}`);
    try {
      const bucket = getStorage().bucket(b);
      await bucket.setCorsConfiguration(corsConfig);
      console.log(`✅ CORS configuration set successfully on ${b}!`);
      return;
    } catch (e) {
      console.log(`Failed on ${b}: ${e.message}`);
    }
  }
}

setCors().catch(console.error);
