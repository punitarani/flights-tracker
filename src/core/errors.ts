/**
 * Error classes for alert operations
 */

export class AlertValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message);
    this.name = "AlertValidationError";
  }
}

export class AlertNotFoundError extends Error {
  constructor(alertId: string) {
    super(`Alert with ID ${alertId} not found`);
    this.name = "AlertNotFoundError";
  }
}
