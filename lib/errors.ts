// Errors can't be declared directly in the server actions because of the Next.js error:
// "Only async functions are allowed to be exported in a "use server" file."

export class EmailAndPasswordRequiredError extends Error {
  constructor() {
    super("Email and password are required.");
    this.name = "EmailAndPasswordRequiredError";
  }
}
export class EmailRequiredError extends Error {
  constructor() {
    super("Email is required.");
    this.name = "EmailRequiredError";
  }
}
export class ErrorFetchingInvitationToken extends Error {
  constructor(message?: string) {
    super("Error fetching invitation token. Original error: " + message);
    this.name = "ErrorFetchingInvitationToken";
  }
}
export class FailedToCreateUserError extends Error {
  constructor(message?: string) {
    super("Failed to create user. Original error: " + message);
    this.name = "FailedToCreateUserError";
  }
}
export class FailedToGetUserError extends Error {
  constructor(message?: string) {
    super("Failed to get user. Original error: " + message);
    this.name = "FailedToGetUserError";
  }
}
export class FailedToSendInviteEmail extends Error {
  constructor(message?: string) {
    super("Failed to send invite email. Original error: " + message);
    this.name = "FailedToSendInviteEmail";
  }
}
export class FailedToSetInvitationTokenAsUsed extends Error {
  constructor(message?: string) {
    super("Failed to set invitation token as used. Original error: " + message);
    this.name = "FailedToSetInvitationTokenAsUsed";
  }
}
export class FailedToSetUserPassword extends Error {
  constructor(message?: string) {
    super("Failed to set user password. Original error: " + message);
    this.name = "FailedToSetUserPassword";
  }
}
export class FailedToStoreTokenInDbError extends Error {
  constructor() {
    super("Failed to store token in database.");
    this.name = "FailedToStoreTokenInDbError";
  }
}
export class InputEmailDoesnMatchTokenEmail extends Error {
  constructor() {
    super("Email does not match the token email.");
    this.name = "InputEmailDoesnMatchTokenEmail";
  }
}
export class InvalidInvitationTokenError extends Error {
  constructor() {
    super("Invalid invitation token.");
    this.name = "InvalidInvitationTokenError";
  }
}
export class InvitationTokenAlreadyUsedError extends Error {
  constructor() {
    super("Invitation token has already been used.");
    this.name = "InvitationTokenAlreadyUsedError";
  }
}
export class InvitationTokenExpiredError extends Error {
  constructor() {
    super("Invitation token has expired.");
    this.name = "InvitationTokenExpiredError";
  }
}
export class NoAccessTokenError extends Error {
  constructor() {
    super("No access token found.");
    this.name = "NoAccessTokenError";
  }
}
export class SignInFailedError extends Error {
  constructor(message?: string) {
    super("Sign in failed. Original error: " + message);
    this.name = "SignInFailedError";
  }
}
