
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { TodoProvider } from "@/contexts/TodoContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useNotificationHandler } from "@/services/NotificationService";
import * as Notifications from 'expo-notifications';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const { initializeNotifications, handleNotificationResponse } = useNotificationHandler();

  useEffect(() => {
    SplashScreen.hideAsync();

    // Initialize notifications on app start
    initializeNotifications();

    // Set up notification response listener
    const subscription = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

    return () => subscription.remove();
  }, [handleNotificationResponse, initializeNotifications]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TodoProvider>
          <GestureHandlerRootView>
            <RootLayoutNav />
          </GestureHandlerRootView>
        </TodoProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
