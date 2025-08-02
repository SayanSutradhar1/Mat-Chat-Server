import express, { Express } from "express";
import cors from "cors";
import { createServer, Server as HttpServer } from "http";
import axios from "axios";
import { ApiResponse } from "./interfaces/api.interface";

export class Application {
  appName!:string
  private instance!: Express;
  private app!: typeof express;
  private server!: HttpServer;
  port: number = 3000;

  constructor(port: number,appName?:string) {
    this.appName=appName||"Application"
    this.app = express;
    this.port = port;
  }

  init() {
    this.instance = this.app();
    this.instance.use(
      cors({
        origin: process.env.CLIENT_URL,
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type"],
        credentials: true,
      })
    );
    this.server = createServer(this.instance); // Create HTTP server from Express
  }

  start(cb: Function) {
    this.server.listen(this.port, () => cb()); // Start the HTTP server, not express instance
  }

  getServer() {
    return this.server;
  }

  async apiGet<K=unknown>(endpoint:string){
    const axiosResponse = await axios.get<ApiResponse<K>>(endpoint)
    return axiosResponse.data
  }

  async apiPost<T=any,K=unknown>(endpoint:string,data:T){
    const axiosResponse = await axios.post<ApiResponse<K>>(endpoint,data)
    return axiosResponse.data
  }

  get(endPoint: string = "/") {
    this.instance.get(endPoint, (req, res) => {
      res.send("Hello from ChatApp Server");
    });
  }
}
