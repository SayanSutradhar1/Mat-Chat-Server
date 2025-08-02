export type MessagePayload = {
  messageStatus: "processing" | "delivered" | "read" | null;
  chatId: string;
  content: string;
  sender?: string;
  receiver: string;
  timestamp?: string;
};
