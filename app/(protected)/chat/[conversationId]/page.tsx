import { getMessages } from "@/app/actions/chat";
import Chat from "@/components/chat";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const conversation = await getMessages(conversationId);

  return <Chat conversationId={conversationId} conversation={conversation} />;
}
