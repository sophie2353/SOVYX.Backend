// modules/refreshToken.js
const fetch = require('node-fetch');

async function refreshToken() {
  const response = await fetch(
    `https://graph.facebook.com/v25.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${CURRENT_TOKEN}`
  );
  const data = await response.json();
  return data.access_token;
}
