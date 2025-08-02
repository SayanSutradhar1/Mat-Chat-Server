import { Server, Socket } from "socket.io";
import { MessagePayload } from "./interfaces/message.interface";

import { app } from "./index";
import { encryptMessage } from "./utils/encryptMessage";

export const SOCKET_EVENTS = {
  CHAT_MESSAGE_SEND: "chat:message_send",
  CHAT_MESSAGE_RECEIVE: "chat:message_receive",
  USER_STATUS: "user:status",
  CHAT_TYPING: "chat:typing",
  CHAT_MESSAGE_STATUS: "chat:messageStatus",
  USER_ACTIVE: "user:active",
  USER_INACTIVE: "user:inactive",
  GET_ONLINE_USERS: "user:getOnlineUsers",
};

const userIdMap = new Map<string, string>();
const userStatusMap = new Map<string, string>();

export function initializeSocketFeatures(io: Server) {
  io.on("connection", (socket: Socket) => {
    // Extract userId from handshake query
    const userId = socket.handshake.query.userId as string | undefined;

    if (userId) {
      userIdMap.set(userId, socket.id);
      userStatusMap.set(userId, "active");
      console.log(`New client connected: ${userId} socketId: ${socket.id}`);

      // Broadcast user is now active to all connected clients
      socket.broadcast.emit(SOCKET_EVENTS.USER_ACTIVE, {
        userId,
        status: "active",
      });
    } else {
      console.log(`New client connected: ${socket.id}, userId not provided`);
      return;
    }

    // Handle user active status
    socket.on(SOCKET_EVENTS.USER_ACTIVE, () => {
      if (userId) {
        userStatusMap.set(userId, "active");
        socket.broadcast.emit(SOCKET_EVENTS.USER_ACTIVE, {
          userId,
          status: "active",
        });
        console.log(`User ${userId} is now active`);
      }
    });

    // Handle user inactive status
    socket.on(SOCKET_EVENTS.USER_INACTIVE, () => {
      if (userId) {
        userStatusMap.set(userId, "inactive");
        socket.broadcast.emit(SOCKET_EVENTS.USER_INACTIVE, {
          userId,
          status: "inactive",
        });
        console.log(`User ${userId} is now inactive`);
      }
    });

    // Handle request for online users
    socket.on(SOCKET_EVENTS.GET_ONLINE_USERS, () => {
      const onlineUsers = Array.from(userStatusMap.entries()).map(
        ([userId, status]) => ({
          userId,
          status,
          socketId: userIdMap.get(userId),
        })
      );
      socket.emit(SOCKET_EVENTS.GET_ONLINE_USERS, onlineUsers);
    });

    // Handle typing events
    socket.on(
      SOCKET_EVENTS.CHAT_TYPING,
      (data: { receiver: string; isTyping: boolean }) => {
        const receiverSocketId = userIdMap.get(data.receiver);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit(SOCKET_EVENTS.CHAT_TYPING, {
            sender: userId,
            isTyping: data.isTyping,
          });
        }
      }
    );

    socket.on(SOCKET_EVENTS.CHAT_MESSAGE_SEND, async (msg: MessagePayload) => {
      // Get the receiver's socket ID from the userIdMap
      const receiverSocketId = userIdMap.get(msg.receiver);

      if (receiverSocketId) {
        try {
          // Send message to the specific receiver
          const encryptedMessage = encryptMessage(msg.content ?? "");

          const response = await app.apiPost("http://localhost:3000/api/user/chats/saveChat", {
            chatId: msg.chatId,
            sender: msg.sender,
            receiver: msg.receiver,
            message: encryptedMessage,
            time: msg.timestamp,
          });

          console.log(response)

          io.to(receiverSocketId).emit(SOCKET_EVENTS.CHAT_MESSAGE_RECEIVE, msg);

          console.log(
            `Message sent to ${msg.receiver} (socket: ${receiverSocketId})`
          );
        } catch (error) {
          console.log(error);
          
          // Send error back to the sender
          socket.emit('error', {
            type: 'encryption_error',
            message: 'Failed to encrypt message. Please check your environment configuration.'
          });
        }
      } else {
        console.log(`Receiver ${msg.receiver} not found or not connected`);
      }
    });

    socket.on("disconnect", () => {
      // Remove user from userIdMap when they disconnect
      for (const [userId, socketId] of userIdMap.entries()) {
        if (socketId === socket.id) {
          userIdMap.delete(userId);
          userStatusMap.delete(userId);
          // Broadcast user is now offline
          socket.broadcast.emit(SOCKET_EVENTS.USER_INACTIVE, {
            userId,
            status: "offline",
          });
          console.log(`User ${userId} disconnected`);
          break;
        }
      }
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}
