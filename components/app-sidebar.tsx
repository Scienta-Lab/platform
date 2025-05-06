"use client";

import {
  LucideBook,
  LucideChevronsUpDown,
  LucideCloud,
  LucideHome,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ComponentProps } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useUser } from "./user-context";
import { UserAvatar, UserMenu } from "./user-menu";

import logo from "@/public/logo.svg";
import { ConversationMetadata } from "@/app/actions/chat";

export function AppSidebar({
  history,
  ...props
}: ComponentProps<typeof Sidebar> & { history: ConversationMetadata[] }) {
  const user = useUser();

  return (
    <Sidebar className="bg-secondary/15 border-gray-200" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/" className="contents">
                <Image
                  src={logo}
                  alt="Logo"
                  width={130}
                  height={40}
                  unoptimized
                />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="mt-5">
          <SidebarGroupLabel className="font-bold">Menu</SidebarGroupLabel>
          <SidebarMenu>
            <SimpleMenuButton href="/" icon={LucideHome}>
              Home
            </SimpleMenuButton>
            <SimpleMenuButton href="#" icon={LucideCloud}>
              Data
            </SimpleMenuButton>
            <SimpleMenuButton href="#" icon={LucideBook}>
              Wiki Scienta
            </SimpleMenuButton>
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup className="h-full overflow-hidden">
          <SidebarGroupContent className="h-full">
            <SidebarGroupLabel className="font-bold">History</SidebarGroupLabel>
            <SidebarMenu className="h-full">
              <div className="no-scrollbar flex flex-col gap-1 overflow-y-auto text-gray-500">
                {history.map((conversation) => (
                  <SimpleMenuButton
                    key={conversation.id}
                    href={`/chat/${conversation.id}`}
                    size="sm"
                  >
                    {conversation.title}
                  </SimpleMenuButton>
                ))}
              </div>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <UserMenu contentProps={{ side: "right", sideOffset: 15 }}>
              <SidebarMenuButton
                size="lg"
                className="hover:bg-primary/10 my-2 h-auto rounded-lg py-1"
              >
                <div className="flex w-full items-center gap-2">
                  <UserAvatar />
                  <div className="flex flex-col gap-0.5 overflow-hidden text-xs">
                    <p className="truncate font-bold wrap-break-word">
                      Julien Duquesne
                    </p>
                    <p className="truncate wrap-break-word text-gray-500">
                      {user?.email ?? ""}
                    </p>
                  </div>
                  <LucideChevronsUpDown className="ml-auto size-4 shrink-0" />
                </div>
              </SidebarMenuButton>
            </UserMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

const SimpleMenuButton = ({
  children,
  icon: Icon,
  size = "default",
  href,
}: {
  children: React.ReactNode;
  icon?: React.ElementType;
  size?: React.ComponentProps<typeof SidebarMenuButton>["size"];
  href: string;
}) => (
  <SidebarMenuItem>
    <SidebarMenuButton asChild size={size} className="hover:bg-primary/10">
      <Link href={href}>
        {Icon && <Icon />}
        <span>{children}</span>
      </Link>
    </SidebarMenuButton>
  </SidebarMenuItem>
);
