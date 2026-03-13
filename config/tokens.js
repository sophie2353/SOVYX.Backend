// config/tokens.js
require('dotenv').config();

module.exports = {
  instagram: {
    tokens: {
      sovyx: process.env.INSTAGRAM_TOKEN_SOVYX,
      socredi: process.env.INSTAGRAM_TOKEN_SOCREDI,
      client1: process.env.INSTAGRAM_TOKEN_CLIENT1,
      client2: process.env.INSTAGRAM_TOKEN_CLIENT2,
      client3: process.env.INSTAGRAM_TOKEN_CLIENT3,
      client4: process.env.INSTAGRAM_TOKEN_CLIENT4,
      client5: process.env.INSTAGRAM_TOKEN_CLIENT5,
      client6: process.env.INSTAGRAM_TOKEN_CLIENT6,
      client7: process.env.INSTAGRAM_TOKEN_CLIENT7,
      client8: process.env.INSTAGRAM_TOKEN_CLIENT8
    },
    ids: {
      sovyx: process.env.INSTAGRAM_ID_SOVYX,
      socredi: process.env.INSTAGRAM_ID_SOCREDI,
      client1: process.env.INSTAGRAM_ID_CLIENT1,
      client2: process.env.INSTAGRAM_ID_CLIENT2,
      client3: process.env.INSTAGRAM_ID_CLIENT3,
      client4: process.env.INSTAGRAM_ID_CLIENT4,
      client5: process.env.INSTAGRAM_ID_CLIENT5,
      client6: process.env.INSTAGRAM_ID_CLIENT6,
      client7: process.env.INSTAGRAM_ID_CLIENT7,
      client8: process.env.INSTAGRAM_ID_CLIENT8
    },
    verifyToken: process.env.INSTAGRAM_VERIFY_TOKEN,
    apiVersion: 'v18.0',
    baseUrl: 'https://graph.instagram.com/v18.0'
  },
  
  facebook: {
    token: process.env.FB_ACCESS_TOKEN,
    adAccountId: process.env.FB_AD_ACCOUNT_ID,
    apiVersion: 'v18.0',
    baseUrl: 'https://graph.facebook.com/v18.0'
  },
  
  sovyx: {
    mode: process.env.SOVYX_MODE || 'development',
    maxClients: parseInt(process.env.SOVYX_MAX_CLIENTS) || 8,
    targetCloses: parseInt(process.env.SOVYX_TARGET_CLOSES) || 27000,
    dailyBudget: parseInt(process.env.SOVYX_DAILY_BUDGET) || 100,
    
    apiUrl: process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}/api`
      : 'http://localhost:3000/api'
  }
};
