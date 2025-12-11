// src/helpers/sendPush.js
import { Expo } from "expo-server-sdk";
const expo = new Expo();

/**
 * Sends a push notification to a single Expo token.
 */
export async function sendPush(expoToken, title, body, data = {}) {
  try {
    console.log("Sending Notification");
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
      },
    ];

    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }
  } catch (err) {
    console.error("sendPush error:", err);
  }
}
