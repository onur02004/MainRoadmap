// src/helpers/sendPush.js
import { Expo } from "expo-server-sdk";
const expo = new Expo();

export async function sendPush(expoToken, title, body, data = {}) {
  try {
    console.log("Sending Notification to:", expoToken); // Log the target
    if (!Expo.isExpoPushToken(expoToken)) {
      console.error("Invalid Expo token:", expoToken);
      return;
    }

    const messages = [
      {
        to: expoToken,
        sound: "default",
        title,
        body,
        data,
        channelId: "default", // <--- ADD THIS (Crucial for Android 8+)
        priority: "high",     // <--- ADD THIS
      },
    ];

    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        console.log("Expo Ticket Receipt:", ticketChunk); // <--- LOG THIS
        
        // Check for specific errors
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