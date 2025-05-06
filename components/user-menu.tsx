"use client";

import { signOut } from "@/app/actions/sign-out";
import { LucideArrowRightFromLine } from "lucide-react";
import Image from "next/image";
import { ComponentProps } from "react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

import julienSrc from "@/public/julien.jpeg";

export const UserMenu = ({
  children,
  ...props
}: ComponentProps<typeof DropdownMenu> & {
  children?: React.ReactNode;
  contentProps?: ComponentProps<typeof DropdownMenuContent>;
}) => (
  <DropdownMenu {...props}>
    <DropdownMenuTrigger asChild>
      {children ?? <UserAvatar />}
    </DropdownMenuTrigger>
    <DropdownMenuContent
      align={props.contentProps?.align ?? "end"}
      {...props.contentProps}
    >
      <DropdownMenuLabel>My Account</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem>Admin</DropdownMenuItem>
      <DropdownMenuItem>Profile</DropdownMenuItem>
      <DropdownMenuItem>WikiScienta</DropdownMenuItem>
      <DropdownMenuItem>
        <Button className="w-full text-xs" onClick={signOut}>
          <LucideArrowRightFromLine className="h-2 w-2 text-white" />
          Sign out
        </Button>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

export const UserAvatar = () => (
  <div className="bg-primary grid h-10 w-10 shrink-0 place-items-center rounded-full">
    <Image
      src={julienSrc}
      alt="User Avatar"
      className="rounded-full"
      unoptimized
      width={40}
      height={40}
    />
  </div>
);
