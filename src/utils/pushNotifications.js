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

export const setupPushNotifications = async (userId) => {
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
      
      if (userId) {
        const { error } = await supabase
          .from('users')
          .update({ fcm_token: token.value })
          .eq('id', userId);
          
        if (error) console.error("Failed to save FCM token to Supabase:", error);
      }
    });

    // 🌟 UPDATED: Foreground Notification with Sound!
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Foreground Push received:', notification);
      
      // Attempt to play the sound when the app is actively open
      try {
        const alertSound = new Audio('/alert.mp3'); // Looks in your public/ folder
        alertSound.play().catch(err => console.warn("Audio autoplay blocked by device:", err));
      } catch (error) {
        console.error("Failed to play notification sound:", error);
      }
    });

    // Save to memory AND broadcast the event when tapped in the background
    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('👆 Notification Tapped!', notification);
      
      const data = notification.notification.data; 
      
      // Save it in our temporary memory for cold starts!
      pendingTapData = data;
      
      // Broadcast it just in case the app was already open in the background
      window.dispatchEvent(new CustomEvent('onPushNotificationTap', { detail: data }));
    });

  } catch (error) {
    console.error("Push Notification Setup Failed:", error);
    return null;
  }
};