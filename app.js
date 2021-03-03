require('dotenv').config();

const debug = require('debug')('test-app:server');
const express = require('express');
const session = require('express-session');
const path = require('path');
const cookieParser = require('cookie-parser');
const flash = require('connect-flash');
const bodyParser = require('body-parser');

const dashboard = require('./routes/dashboard');
const call = require('./routes/call');
const token = require('./routes/token');

const app = express();
const server = require("http").createServer(app);
const WebSocket = require("ws");
const url = require('url');
const wssTranscribe = new WebSocket.Server({ noServer: true });
const wssClient = new WebSocket.Server({ noServer: true });

const TranscriberManager = require('./transcribers/transcriber_manager');

const port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

wssTranscribe.on("connection", function connection(ws, request, client) {
  debug(`New transcriber connection initiated from ${client}`);

  let transcriberManager = null;

  ws.on("message", function incoming(message) {
    const msg = JSON.parse(message);
    switch (msg.event) {
      case "connected":
        debug("A new call has connected.");
        break;
      case "start":
        debug(`Starting Media Stream ${msg.streamSid}`);

        transcriberManager = new TranscriberManager({
          directions: msg.start.tracks,
          transcriptionResult: function(transcriber, direction, type, text) {
            wssClient.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(
                  JSON.stringify({
                    event: 'transcription',
                    transcriber: transcriber,
                    type: type,
                    text: text,
                    from: direction
                  })
                );
              }
            });
          }
        });
        break;
      case "media":
        // Write Media Packets to the recognize stream
        if (transcriberManager) transcriberManager.writeData(msg.media.track, msg.media.payload);
        break;
      case "stop":
        debug("Call Has Ended");
        if (transcriberManager) {
          transcriberManager.destroy();
          transcriberManager = null;
        }
        break;
    }
  });
});

wssClient.on("connection", function connection(ws) {
  debug('New client connection initiated');
});

server.on('upgrade', function upgrade(request, socket, head) {
  const pathname = url.parse(request.url).pathname;

  if (pathname === '/transcribe-socket') {
    authenticateWebsocket(request, (err, client) => {
      if (err || !client) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      wssTranscribe.handleUpgrade(request, socket, head, function done(ws) {
        wssTranscribe.emit('connection', ws, request, client);
      });
    });
  } else if (pathname === '/client-socket') {
    wssClient.handleUpgrade(request, socket, head, function done(ws) {
      wssClient.emit('connection', ws);
    });
  } else {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
  }
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session({
  secret: 'twilio-test-secret',
  name: 'twilio-test',
  cookie: { maxAge: 60000 },
  resave: true,
  saveUninitialized: true
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(flash());

// middleware for flash message handling
app.use(function(req, res, next){
  res.locals.success = req.flash('success');
  res.locals.errors = req.flash('errors');
  next();
});

app.use('/', dashboard);
app.use('/call', call);
app.use('/token', token);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stack-traces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

/**
 * Normalize a port into a number, string, or false.
 */
function normalizePort(val) {
  const port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */
function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */
function onListening() {
  const addr = server.address();
  const bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
}

/**
 *
 */
function authenticateWebsocket(request, callback) {
  debug(`Received transcriber request, authenticating: ${JSON.stringify(request.headers)}`);

  callback.call(this, false, 'foo');
}

/**
 * Listen on provided port, on all network interfaces.
 */
server.listen(port, onListening);
server.on('error', onError);
