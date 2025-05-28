"use client";

import {
  CreateMessage as AiSdkCreateMessage,
  useChat,
  UseChatHelpers,
} from "@ai-sdk/react";
import { ToolResult, UIMessage } from "ai";
import {
  LucideArrowRightCircle,
  LucideBox,
  LucideInbox,
  LucideLightbulb,
  LucideLoader2,
  LucideRotateCcw,
  LucideSend,
  LucideTrash2,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { memo, useEffect, useState } from "react";
import { v4 as uuid } from "uuid";

import {
  ConversationMetadata,
  saveMessage,
  updateMessage,
} from "@/app/actions/chat";
import { GeneEdge, GeneNode, StaticForceGraph } from "@/components/force-graph";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  MarkdownTextMessage,
  TextMessage,
  ThinkingMessage,
} from "@/components/ui/message";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { getMessageAnnotations, PartMetadata } from "@/lib/chat";
import { isThinkingTool, ToolName } from "@/lib/tools";
import { cn } from "@/lib/utils";
import { Article, ArticleCollapsible } from "./article";
import { Trial, TrialCollapsible } from "./trial";
import { Tag } from "./ui/tag";

const defaultSuggestions = [
  "Can you create a gene association network for CD5, including only the 20 most co-expressed genes.",
  "Can you create a gene co-expression network for CD5, CD6 and CD7.",
];

