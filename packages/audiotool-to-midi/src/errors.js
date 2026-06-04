export class AudiotoolToMidiError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = 'AudiotoolToMidiError';
    this.statusCode = statusCode;
  }
}

export class AudiotoolProjectError extends AudiotoolToMidiError {
  constructor(message, statusCode = 400) {
    super(message, statusCode);
    this.name = 'AudiotoolProjectError';
  }
}

export class AudiotoolSdkUnavailableError extends AudiotoolToMidiError {
  constructor(message = '@audiotool/nexus is required for live Audiotool access.') {
    super(message, 500);
    this.name = 'AudiotoolSdkUnavailableError';
  }
}

export class AudiotoolExportNotImplementedError extends AudiotoolToMidiError {
  constructor(message = 'Audiotool project extraction is not implemented yet.') {
    super(message, 501);
    this.name = 'AudiotoolExportNotImplementedError';
  }
}
