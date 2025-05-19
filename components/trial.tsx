import { LucidePlus, LucideMinus, LucideExternalLink } from "lucide-react";
import { MemoizedMarkdown } from "./markdown";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";

export type Trial = {
  "NCT Number": string;
  "Study Title": string;
  "Study URL": string;
  "Study Status": string;
  "Brief Summary": string;
  "Study Results": string;
  Conditions: string;
  Interventions: string;
  Phases: string;
  Enrollment: string;
  "Study Type": string;
  "Study Design": string;
  "Start Date": string;
  "Completion Date": string;
};

export function TrialCollapsible({
  trial,
  ...props
}: { trial: Trial } & React.ComponentProps<typeof Collapsible>) {
  return (
    <Collapsible className="group" {...props}>
      <CollapsibleTrigger className="flex w-full cursor-pointer items-start justify-between gap-2 text-left select-none">
        <p className="my-0 truncate">
          <span className="bg-primary/40 rounded-full p-1 font-mono font-semibold text-gray-700">
            {trial["NCT Number"]}
          </span>{" "}
          {trial["Study Title"] ?? "Untitled Trial"}
        </p>
        <LucidePlus className="size-4 shrink-0 group-data-[state=open]:hidden" />
        <LucideMinus className="hidden size-4 shrink-0 group-data-[state=open]:block" />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-1 text-xs">
        <a href={trial["Study URL"]} target="_blank" rel="noopener noreferrer">
          <h3 className="mt-3 mb-2 text-sm underline underline-offset-2">
            {trial["Study Title"] ?? "Untitled Trial"}
            {trial["Study Title"] ? (
              <LucideExternalLink className="ml-1 inline size-3 text-black" />
            ) : null}
          </h3>
        </a>
        <Metadata label="NCT Number" value={trial["NCT Number"]} />
        <Metadata label="Phases" value={trial["Phases"]} />
        <Metadata
          label="Start Date"
          value={new Date(trial["Start Date"]).toLocaleDateString("en-US")}
        />
        <Metadata
          label="Completion Date"
          value={new Date(trial["Completion Date"]).toLocaleDateString("en-US")}
        />
        <Metadata label="Study Design" value={trial["Study Design"]} />
        <div className="my-4 leading-4.5">
          <MemoizedMarkdown
            id={trial["NCT Number"]}
            content={trial["Brief Summary"] ?? "No summary available."}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

const Metadata = ({ label, value }: { label: string; value: string }) => {
  return (
    <p className="my-1">
      <span className="font-bold">{label}:</span> {value}
    </p>
  );
};
