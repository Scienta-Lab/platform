"use server";

import { verifySession } from "@/lib/dal";
import { dynamodbClient } from "@/lib/dynamodb";
import {
  BatchWriteCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { UIMessage } from "ai";
import { revalidateTag, unstable_cache } from "next/cache";
import { cache } from "react";

const chatTable = "Chat";

export async function startConversation({
  id,
  title,
  metadata,
}: {
  id: string;
  title?: string;
  metadata?: { diseases: string[]; samples: string[] };
}) {
  const user = await verifySession();
  const conversationId = id;
  const now = new Date().toISOString();
  const conversation = {
    PK: `USER#${user.id}`,
    SK: `CONVERSATION#${conversationId}`,
    id: conversationId,
    title: title || "Untitled conversation",
    createdAt: now,
    metadata,
  };
  await dynamodbClient.send(
    new PutCommand({ TableName: chatTable, Item: conversation }),
  );

  revalidateTag(`conversations-${user.id}`);

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
  const SK = message.id;
  // Ignores the toolInvocations field before saving to db
  // It is deprecated and not used in the UI
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { toolInvocations, ...messageWithoutToolInvocations } = message;
  const item = {
    PK,
    SK,
    ...messageWithoutToolInvocations,
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

export const getConversation = cache(async (conversationId?: string) => {
  const user = await verifySession();
  if (!conversationId) return undefined;
  const conversation = await unstable_cache(
    async () => {
      const res = await dynamodbClient.send(
        new QueryCommand({
          TableName: chatTable,
          KeyConditionExpression: "PK = :user_pk AND SK = :conv_sk",
          ExpressionAttributeValues: {
            ":user_pk": `USER#${user.id}`,
            ":conv_sk": `CONVERSATION#${conversationId}`,
          },
        }),
      );
      return (res.Items && res.Items[0]) as ConversationMetadata | undefined;
    },
    [user.id, conversationId],
    { tags: [`conversation-${conversationId}`] },
  )();
  return conversation;
});

export const getConversations = cache(async () => {
  const user = await verifySession();
  const conversations = await unstable_cache(
    async () => {
      const res = await dynamodbClient.send(
        new QueryCommand({
          TableName: chatTable,
          KeyConditionExpression:
            "PK = :user_pk AND begins_with(SK, :conv_prefix)",
          ExpressionAttributeValues: {
            ":user_pk": `USER#${user.id}`,
            ":conv_prefix": "CONVERSATION#",
          },
        }),
      );
      return (res.Items || []) as ConversationMetadata[];
    },
    [user.id],
    { tags: [`conversations-${user.id}`] },
  )();
  return conversations;
});

export type ConversationMetadata = {
  id: string;
  title: string;
  createdAt: string;
  metadata?: { diseases: string[]; samples: string[] };
};

export async function deleteConversation(conversationId: string) {
  const user = await verifySession();
  const messages = await getMessages(conversationId, { keysOnly: true });

  const messageDeleteRequests = messages.map((item) => ({
    DeleteRequest: {
      Key: {
        PK: item.PK,
        SK: item.SK,
      },
    },
  }));

  const conversationMetaDeleteRequest = {
    DeleteRequest: {
      Key: {
        PK: `USER#${user.id}`,
        SK: `CONVERSATION#${conversationId}`,
      },
    },
  };

  // Batch delete (max 25 per batch)
  const allDeleteRequests = [
    ...messageDeleteRequests,
    conversationMetaDeleteRequest,
  ];
  while (allDeleteRequests.length > 0) {
    const batch = allDeleteRequests.splice(0, 25);
    await dynamodbClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [chatTable]: batch,
        },
      }),
    );
  }

  revalidateTag(`conversations-${user.id}`);
}

export async function getMessages(
  conversationId?: string,
  // Options
  { keysOnly = false } = {},
) {
  await verifySession();

  if (!conversationId) return [];

  const res = await dynamodbClient.send(
    new QueryCommand({
      TableName: chatTable,
      KeyConditionExpression: "PK = :conv_pk AND begins_with(SK, :msg_prefix)",
      ExpressionAttributeValues: {
        ":conv_pk": `CONVERSATION#${conversationId}`,
        ":msg_prefix": "MESSAGE#",
      },
      ScanIndexForward: true,
      ProjectionExpression: keysOnly ? "PK, SK" : undefined,
    }),
  );
  return (res.Items || []) as SavedMessage[];
}

export async function updateMessage({
  messageId,
  partIdx,
  conversationId,
  updatedFields,
}: {
  messageId: string;
  partIdx: number;
  conversationId: string;
  updatedFields: Partial<PartMetadata>;
}) {
  await verifySession();
  const PK = `CONVERSATION#${conversationId}`;
  const SK = messageId;

  // Dynamically build UpdateExpression and ExpressionAttributeValues for all fields in updatedFields
  const setExpressions: string[] = [];
  const expressionAttributeValues: Record<
    string,
    PartMetadata[keyof PartMetadata]
  > = {};

  for (const [key, value] of Object.entries(updatedFields)) {
    if (value == undefined) continue;
    setExpressions.push(`parts[${partIdx}].${key} = :${key}`);
    expressionAttributeValues[`:${key}`] = value;
  }

  await dynamodbClient.send(
    new UpdateCommand({
      TableName: chatTable,
      Key: { PK, SK },
      UpdateExpression: `SET ${setExpressions.join(", ")}`,
      ExpressionAttributeValues: expressionAttributeValues,
    }),
  );

  return;
}

type PartMetadata = {
  isInReport?: boolean;
  threshold?: number;
};
export type SavedMessage = Omit<UIMessage, "parts"> & {
  PK: string;
  SK: string;
  type: "text" | "figure";
  parts: (UIMessage["parts"][number] & PartMetadata)[];
};

export type CreateMessage = Omit<SavedMessage, "PK" | "SK">;
