import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

import { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } from "./taintedEnvVar";

export const invitationTokensTable = "InvitationTokens";

const client = new DynamoDBClient({
  region: "eu-west-3",
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

export const dynamodbClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

// Schema
export type InvitationToken = {
  token: string;
  email: string;
  expiresAt: number;
  used: boolean;
};
