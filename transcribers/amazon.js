const crypto = require('crypto'); // to sign our pre-signed URL
const v4 = require('./aws-signature-v4'); // to generate our pre-signed URL
const marshaller = require("@aws-sdk/eventstream-marshaller"); // for converting binary event stream messages to and from JSON
const util_utf8_node = require("@aws-sdk/util-utf8-node"); // utilities for encoding and decoding UTF8
const WebSocket = require("ws");

// wavefile is used to convert from mulaw to PCM audio
const { WaveFile } = require('wavefile');

// our converter between binary event streams messages and JSON
const eventStreamMarshaller = new marshaller.EventStreamMarshaller(util_utf8_node.toUtf8, util_utf8_node.fromUtf8);

const debug = require('debug');

const languageCode = 'en-AU';
const sampleRate = 8000;

class Amazon {
  constructor(options) {
    const _that = this;
    this.logger = debug(`transcriber:amazon-${options.direction}`);

    this.socketError = false;
    this.transcribeException = false;

    const url = this._createPresignedURL();

    // Open up our WebSocket connection
    this.socket = new WebSocket(url);
    this.socket.binaryType = "arraybuffer";

    // handle inbound messages from Amazon Transcribe
    this.socket.onmessage = function (message) {
      //convert the binary event stream message to JSON
      let messageWrapper = eventStreamMarshaller.unmarshall(Buffer.from(message.data));
      let messageBody = JSON.parse(String.fromCharCode.apply(String, messageWrapper.body));
      if (messageWrapper.headers[":message-type"].value === "event") {
        let results = messageBody.Transcript.Results;

        if (results.length > 0) {
          if (results[0].Alternatives.length > 0) {
            let transcript = results[0].Alternatives[0].Transcript;

            // fix encoding for accented characters
            transcript = decodeURIComponent(escape(transcript));

            options.transcriptionResult.call(
              this,
              'amazon',
               options.direction,
               results[0].IsPartial ? 'interim' : 'final',
               transcript
            );
          }
        }
      } else {
        _that.transcribeException = true;
        _that.logger(`(invalid message) ${messageBody.Message}`);
      }
    };

    this.socket.onerror = function () {
      _that.socketError = true;
      _that.logger('WebSocket connection error.');
    };

    this.socket.onclose = function (closeEvent) {
      // the close event immediately follows the error event; only handle one.
      if (!_that.socketError && !_that.transcribeException && closeEvent.code != 1000) {
        _that.logger(`Streaming Exception: ${closeEvent.reason}`);
      }
    };
  }

  writeData(data) {
    if (this.socket.readyState === this.socket.OPEN) {
      // down-sample and convert the raw audio bytes to PCM
      const wav = new WaveFile();
      wav.fromScratch(1, 8000, '8m', Buffer.from(data, "base64"));
      wav.fromMuLaw();

      // add the right JSON headers and structure to the message
      let audioEventMessage = this._getAudioEventMessage(Buffer.from(wav.data.samples));

      // convert the JSON object + headers into a binary event stream message
      let binary = eventStreamMarshaller.marshall(audioEventMessage);

      this.socket.send(binary);
    }
  }

  destroy() {
    if (this.socket.readyState === this.socket.OPEN) {
      // Send an empty frame so that Transcribe initiates a closure of the WebSocket after submitting all transcripts
      let emptyMessage = this._getAudioEventMessage(Buffer.from([]));
      let emptyBuffer = eventStreamMarshaller.marshall(emptyMessage);
      this.socket.send(emptyBuffer);
    }
  }

  _createPresignedURL() {
    let endpoint = "transcribestreaming." + process.env.AWS_DEFAULT_REGION + ".amazonaws.com:8443";

    // get a preauthenticated URL that we can use to establish our WebSocket
    return v4.createPresignedURL(
      'GET',
      endpoint,
      '/stream-transcription-websocket',
      'transcribe',
      crypto.createHash('sha256').update('', 'utf8').digest('hex'), {
        'key': process.env.AWS_ACCESS_KEY_ID,
        'secret': process.env.AWS_SECRET_ACCESS_KEY,
        'protocol': 'wss',
        'expires': 15,
        'region': process.env.AWS_DEFAULT_REGION,
        'query': "language-code=" + languageCode + "&media-encoding=pcm&sample-rate=" + sampleRate
      }
    );
  }

  _getAudioEventMessage(buffer) {
    // wrap the audio data in a JSON envelope
    return {
      headers: {
        ':message-type': {
          type: 'string',
          value: 'event'
        },
        ':event-type': {
          type: 'string',
          value: 'AudioEvent'
        }
      },
      body: buffer
    };
  }
}


module.exports = Amazon;
