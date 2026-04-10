const tokens = require('./tokens');

const ACCOUNTS = {
  // ============================================
  // MATRIZ & PROYECTOS PROPIOS (SOVYX CORP)
  // ============================================
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

  soalefia: {
    id: 'soalefia',
    name: 'SOALEFIA',
    type: 'sub_company',
    instagram_token: tokens.instagram.tokens.soalefia || tokens.instagram.tokens.sovyx, // Fallback a Sovyx si es matriz
    instagram_id: tokens.instagram.ids.soalefia,
    posts_plan: 6,
    budget: 50,
    ia2_style: 'financial_protocol'
  },

  soeditia: {
    id: 'soeditia',
    name: 'SOEDITIA',
    type: 'sub_company',
    instagram_token: tokens.instagram.tokens.soeditia || tokens.instagram.tokens.sovyx,
    instagram_id: tokens.instagram.ids.soeditia,
    posts_plan: 12, // Soeditia requiere más volumen por ser de creación
    budget: 100,
    ia2_style: 'content_creator_high_retention'
  },

  // ============================================
  // SLOTS DE CLIENTES (LIMITADO A 4)
  // ============================================
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
  }
};

module.exports = ACCOUNTS;
