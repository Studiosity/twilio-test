const express = require('express');
const router = express.Router();

const AccessToken = require('twilio').jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

const config = require('../config');

let availableUsers = [];

// GET /token/generate
router.post('/generate', function (req, res) {
  const userId = req.body.user_id;

  const accessToken = new AccessToken(config.accountSid, config.apiKey, config.apiSecret);
  accessToken.identity = userId;

  const grant = new VoiceGrant({
    outgoingApplicationSid: config.appSid,
    incomingAllow: true,
  });
  accessToken.addGrant(grant);

  availableUsers.push(userId);

  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify({ token: accessToken.toJwt(), availableUsers: availableUsers }));
});

module.exports = router;
