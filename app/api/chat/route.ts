import { anthropic } from "@ai-sdk/anthropic";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  appendResponseMessages,
  createDataStreamResponse,
  experimental_createMCPClient as createMCPClient,
  generateObject,
  generateText,
  streamText,
  UIMessage,
} from "ai";
import z from "zod";

import { saveMessage, startConversation } from "@/app/actions/chat";
import { verifySession } from "@/lib/dal";
import { PLATFORM_API_KEY } from "@/lib/taintedEnvVar";
import { toolNames } from "@/lib/tools";
import { getMessageAnnotations } from "@/lib/chat";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  await verifySession();

  const { messages, id, metadata } = (await req.json()) as {
    messages: UIMessage[];
    id: string;
    metadata: { diseases: string[]; samples: string[] } | undefined;
  };

  const mcpClient = await getScientaMcpClient();

  // Need to wrap everything in createDataStreamResponse to access the dataStream
  // https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data#sending-custom-data-from-the-server
  return createDataStreamResponse({
    execute: async (dataStream) => {
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
      let savedUserMessage: UIMessage | undefined;
      if (lastMessage && lastMessage.role === "user") {
        savedUserMessage = await saveMessage({
          conversationId: conversation?.id || id,
          message: lastMessage,
        });
      }

      const updatedMessages = (!savedUserMessage
        ? messages
        : [
            ...messages.slice(0, -1),
            savedUserMessage,
          ]) as unknown as UIMessage[];

      const result = streamText({
        model: anthropic("claude-3-5-haiku-latest"),
        maxRetries: 1,
        maxSteps: 5,
        abortSignal: AbortSignal.timeout(1000 * 60 * 2), // 2 minutes
        messages: updatedMessages,
        tools: await mcpClient.tools(),
        system: `You are a immunologist agent in charge of leveraging tools at your disposal to solve biology and immunology questions and help develop new treatments in immunology & inflammation.${conversation?.metadata?.diseases && conversation.metadata.samples ? ` You are particularly interested in the following diseases: ${conversation.metadata.diseases.join(", ")} and tissues ${conversation.metadata.samples.join(", ")}, so use tools with the corresponding arguments.` : ""}. When you call tools, their result will be automatically displayed to the user. Do not repeat them to the user. Instead, assert that you successfully called the tool and give a bit of context if needed. Do specifically what is asked by the user, not more. If the question is too broad or not specific enough, ask for clarification, based on the tools you have at your disposal.`,
        onFinish: async ({ response }) => {
          await mcpClient.close();

          const newMessages = appendResponseMessages({
            messages: updatedMessages as unknown as UIMessage[], // Have to do this because type isn't right, cf message assertion above,
            responseMessages: response.messages,
          });
          const newMessage = newMessages.at(-1);

          if (!newMessage) return;

          // The LLM might fail to generate suggestions
          // For example sometimes it doesn't generate an object of the right shape
          // Thus for now we just catch the error and save an empty array
          let suggestions;
          try {
            const res = await generateSuggestionsFromConversation({
              messages: newMessages as UIMessage[],
            });
            suggestions = res.object;
          } catch {}

          // We save the message with the suggestions
          const annotations = [{ suggestions: suggestions ?? [] }];
          const savedAssistantMessage = await saveMessage({
            conversationId: id,
            // Seems that asserting to UIMessage it's legit, he is working on AI SDK
            // https://github.com/nicoalbanese/ai-sdk-persistence-db/blob/9b90886a832c9fbe816144cd753bcf4c1958470d/app/api/chat/route.ts#L87
            message: { ...newMessage, annotations } as UIMessage,
          });

          // We append annotations from the saved message to the message we are streaming back
          dataStream.writeMessageAnnotation({
            ...getMessageAnnotations(savedAssistantMessage),
          });

          // We send annotations from the last user message through the data stream
          dataStream.writeData(
            JSON.parse(
              JSON.stringify({
                lastSavedUserMessage: savedUserMessage,
                isFirstResponse: newMessages.length === 2,
              }),
            ),
          );
        },
      });

      result.mergeIntoDataStream(dataStream);
    },
    onError: errorHandler,
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

async function generateSuggestionsFromConversation({
  messages,
}: {
  messages: UIMessage[];
}) {
  const mcpClient = await getScientaMcpClient();
  const tools = await mcpClient.tools();
  const suggestions = await generateObject({
    model: anthropic("claude-3-5-haiku-latest"),
    output: "array",

    schema: z.object({
      toolName: z.enum(Object.keys(toolNames) as [string, ...string[]]),
      content: z.string(),
    }),
    system: `\n
    - your goal is to help the user by generating follow-up prompt suggestions for them
    - you will generate PRECISELY 2 follow-up prompt suggestions that the user could use, based on the conversation from the prompt
    - suggestions should leverage the tools available to you
    - a suggestion is of type: { toolName: ToolName; content: string } where ToolName is the name of the tool you suggest and content is the prompt you suggest
    - ensure it is not more than 120 characters long
    - do not use quotes or colons`,
    prompt: JSON.stringify([messages, tools]),
    maxTokens: 120,
  });

  return suggestions;
}

const getScientaMcpClient = async () => {
  // TODO: delete this when it is fixed
  // https://github.com/modelcontextprotocol/python-sdk/issues/838
  const transportType: "sse" | "http" = "sse";

  if (transportType === "sse")
    return await createMCPClient({
      transport: {
        type: "sse",
        url: "https://platform-mcp-452652483423.europe-west4.run.app/sse",
        headers: {
          Authorization: `Bearer ${PLATFORM_API_KEY}`,
        },
      },
    });

  const url = new URL(
    "https://platform-mcp-452652483423.europe-west4.run.app/mcp/",
  );
  return await createMCPClient({
    transport: new StreamableHTTPClientTransport(url, {
      requestInit: {
        headers: {
          Authorization: `Bearer ${PLATFORM_API_KEY}`,
        },
      },
    }),
  });
};
