// scripts/test-webhook.js
const axios = require('axios');

const simularDMs = async (cantidad) => {
  for (let i = 0; i < cantidad; i++) {
    await axios.post('https://tu-app-en-render.onrender.com/api/webhook/instagram', {
      object: 'instagram',
      entry: [{
        messaging: [{
          sender: { id: `USER_TEST_${i}` },
          message: { text: "Hola, me interesa Soeditia para mis videos" }
        }]
      }]
    });
    console.log(`Simulado DM #${i+1}`);
  }
};

simularDMs(100);
