import { anthropic } from "@ai-sdk/anthropic";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  APICallError,
  appendResponseMessages,
  createDataStreamResponse,
  experimental_createMCPClient as createMCPClient,
  generateObject,
  generateText,
  streamText,
  tool,
  UIMessage,
} from "ai";
import z from "zod";

import {
  prepareImageForUpload,
  saveMessage,
  startConversation,
  uploadImage,
} from "@/app/actions/chat";
import { getMessageAnnotations } from "@/lib/chat";
import { verifySession } from "@/lib/dal";
import { PLATFORM_API_KEY } from "@/lib/taintedEnvVar";
import { toolNames } from "@/lib/tools";
import { removeUnfishedToolCalls } from "@/lib/utils";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  await verifySession();

  const { messages, id, metadata } = (await req.json()) as {
    messages: UIMessage[];
    id: string;
    metadata: { diseases: string[]; samples: string[] } | undefined;
  };

  // TODO: clean up error handling for the MCP client initialization and tool fetching

  const maybeMcpClient = await getScientaMcpClient();
  if (maybeMcpClient instanceof Error) {
    const error = maybeMcpClient;
    // How on earth do we have to do that to get useChat to handle errors?
    // Found no documentation on that. Full improvisation.
    return createDataStreamResponse({
      execute: () => {
        throw new Error("MCP server: " + error.message);
      },
      onError: errorHandler,
    });
  }

  const mcpClient = maybeMcpClient;
  const maybeAllTools = await getToolsFromMcpClient(mcpClient);

  if (maybeAllTools instanceof Error) {
    const error = maybeAllTools;
    return createDataStreamResponse({
      execute: () => {
        throw new Error("MCP server: " + error.message);
      },
      onError: errorHandler,
    });
  }

  const allTools = maybeAllTools;
  const generateFigureTool =
    allTools["_precisesads_generate_figure_from_dataset"];
  delete allTools["_precisesads_generate_figure_from_dataset"];
  const tools = allTools;

  // Need to wrap everything in createDataStreamResponse to access the dataStream
  // https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data#sending-custom-data-from-the-server
  return createDataStreamResponse({
    execute: async (dataStream) => {
      let conversation:
        | Awaited<ReturnType<typeof startConversation>>
        | undefined;
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
      console.log("Server: Last message:", lastMessage);
      if (lastMessage && lastMessage.role === "user") {
        console.log("Server: Saving user message:", lastMessage);
        savedUserMessage = await saveMessage({
          conversationId: conversation?.id || id,
          message: lastMessage,
        });
      }

      const updatedMessages = !savedUserMessage
        ? messages
        : [...messages.slice(0, -1), savedUserMessage];

      const result = streamText({
        model: anthropic("claude-3-7-sonnet-20250219"),
        // model: anthropic("claude-3-haiku-20240307"),
        maxRetries: 0,
        maxSteps: 5,
        abortSignal: AbortSignal.timeout(1000 * 60 * 2), // 2 minutes
        messages: updatedMessages,
        tools: Object.assign(tools, {
          _precisesads_generate_figure_from_dataset: tool({
            ...generateFigureTool,
            execute: async (args, options) => {
              const result = (await generateFigureTool.execute(
                args,
                options,
              )) as unknown as
                | {
                    isError: false;
                    content: [{ mimeType: string; data: string }];
                  }
                | { isError: true; content: [{ text: string }] };

              if (result.isError) throw new Error(result.content[0].text);
              const { mimeType, data } = result.content[0];
              const imageData = await prepareImageForUpload(data, mimeType);
              const uploadedImage = uploadImage({
                ...imageData,
                conversationId: conversation?.id || id,
              });
              return uploadedImage;
            },
          }),
        }),
        system: `
          You are a immunologist agent in charge of leveraging tools at your disposal to solve biology and immunology questions 
          and help develop new treatments in immunology & inflammation.
          ${
            conversation?.metadata?.diseases && conversation.metadata.samples
              ? ` 
          You are particularly interested in the following diseases: ${conversation.metadata.diseases.join(", ")} and tissues ${conversation.metadata.samples.join(", ")}, so use tools with the corresponding arguments.`
              : ""
          }. 
          When you call tools, their result will be automatically displayed to the user. Do not repeat them to the user. Instead,
          assert that you successfully called the tool and give a bit of context if needed. 
          Do specifically what is asked by the user, not more, do not call tools if not specifically asked in the question. 
          If the question is too broad or not specific enough and several tools may be useful to answer it, ask for specification, based on the tools you have at your disposal.`,
        onError: (error) => {
          console.log("StreamText error:", error);
        },
        onFinish: async ({ response }) => {
          console.log("Serve: onFinish called");

          await mcpClient.close();

          const newMessages = appendResponseMessages({
            messages: updatedMessages,
            responseMessages: response.messages,
          });
          const newMessage = newMessages.at(-1);

          console.log("Server: New message:", newMessage);
          if (!newMessage) return;

          console.log("Tools: ", Object.keys(tools));
          // The LLM might fail to generate suggestions
          // For example sometimes it doesn't generate an object of the right shape
          // Thus for now we just catcxh the error and save an empty array
          let suggestions;
          try {
            suggestions = await generateSuggestionsFromConversation({
              messages: newMessages as UIMessage[],
              tools,
            });
          } catch (error) {
            console.error(
              "Error generating suggestions:",
              error instanceof Error ? error.message : error,
            );
          }

          // We save the message with the suggestions
          const annotations = [{ suggestions: suggestions ?? [] }];

          console.log("Server: Saving assistant message:", {
            ...newMessage,
            annotations,
          });
          const savedAssistantMessage = await saveMessage({
            conversationId: id,
            // Seems that asserting to UIMessage  legit, he is working on AI SDK
            // https://github.com/nicoalbanese/ai-sdk-persistence-db/blob/9b90886a832c9fbe816144cd753bcf4c1958470d/app/api/chat/route.ts#L87
            message: removeUnfishedToolCalls({
              ...newMessage,
              annotations,
            } as UIMessage),
          });

          // We append annotations from the saved message to the message we are streaming back
          const savedAssistantMessageAnnotations = getMessageAnnotations(
            savedAssistantMessage,
          );
          if (!savedAssistantMessageAnnotations)
            throw new Error(
              "No annotations found for the saved assistant message",
            );
          dataStream.writeMessageAnnotation(savedAssistantMessageAnnotations);

          // We send annotations from the last user message through the data stream
          if (!savedUserMessage) throw new Error("No saved user message found");
          dataStream.writeData(JSON.parse(JSON.stringify(savedUserMessage)));
        },
      });

      result.mergeIntoDataStream(dataStream);
    },
    onError: errorHandler,
  });
}

