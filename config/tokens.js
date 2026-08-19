require('dotenv').config();

module.exports = {
  port: process.env.PORT || 10000,
  mongoUri: process.env.MONGO_URI,

  meta: {
    accessToken: process.env.META_ADS_ACCESS_TOKEN,
    accountId: process.env.META_ADS_ACCOUNT_ID,
    pixelId: process.env.META_PIXEL_ID,
    pageId: process.env.META_PAGE_ID,
    campaignId: process.env.META_CAMPAIGN_ID || null
  },

  kontigo: {
    slug: process.env.KONTIGO_SLUG || 'SOVYX-Slot'
  },

  security: {
    adminHqSecret: process.env.ADMIN_HQ_SECRET || 'sovyx_hq_key'
  },

  sovyx: {
    totalSlots: 4,
    priceInitial: 1000,
    priceFinal: 4000
  }
};
