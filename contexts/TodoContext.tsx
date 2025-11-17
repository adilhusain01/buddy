import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState, useMemo, useCallback } from "react";
import { Todo } from "@/types/todo";

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

  const addTodo = useCallback((title: string, deadline: string | null) => {
    const newTodo: Todo = {
      id: Date.now().toString(),
      title,
      deadline,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    setTodos((prev) => {
      const updated = [...prev, newTodo];
      saveTodos(updated);
      return updated;
    });
  }, [saveTodos]);

  const toggleTodo = useCallback((id: string) => {
    setTodos((prev) => {
      const updated = prev.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      );
      saveTodos(updated);
      return updated;
    });
  }, [saveTodos]);

  const deleteTodo = useCallback((id: string) => {
    setTodos((prev) => {
      const updated = prev.filter((todo) => todo.id !== id);
      saveTodos(updated);
      return updated;
    });
  }, [saveTodos]);

  const editTodo = useCallback((id: string, title: string, deadline: string | null) => {
    setTodos((prev) => {
      const updated = prev.map((todo) =>
        todo.id === id ? { ...todo, title, deadline } : todo
      );
      saveTodos(updated);
      return updated;
    });
  }, [saveTodos]);

  const exportTodos = useCallback(() => {
    return JSON.stringify(todos, null, 2);
  }, [todos]);

  const importTodos = useCallback((jsonData: string) => {
    try {
      const importedTodos: Todo[] = JSON.parse(jsonData);
      if (Array.isArray(importedTodos)) {
        const validTodos = importedTodos.filter((todo) =>
          todo.id && todo.title && typeof todo.completed === 'boolean'
        );
        setTodos(validTodos);
        saveTodos(validTodos);
        return { success: true, count: validTodos.length };
      }
      return { success: false, error: 'Invalid data format' };
    } catch (error) {
      return { success: false, error: 'Failed to parse JSON' };
    }
  }, [saveTodos]);

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

export function useSortedTodos() {
  const { todos } = useTodos();

  return useMemo(() => {
    const now = new Date();

    return [...todos].sort((a, b) => {
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;

      const timeLeftA = new Date(a.deadline).getTime() - now.getTime();
      const timeLeftB = new Date(b.deadline).getTime() - now.getTime();

      return timeLeftA - timeLeftB;
    });
  }, [todos]);
}

export function isExpired(deadline: string | null): boolean {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}
