import { LucideMinus, LucidePlus } from "lucide-react";
import { MemoizedMarkdown } from "./markdown";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";

export type GeneAnnotation = {
  gene: string;
  fullName: string;
  description: string;
  ncbiCollectiondate: string;
};

export function GeneAnnotationCollapsible({
  annotation,
  ...props
}: { annotation: GeneAnnotation } & React.ComponentProps<typeof Collapsible>) {
  return (
    <Collapsible className="group" {...props}>
      <CollapsibleTrigger className="flex w-full cursor-pointer items-start justify-between gap-2 text-left select-none">
        <p className="my-0 truncate">{annotation.gene ?? "Unnamed Gene"}</p>
        <LucidePlus className="size-4 shrink-0 group-data-[state=open]:hidden" />
        <LucideMinus className="hidden size-4 shrink-0 group-data-[state=open]:block" />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-1 text-xs">
        <h3 className="mt-3 mb-2 text-sm underline underline-offset-2">
          {annotation.fullName ?? "Unnamed Gene"}
        </h3>
        <Metadata
          label="NCBI Collection Date"
          value={annotation.ncbiCollectiondate ?? "No date listed"}
        />
        <div className="my-4 leading-4.5">
          <MemoizedMarkdown
            id={annotation.fullName}
            content={annotation.description}
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
