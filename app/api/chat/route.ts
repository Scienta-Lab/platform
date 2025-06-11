import { anthropic } from "@ai-sdk/anthropic";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  APICallError,
  appendResponseMessages,
  createDataStreamResponse,
  experimental_createMCPClient as createMCPClient,
  generateObject,
  generateText,
  Message,
  streamText,
  StreamTextTransform,
  ToolSet,
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
import { isToolTag, toolNames, ToolTag, toolTags } from "@/lib/tools";
import { removeUnfishedToolCalls } from "@/lib/utils";

// Allow streaming responses up to 45 seconds
export const maxDuration = 45;

export async function POST(req: Request) {
  await verifySession();

  const { messages, id, metadata } = (await req.json()) as {
    messages: UIMessage[];
    id: string;
    metadata: { diseases: string[]; samples: string[] } | undefined;
  };

  const maybeMcpClient = await getScientaMcpClient();
  if (maybeMcpClient instanceof Error)
    return dataStreamError(maybeMcpClient.message);

  const mcpClient = maybeMcpClient;
  const maybeAllTools = await getToolsFromMcpClient(mcpClient);
  if (maybeAllTools instanceof Error)
    return dataStreamError(maybeAllTools.message);

  const tools = overrideToolExecution(maybeAllTools, id);

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
      if (lastMessage && lastMessage.role === "user") {
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
        experimental_transform: addCustomAttributesTransform(tools),
        toolCallStreaming: true,
        // model: anthropic("claude-3-haiku-20240307"),
        maxRetries: 0,
        maxSteps: 5,
        abortSignal: AbortSignal.timeout(1000 * 60 * 2), // 2 minutes
        messages: updatedMessages,
        tools,
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
          await mcpClient.close();

          const newMessages = appendResponseMessages({
            messages: updatedMessages,
            responseMessages: response.messages,
          });

          const newMessage = newMessages.at(-1);
          if (!newMessage) return;

          const newMessageWithCustomAttributes =
            enhanceMessagesWithCustomAttributes(newMessage, tools);

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

          const savedAssistantMessage = await saveMessage({
            conversationId: id,
            // Seems that asserting to UIMessage  legit, he is working on AI SDK
            // https://github.com/nicoalbanese/ai-sdk-persistence-db/blob/9b90886a832c9fbe816144cd753bcf4c1958470d/app/api/chat/route.ts#L87
            message: removeUnfishedToolCalls({
              ...newMessageWithCustomAttributes,
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

type ExtendedToolSet = ToolSet & {
  [K in keyof ToolSet]: ToolSet[K] & { tag?: ToolTag };
};

const enhanceMessagesWithCustomAttributes = (
  message: Message,
  tools: ExtendedToolSet,
) => {
  if (!message.parts) return message;

  const enhancedParts: typeof message.parts = [];
  for (const part of message.parts) {
    if (
      part.type !== "tool-invocation" ||
      part.toolInvocation.state === "partial-call"
    ) {
      enhancedParts.push(part);
      continue;
    }

    const toolName = part.toolInvocation.toolName;
    const tag = tools[toolName]?.tag;
    enhancedParts.push({
      ...part,
      toolInvocation: {
        ...part.toolInvocation,
        // @ts-expect-error - We patched the lib to be able to add custom attributes
        customAttributes: {
          tag,
        },
      },
    });
  }
  message.parts = enhancedParts;
  return message;
};

const addCustomAttributesTransform =
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  <T extends ExtendedToolSet>(tools: T): StreamTextTransform<T> =>
    ({ tools: toolsParam }) => {
      return new TransformStream({
        transform(chunk, controller) {
          if (chunk.type === "tool-call-streaming-start") {
            controller.enqueue({
              ...chunk,
              // @ts-expect-error - We patched the lib to be able to add custom attributes
              customAttributes: {
                tag: toolsParam[chunk.toolName]?.tag,
              },
            });
          } else if (chunk.type === "tool-call-delta") {
            controller.enqueue({
              ...chunk,
              // @ts-expect-error - We patched the lib to be able to add custom attributes
              customAttributes: {
                tag: toolsParam[chunk.toolName]?.tag,
              },
            });
          } else if (chunk.type === "tool-call") {
            controller.enqueue({
              ...chunk,
              customAttributes: {
                tag: toolsParam[chunk.toolName]?.tag,
              },
            });
          } else if (chunk.type === "tool-result") {
            controller.enqueue({
              ...chunk,
              customAttributes: {
                tag: toolsParam[chunk.toolName]?.tag,
              },
            });
          } else {
            controller.enqueue(chunk);
          }
        },
      });
    };

function errorHandler(error: unknown) {
  console.log(error);
  if (error === null || error === undefined) return "Unknown error";

  if (typeof error === "string") return error;

  // Can't return an Error object because of createDataStreamResponse onError param type.
  // We have to send it to the client as a string and parse it there.
  if (APICallError.isInstance(error)) {
    return JSON.stringify({
      type: "AI_APICallError",
      message: error.message,
      retryAfter:
        "responseHeaders" in error
          ? error.responseHeaders?.["retry-after"]
          : undefined,
    });
  }

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

  return res.object;
}

const getScientaMcpClient = async () => {
  try {
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
  } catch (error) {
    return error instanceof Error
      ? error
      : new Error("Failed to create MCP client");
  }
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

const dataStreamError = (message: string) => {
  return createDataStreamResponse({
    execute: () => {
      throw new Error(message);
    },
    onError: errorHandler,
  });
};

const overrideToolExecution = (
  tools: Exclude<Awaited<ReturnType<typeof getToolsFromMcpClient>>, Error>,
  conversationId: string,
) => {
  const taggedTools: Record<
    keyof typeof tools,
    (typeof tools)[keyof typeof tools] & { tag?: ToolTag }
  > = tools;
  for (const name in tools) {
    const description = tools[name].description;
    const secondLine = description?.split("\n")[1].trim();
    if (!secondLine?.startsWith("tags:")) continue;
    // For now we assume there is only one tag per tool
    const tag = secondLine.replace("tags:", "").trim();

    if (!isToolTag(tag)) {
      throw new Error(
        `Tool ${name} has an invalid tag: ${tag}. Valid tags are: ${toolTags.join(", ")}`,
      );
    }

    const extendedTool = tools[name];

    if (tag === "image") {
      const originalExecute = extendedTool.execute;
      extendedTool.execute = async (args, options) => {
        // Asserting as MCP tool return type for image tools
        const result = (await originalExecute(args, options)) as
          | {
              isError: false;
              content: [{ mimeType: string; data: string }];
            }
          | { isError: true; content: [{ text: string }] };

        if (result.isError) throw new Error(result.content[0].text);
        const { mimeType, data } = result.content[0];
        const imageData = await prepareImageForUpload(data, mimeType);
        const uploadedImage = await uploadImage({
          ...imageData,
          conversationId,
        });
        return uploadedImage;
      };
    }

    taggedTools[name] = extendedTool;
    taggedTools[name].tag = tag;
  }
  return taggedTools;
};
