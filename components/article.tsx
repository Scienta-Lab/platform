import { LucideExternalLink, LucideMinus, LucidePlus } from "lucide-react";
import { MemoizedMarkdown } from "./markdown";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";

export type Article = {
  pmid: number;
  pmcid: string;
  title?: string;
  journal: string;
  authors?: string[];
  date: string;
  doi: string;
  abstract: string;
  pubmed_url: string;
  pmc_url?: string;
  doi_url: string;
};

export function ArticleCollapsible({
  article,
  ...props
}: { article: Article } & React.ComponentProps<typeof Collapsible>) {
  return (
    <Collapsible className="group" {...props}>
      <CollapsibleTrigger className="flex w-full cursor-pointer items-start justify-between gap-2 text-left select-none">
        <p className="my-0 truncate">{article.title ?? "Untitled Article"}</p>
        <LucidePlus className="size-4 shrink-0 group-data-[state=open]:hidden" />
        <LucideMinus className="hidden size-4 shrink-0 group-data-[state=open]:block" />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-1 text-xs">
        <a href={article.pubmed_url} target="_blank" rel="noopener noreferrer">
          <h3 className="mt-3 mb-2 text-sm underline underline-offset-2">
            {article.title ?? "Untitled Article"}
            {article.title ? (
              <LucideExternalLink className="ml-1 inline size-3 text-black" />
            ) : null}
          </h3>
        </a>
        <Metadata
          label="Authors"
          value={
            article?.authors && article.authors.length > 0
              ? article.authors.join(", ")
              : "No authors listed"
          }
        />
        <Metadata label="Journal" value={article.journal} />
        <Metadata
          label="Date"
          value={new Date(article.date).toLocaleDateString("en-US")}
        />
        <div className="my-4 leading-4.5">
          <MemoizedMarkdown
            id={article.pmid.toString()}
            content={article.abstract}
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
