import { LucideCheck, LucideChevronsRight, LucideLoader2 } from "lucide-react";

import { ToolName, toolNames } from "@/lib/tools";
import { cn } from "@/lib/utils";
import { MemoizedMarkdown } from "../markdown";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./collapsible";

export const TextMessage = ({
  role = "user",
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  children: React.ReactNode;
  role: "assistant" | "user";
}) => (
  <div
    className={cn(
      "max-w-prose rounded-lg p-2 text-xs leading-4.5",
      role === "user" ? "bg-secondary/20 ml-auto" : "bg-gray-200",
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

export const MarkdownTextMessage = ({
  children,
  ...props
}: React.ComponentProps<"div"> & {
  children: string;
  role: "assistant" | "user";
}) => (
  <TextMessage
    {...props}
    className="prose prose-sm prose-neutral prose-h1:text-xl"
  >
    <MemoizedMarkdown content={children} id="message" />
  </TextMessage>
);

export const ThinkingMessage = ({
  name,
  isLoading,
  children,
}: {
  name: ToolName;
  isLoading?: boolean;
  children?: React.ReactNode;
}) => {
  const displayName = toolNames[name];
  return (
    <Collapsible className="group max-w-prose rounded-lg bg-violet-100 text-xs">
      <CollapsibleTrigger className="flex w-full items-center gap-2 p-2 text-xs text-gray-500">
        <LucideChevronsRight className="h-4 w-4 text-gray-500 transition-transform group-data-[state=open]:rotate-90" />
        <div className="flex w-full items-center justify-between">
          {displayName}
          {isLoading ? (
            <LucideLoader2 className="h-4 w-4 -translate-y-px animate-spin text-gray-500" />
          ) : (
            <LucideCheck className="h-4 w-4 -translate-y-px text-gray-500" />
          )}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="text-tiny p-2 text-gray-500">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
};