function errorHandler(error: unknown) {
  console.log(error);
  if (error === null || error === undefined) return "Unknown error";

  if (typeof error === "string") return error;

  // Can't return an Error object because of createDataStreamResponse onError param type.
  // We have to send it to the client as a string and parse it there.
  if (APICallError.isInstance(error))
    return JSON.stringify({ type: "AI_APICallError", message: error.message });

  if (error instanceof Error) return error.message;

  try {
    return JSON.stringify(error);
  } catch {
    return "Error serialization failed";
  }
}

// From
// https://github.com/vercel/ai-chatbot/blob/8a7d3e9950bfb363e92bd58200b9366053102d02/app/(chat)/actions.ts#L18
async function generateTitleFromUserMessage({
  message,
}: {
  message: UIMessage;
}) {
  const { text: title } = await generateText({
    model: anthropic("claude-3-5-sonnet-latest"),
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
  tools,
}: {
  messages: UIMessage[];
  tools: Exclude<Awaited<ReturnType<typeof getToolsFromMcpClient>>, Error>;
}) {
  const toolNameKeys = Object.keys(toolNames) as [string, ...string[]];

  const res = await generateObject({
    model: anthropic("claude-3-5-haiku-latest"),
    output: "array",
    schema: z.object({
      toolName: z.enum(toolNameKeys),
      content: z.string().max(120),
    }),
    system: `You are tasked with generating exactly 2 follow-up prompt suggestions for the user.

Rules:
- Generate EXACTLY 2 suggestions
- Each suggestion must use one of these available tools: ${toolNameKeys.join(", ")}
- Each suggestion content must be under 120 characters
- Base suggestions on the conversation context
- Format: Return an array of objects with toolName and content properties
- Do not include quotes, colons, or special formatting in content

Example format:
[
  {"toolName": "tool1", "content": "suggestion text here"},
  {"toolName": "tool2", "content": "another suggestion"}
]`,
    prompt: `Conversation: ${JSON.stringify(messages)}\nAvailable tools: ${JSON.stringify(tools)}`,
    maxTokens: 300,
  });

  console.log("Server: Suggestions result:", JSON.stringify(res));
  return res.object;
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

const getToolsFromMcpClient = async (
  client: Awaited<ReturnType<typeof createMCPClient>>,
) => {
  try {
    const tools = await Promise.race([
      client.tools(),
      new Promise<Error>((_, reject) =>
        setTimeout(
          () =>
            reject(new Error("MCP tools request timed out after 30 seconds")),
          30_000,
        ),
      ),
    ]);
    return tools;
  } catch (error) {
    return error instanceof Error
      ? error
      : new Error(
          "Unknown error occurred while fetching tools from MCP client",
        );
  }
};
