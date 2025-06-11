"use client";

import {
  LucideBook,
  LucideChevronsUpDown,
  LucideCloud,
  LucideHome,
  LucideIcon,
  LucideLoader2,
  LucidePlusCircle,
  LucideTrash2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect, useRouter } from "next/navigation";
import { ComponentProps, useTransition } from "react";
import { v4 as uuid } from "uuid";

import { ConversationMetadata, deleteConversation } from "@/app/actions/chat";
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

import { cn } from "@/lib/utils";
import logo from "@/public/logo.svg";
import { Button } from "./ui/button";

export function AppSidebar({
  history,
  ...props
}: ComponentProps<typeof Sidebar> & { history: ConversationMetadata[] }) {
  const { user } = useUser();
  const router = useRouter();

  const { name, company } = parseEmail(user?.email ?? "");
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
            <SimpleMenuButton
              onClick={() => redirect(`/chat/${uuid()}`)}
              icon={LucidePlusCircle}
              className="text-primary font-bold"
            >
              New Chat
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
                    actionIcon={LucideTrash2}
                    onDelete={async () => {
                      await deleteConversation(conversation.id);
                      router.refresh();
                    }}
                  >
                    <span className="truncate">{conversation.title}</span>
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
                    <p className="truncate font-bold wrap-break-word capitalize">
                      {name}
                    </p>
                    <p className="truncate wrap-break-word text-gray-500 capitalize">
                      {company}
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
  actionIcon: ActionIcon,
  size = "default",
  href,
  onDelete,
  onClick,
  className,
  ...props
}: {
  children: React.ReactNode;
  icon?: LucideIcon;
  actionIcon?: LucideIcon;
  size?: React.ComponentProps<typeof SidebarMenuButton>["size"];
  href?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onDelete?: (e: React.MouseEvent<HTMLButtonElement>) => void;
} & React.ComponentProps<typeof SidebarMenuButton>) => {
  const router = useRouter();
  const [isDeleting, startTransition] = useTransition();

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild={href !== undefined}
        size={size}
        className={cn(
          "group/simple-menu-button hover:bg-primary/10",
          className,
        )}
        onClick={onClick}
        {...props}
      >
        <MaybeLink href={href}>
          {Icon && <Icon />}
          <span className="flex overflow-hidden">{children}</span>
          {ActionIcon && (
            <Button
              className={cn(
                "ml-auto box-content hidden border border-none bg-transparent p-1 shadow-none group-hover/simple-menu-button:block hover:bg-transparent",
                isDeleting && "block opacity-50",
              )}
              asChild
              variant="outline"
              onClick={(e) => {
                e.preventDefault();
                startTransition(async () => {
                  await onDelete?.(e);
                  router.push("/chat");
                  router.refresh();
                });
              }}
            >
              {isDeleting ? (
                <LucideLoader2 className="size-4 shrink-0 animate-spin text-gray-500" />
              ) : (
                <ActionIcon className="size-4 shrink-0 text-gray-500 hover:text-red-500" />
              )}
            </Button>
          )}
        </MaybeLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};

const MaybeLink = ({
  href,
  ...props
}: Omit<React.ComponentProps<typeof Link>, "href"> & { href?: string }) => {
  if (!href) return <>{props.children}</>;
  return <Link href={href} {...props} />;
};

export function parseEmail(email: string) {
  const [nameRaw, domain] = email.split("@");
  const name = nameRaw?.split(".").join(" ") || "";
  const company = domain?.split(".")[0] || "";
  return { name, company };
}
