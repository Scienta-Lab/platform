import { startConversation } from "@/app/actions/chat";
import { redirect } from "next/navigation";

export default async function Page() {
  const conversation = await startConversation({ title: "New Chat" }); // create a new chat
  redirect(`/chat/${conversation.id}`); // redirect to chat page, see below
}
