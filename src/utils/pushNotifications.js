// src/utils/pushNotifications.js
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../supabaseClient';

// A temporary memory to hold the tap data during a cold start
let pendingTapData = null;

// A function for the Dashboard to grab the missed tap
export const getPendingNotificationData = () => {
  const data = pendingTapData;
  pendingTapData = null; // Clear it so it doesn't trigger twice
  return data;
};

export const setupPushNotifications = async () => {
  if (!Capacitor.isNativePlatform()) {
    console.log("Push notifications are not available on the web browser.");
    return null;
  }

  try {
    // 1. Remove previous listeners to prevent duplicate execution bugs
    await PushNotifications.removeAllListeners();

    // 2. Attach listeners FIRST before registering!
    await PushNotifications.addListener('registration', async (token) => {
      console.log('🔥 SUCCESS! My Device Token is:', token.value);
      
      // 🌟 Fetch the user right here to guarantee we have the correct ID
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        console.log("👤 Found logged-in user:", user.id);
        console.log("Attempting to save to Supabase...");

        // 🌟 Added .select() to force Supabase to tell us if it actually updated a row
        const { data, error } = await supabase
          .from('users')
          .update({ fcm_token: token.value })
          .eq('id', user.id)
          .select(); 
          
        if (error) {
          console.error("❌ Supabase Error:", error.message);
        } else if (data && data.length === 0) {
          console.error("❌ FAILED: Supabase silently blocked the update! (This is an RLS Policy issue or the user ID doesn't exist in the users table).");
        } else {
          console.log("✅ FCM Token successfully synced to database!", data);
        }
      } else {
        console.warn("⚠️ No user is currently logged in, cannot save token.");
      }
    });

    await PushNotifications.addListener('registrationError', (error) => {
      console.error('Push registration error:', error);
    });

    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Foreground Push received:', notification);
      
      try {
        const alertSound = new Audio('/alert.mp3'); 
        alertSound.play().catch(err => console.warn("Audio autoplay blocked by device:", err));
      } catch (error) {
        console.error("Failed to play notification sound:", error);
      }
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('👆 Notification Tapped!', notification);
      
      const data = notification.notification.data; 
      pendingTapData = data;
      window.dispatchEvent(new CustomEvent('onPushNotificationTap', { detail: data }));
    });

    // 3. Check and request permission
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('User denied push notification permissions!');
      return null;
    }

    // 4. Register AFTER listeners are active
    await PushNotifications.register();

  } catch (error) {
    console.error("Push Notification Setup Failed:", error);
    return null;
  }
};