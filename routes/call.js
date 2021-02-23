const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const VoiceResponse = twilio.twiml.VoiceResponse;

// POST /calls/connect
router.post('/connect', twilio.webhook({validate: false}), function(req, res, next) {
  const user = req.body.user;
  const twiml = new VoiceResponse();

  // Dial the user
  const dial = twiml.dial();
  dial.client({}, user);

  // Start streaming to the websocket
  const start = twiml.start();
  start.stream({
    url: `wss://${req.headers.host}/websocket`
  });

  console.log(`Call string: ${twiml.toString()}`);
  res.send(twiml.toString());
});

module.exports = router;
