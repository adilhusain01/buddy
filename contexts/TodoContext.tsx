import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState, useMemo, useCallback } from "react";
import { Platform } from 'react-native';
import { Todo, NotificationSettings, TodoState, TodoStateInfo, BuddyExportData, ImportResult, ExportMetadata, AppSettings, NotificationStatus } from "@/types/todo";
import { NotificationService } from "@/services/NotificationService";

const STORAGE_KEY = "todos";

export const [TodoProvider, useTodos] = createContextHook(() => {
  const [todos, setTodos] = useState<Todo[]>([]);

  const todosQuery = useQuery({
    queryKey: ["todos"],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    },
  });


  const { mutate: saveTodos } = useMutation({
    mutationFn: async (newTodos: Todo[]) => {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newTodos));
      return newTodos;
    },
  });

  useEffect(() => {
    if (todosQuery.data) {
      setTodos(todosQuery.data);
    }
  }, [todosQuery.data]);

  const addTodo = useCallback(async (title: string, deadline: string | null, notifications?: NotificationSettings) => {
    try {
      const newTodo: Todo = {
        id: Date.now().toString(),
        title,
        deadline,
        completed: false,
        createdAt: new Date().toISOString(),
        notifications,
      };

      let finalTodo = newTodo;

      // Schedule notifications first if provided - ATOMIC OPERATION
      if (notifications) {
        const updatedNotifications = { ...notifications };

        // Schedule early notification
        if (notifications.early?.enabled) {
          const notificationId = await NotificationService.scheduleEarlyNotification(newTodo, notifications.early);
          if (notificationId && updatedNotifications.early) {
            updatedNotifications.early.notificationId = notificationId;
          }
        }

        // Schedule repeat notifications
        if (notifications.repeat?.enabled) {
          const notificationIds = await NotificationService.scheduleRepeatNotification(newTodo, notifications.repeat);
          if (notificationIds.length > 0 && updatedNotifications.repeat) {
            updatedNotifications.repeat.notificationIds = notificationIds;
          }
        }

        // Update todo with final notification IDs BEFORE saving
        finalTodo = { ...newTodo, notifications: updatedNotifications };
      }

      // Only save once with complete data
      setTodos((prev) => {
        const updated = [...prev, finalTodo];
        saveTodos(updated);
        return updated;
      });
    } catch (error) {
      console.error('Failed to add todo with notifications:', error);
      throw error;
    }
  }, [saveTodos]);

  const toggleTodo = useCallback(async (id: string) => {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    const willBeCompleted = !todo.completed;

    if (willBeCompleted) {
      // Task is being marked as complete - cancel repeat notifications
      // But keep early notifications in case user unchecks later
      if (todo.notifications?.repeat?.notificationIds) {
        await NotificationService.cancelNotifications(todo.notifications.repeat.notificationIds);
        // Update todo to remove repeat notification IDs
        const updatedNotifications = { ...todo.notifications };
        if (updatedNotifications.repeat) {
          updatedNotifications.repeat.notificationIds = [];
        }

        setTodos((prev) => {
          const updated = prev.map((t) =>
            t.id === id ? { ...t, completed: true, notifications: updatedNotifications } : t
          );
          saveTodos(updated);
          return updated;
        });
      } else {
        // No notifications to manage, just toggle
        setTodos((prev) => {
          const updated = prev.map((t) =>
            t.id === id ? { ...t, completed: true } : t
          );
          saveTodos(updated);
          return updated;
        });
      }
    } else {
      // Task is being unchecked - reschedule repeat notifications if they existed
      setTodos((prev) => {
        const updated = prev.map((t) =>
          t.id === id ? { ...t, completed: false } : t
        );
        saveTodos(updated);
        return updated;
      });

      // Reschedule repeat notifications if they exist
      if (todo.notifications?.repeat?.enabled) {
        const updatedTodo: Todo = {
          ...todo,
          completed: false,
          createdAt: todo.createdAt || new Date().toISOString()
        };

        // Schedule repeat notifications atomically
        const updatedNotifications = { ...todo.notifications };
        if (updatedNotifications.repeat?.enabled) {
          const notificationIds = await NotificationService.scheduleRepeatNotification(updatedTodo, updatedNotifications.repeat);
          if (notificationIds.length > 0) {
            updatedNotifications.repeat.notificationIds = notificationIds;

            // Update the todo with new notification IDs
            setTodos((prevTodos) =>
              prevTodos.map((t) =>
                t.id === todo.id ? { ...t, notifications: updatedNotifications } : t
              )
            );
          }
        }
      }
    }
  }, [todos, saveTodos]);

  const deleteTodo = useCallback(async (id: string) => {
    // Cancel notifications first
    const todo = todos.find(t => t.id === id);
    if (todo) {
      await NotificationService.cancelAllTodoNotifications(todo);
    }

    setTodos((prev) => {
      const updated = prev.filter((todo) => todo.id !== id);
      saveTodos(updated);
      return updated;
    });
  }, [todos, saveTodos]);

  const editTodo = useCallback(async (id: string, title: string, deadline: string | null, notifications?: NotificationSettings) => {
    try {
      // Find existing todo
      const existingTodo = todos.find(t => t.id === id);
      if (!existingTodo) {
        throw new Error('Todo not found for editing');
      }

      // Cancel existing notifications first
      await NotificationService.cancelAllTodoNotifications(existingTodo);

      // Create updated todo
      let updatedTodo = {
        ...existingTodo,
        title,
        deadline,
        notifications
      };

      // Schedule new notifications if provided - ATOMIC OPERATION
      if (notifications) {
        const updatedNotifications = { ...notifications };

        // Schedule early notification
        if (notifications.early?.enabled) {
          const notificationId = await NotificationService.scheduleEarlyNotification(updatedTodo, notifications.early);
          if (notificationId && updatedNotifications.early) {
            updatedNotifications.early.notificationId = notificationId;
          }
        }

        // Schedule repeat notifications
        if (notifications.repeat?.enabled) {
          const notificationIds = await NotificationService.scheduleRepeatNotification(updatedTodo, notifications.repeat);
          if (notificationIds.length > 0 && updatedNotifications.repeat) {
            updatedNotifications.repeat.notificationIds = notificationIds;
          }
        }

        // Update todo with final notification IDs
        updatedTodo = { ...updatedTodo, notifications: updatedNotifications };
      }

      // Save complete todo only once
      setTodos((prev) => {
        const updated = prev.map((todo) =>
          todo.id === id ? updatedTodo : todo
        );
        saveTodos(updated);
        return updated;
      });
    } catch (error) {
      console.error('Failed to edit todo with notifications:', error);
      throw error;
    }
  }, [todos, saveTodos]);

  const exportTodos = useCallback(async () => {
    try {
      // Get current notification status
      const notificationStatus = await getNotificationStatus();

      // Get app settings (from theme context or storage)
      const settings = await getAppSettings();

      // Generate metadata
      const metadata: ExportMetadata = {
        version: "1.0.1", // Match app.json version
        exportDate: new Date().toISOString(),
        appVersion: "1.0.1", // Should match app.json version
        totalTodos: todos.length,
        completedTodos: todos.filter(t => t.completed).length,
        pendingTodos: todos.filter(t => !t.completed).length,
        devicePlatform: Platform.OS,
        exportId: `buddy_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
      };

      const exportData: BuddyExportData = {
        metadata,
        todos,
        settings,
        notificationStatus
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('Export preparation failed:', error);
      throw new Error('Failed to prepare export data. Please try again.');
    }
  }, [todos]);


  const getNotificationStatus = async (): Promise<NotificationStatus> => {
    try {
      const totalScheduled = await NotificationService.getScheduledNotificationCount();
      let earlyNotifications = 0;
      let repeatNotifications = 0;

      for (const todo of todos) {
        if (todo.notifications?.early?.enabled) earlyNotifications++;
        if (todo.notifications?.repeat?.enabled) repeatNotifications++;
      }

      return {
        totalScheduled,
        earlyNotifications,
        repeatNotifications,
        lastCleanup: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to get notification status:', error);
      return {
        totalScheduled: 0,
        earlyNotifications: 0,
        repeatNotifications: 0,
        lastCleanup: new Date().toISOString()
      };
    }
  };

  const getAppSettings = async (): Promise<AppSettings> => {
    try {
      // Get theme from storage (this should ideally come from ThemeContext)
      const theme = await AsyncStorage.getItem('app_theme') as 'light' | 'dark' | 'auto' || 'dark';
      const lastBackup = await AsyncStorage.getItem('last_backup');

      return {
        theme,
        notificationsEnabled: true, // Assume enabled if we got here
        lastBackup: lastBackup || undefined
      };
    } catch (error) {
      console.error('Failed to get app settings:', error);
      return {
        theme: 'dark',
        notificationsEnabled: true
      };
    }
  };

  const importTodos = useCallback(async (jsonData: string): Promise<ImportResult> => {
    try {
      const parsedData = JSON.parse(jsonData);
      let warnings: string[] = [];

      // Only accept enhanced format
      if (!parsedData.metadata || !parsedData.todos || !Array.isArray(parsedData.todos)) {
        return {
          success: false,
          error: 'Invalid file format. Please use a file exported from Buddy v1.0+'
        };
      }

      const exportData = parsedData as BuddyExportData;
      const importedTodos = exportData.todos;
      const metadata = exportData.metadata;

      // Version check - support both legacy 1.0 and current 1.0.1
      const supportedVersions = ["1.0", "1.0.1"];
      if (!supportedVersions.includes(metadata.version)) {
        return {
          success: false,
          error: `Unsupported export version: ${metadata.version}. Supported versions: ${supportedVersions.join(', ')}. Please update the app or re-export your data.`
        };
      }

      // Apply settings if available
      if (exportData.settings) {
        try {
          await AsyncStorage.setItem('app_theme', exportData.settings.theme);
          if (exportData.settings.lastBackup) {
            await AsyncStorage.setItem('last_backup', exportData.settings.lastBackup);
          }
        } catch (error) {
          warnings.push('Could not restore app settings');
        }
      }

      // Validate and filter todos
      const validTodos = importedTodos.filter((todo) =>
        todo.id && todo.title && typeof todo.completed === 'boolean'
      );

      if (validTodos.length === 0) {
        return { success: false, error: 'No valid todos found in import data' };
      }

      // CRITICAL: Cancel all existing notifications before import
      console.log('Cancelling existing notifications before import...');
      for (const existingTodo of todos) {
        if (existingTodo.notifications) {
          await NotificationService.cancelAllTodoNotifications(existingTodo);
        }
      }

      // Set the todos (without notifications scheduled yet)
      setTodos(validTodos);
      saveTodos(validTodos);

      // CRITICAL: Reschedule all notifications for imported todos with updated IDs
      let notificationsRestored = 0;
      console.log('Restoring notifications for imported todos...');

      const updatedTodos = [...validTodos];

      for (let i = 0; i < validTodos.length; i++) {
        const todo = validTodos[i];
        if (todo.notifications && (todo.notifications.early?.enabled || todo.notifications.repeat?.enabled)) {
          try {
            const updatedNotifications = { ...todo.notifications };
            let hasUpdatedNotifications = false;

            // Schedule early notification
            if (todo.notifications.early?.enabled) {
              const notificationId = await NotificationService.scheduleEarlyNotification(todo, todo.notifications.early);
              if (notificationId && updatedNotifications.early) {
                updatedNotifications.early.notificationId = notificationId;
                hasUpdatedNotifications = true;
              } else if (notificationId === null && updatedNotifications.early) {
                // Notification time was in the past, disable it
                updatedNotifications.early.enabled = false;
                hasUpdatedNotifications = true;
                warnings.push(`Early reminder for "${todo.title}" was in the past and has been disabled`);
              }
            }

            // Schedule repeat notifications
            if (todo.notifications.repeat?.enabled) {
              const notificationIds = await NotificationService.scheduleRepeatNotification(todo, todo.notifications.repeat);
              if (notificationIds.length > 0 && updatedNotifications.repeat) {
                updatedNotifications.repeat.notificationIds = notificationIds;
                hasUpdatedNotifications = true;
              }
            }

            // Update the todo in our array with new notification IDs
            if (hasUpdatedNotifications) {
              updatedTodos[i] = { ...todo, notifications: updatedNotifications };
            }

            notificationsRestored++;
            console.log(`Restored notifications for todo: ${todo.title}`);
          } catch (error) {
            console.error(`Failed to restore notifications for todo ${todo.id}:`, error);
            warnings.push(`Could not restore notifications for: ${todo.title}`);
          }
        }
      }

      // Update state with todos that have correct notification IDs
      if (notificationsRestored > 0) {
        setTodos(updatedTodos);
        saveTodos(updatedTodos);
      }

      // Update last backup timestamp
      await AsyncStorage.setItem('last_backup', new Date().toISOString());

      const result: ImportResult = {
        success: true,
        count: validTodos.length,
        notificationsRestored,
        metadata,
        warnings: warnings.length > 0 ? warnings : undefined
      };

      console.log('Import completed:', result);
      return result;

    } catch (error) {
      console.error('Import failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse import data'
      };
    }
  }, [todos, saveTodos]);

  // Initialize notification permissions on app start
  useEffect(() => {
    NotificationService.requestPermissions();
  }, []);

  return useMemo(
    () => ({
      todos,
      addTodo,
      toggleTodo,
      deleteTodo,
      editTodo,
      exportTodos,
      importTodos,
      isLoading: todosQuery.isLoading,
    }),
    [todos, addTodo, toggleTodo, deleteTodo, editTodo, exportTodos, importTodos, todosQuery.isLoading]
  );
});


export function isExpired(deadline: string | null): boolean {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

export function getTodoStateInfo(todo: Todo): TodoStateInfo {
  const now = new Date();

  // Completed tasks - always strikethrough with muted colors
  if (todo.completed) {
    return {
      state: TodoState.COMPLETED,
      urgencyColor: "#94a3b8",
      shouldStrikethrough: true,
      shouldBold: false,
      deadlineLabel: todo.deadline ? formatRelativeTime(todo.deadline) : ""
    };
  }

  // No deadline tasks
  if (!todo.deadline) {
    return {
      state: TodoState.NO_DEADLINE,
      urgencyColor: "#64748b",
      shouldStrikethrough: false,
      shouldBold: false,
      deadlineLabel: ""
    };
  }

  const deadline = new Date(todo.deadline);
  const hoursLeft = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

  // Overdue tasks - RED, bold, never strikethrough
  if (hoursLeft < 0) {
    return {
      state: TodoState.OVERDUE,
      urgencyColor: "#ef4444",
      shouldStrikethrough: false,
      shouldBold: true,
      deadlineLabel: formatRelativeTime(todo.deadline)
    };
  }

  // Urgent tasks (due within 24 hours)
  if (hoursLeft < 24) {
    return {
      state: TodoState.URGENT,
      urgencyColor: "#f97316",
      shouldStrikethrough: false,
      shouldBold: false,
      deadlineLabel: formatRelativeTime(todo.deadline)
    };
  }

  // Due within 72 hours
  if (hoursLeft < 72) {
    return {
      state: TodoState.NORMAL,
      urgencyColor: "#eab308",
      shouldStrikethrough: false,
      shouldBold: false,
      deadlineLabel: formatRelativeTime(todo.deadline)
    };
  }

  // Normal tasks
  return {
    state: TodoState.NORMAL,
    urgencyColor: "#10b981",
    shouldStrikethrough: false,
    shouldBold: false,
    deadlineLabel: formatRelativeTime(todo.deadline)
  };
}

function formatRelativeTime(deadline: string): string {
  const date = new Date(deadline);

  // Format date and time with AM/PM
  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  return `${dateStr} at ${timeStr}`;
}

export function useSortedTodos() {
  const { todos } = useTodos();

  return useMemo(() => {
    return [...todos].sort((a, b) => {
      const aState = getTodoStateInfo(a);
      const bState = getTodoStateInfo(b);

      // Completed tasks go to bottom
      if (aState.state === TodoState.COMPLETED && bState.state !== TodoState.COMPLETED) return 1;
      if (bState.state === TodoState.COMPLETED && aState.state !== TodoState.COMPLETED) return -1;
      if (aState.state === TodoState.COMPLETED && bState.state === TodoState.COMPLETED) return 0;

      // Overdue tasks come first (most overdue first)
      if (aState.state === TodoState.OVERDUE && bState.state !== TodoState.OVERDUE) return -1;
      if (bState.state === TodoState.OVERDUE && aState.state !== TodoState.OVERDUE) return 1;

      // Both overdue - sort by most overdue first
      if (aState.state === TodoState.OVERDUE && bState.state === TodoState.OVERDUE) {
        if (!a.deadline || !b.deadline) return 0;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }

      // Tasks with deadlines vs tasks without deadlines
      if (!a.deadline && b.deadline) return 1;
      if (a.deadline && !b.deadline) return -1;
      if (!a.deadline && !b.deadline) return 0;

      // Both have deadlines - sort by earliest deadline first
      return new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime();
    });
  }, [todos]);
}
