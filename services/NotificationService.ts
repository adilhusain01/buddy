import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';
import { Todo, RepeatFrequency, EarlyNotification, RepeatNotification, REPEAT_FREQUENCY_LABELS } from '@/types/todo';


// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export class NotificationService {
  static async requestPermissions(): Promise<boolean> {
    if (!Device.isDevice) {
      console.warn('Notifications only work on physical devices');
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notification!');
      return false;
    }

    // Configure Android channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('buddy-reminders', {
        name: 'Task Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#E2BA6F',
      });
    }

    return true;
  }

  static async scheduleEarlyNotification(
    todo: Todo,
    earlyNotification: EarlyNotification
  ): Promise<string | null> {
    try {
      // Validate early notification data
      if (!earlyNotification.dateTime) {
        console.error('Early notification dateTime is missing');
        return null;
      }

      const trigger = new Date(earlyNotification.dateTime);
      const now = new Date();


      // Validate the parsed date
      if (isNaN(trigger.getTime())) {
        console.error('Early notification dateTime is invalid:', earlyNotification.dateTime);
        return null;
      }

      // Don't schedule if the time has passed (with 5 minute buffer for safety)
      const fiveMinutesFromNow = new Date(now.getTime() + 300 * 1000);
      if (trigger <= fiveMinutesFromNow) {
        console.log('Early notification time has passed or is too soon (within 5 minutes), skipping');
        return null;
      }

      // Additional validation: Early notification for todo without deadline
      if (!todo.deadline) {
        console.log('Scheduling early notification for todo without deadline');
      } else {
        // Validate that early notification is before deadline
        const deadline = new Date(todo.deadline);
        if (isNaN(deadline.getTime())) {
          console.warn('Todo deadline is invalid, but proceeding with early notification');
        } else if (trigger >= deadline) {
          console.error('Early notification is after deadline, this doesn\'t make sense');
          return null;
        }
      }


      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏰ Early Reminder',
          body: `Don't forget: ${todo.title}${todo.deadline ? `\n📅 Due: ${new Date(todo.deadline).toLocaleDateString()} at ${new Date(todo.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}`,
          data: {
            todoId: todo.id,
            type: 'early',
            action: 'open_todo'
          },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: trigger,
      });

      return notificationId;
    } catch (error) {
      console.error('Failed to schedule early notification:', error);
      return null;
    }
  }

  static async scheduleRepeatNotification(
    todo: Todo,
    repeatNotification: RepeatNotification
  ): Promise<string[]> {
    try {
      // Validate repeat notification data
      if (!repeatNotification.frequency) {
        console.error('Repeat notification frequency is missing');
        return [];
      }

      const notificationIds: string[] = [];
      const now = new Date();

      // Determine the base time for repeat notifications
      let baseTime: Date;
      let endDate: Date | null = null;

      if (todo.deadline) {
        // Use deadline as the reference time
        baseTime = new Date(todo.deadline);
        if (isNaN(baseTime.getTime())) {
          console.error('Todo deadline is invalid, using current time');
          baseTime = new Date();
        }
      } else {
        // No deadline, use current time
        baseTime = new Date();
      }

      // Set end date - either specified or deadline (for tasks with deadlines)
      if (repeatNotification.endDate) {
        endDate = new Date(repeatNotification.endDate);
        if (isNaN(endDate.getTime()) || endDate <= now) {
          console.error('Repeat notification endDate is invalid or in the past');
          return [];
        }
      } else if (todo.deadline) {
        // For tasks with deadlines, end repeats at deadline
        endDate = new Date(todo.deadline);
      }

      // Generate notification schedule based on frequency, relative to base time
      const scheduleDates = this.generateScheduleDates(
        now,
        repeatNotification.frequency,
        baseTime, // Pass base time instead of custom time
        endDate
      );

      // Validate we got some dates
      if (scheduleDates.length === 0) {
        console.warn('No valid schedule dates generated for repeat notification');
        return [];
      }

      for (const scheduleDate of scheduleDates) {
        if (scheduleDate <= new Date(Date.now() + 300 * 1000)) continue; // Skip past dates and dates within 5 minutes

        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: `🔄 ${REPEAT_FREQUENCY_LABELS[repeatNotification.frequency]} Reminder`,
            body: `${todo.title}${todo.deadline ? `\n📅 Due: ${new Date(todo.deadline).toLocaleDateString()} at ${new Date(todo.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}\n🕒 Repeating: ${REPEAT_FREQUENCY_LABELS[repeatNotification.frequency].toLowerCase()}`,
            data: {
              todoId: todo.id,
              type: 'repeat',
              frequency: repeatNotification.frequency,
              action: 'open_todo'
            },
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: scheduleDate,
        });

        notificationIds.push(notificationId);
      }

      return notificationIds;
    } catch (error) {
      console.error('Failed to schedule repeat notifications:', error);
      return [];
    }
  }

  private static generateScheduleDates(
    startDate: Date,
    frequency: RepeatFrequency,
    baseTime: Date, // Now accepts a base time instead of custom time string
    endDate?: Date | null,
    maxNotifications = 50 // Prevent too many scheduled notifications
  ): Date[] {
    const dates: Date[] = [];

    // Validate input parameters
    if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {
      console.error('generateScheduleDates: Invalid start date provided');
      return [];
    }

    if (!frequency) {
      console.error('generateScheduleDates: No frequency provided');
      return [];
    }

    // Validate endDate if provided
    if (endDate && (!(endDate instanceof Date) || isNaN(endDate.getTime()))) {
      console.error('generateScheduleDates: Invalid end date provided');
      return [];
    }

    // Ensure we don't generate too many notifications
    const safeMaxNotifications = Math.min(maxNotifications, 100);

    const currentDate = new Date(startDate);

    // Extract hour and minute from base time
    let hour = 9, minute = 0; // Default to 9 AM
    if (baseTime && !isNaN(baseTime.getTime())) {
      hour = baseTime.getHours();
      minute = baseTime.getMinutes();
      console.log(`Using base time: ${hour}:${minute.toString().padStart(2, '0')} from ${baseTime.toLocaleString()}`);
    } else {
      console.warn('Invalid base time, using default 9:00 AM');
    }

    // Multiple safety mechanisms to prevent infinite loops
    let safetyCounter = 0;
    const maxSafetyIterations = safeMaxNotifications * 3; // Triple safety margin
    const maxGenerationTime = Date.now() + 5000; // 5 second timeout
    let lastGeneratedTime = 0;

    for (let i = 0; i < safeMaxNotifications && safetyCounter < maxSafetyIterations; i++) {
      safetyCounter++;

      // Timeout protection
      if (Date.now() > maxGenerationTime) {
        console.error('generateScheduleDates: Generation timeout reached, stopping');
        break;
      }

      let nextDate: Date;
      try {
        nextDate = this.getNextScheduleDate(currentDate, frequency, hour, minute);
      } catch (error) {
        console.error('Error generating next schedule date:', error);
        break;
      }

      // Validate the generated date
      if (!(nextDate instanceof Date) || isNaN(nextDate.getTime())) {
        console.error('Generated invalid date, breaking loop');
        break;
      }

      // Prevent infinite loops by ensuring we're moving forward
      const nextDateTime = nextDate.getTime();
      if (nextDateTime <= currentDate.getTime()) {
        console.error('Date generation not progressing forward, breaking loop');
        break;
      }

      // Additional check: ensure time progresses by at least 1 minute for hourly frequencies
      if (frequency === 'hourly' && nextDateTime - lastGeneratedTime < 60000) {
        console.error('Hourly frequency not progressing properly, breaking loop');
        break;
      }

      // Check if we've exceeded the end date
      if (endDate && nextDate > endDate) {
        console.log('Reached end date, stopping generation');
        break;
      }

      // Prevent dates too far in the future (sanity check)
      const maxFutureDate = new Date();
      maxFutureDate.setFullYear(maxFutureDate.getFullYear() + 11);
      if (nextDate > maxFutureDate) {
        console.error('Generated date too far in future, breaking loop');
        break;
      }

      dates.push(new Date(nextDate));
      currentDate.setTime(nextDateTime);
      lastGeneratedTime = nextDateTime;

      // Extra safety: if we're generating too quickly, break
      if (i > 0 && dates.length >= 2) {
        const timeDiff = dates[dates.length - 1].getTime() - dates[dates.length - 2].getTime();
        if (timeDiff < 1000) { // Less than 1 second between notifications
          console.error('Generating notifications too rapidly, breaking loop');
          break;
        }
      }
    }

    console.log(`Generated ${dates.length} notification dates for ${frequency} frequency (safety counter: ${safetyCounter})`);

    // Final validation of generated dates
    const validDates = dates.filter(date => {
      const isValid = date instanceof Date && !isNaN(date.getTime()) && date > new Date();
      if (!isValid) {
        console.warn('Filtered out invalid date during final validation');
      }
      return isValid;
    });

    if (validDates.length !== dates.length) {
      console.warn(`Filtered out ${dates.length - validDates.length} invalid dates`);
    }

    return validDates;
  }


  private static getNextScheduleDate(
    currentDate: Date,
    frequency: RepeatFrequency,
    hour: number,
    minute: number
  ): Date {
    // Validate input parameters
    if (!(currentDate instanceof Date) || isNaN(currentDate.getTime())) {
      throw new Error('getNextScheduleDate: Invalid current date provided');
    }

    if (!frequency) {
      throw new Error('getNextScheduleDate: No frequency provided');
    }

    const next = new Date(currentDate);

    // Validate and sanitize hour and minute parameters
    if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      console.error(`Invalid time parameters: ${hour}:${minute}, using 9:00 AM`);
      hour = 9;
      minute = 0;
    }

    // Set the time, but preserve the current date initially
    next.setHours(hour, minute, 0, 0);

    // Apply frequency-specific logic with enhanced safety checks
    switch (frequency) {
      case 'hourly':
        next.setHours(next.getHours() + 1);
        // Validate that we didn't overflow into an invalid state
        if (isNaN(next.getTime())) {
          throw new Error('Date overflow in hourly frequency calculation');
        }
        break;

      case 'daily':
        next.setDate(next.getDate() + 1);
        if (isNaN(next.getTime())) {
          throw new Error('Date overflow in daily frequency calculation');
        }
        break;

      case 'weekdays':
        // Add days until we hit a weekday (Mon-Fri)
        let weekdayAttempts = 0;
        do {
          next.setDate(next.getDate() + 1);
          weekdayAttempts++;
          if (weekdayAttempts > 7) { // Safety: shouldn't take more than 7 days to find a weekday
            throw new Error('Unable to find valid weekday in reasonable time');
          }
          if (isNaN(next.getTime())) {
            throw new Error('Date overflow in weekdays frequency calculation');
          }
        } while (next.getDay() === 0 || next.getDay() === 6); // Skip weekends
        break;

      case 'weekends':
        // Add days until we hit a weekend (Sat-Sun)
        let weekendAttempts = 0;
        do {
          next.setDate(next.getDate() + 1);
          weekendAttempts++;
          if (weekendAttempts > 7) { // Safety: shouldn't take more than 7 days to find a weekend
            throw new Error('Unable to find valid weekend in reasonable time');
          }
          if (isNaN(next.getTime())) {
            throw new Error('Date overflow in weekends frequency calculation');
          }
        } while (next.getDay() !== 0 && next.getDay() !== 6); // Only weekends
        break;

      case 'weekly':
        next.setDate(next.getDate() + 7);
        if (isNaN(next.getTime())) {
          throw new Error('Date overflow in weekly frequency calculation');
        }
        break;

      case 'biweekly':
        next.setDate(next.getDate() + 14);
        if (isNaN(next.getTime())) {
          throw new Error('Date overflow in biweekly frequency calculation');
        }
        break;

      case 'monthly':
        // Handle month overflow carefully
        const originalDay = next.getDate();
        next.setMonth(next.getMonth() + 1);

        // If the day changed (e.g., Jan 31 -> Mar 3), adjust to last day of target month
        if (next.getDate() !== originalDay) {
          next.setDate(0); // Sets to last day of previous month
        }

        if (isNaN(next.getTime())) {
          throw new Error('Date overflow in monthly frequency calculation');
        }
        break;

      case 'quarterly':
        // Handle quarter overflow carefully
        const quarterOriginalDay = next.getDate();
        next.setMonth(next.getMonth() + 3);

        // If the day changed, adjust to last day of target month
        if (next.getDate() !== quarterOriginalDay) {
          next.setDate(0);
        }

        if (isNaN(next.getTime())) {
          throw new Error('Date overflow in quarterly frequency calculation');
        }
        break;

      case 'semiannually':
        // Handle semi-annual overflow carefully
        const semiOriginalDay = next.getDate();
        next.setMonth(next.getMonth() + 6);

        // If the day changed, adjust to last day of target month
        if (next.getDate() !== semiOriginalDay) {
          next.setDate(0);
        }

        if (isNaN(next.getTime())) {
          throw new Error('Date overflow in semiannually frequency calculation');
        }
        break;

      case 'yearly':
        // Handle leap year edge cases
        const yearOriginalDay = next.getDate();
        const yearOriginalMonth = next.getMonth();
        next.setFullYear(next.getFullYear() + 1);

        // Special case for Feb 29 on non-leap years
        if (yearOriginalMonth === 1 && yearOriginalDay === 29 && next.getDate() !== 29) {
          next.setDate(28); // Adjust to Feb 28
        }

        if (isNaN(next.getTime())) {
          throw new Error('Date overflow in yearly frequency calculation');
        }
        break;

      default:
        throw new Error(`Unsupported frequency: ${frequency}`);
    }

    // Final validation
    if (isNaN(next.getTime())) {
      throw new Error('Generated date is invalid after frequency calculation');
    }

    // Ensure we're progressing forward in time
    if (next.getTime() <= currentDate.getTime()) {
      throw new Error('Generated date is not progressing forward in time');
    }

    return next;
  }


  static async cancelNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      console.error('Failed to cancel notification:', error);
    }
  }

  static async cancelNotifications(notificationIds: string[]): Promise<void> {
    try {
      for (const id of notificationIds) {
        await this.cancelNotification(id);
      }
    } catch (error) {
      console.error('Failed to cancel notifications:', error);
    }
  }

  static async cancelAllTodoNotifications(todo: Todo): Promise<void> {
    const ids: string[] = [];

    if (todo.notifications?.early?.notificationId) {
      ids.push(todo.notifications.early.notificationId);
    }

    if (todo.notifications?.repeat?.notificationIds) {
      ids.push(...todo.notifications.repeat.notificationIds);
    }


    await this.cancelNotifications(ids);
  }

  // Intelligent suggestions based on task content
  static suggestNotificationSettings(todoTitle: string): {
    suggestedEarly?: { hours: number; label: string };
    suggestedRepeat?: { frequency: RepeatFrequency; label: string };
  } {
    const title = todoTitle.toLowerCase();
    const suggestions: any = {};

    // Early notification suggestions
    if (title.includes('meeting') || title.includes('appointment')) {
      suggestions.suggestedEarly = { hours: 1, label: '1 hour before' };
    } else if (title.includes('deadline') || title.includes('due')) {
      suggestions.suggestedEarly = { hours: 24, label: '1 day before' };
    } else {
      suggestions.suggestedEarly = { hours: 2, label: '2 hours before' };
    }

    // Repeat suggestions based on keywords
    if (title.includes('daily') || title.includes('everyday')) {
      suggestions.suggestedRepeat = { frequency: 'daily', label: 'Daily reminder' };
    } else if (title.includes('weekly') || title.includes('week')) {
      suggestions.suggestedRepeat = { frequency: 'weekly', label: 'Weekly reminder' };
    } else if (title.includes('exercise') || title.includes('workout')) {
      suggestions.suggestedRepeat = { frequency: 'daily', label: 'Daily exercise reminder' };
    } else if (title.includes('review') || title.includes('check')) {
      suggestions.suggestedRepeat = { frequency: 'weekly', label: 'Weekly review' };
    }

    return suggestions;
  }

  static async cleanupExpiredNotifications(): Promise<void> {
    try {
      // Get all scheduled notifications
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();

      // Cancel notifications that are in the past
      const now = new Date();
      for (const notification of scheduled) {
        if (notification.trigger && 'date' in notification.trigger) {
          const triggerDate = new Date(notification.trigger.date);
          if (triggerDate < now) {
            await this.cancelNotification(notification.identifier);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup expired notifications:', error);
    }
  }

  static async getScheduledNotificationCount(): Promise<number> {
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      return scheduled.length;
    } catch (error) {
      console.error('Failed to get notification count:', error);
      return 0;
    }
  }

  static async getNotificationStatus(todoId: string): Promise<{
    early?: { scheduled: boolean; triggerDate?: Date };
    repeat?: { scheduled: number; nextTrigger?: Date };
  }> {
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const todoNotifications = scheduled.filter(
        n => n.content.data?.todoId === todoId
      );

      const result: any = {};

      for (const notification of todoNotifications) {
        const type = notification.content.data?.type;
        if (type === 'early' && notification.trigger && 'date' in notification.trigger) {
          result.early = {
            scheduled: true,
            triggerDate: new Date(notification.trigger.date)
          };
        } else if (type === 'repeat') {
          if (!result.repeat) {
            result.repeat = { scheduled: 0 };
          }
          result.repeat.scheduled += 1;
          if (notification.trigger && 'date' in notification.trigger) {
            const triggerDate = new Date(notification.trigger.date);
            if (!result.repeat.nextTrigger || triggerDate < result.repeat.nextTrigger) {
              result.repeat.nextTrigger = triggerDate;
            }
          }
        }
      }

      return result;
    } catch (error) {
      console.error('Failed to get notification status:', error);
      return {};
    }
  }
}

// Hook for handling notification responses and lifecycle
export function useNotificationHandler() {
  return {
    handleNotificationResponse: async (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data;

      if (data?.action === 'open_todo' && data?.todoId) {
        // Navigate to todo or show todo details
        // This can be implemented based on your navigation setup
        console.log('Opening todo:', data.todoId);

        // You can add navigation logic here, for example:
        // router.push(`/todo/${data.todoId}`);
      }
    },

    // Initialize notification system on app start
    initializeNotifications: async () => {
      await NotificationService.requestPermissions();
      await NotificationService.cleanupExpiredNotifications();

      const count = await NotificationService.getScheduledNotificationCount();
      console.log('Scheduled notifications after cleanup:', count);
    }
  };
}