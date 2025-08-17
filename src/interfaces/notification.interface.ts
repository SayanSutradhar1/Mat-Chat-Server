export interface NotificationPayload {
  userId: string;
  header: string;
  content?: string;
  timeStamp: Date;
}
