"use server";

import { getMessageAnnotations, PartMetadata } from "@/lib/chat";
import { verifySession } from "@/lib/dal";
import { dynamodbClient } from "@/lib/dynamodb";
import { s3Client, platformBucket } from "@/lib/s3";
import {
  BatchWriteCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { UIMessage } from "ai";
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

  return Item as UIMessage;
}

export const getConversation = async (conversationId?: string) => {
  const user = await verifySession();
  if (!conversationId) return undefined;

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
};

export const getConversations = async () => {
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
};

export type ConversationMetadata = {
  id: string;
  title: string;
  createdAt: string;
  metadata?: { diseases: string[]; samples: string[] };
};

export async function deleteConversation(conversationId: string) {
  const user = await verifySession();
  const messages = await getMessages(conversationId);

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

  // Delete entire conversation folder from S3
  await deleteConversationFolder(conversationId);
}

async function deleteConversationFolder(conversationId: string) {
  try {
    const listCommand = new ListObjectsV2Command({
      Bucket: platformBucket,
      Prefix: `${conversationId}/`,
    });

    const listResponse = await s3Client.send(listCommand);

    if (listResponse.Contents?.length) {
      await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: platformBucket,
          Delete: {
            Objects: listResponse.Contents.map((obj) => ({ Key: obj.Key! })),
          },
        }),
      );
    }
  } catch (error) {
    console.error("Failed to delete conversation folder:", error);
  }
}

export const getMessages = async (
  conversationId?: string,
  // Options
  { keysOnly = false } = {},
) => {
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

  return (res.Items || []) as (UIMessage & { PK: string; SK: string })[];
};

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

  if (!SK) throw new Error("Message does not have a valid dbId");

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

export async function uploadImage({
  file,
  conversationId,
  extension,
}: {
  file: Buffer;
  conversationId: string;
  extension?: string;
}) {
  const user = await verifySession();
  const imageId = uuid();
  const imageKey = `${conversationId}/${imageId}.${extension}`;

  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: platformBucket,
        Key: imageKey,
        Body: file,
        Metadata: {
          userId: user.id,
          conversationId,
          uploadedAt: new Date().toISOString(),
        },
      }),
    );

    return {
      imageId,
      imageKey,
    };
  } catch (error) {
    console.error("Failed to upload image:", error);
    throw new Error("Failed to upload image to S3");
  }
}

export async function prepareImageForUpload(data: string, mimeType: string) {
  const buffer = Buffer.from(data, "base64");

  // Extract file extension from mime type
  const extension = mimeType.includes("/")
    ? mimeType.split("/")[1] || "png"
    : mimeType;

  return {
    file: buffer,
    extension,
    mimeType,
  };
}

export async function getImageUrl(key: string) {
  await verifySession();

  try {
    const command = new GetObjectCommand({
      Bucket: platformBucket,
      Key: key,
    });

    // Generate presigned URL valid for 24 hours
    const url = await getSignedUrl(s3Client, command, { expiresIn: 86400 });
    return { url };
  } catch (error) {
    console.error("Failed to generate presigned URL:", error);
    throw new Error("Failed to generate image URL");
  }
}
