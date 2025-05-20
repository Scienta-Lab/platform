import { anthropic } from "@ai-sdk/anthropic";
import {
  appendResponseMessages,
  experimental_createMCPClient as createMCPClient,
  generateText,
  streamText,
  UIMessage,
} from "ai";
import { v4 as uuid } from "uuid";

import { saveMessage, startConversation } from "@/app/actions/chat";
import { verifySession } from "@/lib/dal";
import { PLATFORM_API_KEY } from "@/lib/taintedEnvVar";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  await verifySession();

  const { messages, id, metadata } = (await req.json()) as {
    messages: UIMessage[];
    id: string;
    metadata: { diseases: string[]; samples: string[] } | undefined;
  };

  let conversation;
  if (messages.length === 1) {
    conversation = await startConversation({
      title: await generateTitleFromUserMessage({
        message: messages[0],
      }),
      id,
      metadata,
    });
  }

  const lastMessage = messages?.at(-1);
  let savedMessage;
  if (lastMessage && lastMessage.role === "user") {
    savedMessage = await saveMessage({
      conversationId: conversation?.id || id,
      message: {
        ...lastMessage,
        createdAt: new Date(lastMessage.id.split("#")[1]),
      },
    });
  }

  const updatedMessages = (!savedMessage
    ? messages
    : [...messages.slice(0, -1), savedMessage]) as unknown as UIMessage[];

  const mcpClient = await createMCPClient({
    transport: {
      type: "sse",
      url: "https://platform-mcp-452652483423.europe-west4.run.app/sse",
      headers: {
        Authorization: `Bearer ${PLATFORM_API_KEY}`,
      },
    },
  });

  const result = streamText({
    model: anthropic("claude-3-7-sonnet-20250219"),
    maxRetries: 1,
    maxSteps: 5,
    abortSignal: AbortSignal.timeout(1000 * 60 * 2), // 2 minutes
    experimental_generateMessageId: () =>
      `MESSAGE#${new Date().toISOString()}#${uuid()}`,
    messages: updatedMessages,
    tools: await mcpClient.tools(),
    system: `You are a immunologist agent in charge of leveraging tools at your disposal to solve biology and immunology questions and help develop new treatments in immunology & inflammation.${conversation?.metadata?.diseases && conversation.metadata.samples ? ` You are particularly interested in the following diseases: ${conversation.metadata.diseases.join(", ")} and tissues ${conversation.metadata.samples.join(", ")}, so use tools with the corresponding arguments.` : ""} When you call tools, their result will be automatically displayed to the user. Do not repeat them to the user. Instead, assert that you successfully called the tool and give a bit of context if needed.`,
    onFinish: async ({ response }) => {
      await mcpClient.close();

      const newMessage = appendResponseMessages({
        messages: messages as unknown as UIMessage[], // Have to do this because type isn't right, cf message assertion above,
        responseMessages: response.messages,
      }).at(-1);

      if (!newMessage) return;

      await saveMessage({
        conversationId: id,
        // Seems that asserting to UIMessage it's legit, he is working on AI SDK
        // https://github.com/nicoalbanese/ai-sdk-persistence-db/blob/9b90886a832c9fbe816144cd753bcf4c1958470d/app/api/chat/route.ts#L87
        message: {
          ...newMessage,
          createdAt: newMessage.createdAt
            ? new Date(newMessage.createdAt)
            : undefined,
        } as UIMessage,
      });
    },
  });

  return result.toDataStreamResponse({
    getErrorMessage:
      process.env.NODE_ENV === "development" ? errorHandler : undefined,
  });
}

function errorHandler(error: unknown) {
  if (error == null) {
    return "unknown error";
  }

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return JSON.stringify(error);
}

// From
// https://github.com/vercel/ai-chatbot/blob/8a7d3e9950bfb363e92bd58200b9366053102d02/app/(chat)/actions.ts#L18
async function generateTitleFromUserMessage({
  message,
}: {
  message: UIMessage;
}) {
  const { text: title } = await generateText({
    model: anthropic("claude-3-5-haiku-latest"),
    system: `\n
    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 80 characters long
    - the title should be a summary of the user's message
    - If the user message is a question, don't answer the question, keep focusing on generating a good title
    - do not use quotes or colons`,
    prompt: JSON.stringify(message),
    maxTokens: 80,
  });

  return title;
}
