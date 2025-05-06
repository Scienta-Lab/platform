import { cn } from "@/lib/utils";

export const TextMessage = ({
  role = "user",
  children,
  className,
  ...props
}: React.ComponentProps<"p"> & { role: "assistant" | "user" }) => {
  return (
    <p
      className={cn(
        "max-w-prose rounded-lg p-2 text-xs leading-4.5",
        role === "user" ? "bg-secondary/20 ml-auto" : "bg-gray-200",
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
};
