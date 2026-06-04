export class MidiToMusicXmlError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = 'MidiToMusicXmlError';
    this.statusCode = statusCode;
  }
}

export class MidiValidationError extends MidiToMusicXmlError {
  constructor(message) {
    super(message, 400);
    this.name = 'MidiValidationError';
  }
}
