"use server";

import { getMessageAnnotations, PartMetadata } from "@/lib/chat";
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
import { v4 as uuid } from "uuid";

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
  const SK =
    getMessageAnnotations(message)?.dbId ||
    `MESSAGE#${new Date().toISOString()}#${uuid()}`;
  // Ignores the toolInvocations field before saving to db
  // It is deprecated and not used in the UI
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { toolInvocations, ...messageWithoutToolInvocations } = message;
  const oldAnnotations = getMessageAnnotations(message);
  const Item = {
    PK,
    SK,
    ...messageWithoutToolInvocations,
    annotations: [
      {
        ...oldAnnotations,
        parts: oldAnnotations?.parts ?? {},
        createdAt: oldAnnotations?.createdAt || new Date().toISOString(),
        dbId: SK,
        PK,
        SK,
      },
    ],
  };

  try {
    await dynamodbClient.send(
      new PutCommand({
        TableName: chatTable,
        Item,
        ConditionExpression:
          "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      }),
    );
  } catch (error) {
    // If the item already exists, we ignore the error
    // This can happen if there is an error when the user sent just a single message
    // and clicked the retry button of the error component. This will lead to try to save the convesation again
    if (
      error instanceof Error &&
      error.name !== "ConditionalCheckFailedException"
    ) {
      throw error;
    }
  }

  revalidateTag(`conversation-${conversationId}-messages`);

  return Item as UIMessage;
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

export const getMessages = cache(
  async (
    conversationId?: string,
    // Options
    { keysOnly = false } = {},
  ) => {
    await verifySession();

    if (!conversationId) return [];

    const res = await unstable_cache(
      async () => {
        return await dynamodbClient.send(
          new QueryCommand({
            TableName: chatTable,
            KeyConditionExpression:
              "PK = :conv_pk AND begins_with(SK, :msg_prefix)",
            ExpressionAttributeValues: {
              ":conv_pk": `CONVERSATION#${conversationId}`,
              ":msg_prefix": "MESSAGE#",
            },
            ScanIndexForward: true,
            ProjectionExpression: keysOnly ? "PK, SK" : undefined,
          }),
        );
      },
      [conversationId, keysOnly ? "keysOnly" : "full"],
      { tags: [`conversation-${conversationId}-messages`] },
    )();

    return (res.Items || []) as (UIMessage & { PK: string; SK: string })[];
  },
);

export async function updateMessage({
  message,
  partIdx,
  conversationId,
  updatedFields,
}: {
  message: UIMessage;
  partIdx: number;
  conversationId: string;
  updatedFields: Partial<PartMetadata>;
}) {
  await verifySession();
  const PK = `CONVERSATION#${conversationId}`;
  const SK = getMessageAnnotations(message)?.dbId;

  if (!SK) {
    console.log({ message });
    throw new Error("Message does not have a valid dbId");
  }

  const partKey = `part_${partIdx}`;
  const annotations = getMessageAnnotations(message);
  const newAnnotations = {
    ...annotations,
    parts: {
      ...annotations?.parts,
      [partKey]: { ...annotations?.parts[partKey], ...updatedFields },
    },
  };

  await dynamodbClient.send(
    new UpdateCommand({
      TableName: chatTable,
      Key: { PK, SK },
      UpdateExpression: "SET annotations = :annotations",
      ExpressionAttributeValues: {
        ":annotations": [newAnnotations],
      },
    }),
  );

  return;
}
