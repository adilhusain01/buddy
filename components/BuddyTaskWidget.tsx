import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { WidgetProvider } from '@bittingz/expo-widgets';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Todo } from '@/types/todo';

const STORAGE_KEY = 'todos';

interface WidgetProps {
  family?: 'small' | 'medium' | 'large';
}

export default function BuddyTaskWidget({ family = 'medium' }: WidgetProps) {
  const [todos, setTodos] = useState<Todo[]>([]);

  useEffect(() => {
    loadTodos();
    // Set up widget refresh interval
    const interval = setInterval(loadTodos, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const loadTodos = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedTodos = JSON.parse(stored);
        // Sort todos by deadline (urgent first)
        const sortedTodos = sortTodosByDeadline(parsedTodos);
        setTodos(sortedTodos);
      }
    } catch (error) {
      console.error('Widget failed to load todos:', error);
    }
  };

  const sortTodosByDeadline = (todos: Todo[]): Todo[] => {
    const now = new Date();
    return todos
      .filter(todo => !todo.completed) // Show only incomplete tasks
      .sort((a, b) => {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;

        const timeLeftA = new Date(a.deadline).getTime() - now.getTime();
        const timeLeftB = new Date(b.deadline).getTime() - now.getTime();

        return timeLeftA - timeLeftB;
      });
  };

  const formatDeadline = (deadline: string | null): string => {
    if (!deadline) return "";
    const date = new Date(deadline);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffHours = diffTime / (1000 * 60 * 60);

    if (diffHours < 0) return "Overdue";
    if (diffHours < 1) return `${Math.ceil(diffTime / (1000 * 60))}m left`;
    if (diffHours < 24) return `${Math.ceil(diffHours)}h left`;
    const diffDays = Math.ceil(diffHours / 24);
    return `${diffDays}d left`;
  };

  const getUrgencyColor = (todo: Todo): string => {
    if (todo.completed) return "#94a3b8";
    if (!todo.deadline) return "#64748b";

    const now = new Date();
    const deadline = new Date(todo.deadline);
    const hoursLeft = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursLeft < 0) return "#ef4444"; // Red - overdue
    if (hoursLeft < 24) return "#f97316"; // Orange - urgent
    if (hoursLeft < 72) return "#E2BA6F"; // Golden - soon
    return "#10b981"; // Green - plenty of time
  };

  const maxTasks = family === 'large' ? 6 : family === 'medium' ? 4 : 2;
  const visibleTodos = todos.slice(0, maxTasks);

  return (
    <WidgetProvider>
      <View style={[styles.container, family === 'large' && styles.largeContainer]}>
        <View style={styles.header}>
          <Text style={styles.title}>Buddy Tasks</Text>
          <Text style={styles.subtitle}>
            {todos.length} task{todos.length !== 1 ? 's' : ''}
          </Text>
        </View>

        <ScrollView style={styles.taskList} showsVerticalScrollIndicator={false}>
          {visibleTodos.length > 0 ? (
            visibleTodos.map((todo, index) => (
              <View key={todo.id} style={styles.taskItem}>
                <View style={styles.taskContent}>
                  <View
                    style={[
                      styles.taskIndicator,
                      { backgroundColor: getUrgencyColor(todo) }
                    ]}
                  />
                  <View style={styles.taskText}>
                    <Text style={styles.taskTitle} numberOfLines={1}>
                      {todo.title}
                    </Text>
                    {todo.deadline && (
                      <Text
                        style={[
                          styles.taskDeadline,
                          { color: getUrgencyColor(todo) }
                        ]}
                      >
                        {formatDeadline(todo.deadline)}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No tasks yet!</Text>
              <Text style={styles.emptySubtext}>Add some tasks in the app</Text>
            </View>
          )}
        </ScrollView>

        {todos.length > maxTasks && (
          <Text style={styles.moreText}>
            +{todos.length - maxTasks} more task{todos.length - maxTasks !== 1 ? 's' : ''}
          </Text>
        )}
      </View>
    </WidgetProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020202',
    borderRadius: 16,
    padding: 16,
    minHeight: 146,
  },
  largeContainer: {
    minHeight: 294,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f1f5f9',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  taskList: {
    flex: 1,
  },
  taskItem: {
    marginBottom: 8,
  },
  taskContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskIndicator: {
    width: 3,
    height: 20,
    borderRadius: 2,
    marginRight: 10,
  },
  taskText: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f1f5f9',
    marginBottom: 2,
  },
  taskDeadline: {
    fontSize: 11,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
  moreText: {
    fontSize: 11,
    color: '#E2BA6F',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },
});