export default function Chat({
  conversation,
  messages: initialMessages,
}: {
  conversation?: ConversationMetadata;
  messages?: UIMessage[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const metadata = conversation?.metadata ?? {
    samples: searchParams.get("samples")?.split(",") ?? [],
    diseases: searchParams.get("diseases")?.split(",") ?? [],
  };

  // Try to get the conversationId from the conversation object
  let conversationId: string | undefined = conversation?.id;

  // If not found, try to get it from the URL
  if (!conversationId) {
    const pathParts = pathname.split("/").filter(Boolean);
    const chatIdx = pathParts.indexOf("chat");
    if (chatIdx !== -1 && pathParts.length > chatIdx + 1) {
      conversationId = pathParts[chatIdx + 1];
    }
  }

  // If still no conversationId, generate one
  conversationId = conversationId ?? uuid();

  // Chat state
  const [areSuggestionsVisible, setAreSuggestionsVisible] = useState(false);
  const {
    input,
    handleSubmit: _useChatHandleSubmit,
    messages,
    setMessages,
    append,
    setInput,
    data,
    setData,
    status,
    error,
    reload,
  } = useChat({
    id: conversationId,
    maxSteps: 5,
    initialMessages,
    experimental_prepareRequestBody: (options) => {
      return { ...options, metadata };
    },
  });
  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    // After refreshing the router with router.refresh() above, we need to sync the messages
    // with the initial messages from the server
    setMessages(initialMessages ?? []);
  }, [setMessages, initialMessages]);

  useEffect(() => {
    if (status !== "error" || !conversationId) return;

    // If there is a status error, then onFinish has not been called on the server
    // and thus the last message is not saved in the database yet
    const lastMessage = messages.at(-1) as UIMessage | undefined;

    if (!lastMessage) return;

    // If the last message is already saved, we don't need to save it again
    if ("PK" in lastMessage && lastMessage.PK !== undefined) return;

    saveMessage({
      conversationId,
      message: lastMessage,
    });
  }, [status, messages, router, conversationId]);

  // Handles sync with additional data sent from the server
  // This is used to update the last saved user message in the chat (in order to apply the annotations)
  // And to refresh the page if it's the first response (in order to display the conversation title in the report and sidebar)
  useEffect(() => {
    if (data !== undefined) {
      // Type derived from api/chat/route.ts
      const { lastSavedUserMessage, isFirstResponse } = data[0] as {
        lastSavedUserMessage?: UIMessage;
        isFirstResponse?: boolean;
      };

      if (!lastSavedUserMessage || isFirstResponse === undefined) {
        console.error("Invalid data received from server:", data);
        return;
      }

      if (isFirstResponse) router.refresh();

      const lastMessageIdx = messages.findLastIndex((m) => m.role === "user");
      setMessages((prev) => {
        const updatedMessages = [...prev];
        if (lastMessageIdx === -1) return updatedMessages;
        updatedMessages[lastMessageIdx] = lastSavedUserMessage;
        return updatedMessages;
      });
      setData(undefined);
    }
  }, [data, messages, router, setMessages, setData]);

  const handleSubmit: UseChatHelpers["handleSubmit"] = async (e) => {
    if (window.location.pathname !== `/chat/${conversationId}`)
      window.history.pushState(
        {},
        "",
        `/chat/${conversationId}/${window.location.search}`,
      );

    _useChatHandleSubmit(e);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const saveReport = async () => {
    console.log("Saving report...");
  };

  const hasMessages = messages.length > 0;
  const lastMessage = messages.at(-1);
  const lastSuggestions = lastMessage
    ? getMessageAnnotations(lastMessage)?.suggestions
    : [];

  console.log({
    messages,
    status,
    conversationId,
    error,
    data,
  });

  return (
    <ResizablePanelGroup className="h-full" direction="horizontal">
      <ResizablePanel
        defaultSize={0.5}
        className="grid h-[100dvh] grid-rows-[1fr_auto] overflow-hidden bg-transparent px-4"
      >
        <div className="no-scrollbar flex h-full flex-col-reverse overflow-x-hidden overflow-y-auto">
          {!hasMessages || !conversationId ? (
            <Suggestions onClick={append} />
          ) : (
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 pt-4 pb-4">
              {messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  conversationId={conversationId}
                  setMessages={
                    setMessages as React.Dispatch<
                      React.SetStateAction<UIMessage[]>
                    >
                  }
                />
              ))}
              {status === "submitted" ? (
                <div className="mt-3 ml-2 flex items-center gap-5">
                  <div className="bg-primary size-3.5 animate-pulse rounded-full"></div>
                </div>
              ) : null}
              {status === "error" ? (
                <ErrorMessage onRetry={reload}>
                  {error?.message ??
                    "An error occurred while processing your request."}
                </ErrorMessage>
              ) : null}
              {areSuggestionsVisible ? (
                <Suggestions
                  onClick={(message) => {
                    append(message);
                    setAreSuggestionsVisible(false);
                  }}
                  suggestions={lastSuggestions
                    ?.slice(0, 2)
                    .map((s) => s.content)}
                />
              ) : null}
            </div>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="stack mx-auto my-4 w-full max-w-2xl"
        >
          <textarea
            placeholder="Ask something to Eva"
            className="w-full resize-none scroll-p-15 rounded-lg border border-gray-300 bg-white p-4 pb-15 text-sm"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={4}
          />
          <Button
            className="m-3 h-auto self-start justify-self-end rounded-full bg-yellow-600 py-1.5 text-white shadow-none hover:bg-yellow-600/90 has-[>svg]:px-1.5"
            type="submit"
            disabled={
              !lastSuggestions || lastSuggestions.length === 0 || isLoading
            }
            onClick={() => setAreSuggestionsVisible((prev) => !prev)}
          >
            <LucideLightbulb className="size-5" />
          </Button>
          <Button
            className="bg-primary hover:bg-primary/90 m-3 h-auto place-self-end rounded-full py-2 text-white shadow-none has-[>svg]:px-2"
            type="submit"
            disabled={isLoading || !input || !conversationId}
          >
            {isLoading ? (
              <LucideLoader2 className="size-4 animate-spin" />
            ) : (
              <LucideSend className="size-4 -translate-x-px translate-y-px" />
            )}
          </Button>
          <div className="relative m-3 flex items-center gap-2 self-end justify-self-start">
            <DataFolderPopover>
              <Button
                size="sm"
                className="bg-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-300"
              >
                <LucideInbox className="size-4" />
                Add a dataset
              </Button>
            </DataFolderPopover>
            <PromptGalleryPopover>
              <Button
                size="sm"
                className="bg-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-300"
              >
                <LucideBox className="size-4" />
                Eva prompt gallery
              </Button>
            </PromptGalleryPopover>
          </div>
        </form>
      </ResizablePanel>

      <ResizableHandle />

      <ResizablePanel defaultSize={0.5}>
        <div className="p-6">
          <div className="mb-3 flex items-center justify-between border-b border-gray-200 pb-3">
            <p className="font-bold">Report</p>
            <Button className="bg-primary font-bold" onClick={saveReport}>
              Save
            </Button>
          </div>
          <div className="mt-6 flex flex-col gap-4">
            {metadata.diseases.length > 0 || metadata.samples.length > 0 ? (
              <div className="flex flex-wrap gap-4 text-sm">
                {metadata.diseases.length > 0 ? (
                  <span className="flex items-center gap-1.5">
                    <p>Diseases:</p>
                    <span className="flex gap-1">
                      {metadata.diseases.map((d) => (
                        <Tag key={d}>{d}</Tag>
                      ))}
                    </span>
                  </span>
                ) : null}
                {metadata.samples.length > 0 ? (
                  <span className="flex items-center gap-1.5">
                    <p>Samples:</p>
                    <span className="flex gap-1">
                      {metadata.samples.map((s) => (
                        <Tag key={s}>{s}</Tag>
                      ))}
                    </span>
                  </span>
                ) : null}
              </div>
            ) : null}
            <h1 className="max-w-prose text-lg">{conversation?.title}</h1>
            {messages.length === 0 || !conversationId
              ? null
              : messages.map((msg, idx) => (
                  <ChatMessage
                    // We have to use the index as key here because of:
                    // https://github.com/vercel/ai/issues/5318
                    key={idx}
                    message={msg}
                    type="report"
                    conversationId={conversationId}
                    setMessages={
                      setMessages as React.Dispatch<
                        React.SetStateAction<UIMessage[]>
                      >
                    }
                  />
                ))}
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

// Memoize ChatMessage to avoid unnecessary rerenders
const ChatMessage = memo(function ChatMessage({
  conversationId,
  message,
  type = "default",
  setMessages,
}: {
  conversationId: string;
  message: UIMessage;
  type?: "default" | "report";
  setMessages: React.Dispatch<React.SetStateAction<UIMessage[]>>;
}) {
  const updateMessageAnnotation = async (
    partIdx: number,
    updatedFields: Partial<PartMetadata>,
  ) => {
    await updateMessage({
      message,
      partIdx,
      conversationId,
      updatedFields,
    });
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== message.id) return msg;

        const annotations = getMessageAnnotations(msg);
        if (!annotations) return msg;
        if (!annotations.parts) return msg;

        const partKey = `part_${partIdx}`;
        const existingPart = annotations.parts[partKey] ?? {};
        const updatedPart = { ...existingPart, ...updatedFields };
        const updatedParts = { ...annotations.parts, [partKey]: updatedPart };

        return {
          ...msg,
          annotations: [{ ...annotations, parts: updatedParts }],
        };
      }),
    );
  };

  const messageAnnotations = getMessageAnnotations(message);
  return message.parts?.map((part, idx) => {
    const key = `${message.id}-${idx}`;
    const partKey = `part_${idx}`;
    const isInReport =
      messageAnnotations?.parts?.[partKey]?.isInReport ?? false;
    if (part.type !== "text" && part.type !== "tool-invocation") return null;
    if (type === "report" && !isInReport) return null;

    const disabled = type === "default" && isInReport;
    const role = message.role === "user" ? "user" : "assistant";

    if (part.type === "text") {
      return (
        <TextMessageActions
          key={key}
          buttonProps={{ disabled }}
          onSave={
            type === "default"
              ? () => updateMessageAnnotation(idx, { isInReport: true })
              : undefined
          }
          onDelete={
            type === "report"
              ? () => updateMessageAnnotation(idx, { isInReport: false })
              : undefined
          }
        >
          <MarkdownTextMessage role={role}>{part.text}</MarkdownTextMessage>
        </TextMessageActions>
      );
    }

    const toolName = part.toolInvocation.toolName as ToolName;

    //
    // Loading states
    //
    if (
      part.toolInvocation.state === "call" ||
      part.toolInvocation.state === "partial-call"
    ) {
      if (
        toolName === "enigma_generate_network" ||
        toolName === "data-analysis_generate_figure_from_dataset"
      ) {
        return (
          <div
            key={key}
            className="bg-secondary/10 grid h-[400px] place-items-center rounded-lg border border-gray-200"
          >
            <div className="flex flex-col items-center justify-center">
              <LucideLoader2 className="text-primary size-8 animate-spin" />
              <span className="mt-4 text-sm text-gray-500">
                Generating figure...
              </span>
            </div>
          </div>
        );
      }

      if (isThinkingTool(toolName)) {
        return <ThinkingMessage key={key} name={toolName} isLoading />;
      }
    }

    if (part.toolInvocation.state !== "result") return null;

    //
    // Result states
    //

    if (part.toolInvocation.result.isError) {
      return (
        <ErrorMessage key={key}>
          {part.toolInvocation.result.content[0].text}
        </ErrorMessage>
      );
    }

    if (toolName === "enigma_generate_network") {
      const networkResult = parseToolInvocationResult<{
        nodes: string[];
        edges: { source: number; target: number; weight: number }[];
      }>(part.toolInvocation);

      if (networkResult instanceof Error) {
        return <ErrorMessage key={key}>{networkResult.message}</ErrorMessage>;
      }

      const { nodes, edges } = networkResult;

      return (
        <FigureMessageActions
          key={key}
          buttonProps={{ disabled }}
          onSave={
            type === "default"
              ? () => updateMessageAnnotation(idx, { isInReport: true })
              : undefined
          }
          onDelete={
            type === "report"
              ? () => updateMessageAnnotation(idx, { isInReport: false })
              : undefined
          }
        >
          <StaticForceGraph
            defaultThreshold={messageAnnotations?.parts?.[partKey]?.threshold}
            onTresholdSet={(threshold) =>
              updateMessageAnnotation(idx, { threshold })
            }
            nodes={
              nodes.map((n, idx) => ({
                id: n,
                idx,
                group: 1,
              })) as GeneNode[]
            }
            links={
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              edges.map((e: any) => ({
                ...e,
                value: e.weight,
              })) as GeneEdge[]
            }
          />
        </FigureMessageActions>
      );
    }

    if (toolName === "biomcp_article_searcher") {
      const articles: Article[] = JSON.parse(
        part.toolInvocation.result.content[0].text,
      );

      return (
        <TextMessage
          key={key}
          role={role}
          className="space-y-1 [&_div]:py-1 [&>div]:border-b [&>div]:border-gray-300 [&>div]:last:border-b-0"
        >
          {articles.map((article, n) => (
            <ArticleCollapsible
              key={`${article.pmid}`}
              article={article}
              defaultOpen={n === 0}
            />
          ))}
        </TextMessage>
      );
    }

    if (toolName === "biomcp_trial_searcher") {
      const trials: Trial[] = JSON.parse(
        part.toolInvocation.result.content[0].text,
      );

      return (
        <TextMessage
          key={key}
          role={role}
          className="space-y-1 [&_div]:py-1 [&>div]:border-b [&>div]:border-gray-300 [&>div]:last:border-b-0"
        >
          {trials.map((trial, n) => (
            <TrialCollapsible
              key={`${trial["NCT Number"]}`}
              trial={trial}
              defaultOpen={n === 0}
            />
          ))}
        </TextMessage>
      );
    }

    if (
      toolName === "dataset-analysis_precisesads_generate_figure_from_dataset"
    ) {
      const { data, mimeType } = part.toolInvocation.result.content[0];
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={key}
          src={`data:${mimeType};base64,${data}`}
          alt="Generated figure"
          className="max-w-full rounded border border-gray-300"
        />
      );
    }

    if (isThinkingTool(toolName)) {
      return (
        <ThinkingMessage key={key} name={toolName}>
          <pre className="no-scrollbar overflow-x-auto">
            {part.toolInvocation.result.content[0].text}
          </pre>
        </ThinkingMessage>
      );
    }

    // Default case for other tool invocations
    return (
      <TextMessageActions
        key={key}
        buttonProps={{ disabled }}
        onSave={
          type === "default"
            ? () => updateMessageAnnotation(idx, { isInReport: true })
            : undefined
        }
        onDelete={
          type === "report"
            ? () => updateMessageAnnotation(idx, { isInReport: false })
            : undefined
        }
      >
        <MarkdownTextMessage key={key} role={role}>
          {part.toolInvocation.result.content[0].text}
        </MarkdownTextMessage>
      </TextMessageActions>
    );
  });
});

