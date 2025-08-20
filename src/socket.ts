import { Server, Socket } from "socket.io";
import { MessagePayload } from "./interfaces/message.interface";

import { encryptMessage } from "./utils/encryptMessage";
import { Application } from "./app";
import { NotificationPayload } from "./interfaces/notification.interface";
import { FollowPayload } from "./interfaces/follow.interface";

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

      io.emit("active_users", Array.from(userIdMap.keys()));

      // Broadcast user is now active to all connected clients
    } else {
      console.log(`New client connected: ${socket.id}, userId not provided`);
      return;
    }

    // Emit the active users to the newly connected client
    socket.on("active_users", (userId) => {
      const activeUsers = Array.from(userIdMap.keys());
      const socketId = userIdMap.get(userId);
      if (socketId) {
        io.to(socketId).emit("active_users", activeUsers);
      } else {
        console.log(`User ${userId} not found in userIdMap`);
      }
    })

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

      console.log("Message sending...");

      try {
        const encryptedMessage = encryptMessage(msg.content ?? "");

        if (receiverSocketId) {
          // Send message to the specific receiver

          const response = await Application.apiPost(
            `${process.env.CLIENT_URL}/api/user/chats/saveChat`,
            {
              chatId: msg.chatId,
              sender: msg.sender,
              receiver: msg.receiver,
              message: encryptedMessage,
              time: msg.timestamp,
            }
          );

          console.log(response);

          io.to(receiverSocketId).emit(SOCKET_EVENTS.CHAT_MESSAGE_RECEIVE, msg);

          console.log(
            `Message sent to ${msg.receiver} (socket: ${receiverSocketId})`
          );
        } else {
          console.log(`Receiver ${msg.receiver} not found or not connected`);
          const response = await Application.apiPost(
            `${process.env.CLIENT_URL}/api/user/chats/saveChat`,
            {
              chatId: msg.chatId,
              sender: msg.sender,
              receiver: msg.receiver,
              message: encryptedMessage,
              time: msg.timestamp,
            }
          );

          console.log(response);
        }
        console.log("Message sent");
      } catch (error) {
        console.log((error as Error).message);

        // Send error back to the sender
        socket.emit("error", {
          type: "encryption_error",
          message:
            "Failed to encrypt message. Please check your environment configuration.",
        });
      }
    });

    // Handle message status updates (delivered/read)
    socket.on(
      SOCKET_EVENTS.CHAT_MESSAGE_STATUS,
      (data: {
        receiver: string;
        chatId: string;
        status: string;
        messageId: string;
      }) => {
        const receiverSocketId = userIdMap.get(data.receiver);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit(SOCKET_EVENTS.CHAT_MESSAGE_STATUS, {
            sender: userId,
            chatId: data.chatId,
            status: data.status,
            messageId: data.messageId,
          });
        }
      }
    );

    // Follow

    socket.on("follow", async (data: FollowPayload) => {
      const friendSocketId = userIdMap.get(data.friendId);

      console.log("follow event invoked with", data);

      if (friendSocketId) {
        // // Notification
        io.to(friendSocketId).emit("notification", {
          userId: data.friendId,
          header: `New Follower`,
          content: `${data.senderName} started following you`,
          timeStamp: new Date(Date.now()),
        } as NotificationPayload);
      }
      try {
        const folowResponse = await Application.apiPost(
          `${process.env.CLIENT_URL}/api/user/follow`,
          {
            userId: data.userId,
            friendId: data.friendId,
          }
        );

        const notificationResponse = await Application.apiPost(
          `${process.env.CLIENT_URL}/api/user/notification/new`,
          {
            userId: data.friendId,
            header: `New Follower`,
            content: `${data.senderName} started following you`,
            timeStamp: new Date(Date.now()),
          }
        );

        console.log(notificationResponse.message);

        console.log(folowResponse.message);
      } catch (error) {
        console.log(error);
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
      io.emit("active_users", Array.from(userIdMap.keys()));
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}
