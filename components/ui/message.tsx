import { cn } from "@/lib/utils";
import { MemoizedMarkdown } from "../markdown";

export const TextMessage = ({
  role = "user",
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  children: string;
  role: "assistant" | "user";
}) => {
  return (
    <div
      className={cn(
        "prose prose-sm prose-neutral prose-h1:text-xl max-w-prose rounded-lg p-2 text-xs leading-4.5",
        role === "user" ? "bg-secondary/20 ml-auto" : "bg-gray-200",
        className,
      )}
      {...props}
    >
      <MemoizedMarkdown content={children} id="message" />
    </div>
  );
};
