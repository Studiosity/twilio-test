const debug = require('debug')('test-app:call-route');
const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const VoiceResponse = twilio.twiml.VoiceResponse;

const config = require('../config');

// POST /call/connect
router.post('/connect', twilio.webhook({ authToken: config.authToken, url: `https://${config.host}/call/connect` }), function(req, res, next) {
  debug('Received POST to /call/connect');

  const user = req.body.user;
  const twiml = new VoiceResponse();

  // Start streaming to the websocket
  const start = twiml.start();
  start.stream({
    url: `${config.websocketProtocol}://${req.headers.host}/transcribe-socket`,
    track: 'both_tracks'
  });

  // Dial the user
  const dial = twiml.dial();
  dial.client({}, user);

  res.send(twiml.toString());
});

module.exports = router;
