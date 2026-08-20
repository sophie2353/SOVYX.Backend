const express = require('express');
const router = express.Router();
const tokens = require('../config/tokens');

router.get('/config', (req, res) => {
  res.json({
    SOVYX_ADMIN_KEY: tokens.SOVYX_ADMIN_KEY,
    FB_APP_ID: tokens.META_APP_ID
  });
});

module.exports = router;
