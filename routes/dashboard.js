const express = require('express');
const router = express.Router();
const hri = require('human-readable-ids').hri;

const config = require('../config');

// GET /
router.get('/', function (req, res) {
  req.session.userId = req.session.userId || hri.random();
  res.render('dashboard/index', { user_id: req.session.userId, host: config.host });
});

module.exports = router;
