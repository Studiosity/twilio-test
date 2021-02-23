const express = require('express');
const router = express.Router();
const hri = require('human-readable-ids').hri;

// GET /
router.get('/', function (req, res) {
  req.session.userId = req.session.userId || hri.random();
  res.render('dashboard/index', { user_id: req.session.userId });
});

module.exports = router;
