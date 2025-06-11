import { UIMessage } from "ai";

import { ToolName } from "./tools";

export type PartMetadata = {
  isInReport?: boolean;
  threshold?: number;
};
export type UIMessageAnnotation = {
  dbId: string;
  PK: string;
  SK: string;
  type: "text" | "figure";
  createdAt: string;
  // Record key is formatted as "part_${partIdx}"
  parts: Record<string, PartMetadata>;
  suggestions?: { toolName: ToolName; content: string }[];
};

export const getMessageAnnotations = (message: UIMessage) =>
  message.annotations?.[0] as UIMessageAnnotation | undefined;

export const isAPICallError = (
  error: object | undefined,
): error is {
  type: "AI_APICallError";
  message: string;
  retryAfter?: number;
} => {
  return (
    error !== undefined &&
    "type" in error &&
    error.type === "AI_APICallError" &&
    "message" in error &&
    typeof error.message === "string"
  );
};
