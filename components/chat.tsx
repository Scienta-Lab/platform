"use client";

import {
  CreateMessage as AiSdkCreateMessage,
  Message,
  useChat,
  UseChatHelpers,
} from "@ai-sdk/react";
import { ToolResult } from "ai";
import {
  LucideArrowRightCircle,
  LucideBox,
  LucideInbox,
  LucideLoader2,
  LucideRotateCcw,
  LucideSend,
  LucideTrash2,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useMemo } from "react";
import { v4 as uuid } from "uuid";

import {
  ConversationMetadata,
  SavedMessage,
  updateMessage,
} from "@/app/actions/chat";
import { ForceGraph, GeneEdge, GeneNode } from "@/components/force-graph";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MarkdownTextMessage, TextMessage } from "@/components/ui/message";
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
import { Article, ArticleCollapsible } from "./article";
import { Trial, TrialCollapsible } from "./trial";
import { Tag } from "./ui/tag";

const suggestions = [
  "Can you create a gene association network for CD5, including only the 20 most co-expressed genes.",
  "Can you create a gene co-expression network for CD5, CD6 and CD7.",
];

export default function Chat({
  conversation,
  messages: initialMessages,
}: {
  conversation?: ConversationMetadata;
  messages?: SavedMessage[];
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

  // If still no conversationId, generate one and update the URL
  useEffect(() => {
    if (conversationId) return;
    const newId = uuid();
    router.replace(`/chat/${newId}${window.location.search}`);

    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chat state
  const {
    messages,
    input,
    handleSubmit: _useChatHandleSubmit,
    setMessages,
    append,
    setInput,
    status,
    error,
    reload,
  } = useChat({
    id: conversationId,
    maxSteps: 5,
    initialMessages,
    sendExtraMessageFields: true,
    experimental_prepareRequestBody: (options) => {
      return { ...options, metadata };
    },
    onFinish: () => {
      // TODO: ideally we would like to refresh only if this is the first message of the
      // conversation, because we do that just to update the title in the sidebar
      router.refresh();
    },
    // I don't like the idea of generating some ids on the client side, but
    // the function is offered by useChat so I guess it's ok for now
    // as I don't have a better solution
    generateId: () => `MESSAGE#${new Date().toISOString()}#${uuid()}`,
  });
  const isLoading = status === "submitted" || status === "streaming";

  // We override the type because we know that the messages are of type SavedMessage
  // as we save each message and then setMessages from the onFinish callback
  const savedMessages = useMemo(() => messages as SavedMessage[], [messages]);
  const stableSetMessages = useCallback(
    (messages: React.SetStateAction<SavedMessage[]>) =>
      setMessages(messages as React.SetStateAction<Message[]>),
    [setMessages],
  );
  const hasMessages = savedMessages.length > 0;

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

  console.log({ messages, status, conversationId, error });

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
              {savedMessages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  conversationId={conversationId}
                  setMessages={stableSetMessages}
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
            {savedMessages.length === 0 || !conversationId
              ? null
              : savedMessages.map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    type="report"
                    conversationId={conversationId}
                    setMessages={stableSetMessages}
                  />
                ))}
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

// Memoize ChatMessage to avoid unnecessary rerenders
const ChatMessage = React.memo(function ChatMessage({
  conversationId,
  message,
  type = "default",
  setMessages,
}: {
  conversationId: string;
  message: SavedMessage;
  type?: "default" | "report";
  setMessages: React.Dispatch<React.SetStateAction<SavedMessage[]>>;
}) {
  const addToReport = async (messageId: string, partIdx: number) => {
    await updateMessage({
      messageId,
      partIdx,
      conversationId,
      updatedFields: { isInReport: true },
    });
    setMessages((prev) => [
      ...prev.map((msg) => {
        if (msg.id === messageId) {
          const newParts = [...msg.parts];
          newParts[partIdx] = {
            ...newParts[partIdx],
            isInReport: true,
          };
          return { ...msg, parts: newParts };
        }
        return msg;
      }),
    ]);
  };

  const removeFromReport = async (messageId: string, partIdx: number) => {
    await updateMessage({
      messageId,
      partIdx,
      conversationId,
      updatedFields: { isInReport: false },
    });
    setMessages((prev) => [
      ...prev.map((msg) => {
        if (msg.id === messageId) {
          const newParts = [...msg.parts];
          newParts[partIdx] = {
            ...newParts[partIdx],
            isInReport: false,
          };
          return { ...msg, parts: newParts };
        }
        return msg;
      }),
    ]);
  };

  const updateThreshold = async (
    messageId: string,
    partIdx: number,
    threshold: number,
  ) => {
    await updateMessage({
      messageId,
      partIdx,
      conversationId,
      updatedFields: { threshold },
    });
    setMessages((prev) => [
      ...prev.map((msg) => {
        if (msg.id === messageId) {
          const newParts = [...msg.parts];
          newParts[partIdx] = {
            ...newParts[partIdx],
            threshold,
          };
          return { ...msg, parts: newParts };
        }
        return msg;
      }),
    ]);
  };

  return message.parts?.map((part, idx) => {
    if (part.type !== "text" && part.type !== "tool-invocation") return null;
    if (type === "report" && !part.isInReport) return null;

    const disabled = type === "default" && part.isInReport;
    const role = message.role === "user" ? "user" : "assistant";

    if (part.type === "text") {
      return (
        <TextMessageActions
          key={`${message.id}-${idx}`}
          buttonProps={{ disabled }}
          onSave={
            type === "default" ? () => addToReport(message.id, idx) : undefined
          }
          onDelete={
            type === "report"
              ? () => removeFromReport(message.id, idx)
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
            key={`${message.id}-${idx}`}
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
    }

    if (part.toolInvocation.state !== "result") return null;

    //
    // Result states
    //

    if (part.toolInvocation.result.isError) {
      return (
        <ErrorMessage key={`${message.id}-${idx}`}>
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
        return (
          <ErrorMessage key={`${message.id}-${idx}`}>
            {networkResult.message}
          </ErrorMessage>
        );
      }

      const { nodes, edges } = networkResult;
      return (
        <FigureMessageActions
          key={`${message.id}-${idx}`}
          buttonProps={{ disabled }}
          onSave={
            type === "default" ? () => addToReport(message.id, idx) : undefined
          }
          onDelete={
            type === "report"
              ? () => removeFromReport(message.id, idx)
              : undefined
          }
        >
          <ForceGraph
            defaultThreshold={part.threshold}
            onTresholdSet={(threshold) =>
              updateThreshold(message.id, idx, threshold)
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
          key={`${message.id}-${idx}`}
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
          key={`${message.id}-${idx}`}
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

    if (toolName === "data-analysis_generate_figure_from_dataset") {
      const { data, mimeType } = part.toolInvocation.result.content[0];
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${message.id}-${idx}`}
          src={`data:${mimeType};base64,${data}`}
          alt="Generated figure"
          className="max-w-full rounded border border-gray-300"
        />
      );
    }

    // Default case for other tool invocations
    return (
      <TextMessageActions
        key={`${message.id}-${idx}`}
        buttonProps={{ disabled }}
        onSave={
          type === "default" ? () => addToReport(message.id, idx) : undefined
        }
        onDelete={
          type === "report"
            ? () => removeFromReport(message.id, idx)
            : undefined
        }
      >
        <MarkdownTextMessage key={`${message.id}-${idx}`} role={role}>
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
  onClick,
}: {
  onClick: (message: AiSdkCreateMessage) => void;
}) => {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-4">
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

type ToolName =
  | "enigma_generate_network"
  | "biomcp_article_details"
  | "biomcp_article_searcher"
  | "biomcp_trial_protocol"
  | "biomcp_trial_locations"
  | "biomcp_trial_outcomes"
  | "biomcp_trial_references"
  | "biomcp_trial_searcher"
  | "biomcp_variant_details"
  | "biomcp_variant_searcher"
  | "data-analysis_generate_figure_from_dataset";
