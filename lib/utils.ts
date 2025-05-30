import { UIMessage } from "ai";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function removeUnfishedToolCalls(message: UIMessage): UIMessage {
  return {
    ...message,
    parts: message.parts?.filter(
      (part) =>
        part.type !== "tool-invocation" ||
        part.toolInvocation.state === "result",
    ),
  };
}
