export interface Todo {
  id: string;
  title: string;
  deadline: string | null;
  completed: boolean;
  createdAt: string;
  notifications?: NotificationSettings;
}

export interface NotificationSettings {
  early?: EarlyNotification;
  repeat?: RepeatNotification;
}

export interface EarlyNotification {
  enabled: boolean;
  dateTime: string; // ISO string
  notificationId?: string; // For tracking scheduled notifications
}

export interface RepeatNotification {
  enabled: boolean;
  frequency: RepeatFrequency;
  customTime?: string; // Time of day (HH:mm format)
  notificationIds?: string[]; // Multiple scheduled notifications
  endDate?: string; // Optional end date for repeating notifications
}

export type RepeatFrequency =
  | 'hourly'
  | 'daily'
  | 'weekdays'
  | 'weekends'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'semiannually'
  | 'yearly';

export const REPEAT_FREQUENCY_LABELS: Record<RepeatFrequency, string> = {
  hourly: 'Every Hour',
  daily: 'Daily',
  weekdays: 'Weekdays',
  weekends: 'Weekends',
  weekly: 'Weekly',
  biweekly: 'Every 2 Weeks',
  monthly: 'Monthly',
  quarterly: 'Every 3 Months',
  semiannually: 'Every 6 Months',
  yearly: 'Yearly'
};

export enum TodoState {
  COMPLETED = 'completed',
  OVERDUE = 'overdue',
  URGENT = 'urgent',
  NORMAL = 'normal',
  NO_DEADLINE = 'no_deadline'
}

export interface TodoStateInfo {
  state: TodoState;
  urgencyColor: string;
  shouldStrikethrough: boolean;
  shouldBold: boolean;
  deadlineLabel: string;
}

// Enhanced Export/Import Types
export interface BuddyExportData {
  metadata: ExportMetadata;
  todos: Todo[];
  settings?: AppSettings;
  notificationStatus?: NotificationStatus;
}

export interface ExportMetadata {
  version: string;
  exportDate: string;
  appVersion: string;
  totalTodos: number;
  completedTodos: number;
  pendingTodos: number;
  devicePlatform: string;
  exportId: string;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'auto';
  notificationsEnabled: boolean;
  lastBackup?: string;
}

export interface NotificationStatus {
  totalScheduled: number;
  earlyNotifications: number;
  repeatNotifications: number;
  lastCleanup: string;
}

export interface ImportResult {
  success: boolean;
  count?: number;
  notificationsRestored?: number;
  error?: string;
  warnings?: string[];
  metadata?: ExportMetadata;
}