const TextMessageActions = ({
  children,
  onSave,
  onDelete,
  buttonProps,
}: {
  children: React.ReactNode;
  onSave?: () => void;
  onDelete?: () => void;
  buttonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
}) => {
  return (
    <div className="flex w-full items-center gap-2">
      {children}
      <Button
        variant="outline"
        className="mr-1 h-auto rounded-full border-none bg-white p-0! hover:scale-110 hover:bg-white"
        size="sm"
        onClick={onSave ?? onDelete}
        {...buttonProps}
      >
        {onSave ? (
          <LucideArrowRightCircle className="bg-primary m-0 size-7 rounded-full text-white" />
        ) : (
          <LucideTrash2 className="m-0 size-6 rounded-full bg-red-400 p-1 text-white" />
        )}
      </Button>
    </div>
  );
};

const FigureMessageActions = ({
  children,
  onSave,
  onDelete,
  buttonProps,
}: {
  children: React.ReactNode;
  onSave?: () => void;
  onDelete?: () => void;
  buttonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
}) => {
  return (
    <div className="stack h-[400px] overflow-hidden rounded-lg border border-gray-200">
      {children}
      <Button
        variant="outline"
        className="z-10 m-2 h-auto self-start justify-self-end rounded-full border-none bg-white p-0! pr-5 hover:scale-110 hover:bg-white"
        size="sm"
        onClick={onSave ?? onDelete}
        {...buttonProps}
      >
        {onSave ? (
          <LucideArrowRightCircle className="bg-primary m-0 size-7 rounded-full text-white" />
        ) : (
          <LucideTrash2 className="m-0 size-6 rounded-full bg-red-400 p-1 text-white" />
        )}
      </Button>
    </div>
  );
};

