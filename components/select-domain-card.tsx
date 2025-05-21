"use client";

import Link from "next/link";
import { useState } from "react";

import type { Domain } from "@/app/(protected)/page";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MultiSelect } from "@/components/ui/multi-select";

export const SelectDomainCard = (domain: Domain) => {
  const [selected, setSelected] = useState<{
    domains: string[];
    samples: string[];
  }>({ domains: [], samples: [] });

  const handleSelectChange = (type: "domains" | "samples", value: string[]) => {
    setSelected((prev) => ({ ...prev, [type]: value }));
  };

  const urlParams = new URLSearchParams();
  if (selected.samples.length > 0)
    urlParams.set("samples", selected.samples.join(","));
  if (selected.domains.length > 0)
    urlParams.set("diseases", selected.domains.join(","));
  const url = `/chat?${urlParams.toString()}`;

  return (
    <Card
      key={domain.title}
      className="flex h-98 w-55 flex-col justify-between bg-white shadow-2xl"
    >
      <CardHeader className="space-y-2 px-4">
        <CardTitle className="text-base">{domain.title}</CardTitle>
        <CardDescription className="text-xs">
          {domain.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-4">
        <MultiSelect
          name="Samples"
          options={domain.samples}
          placeholder="Choose a sample"
          onValueChange={(value) => handleSelectChange("samples", value)}
        />
        <MultiSelect
          name="Diseases"
          options={domain.diseases}
          placeholder="Choose a disease"
          onValueChange={(value) => handleSelectChange("domains", value)}
        />
      </CardContent>
      <CardFooter className="px-4">
        <Link href={url} className="contents">
          <Button
            className="bg-primary hover:bg-primary/90 w-full font-bold"
            disabled={domain.button.disabled}
          >
            {domain.button.text}
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
};
