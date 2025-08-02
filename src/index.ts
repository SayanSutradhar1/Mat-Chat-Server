import { Application } from "./app";
import { Server } from "socket.io";
import dotenv from "dotenv";
import { initializeSocketFeatures } from "./socket";

dotenv.config({
  path: "./.env",
});

const app = new Application(3500,"Chat app server");

app.init();
app.get();

const server = app.getServer();

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

initializeSocketFeatures(io)

app.start(() => {
  console.log(`${app.appName} is running on port ${app.port}`);
});

export {app}
