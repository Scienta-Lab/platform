"use server";

import {
  AuthFlowType,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { cookies } from "next/headers";

import { cognitoClient } from "@/lib/cognito";
import { EmailAndPasswordRequiredError, SignInFailedError } from "@/lib/errors";
import { getSecretHash } from "@/lib/server-utils";
import { AWS_COGNITO_CLIENT_ID } from "@/lib/taintedEnvVar";

export async function signIn(formData: FormData) {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  if (!email || !password) return new EmailAndPasswordRequiredError();

  const maybeSecretHash = getSecretHash(email);
  if (maybeSecretHash instanceof Error) return maybeSecretHash;

  const secretHash = maybeSecretHash;
  const command = new InitiateAuthCommand({
    ClientId: AWS_COGNITO_CLIENT_ID,
    AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password,
      SECRET_HASH: secretHash,
    },
  });

  let res;
  try {
    res = await cognitoClient.send(command);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new SignInFailedError(message);
  }

  if (res && res.AuthenticationResult && res.AuthenticationResult.AccessToken) {
    const cookieStore = await cookies();
    const expires = new Date(
      Date.now() + (res.AuthenticationResult.ExpiresIn || 3600) * 1000,
    );
    cookieStore.set(
      "aws-cognito-access-token",
      res.AuthenticationResult.AccessToken,
      {
        expires,
        secure: true,
        sameSite: "lax",
      },
    );
  }

  return res;
}
