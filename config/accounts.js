// config/accounts.js
const tokens = require('tokens');

const ACCOUNTS = {
  // MIS CUENTAS
  sovyx: {
    id: 'sovyx',
    name: 'SOVYX',
    type: 'owner',
    instagram_token: tokens.instagram.tokens.sovyx,
    instagram_id: tokens.instagram.ids.sovyx,
    posts_plan: 9,
    budget: 0,
    ia2_style: 'high_ticket_owner'
  },
  
  socredi: {
    id: 'socredi',
    name: 'SOCREDI',
    type: 'owner',
    instagram_token: tokens.instagram.tokens.socredi,
    instagram_id: tokens.instagram.ids.socredi,
    posts_plan: 9,
    budget: 0,
    ia2_style: 'high_ticket_owner'
  },
  
  // CLIENTES
  client1: {
    id: 'client1',
    name: 'CLIENTE 1',
    type: 'client',
    instagram_token: tokens.instagram.tokens.client1,
    instagram_id: tokens.instagram.ids.client1,
    posts_plan: 4,
    budget: 100,
    ia2_style: 'high_ticket_client'
  },
  
  client2: {
    id: 'client2',
    name: 'CLIENTE 2',
    type: 'client',
    instagram_token: tokens.instagram.tokens.client2,
    instagram_id: tokens.instagram.ids.client2,
    posts_plan: 4,
    budget: 100,
    ia2_style: 'high_ticket_client'
  },
  
  client3: {
    id: 'client3',
    name: 'CLIENTE 3',
    type: 'client',
    instagram_token: tokens.instagram.tokens.client3,
    instagram_id: tokens.instagram.ids.client3,
    posts_plan: 4,
    budget: 100,
    ia2_style: 'high_ticket_client'
  },
  
  client4: {
    id: 'client4',
    name: 'CLIENTE 4',
    type: 'client',
    instagram_token: tokens.instagram.tokens.client4,
    instagram_id: tokens.instagram.ids.client4,
    posts_plan: 4,
    budget: 100,
    ia2_style: 'high_ticket_client'
  },
  
  client5: {
    id: 'client5',
    name: 'CLIENTE 5',
    type: 'client',
    instagram_token: tokens.instagram.tokens.client5,
    instagram_id: tokens.instagram.ids.client5,
    posts_plan: 4,
    budget: 100,
    ia2_style: 'high_ticket_client'
  },
  
  client6: {
    id: 'client6',
    name: 'CLIENTE 6',
    type: 'client',
    instagram_token: tokens.instagram.tokens.client6,
    instagram_id: tokens.instagram.ids.client6,
    posts_plan: 4,
    budget: 100,
    ia2_style: 'high_ticket_client'
  },
  
  client7: {
    id: 'client7',
    name: 'CLIENTE 7',
    type: 'client',
    instagram_token: tokens.instagram.tokens.client7,
    instagram_id: tokens.instagram.ids.client7,
    posts_plan: 4,
    budget: 100,
    ia2_style: 'high_ticket_client'
  },
  
  client8: {
    id: 'client8',
    name: 'CLIENTE 8',
    type: 'client',
    instagram_token: tokens.instagram.tokens.client8,
    instagram_id: tokens.instagram.ids.client8,
    posts_plan: 4,
    budget: 100,
    ia2_style: 'high_ticket_client'
  }
};

module.exports = ACCOUNTS;
