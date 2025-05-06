"use server";

import { verifySession } from "@/lib/dal";
import { dynamodbClient } from "@/lib/dynamodb";
import { PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { UIMessage } from "ai";
import { v4 as uuid } from "uuid";

const chatTable = "Chat";

export async function startConversation({ title }: { title?: string }) {
  const user = await verifySession();
  const conversationId = uuid();
  const now = new Date().toISOString();
  const conversation = {
    PK: `USER#${user.id}`,
    SK: `CONVERSATION#${conversationId}`,
    id: conversationId,
    title: title || "Untitled conversation",
    createdAt: now,
  };
  await dynamodbClient.send(
    new PutCommand({ TableName: chatTable, Item: conversation }),
  );

  return conversation;
}

export async function saveMessage({
  conversationId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  message: { createdAt, ...message },
}: {
  conversationId: string;
  message: UIMessage;
}) {
  await verifySession();
  const PK = `CONVERSATION#${conversationId}`;
  const SK = message.id; //
  const item = {
    PK,
    SK,
    ...message,
    id: SK,
  };
  await dynamodbClient.send(
    new PutCommand({
      TableName: chatTable,
      Item: { ...item },
    }),
  );
  return item as SavedMessage;
}

export async function getConversations() {
  const user = await verifySession();
  const res = await dynamodbClient.send(
    new QueryCommand({
      TableName: chatTable,
      KeyConditionExpression: "PK = :user_pk AND begins_with(SK, :conv_prefix)",
      ExpressionAttributeValues: {
        ":user_pk": `USER#${user.id}`,
        ":conv_prefix": "CONVERSATION#",
      },
    }),
  );
  return (res.Items || []) as ConversationMetadata[];
}

export type ConversationMetadata = {
  id: string;
  title: string;
  createdAt: string;
};

export async function getMessages(conversationId: string) {
  const res = await dynamodbClient.send(
    new QueryCommand({
      TableName: chatTable,
      KeyConditionExpression: "PK = :conv_pk AND begins_with(SK, :msg_prefix)",
      ExpressionAttributeValues: {
        ":conv_pk": `CONVERSATION#${conversationId}`,
        ":msg_prefix": "MESSAGE#",
      },
      ScanIndexForward: true,
    }),
  );
  return (res.Items || []) as SavedMessage[];
}

export async function updateMessage({
  messageId,
  partIdx,
  conversationId,
  isInReport,
}: {
  messageId: string;
  partIdx: number;
  conversationId: string;
  isInReport: boolean;
}) {
  await verifySession();
  const PK = `CONVERSATION#${conversationId}`;
  const SK = messageId;

  // Update the isInReport attribute of the specific part in the parts array
  await dynamodbClient.send(
    new UpdateCommand({
      TableName: chatTable,
      Key: { PK, SK },
      UpdateExpression: `SET parts[${partIdx}].isInReport = :isInReport`,
      ExpressionAttributeValues: {
        ":isInReport": isInReport,
      },
    }),
  );

  return;
}

export type SavedMessage = Omit<UIMessage, "parts"> & {
  PK: string;
  SK: string;
  type: "text" | "figure";
  parts: (UIMessage["parts"][number] & { isInReport?: boolean })[];
};

export type CreateMessage = Omit<SavedMessage, "PK" | "SK">;
