import { LucideMinus, LucidePlus } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";

export type BiologicalProcess = {
  goId: string;
  goName: string;
  genes: string[];
};

export function BiologicalProcessCollapsible({
  biologicalProcess,
  ...props
}: { biologicalProcess: BiologicalProcess } & React.ComponentProps<
  typeof Collapsible
>) {
  return (
    <Collapsible className="group" {...props}>
      <CollapsibleTrigger className="flex w-full cursor-pointer items-start justify-between gap-2 text-left select-none">
        <p className="my-0 truncate">
          {biologicalProcess.goName ?? "Unnamed Gene"}
        </p>
        <LucidePlus className="size-4 shrink-0 group-data-[state=open]:hidden" />
        <LucideMinus className="hidden size-4 shrink-0 group-data-[state=open]:block" />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-1 text-xs">
        <h3 className="mt-3 mb-2 text-sm underline underline-offset-2">
          {biologicalProcess.goName ?? "Unnamed Gene"}
        </h3>
        <Metadata
          label="GO ID"
          value={biologicalProcess.goId ?? "No GO ID listed"}
        />
        <Metadata
          label="Genes"
          value={biologicalProcess.genes.join(", ") ?? "No genes listed"}
        />
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
