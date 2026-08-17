// src/utils/pushNotifications.js
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../supabaseClient';

// 🌟 NEW: A temporary memory to hold the tap data during a cold start
let pendingTapData = null;

// 🌟 NEW: A function for the Dashboard to grab the missed tap
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
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('User denied push notification permissions!');
      return null;
    }

    await PushNotifications.register();

    PushNotifications.addListener('registration', async (token) => {
      console.log('🔥 SUCCESS! My Device Token is:', token.value);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from('users')
          .update({ fcm_token: token.value })
          .eq('id', user.id);
          
        if (error) console.error("Failed to save FCM token to Supabase:", error);
      }
    });

    // 🌟 UPDATED: Save to memory AND broadcast the event
    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('👆 Notification Tapped!', notification);
      
      const data = notification.notification.data; 
      
      // Save it in our temporary memory for cold starts!
      pendingTapData = data;
      
      // Broadcast it just in case the app was already open
      window.dispatchEvent(new CustomEvent('onPushNotificationTap', { detail: data }));
    });

  } catch (error) {
    console.error("Push Notification Setup Failed:", error);
    return null;
  }
};