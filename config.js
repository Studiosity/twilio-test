/**
 * Normalize a port into a number or default (3000).
 */
function normalizePort(val) {
  const port = parseInt(val, 10);

  if (port >= 0) {
    // port number
    return port;
  }

  return 3000;
}

module.exports = {
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  appSid: process.env.TWILIO_APP_SID,
  apiKey: process.env.TWILIO_API_KEY,
  apiSecret: process.env.TWILIO_API_SECRET,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  host: process.env.HOST,
  port: normalizePort(process.env.PORT),
  websocketProtocol: process.env.WEBSOCKET_PROTOCOL
};
