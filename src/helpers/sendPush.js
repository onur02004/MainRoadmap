// src/helpers/sendPush.js
import { Expo } from "expo-server-sdk";
const expo = new Expo();
import { NotificationType } from "../constants/notificationTypes.js";

// 1. Update arguments to accept 'imageUrl' (default is null)
export async function sendPush(expoToken, title, body, data = {}, imageUrl = null) {
  try {
    console.log("Sending Notification to:", expoToken);

    if (!Expo.isExpoPushToken(expoToken)) {
      console.error("Invalid Expo token:", expoToken);
      return;
    }

    // 1. Construct the base message
    const message = {
      to: expoToken,
      sound: "default",
      title,
      body,
      data,
      channelId: "default",
      priority: "high",
    };

    // 2. Handle Image Attachment
    if (imageUrl) {
        // Ensure the URL ends in an image extension.
        // Android is usually smart, but Expo's push service works best when the extension is explicit.
        const cleanUrl = (imageUrl.endsWith('.jpg') || imageUrl.endsWith('.png')) 
            ? imageUrl 
            : `${imageUrl}#.jpg`;

        // --- FIX: Assign 'cleanUrl' to message.image (NOT the raw imageUrl) ---
        message.image = cleanUrl; 
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

function isNotificationAllowed(settings, type, channel) {
  if (channel === "push") {
    if (!settings.push_enabled) return false;

    switch (type) {
      case "login": return settings.push_login;
      case "public_share": return settings.push_public_share;
      case "direct_share": return settings.push_direct_share;
      case "post_comment": return settings.push_post_comment;
      case "post_reaction": return settings.push_post_reaction;
      case "song_played": return settings.push_song_played;
    }
  }

  if (channel === "email") {
    if (!settings.email_enabled) return false;

    switch (type) {
      case "login": return settings.email_login;
      case "public_share": return settings.email_public_share;
      case "direct_share": return settings.email_direct_share;
      case "post_comment": return settings.email_post_comment;
      case "post_reaction": return settings.email_post_reaction;
      case "song_played": return settings.email_song_played;
    }
  }

  return false;
}
