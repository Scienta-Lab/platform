"use client";

import { useChat, UseChatHelpers } from "@ai-sdk/react";
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
import { memo, SyntheticEvent, useEffect, useRef, useState } from "react";
import { v4 as uuid } from "uuid";

import {
  ConversationMetadata,
  getImageUrl,
  getMessages,
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
import {
  getMessageAnnotations,
  isAPICallError,
  PartMetadata,
} from "@/lib/chat";
import { isThinkingTool, ToolName } from "@/lib/tools";
import { cn, removeUnfishedToolCalls } from "@/lib/utils";
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
  const {
    input,
    handleSubmit: _useChatHandleSubmit,
    messages,
    setMessages,
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
    onFinish: () => {
      // We only refresh the router to update the conversation title in the report and sidebar
      // So we only do that after the first assistant message gets back
      // Ideally we would do that as soon as the conversation is created
      if (messagesRef.current && messagesRef.current.length === 2) {
        router.refresh();
      }

      // Handles sync with additional data sent from the server
      // This is used to update the last saved user message in the chat (in order to apply the annotations)
      if (dataRef.current !== undefined) {
        // Type derived from api/chat/route.ts
        const lastSavedUserMessage = dataRef.current[0] as unknown as UIMessage;
        const lastMessageIdx = messagesRef.current?.findLastIndex(
          (m) => m.role === "user",
        );

        if (lastMessageIdx === undefined) return;

        setMessages((prev) => {
          const updatedMessages = [...prev];
          updatedMessages[lastMessageIdx] = lastSavedUserMessage;
          console.log({ updatedMessages });

          return updatedMessages;
        });

        setData(undefined);
      }
    },
    onError: async (error) => {
      console.log("An error occured: ", error);
      // In case there is an error during the first assistant message, onFinish is not called
      // So we have to refresh the router here to update the conversation title in the report and sidebar
      if (messagesRef.current && messagesRef.current.length === 2) {
        router.refresh();
      }

      let apiError;
      try {
        apiError = JSON.parse(error.message) as object;
      } catch {}

      console.log("API error: ", apiError);

      // We have to distinguish between regular errors and these ones as for
      // regular ones, onFinish is called and thus the last message is saved even if unfinished.
      // But with these ones, onFinish is not called and thus we have to save the last message manually
      if (!isAPICallError(apiError) || !messagesRef.current) return;

      console.log("apiError is an API call error");

      // If the last message is already saved, we don't need to save it again
      // We have to get messages like this because the last message might be saved already but the
      // client doesn't know about it yet
      // Ideally we wouldn't need to do that like this
      const savedMessages = await getMessages(conversationId, {
        keysOnly: true,
      });
      console.log(
        "Saved messages: ",
        savedMessages,
        "messagesRef.current: ",
        messagesRef.current,
      );
      if (savedMessages.length === messagesRef.current.length) return;

      const lastMessage = messagesRef.current.at(-1);

      console.log("Last message: ", lastMessage);
      if (!lastMessage) return;

      console.log("Saving last message following API call error", lastMessage);
      saveMessage({
        conversationId,
        // Needed to avoid error: "ToolInvocation must have a result"
        // https://github.com/vercel/ai/issues/4584
        message: removeUnfishedToolCalls(lastMessage),
      });
    },

    experimental_prepareRequestBody: (options) => {
      return { ...options, metadata };
    },
  });
  const [areSuggestionsVisible, setAreSuggestionsVisible] = useState(
    messages && messages.length === 0,
  );
  // This is required to be able to access messages and data in the onFinish callback
  // I don't like this approach, but it's the best solution I've found so far
  // This allows us to get rid of useEffects, making things simpler
  const messagesRef = useRef(initialMessages);
  messagesRef.current = messages;
  const dataRef = useRef(data);
  dataRef.current = data;

  const isLoading = status === "submitted" || status === "streaming";

  const handleSubmit: UseChatHelpers["handleSubmit"] = async (e) => {
    if (window.location.pathname !== `/chat/${conversationId}`)
      window.history.pushState(
        {},
        "",
        `/chat/${conversationId}/${window.location.search}`,
      );

    _useChatHandleSubmit(e);
    setAreSuggestionsVisible(false);
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

  const lastMessage = messages.at(-1);
  const lastSuggestions =
    (lastMessage && getMessageAnnotations(lastMessage)?.suggestions) ?? [];

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
        <div className="no-scrollbar flex h-full flex-col-reverse space-y-5 overflow-x-hidden overflow-y-auto">
          {areSuggestionsVisible && messages.length === 0 ? (
            <Suggestions
              onClick={(m) => {
                setInput(m);
                setAreSuggestionsVisible(false);
              }}
            />
          ) : null}
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 pt-4 pb-5">
            {messages.map((msg, idx) => (
              <ChatMessage
                key={idx}
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
                {error?.message
                  ? parseErrorMessage(error.message)?.message
                  : (error?.message ??
                    "An error occurred while processing your request.")}
              </ErrorMessage>
            ) : null}
            {areSuggestionsVisible && lastSuggestions?.length > 0 ? (
              <Suggestions
                onClick={(message) => {
                  setInput(message);
                  setAreSuggestionsVisible(false);
                }}
                suggestions={lastSuggestions?.slice(0, 2).map((s) => s.content)}
              />
            ) : null}
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="stack mx-auto -mt-1 mb-4 w-full max-w-2xl"
        >
          <textarea
            placeholder="Ask something to Eva"
            className="z-10 w-full resize-none scroll-p-15 rounded-lg border border-gray-300 bg-white p-4 pb-15 text-sm"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={(e) => setInput(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            rows={4}
          />
          <div className="m-3 flex items-center gap-3 place-self-end">
            <Button
              className="z-20 h-auto rounded-full bg-yellow-600 py-1.5 text-white shadow-none hover:bg-yellow-600/90 has-[>svg]:px-1.5"
              type="button"
              disabled={
                (lastSuggestions.length === 0 || isLoading) &&
                !(messages.length === 0)
              }
              onClick={() => setAreSuggestionsVisible((prev) => !prev)}
            >
              <LucideLightbulb className="size-5" />
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 z-20 h-auto rounded-full py-2 text-white shadow-none has-[>svg]:px-2"
              type="submit"
              disabled={isLoading || !input || !conversationId}
            >
              {isLoading ? (
                <LucideLoader2 className="size-4 animate-spin" />
              ) : (
                <LucideSend className="size-4 -translate-x-px translate-y-px" />
              )}
            </Button>
          </div>
          <div className="relative z-20 m-3 flex items-center gap-2 self-end justify-self-start">
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

      <ResizablePanel defaultSize={0.5} className="h-[100dvh] overflow-hidden">
        <div className="flex h-full flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-200 p-6 pb-3">
            <p className="font-bold">Report</p>
            <Button className="bg-primary font-bold" onClick={saveReport}>
              Save
            </Button>
          </div>
          <div className="no-scrollbar flex flex-col gap-4 overflow-y-scroll p-6">
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
        toolName === "_enigma_enigma_network_generate_network" ||
        toolName === "_precisesads_generate_figure_from_dataset"
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

    if (toolName === "_enigma_enigma_network_generate_network") {
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
    if (toolName === "_precisesads_generate_figure_from_dataset") {
      const { imageKey } = part.toolInvocation.result;
      return <ImageFigure key={key} imageKey={imageKey} />;
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
    <div className="stack aspect-video overflow-hidden rounded-lg border border-gray-200">
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
  onClick: (message: string) => void;
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
            onClick={() => onClick(text)}
          >
            <CardContent className="stack h-full px-0 py-0">
              <p className="p-5 text-sm">{text}</p>
              <Button
                className="m-1 h-auto place-self-end rounded-full bg-transparent py-3 text-gray-500 shadow-none hover:bg-black/5 has-[>svg]:px-3"
                type="button"
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

const parseErrorMessage = (error: string) => {
  try {
    const parsedError = JSON.parse(error);
    if (isAPICallError(parsedError)) {
      return new Error(parsedError.message);
    }
  } catch {}
  return undefined;
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

// We could save the url in the message part itself in order to avoid fetching it
// as long as it is not expired
const ImageFigure = ({ imageKey }: { imageKey: string }) => {
  const [url, setUrl] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const fetchImage = async () => {
      try {
        setIsLoading(true);
        setError(undefined);
        const res = await getImageUrl(imageKey);
        setUrl(res.url);
      } catch (err) {
        if (retryCount === 0) {
          setRetryCount(1);
          return;
        }

        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchImage();
  }, [imageKey, retryCount]);

  const handleImageError = (e: SyntheticEvent<HTMLImageElement, Event>) => {
    if (retryCount === 0) {
      setRetryCount(1);
      setIsLoading(true);
    } else {
      setError(e instanceof Error ? e.message : "Unknown error");
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="grid aspect-video place-items-center rounded border border-gray-300">
        <div className="flex flex-col items-center justify-center">
          <LucideLoader2 className="text-primary size-8 animate-spin" />
          <span className="mt-4 text-sm text-gray-500">Loading image...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid aspect-video place-items-center rounded border border-gray-300 bg-red-50">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="mb-2 text-4xl text-red-500">⚠️</div>
          <span className="text-sm font-medium text-red-700">
            Failed to load image
          </span>
          <span className="mt-1 text-xs text-red-600">{error}</span>
        </div>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt="Generated figure"
      className="aspect-video max-w-full rounded border border-gray-300 object-contain"
      onError={handleImageError}
    />
  );
};
