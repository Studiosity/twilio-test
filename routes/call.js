const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const VoiceResponse = twilio.twiml.VoiceResponse;

// POST /calls/connect
router.post('/connect', twilio.webhook({validate: false}), function(req, res, next) {
  const user = req.body.user;
  const twiml = new VoiceResponse();

  // Start streaming to the websocket
  const start = twiml.start();
  start.stream({
    url: `wss://${req.headers.host}/websocket`,
    track: 'both_tracks'
  });

  // Dial the user
  const dial = twiml.dial();
  dial.client({}, user);

  res.send(twiml.toString());
});

module.exports = router;
