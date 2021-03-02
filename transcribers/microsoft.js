// Include Microsoft Speech to Text
const speechSdk = require("microsoft-cognitiveservices-speech-sdk");
const subscriptionKey = process.env.MICROSOFT_SUBSCRIPTION_KEY;
const serviceRegion = process.env.MICROSOFT_SERVICE_REGION;

// wavefile is used to convert from mulaw to PCM audio
const { WaveFile } = require('wavefile');

const debug = require('debug');

class Microsoft {
  constructor(options) {
    const _that = this;
    this.logger = debug(`transcriber:microsoft-${options.direction}`);

    this.pushStream = speechSdk.AudioInputStream.createPushStream();
    const audioConfig = speechSdk.AudioConfig.fromStreamInput(this.pushStream);

    const speechConfig = speechSdk.SpeechTranslationConfig.fromSubscription(subscriptionKey, serviceRegion);
    // setting the recognition language to Australian English.
    speechConfig.speechRecognitionLanguage = "en-AU";

    this.recogniser = new speechSdk.SpeechRecognizer(speechConfig, audioConfig);

    this.recogniser.canceled = function (sender, event) {
      let str = "(cancel) Reason: " + speechSdk.CancellationReason[event.reason];
      if (e.reason === speechSdk.CancellationReason.Error) {
        str += ": " + event.errorDetails;
      }
      _that.logger(str);
    };

    this.recogniser.recognizing = function (sender, event) {
      let str = "(recognizing) Reason: " + speechSdk.ResultReason[event.result.reason] + " Text: " + event.result.text;
      _that.logger(str);

      if (event.result.reason === speechSdk.ResultReason.RecognizingSpeech) {
        options.transcriptionResult.call(this, 'microsoft', options.direction, 'interim', event.result.text);
      }
    };

    this.recogniser.recognized = function (sender, event) {
      let str = "(recognized) Reason: " + speechSdk.ResultReason[event.result.reason] + " Text: " + event.result.text;
      _that.logger(str);

      if (event.result.reason === speechSdk.ResultReason.RecognizedSpeech) {
        options.transcriptionResult.call(this, 'microsoft', options.direction, 'final', event.result.text);
      }
    };

    // Signals that a new session has started with the speech service
    this.recogniser.sessionStarted = function (s, e) {
      _that.logger(`(sessionStarted) SessionId: ${e.sessionId}`);
    };

    // Signals the end of a session with the speech service.
    this.recogniser.sessionStopped = function (s, e) {
      _that.logger(`(sessionStopped) SessionId: ${e.sessionId}`);
    };

    // Signals that the speech service has started to detect speech.
    this.recogniser.speechStartDetected = function (s, e) {
      _that.logger(`(speechStartDetected) SessionId: ${e.sessionId}`);
    };

    // Signals that the speech service has detected that speech has stopped.
    this.recogniser.speechEndDetected = function (s, e) {
      _that.logger(`(speechEndDetected) SessionId: ${e.sessionId}`);
    };

    this.recogniser.startContinuousRecognitionAsync(
      function() { _that.logger(`Recognizer online...`) },
      _that.logger
    );
  }

  writeData(data) {
    const wav = new WaveFile();
    wav.fromScratch(1, 8000, '8m', Buffer.from(data, "base64"));
    wav.fromMuLaw();
    wav.toSampleRate(16000);
    this.pushStream.write(wav.data.samples);
  }

  destroy() {
    this.pushStream.close();
    this.recogniser.stopContinuousRecognitionAsync();
  }
}

module.exports = Microsoft;
