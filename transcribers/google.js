//Include Google Speech to Text
const speech = require("@google-cloud/speech");

const debug = require('debug');

//Configure Transcription Request
const transcriptionRequest = {
  config: {
    encoding: "MULAW",
    sampleRateHertz: 8000,
    languageCode: "en-AU",
  },
  interimResults: true, // If you want interim results, set this to true
};

class Google {
  constructor(options) {
    const _that = this;
    this.logger = debug(`transcriber:google-${options.direction}`);

    const client = new speech.SpeechClient();

    this.transcriber = client
      .streamingRecognize(transcriptionRequest)
      .on("error", console.error)
      .on("data", (data) => {
        const result = data.results[0];
        options.transcriptionResult.call(
          this,
          'google',
           options.direction,
           result.isFinal ? 'final' : 'interim',
           result.alternatives[0].transcript
        );
      });
  }

  writeData(data) {
    this.transcriber.write(data);
  }

  destroy() {
    this.transcriber.destroy();
  }
}

module.exports = Google;