const Suggestions = ({
  suggestions = defaultSuggestions,
  onClick,
}: {
  suggestions?: string[];
  onClick: (message: AiSdkCreateMessage) => void;
}) => {
  const isUsingDefaultSuggestions = suggestions === defaultSuggestions;
  return (
    <div
      className={cn(
        "mx-auto mt-5 flex max-w-2xl flex-col items-center gap-4",
        !isUsingDefaultSuggestions &&
          "animate-in fade-in-30 slide-in-from-bottom-30 duration-200",
      )}
    >
      <p>Suggestions by Eva</p>
      <div className="flex justify-center gap-5">
        {suggestions.map((text, idx) => (
          <Card
            key={idx}
            className="grid w-1/2 cursor-pointer place-items-center py-0 shadow-none"
            onClick={() => onClick({ role: "user", content: text })}
          >
            <CardContent className="stack h-full px-0 py-0">
              <p className="p-5 text-sm">{text}</p>
              <Button
                className="m-1 h-auto place-self-end rounded-full bg-transparent py-3 text-gray-500 shadow-none hover:bg-black/5 has-[>svg]:px-3"
                type="submit"
              >
                <LucideSend className="size-4 -translate-x-px translate-y-px" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

const DataFolderPopover = ({ children }: { children: React.ReactNode }) => {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-2xl" sideOffset={15}>
        <div className="p-4">
          <h3 className="text-lg font-semibold">Data Folder</h3>
          <p className="text-sm text-gray-500">
            Upload your own dataset to create a custom gene regulatory network.
          </p>
          <div className="grid grid-cols-4 gap-3 py-5">
            <div className="bg-primary/30 h-40 rounded-lg"></div>
            <div className="bg-primary/30 h-40 rounded-lg"></div>
            <div className="bg-primary/30 h-40 rounded-lg"></div>
            <div className="bg-primary/30 h-40 rounded-lg"></div>
            <div className="bg-primary/30 h-40 rounded-lg"></div>
            <div className="bg-primary/30 h-40 rounded-lg"></div>
            <div className="bg-primary/30 h-40 rounded-lg"></div>
            <div className="bg-primary/30 h-40 rounded-lg"></div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const PromptGalleryPopover = ({ children }: { children: React.ReactNode }) => {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-2xl" sideOffset={15}>
        <div className="p-4">
          <h3 className="text-lg font-semibold">Prompt Gallery</h3>
          <p className="text-sm text-gray-500">
            Browse through various prompts to enhance your experience.
          </p>
          <div className="grid grid-cols-4 gap-3 py-5">
            <div className="bg-primary/20 h-40 rounded-lg"></div>
            <div className="bg-primary/20 h-40 rounded-lg"></div>
            <div className="bg-primary/20 h-40 rounded-lg"></div>
            <div className="bg-primary/20 h-40 rounded-lg"></div>
            <div className="bg-primary/20 h-40 rounded-lg"></div>
            <div className="bg-primary/20 h-40 rounded-lg"></div>
            <div className="bg-primary/20 h-40 rounded-lg"></div>
            <div className="bg-primary/20 h-40 rounded-lg"></div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const parseToolInvocationResult = <T,>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toolInvocation: ToolResult<string, any, any>,
): T | Error => {
  try {
    // Shouldn't be necessary, as it is check before in the flow
    if (toolInvocation.result.isError)
      return new Error(toolInvocation.result.content[0].text);
    const parsedResult = JSON.parse(toolInvocation.result.content[0].text);
    // Some tools return an error in the result, so we need to check for that
    if (parsedResult.error) throw new Error(parsedResult.error);
    return parsedResult;
  } catch (error) {
    if (error instanceof Error) {
      return error;
    }
    return new Error(
      `Error parsing tool invocation result for tool ${toolInvocation.toolName}`,
    );
  }
};

const ErrorMessage = ({
  children,
  onRetry,
}: {
  children: React.ReactNode;
  onRetry?: () => void;
}) => {
  return (
    <div
      className="max-w-prose rounded-lg border-l-4 border-red-500 bg-red-100 p-4 text-xs text-red-700"
      role="alert"
    >
      <p className="font-black">Error</p>
      <p>{children}</p>
      {onRetry ? (
        <button
          onClick={onRetry}
          className="mt-1 ml-auto block text-xs font-bold text-red-700"
        >
          Retry
          <LucideRotateCcw className="ml-2 inline-block size-4" />
        </button>
      ) : null}
    </div>
  );
};
