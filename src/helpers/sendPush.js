// src/helpers/sendPush.js
import { Expo } from "expo-server-sdk";
const expo = new Expo();

// 1. Update arguments to accept 'imageUrl' (default is null)
export async function sendPush(expoToken, title, body, data = {}, imageUrl = null) {
  try {
    console.log("Sending Notification to:", expoToken);

    if (!Expo.isExpoPushToken(expoToken)) {
      console.error("Invalid Expo token:", expoToken);
      return;
    }

    // 2. Construct the base message
    const message = {
      to: expoToken,
      sound: "default",
      title,
      body,
      data,
      channelId: "default",
      priority: "high",
    };

    // 3. If an image URL is provided, add the specific fields for Android and iOS
    if (imageUrl) {
      // Android: Displays as a large image in the notification shade
      message.image = imageUrl; 
      
      // iOS: Displays as a thumbnail and expands on long-press
      message.attachments = [imageUrl]; 
    }

    const messages = [message];

    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        console.log("Expo Ticket Receipt:", ticketChunk); 

        if (ticketChunk[0].status === "error") {
            console.error("Expo Error Detail:", ticketChunk[0].message);
            console.error("Error Code:", ticketChunk[0].details?.error);
        }
      } catch (error) {
        console.error("Error sending chunk:", error);
      }
    }
  } catch (err) {
    console.error("sendPush error:", err);
  }
}