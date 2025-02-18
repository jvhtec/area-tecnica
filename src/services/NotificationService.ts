
import { supabase } from "@/lib/supabase";

const NTFY_TOPIC = 'sector-pro-notifications';  // You might want to make this configurable or unique per environment
const NTFY_SERVER = 'https://ntfy.sh';

export interface NotificationSubscription {
  endpoint: string;
  auth_key: string;
  p256dh_key: string;
}

export class NotificationService {
  private static instance: NotificationService;
  private initialized = false;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      if (!('Notification' in window)) {
        console.log('This browser does not support notifications');
        return;
      }

      // Request permission if needed
      if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.log('Notification permission denied');
          return;
        }
      }

      this.initialized = true;
      console.log('Notification service initialized');
      await this.subscribeToNtfy();
    } catch (error) {
      console.error('Error initializing notification service:', error);
    }
  }

  private async subscribeToNtfy() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const response = await fetch(`${NTFY_SERVER}/${NTFY_TOPIC}/json`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Accept': 'text/event-stream',
        }
      });

      const reader = response.body?.getReader();
      if (!reader) return;

      // Process the stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = new TextDecoder().decode(value);
        const messages = text.split('\n').filter(Boolean);

        for (const message of messages) {
          try {
            const notification = JSON.parse(message);
            this.showNotification(notification.title, notification.message);
          } catch (e) {
            console.error('Error parsing notification:', e);
          }
        }
      }
    } catch (error) {
      console.error('Error subscribing to ntfy:', error);
    }
  }

  private async showNotification(title: string, body: string) {
    if (!this.initialized || Notification.permission !== 'granted') return;

    try {
      new Notification(title, {
        body,
        icon: '/icon.png'
      });
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }

  async saveSubscription(subscription: NotificationSubscription) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { error } = await supabase
        .from('notification_subscriptions')
        .upsert({
          user_id: user.id,
          ...subscription
        }, {
          onConflict: 'user_id,endpoint'
        });

      if (error) throw error;
      console.log('Notification subscription saved');
    } catch (error) {
      console.error('Error saving notification subscription:', error);
      throw error;
    }
  }

  async sendNotification(title: string, message: string, tags?: string[]) {
    try {
      const response = await fetch(`${NTFY_SERVER}/${NTFY_TOPIC}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: NTFY_TOPIC,
          title,
          message,
          tags: tags || [],
          priority: 3,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log('Notification sent successfully');
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  }
}

export const notificationService = NotificationService.getInstance();
