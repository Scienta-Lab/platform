import { anthropic } from "@ai-sdk/anthropic";
import {
  appendResponseMessages,
  experimental_createMCPClient as createMCPClient,
  streamText,
  UIMessage,
} from "ai";
import { v4 as uuid } from "uuid";

import { saveMessage } from "@/app/actions/chat";
import { verifySession } from "@/lib/dal";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const mcpClient = await createMCPClient({
  transport: {
    type: "sse",
    url: "https://platform-mcp-452652483423.europe-west4.run.app/sse",
  },
});

export async function POST(req: Request) {
  await verifySession();

  const { messages, id } = (await req.json()) as {
    messages: UIMessage[];
    id: string;
  };

  const lastMessage = messages?.at(-1);
  let savedMessage;
  if (lastMessage && lastMessage.role === "user") {
    savedMessage = await saveMessage({
      conversationId: id,
      message: {
        ...lastMessage,
        createdAt: new Date(lastMessage.id.split("#")[1]),
      },
    });
  }

  const updatedMessages = (!savedMessage
    ? messages
    : [...messages.slice(0, -1), savedMessage]) as unknown as UIMessage[];

  const result = streamText({
    model: anthropic("claude-3-7-sonnet-20250219"),
    // https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#closing-the-mcp-client
    // Don't know what we should do here as closing the client seems to prevent subsequent interactions
    // onFinish: () => mcpClient.close(),
    // onError: () => mcpClient.close(),
    maxRetries: 1,
    maxSteps: 1,
    experimental_generateMessageId: () =>
      `MESSAGE#${new Date().toISOString()}#${uuid()}`,
    messages: updatedMessages,
    tools: await mcpClient.tools(),
    system:
      "When you call tools, their result will be automatically displayed to the user. Do not repeat them to the user. Instead, assert that you successfully called the tool and give a bit of context if needed.",
    onFinish: async ({ response }) => {
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

  return result.toDataStreamResponse();
}
