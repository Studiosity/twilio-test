const MicrosoftTranscriber = require('./microsoft');
const GoogleTranscriber = require('./google');

const transcriberTypes = {
  microsoft: MicrosoftTranscriber,
  google: GoogleTranscriber
}

class TranscriberManager {
  constructor(options) {
    this.transcribers = {};
    const _that = this;

    Object.keys(transcriberTypes).forEach(function(transcriberType) {
      _that.transcribers[transcriberType] = {};
      options.directions.forEach(function(direction) {
        _that.transcribers[transcriberType][direction] = new transcriberTypes[transcriberType]({
          direction: direction,
          transcriptionResult: options.transcriptionResult
        });
      });
    });
  }

  writeData(direction, data) {
    const _that = this;
    Object.keys(this.transcribers).forEach(function(transcriber) {
      if (_that.transcribers[transcriber][direction])
        _that.transcribers[transcriber][direction].writeData(data);
    });
  }

  destroy() {
    const _that = this;
    Object.keys(this.transcribers).forEach(function(transcriber) {
      Object.keys(_that.transcribers[transcriber]).forEach(function(direction) {
        _that.transcribers[transcriber][direction].destroy();
        delete _that.transcribers[transcriber][direction];
      });
      delete _that.transcribers[transcriber];
    });
  }
};

module.exports = TranscriberManager;
