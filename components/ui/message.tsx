import { cn } from "@/lib/utils";
import { MemoizedMarkdown } from "../markdown";

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
