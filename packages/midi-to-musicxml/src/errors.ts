export class MidiToMusicXmlError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = 'MidiToMusicXmlError';
    this.statusCode = statusCode;
  }
}

export class MidiValidationError extends MidiToMusicXmlError {
  constructor(message: string) {
    super(message, 400);
    this.name = 'MidiValidationError';
  }
}
