import { getConversations } from "@/app/actions/chat";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function ChatLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const history = await getConversations();
  return (
    <SidebarProvider className="flex flex-col">
      <div className="flex flex-1">
        <AppSidebar history={history} />
        <SidebarInset className="bg-transparent">{children}</SidebarInset>
      </div>
    </SidebarProvider>
  );
}
