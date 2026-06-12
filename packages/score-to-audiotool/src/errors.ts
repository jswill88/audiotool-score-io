export class ScoreToAudiotoolError extends Error {
  statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'ScoreToAudiotoolError';
    this.statusCode = statusCode;
  }
}

export class ScoreImportValidationError extends ScoreToAudiotoolError {
  constructor(message: string, statusCode = 400) {
    super(message, statusCode);
    this.name = 'ScoreImportValidationError';
  }
}
