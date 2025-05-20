"use client";

import {
  Select,
  SelectItem,
  SelectItemText,
  SelectTrigger,
} from "@radix-ui/react-select";
import { CheckIcon, LucideChevronDown } from "lucide-react";
import { useState } from "react";

import { SelectContent } from "@/components/ui/select";
import { Tag } from "./tag";

export const MultiSelect = <T extends string>({
  name,
  options,
  placeholder,
  onValueChange,
}: {
  name: string;
  options: T[];
  placeholder: string;
  onValueChange: (value: T[]) => void;
}) => {
  const [selected, setSelected] = useState<T[]>([]);

  return (
    <Select
      // We have to set a value to make the select uncontrolled.
      // Otherwise, onValueChange will not be called when the user selected value is already selected.
      value=""
      onValueChange={(option: T) => {
        const newSelected = selected.includes(option)
          ? selected.filter((item) => item !== option)
          : [...selected, option];
        setSelected(newSelected);
        onValueChange(newSelected);
      }}
    >
      <SelectTrigger className="flex h-auto w-full flex-col gap-2 overflow-hidden rounded-md border border-neutral-200 px-3 py-2 text-sm">
        <span className="flex items-center justify-between">
          <p>{name}</p>
          <LucideChevronDown className="h-3 w-3" />
        </span>
        <ul className="no-scrollbar flex items-center gap-1 overflow-x-auto">
          {selected.length === 0 ? (
            <p className="h-6 text-xs text-gray-400">{placeholder}</p>
          ) : (
            selected.map((item) => (
              <Tag key={item} asChild>
                <li>{item}</li>
              </Tag>
            ))
          )}
        </ul>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem
            key={option}
            value={option}
            className="relative flex w-full items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none focus:bg-neutral-100 focus:text-neutral-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-neutral-500 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2"
          >
            {selected.includes(option) && (
              <span className="absolute right-2 flex size-3.5 items-center justify-center">
                <CheckIcon className="size-4" />
              </span>
            )}
            <SelectItemText>{option}</SelectItemText>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
