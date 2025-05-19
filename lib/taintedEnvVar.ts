import { experimental_taintUniqueValue } from "react";

// https://react.dev/reference/react/experimental_taintUniqueValue
// https://nextjs.org/docs/app/building-your-application/data-fetching/fetching#preventing-sensitive-data-from-being-exposed-to-the-client
// Note: I tried and it doesn seem to be necessary to export constants based on the env vars
// but at least someone using the codebase will be more likely to notice tainted values usage and to care about it.

const message = (envVar: string) =>
  `The environment variable ${envVar} is exposed to the client! Please fix this!`;

experimental_taintUniqueValue(
  message("AWS_SECRET_ACCESS_KEY"),
  process,
  process.env.AWS_ACCESS_KEY_ID!,
);
export const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID!;

experimental_taintUniqueValue(
  message("AWS_SECRET_ACCESS_KEY"),
  process,
  process.env.AWS_SECRET_ACCESS_KEY!,
);
export const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY!;

experimental_taintUniqueValue(
  message("AWS_COGNITO_CLIENT_SECRET"),
  process,
  process.env.AWS_COGNITO_CLIENT_SECRET!,
);
export const AWS_COGNITO_CLIENT_SECRET = process.env.AWS_COGNITO_CLIENT_SECRET!;

experimental_taintUniqueValue(
  message("AWS_COGNITO_CLIENT_ID"),
  process,
  process.env.AWS_COGNITO_CLIENT_ID!,
);
export const AWS_COGNITO_CLIENT_ID = process.env.AWS_COGNITO_CLIENT_ID!;

experimental_taintUniqueValue(
  message("AWS_COGNITO_USER_POOL_ID"),
  process,
  process.env.AWS_COGNITO_USER_POOL_ID!,
);
export const AWS_COGNITO_USER_POOL_ID = process.env.AWS_COGNITO_USER_POOL_ID!;

experimental_taintUniqueValue(
  message("PLATFORM_API_KEY"),
  process,
  process.env.PLATFORM_API_KEY!,
);
export const PLATFORM_API_KEY = process.env.PLATFORM_API_KEY!;
