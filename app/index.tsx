import { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Platform,
  Modal,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus, Calendar, Trash2, Check, Edit3, Download, Upload, Sun, Moon, Bell } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useTodos, useSortedTodos, getTodoStateInfo } from "@/contexts/TodoContext";
import { Todo, NotificationSettings } from "@/types/todo";
import { useTheme } from "@/contexts/ThemeContext";
import { Colors } from "@/constants/colors";
import { NotificationSettings as NotificationSettingsModal } from "@/components/NotificationSettings";

export default function TodoListScreen() {
  const { addTodo, toggleTodo, deleteTodo, editTodo, exportTodos, importTodos } = useTodos();
  const sortedTodos = useSortedTodos();
  const { isDark, colorScheme, setTheme } = useTheme();

  const [inputText, setInputText] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editText, setEditText] = useState("");
  const [editDate, setEditDate] = useState<Date | null>(null);
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [showEditTimePicker, setShowEditTimePicker] = useState(false);
  const [editTempDate, setEditTempDate] = useState<Date>(new Date());
  const [showCreateDateModal, setShowCreateDateModal] = useState(false);

  // Notification states
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [currentNotifications, setCurrentNotifications] = useState<NotificationSettings>();
  const [notificationTodoTitle, setNotificationTodoTitle] = useState("");
  const [notificationTodoDeadline, setNotificationTodoDeadline] = useState<string | null>(null);

  const handleAddTodo = useCallback(async () => {
    if (inputText.trim()) {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      await addTodo(inputText.trim(), selectedDate?.toISOString() || null, currentNotifications);
      setInputText("");
      setSelectedDate(null);
      setCurrentNotifications(undefined);
    }
  }, [inputText, selectedDate, currentNotifications, addTodo]);

  const handleToggleTodo = useCallback(
    (id: string) => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      toggleTodo(id);
    },
    [toggleTodo]
  );

  const handleDeleteTodo = useCallback(
    (id: string) => {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      deleteTodo(id);
    },
    [deleteTodo]
  );

  // Remove old functions - using getTodoStateInfo now


  const handleDateChange = (_event: any, date?: Date) => {
    if (date) {
      setTempDate(date);
      if (Platform.OS === "android") {
        setShowDatePicker(false);
        setTimeout(() => {
          setShowTimePicker(true);
        }, 100);
      }
    } else if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
  };

  const handleTimeChange = (_event: any, date?: Date) => {
    setShowTimePicker(false);
    if (date) {
      const combined = new Date(tempDate);
      combined.setHours(date.getHours(), date.getMinutes(), 0, 0);
      setTempDate(combined);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  };

  const handleConfirmDateTime = () => {
    setSelectedDate(tempDate);
    setShowCreateDateModal(false);
    setShowDatePicker(false);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleEditTodo = useCallback((todo: Todo) => {
    setEditingTodo(todo);
    setEditText(todo.title);
    setEditDate(todo.deadline ? new Date(todo.deadline) : null);
    setShowEditModal(true);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (editingTodo && editText.trim()) {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      await editTodo(editingTodo.id, editText.trim(), editDate?.toISOString() || null, currentNotifications);
      setShowEditModal(false);
      setEditingTodo(null);
      setEditText("");
      setEditDate(null);
      setCurrentNotifications(undefined);
    }
  }, [editingTodo, editText, editDate, currentNotifications, editTodo]);

  const handleExport = useCallback(async () => {
    try {
      const data = await exportTodos();
      const filename = `buddy-tasks-${new Date().toISOString().split('T')[0]}.json`;

      if (Platform.OS === 'web') {
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // Mobile platforms - create file and share using new API
        try {
          const file = new File(Paths.cache, filename);
          file.write(data);

          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(file.uri, {
              mimeType: 'application/json',
              dialogTitle: 'Export Buddy Tasks',
              UTI: 'public.data',
            });
          } else {
            Alert.alert('Export Complete', `Tasks exported to ${filename}`);
          }
        } catch (fileError) {
          console.error('File operation failed:', fileError);
          Alert.alert('Export Failed', 'Could not create export file. Please try again.');
        }
      }
    } catch (error) {
      console.error('Export error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Could not export tasks. Please try again.';
      Alert.alert('Export Failed', errorMessage);
    }
  }, [exportTodos]);

  const handleImport = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/json', 'text/plain'],
        copyToCacheDirectory: true, // Important for Android content URI handling
      });

      if (!result.canceled && result.assets?.[0]) {
        let text: string;

        if (Platform.OS === 'web') {
          const response = await fetch(result.assets[0].uri);
          text = await response.text();
        } else {
          // Mobile platforms - use new File API which handles content URIs properly
          try {
            const file = new File(result.assets[0].uri);
            text = file.textSync();
          } catch (fileError) {
            console.error('File read error:', fileError);
            // Fallback for content URIs that might need copying
            const tempFile = new File(Paths.cache, 'import-temp.json');
            const originalFile = new File(result.assets[0].uri);
            originalFile.copy(tempFile);
            text = tempFile.textSync();
            tempFile.delete(); // Clean up
          }
        }

        // Clean up any BOM or whitespace that might cause parsing issues
        text = text.replace(/^\uFEFF/, "").trim();

        const importResult = await importTodos(text);

        if (importResult.success) {
          let successMessage = `Successfully imported ${importResult.count} tasks!`;

          if (importResult.notificationsRestored !== undefined) {
            successMessage += `\nNotifications restored: ${importResult.notificationsRestored}`;
          }

          if (importResult.warnings && importResult.warnings.length > 0) {
            successMessage += `\n\nWarnings:\n${importResult.warnings.join('\n')}`;
          }

          if (importResult.metadata) {
            successMessage += `\n\nImported from: ${importResult.metadata.devicePlatform} (${importResult.metadata.exportDate.split('T')[0]})`;
          }

          Alert.alert('Import Successful', successMessage);
        } else {
          Alert.alert('Import Failed', importResult.error || 'The file format is not valid. Please select a JSON file exported from Buddy.');
        }
      }
    } catch (error) {
      console.error('Import error:', error);
      Alert.alert('Import Failed', 'Could not read the selected file. Please make sure it\'s a valid JSON file exported from Buddy.');
    }
  }, [importTodos]);

  const toggleTheme = useCallback(() => {
    setTheme(isDark ? 'light' : 'dark');
  }, [isDark, setTheme]);

  const openNotificationSettings = useCallback((forCreation: boolean = false) => {
    if (forCreation) {
      setNotificationTodoTitle(inputText);
      setNotificationTodoDeadline(selectedDate?.toISOString() || null);
      setCurrentNotifications(undefined);
    } else if (editingTodo) {
      setNotificationTodoTitle(editText);
      setNotificationTodoDeadline(editDate?.toISOString() || null);
      setCurrentNotifications(editingTodo.notifications);
    }
    setShowNotificationSettings(true);
  }, [inputText, selectedDate, editingTodo, editText, editDate]);

  const handleNotificationSave = useCallback((notifications: NotificationSettings) => {
    setCurrentNotifications(notifications);
    setShowNotificationSettings(false);

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const hasActiveNotifications = useCallback((todo: Todo) => {
    return !!(todo.notifications?.early?.enabled || todo.notifications?.repeat?.enabled);
  }, []);

  const handleEditDateChange = (_event: any, date?: Date) => {
    if (date) {
      setEditTempDate(date);
      if (Platform.OS === "android") {
        setShowEditDatePicker(false);
        setTimeout(() => {
          setShowEditTimePicker(true);
        }, 100);
      }
    } else if (Platform.OS === "android") {
      setShowEditDatePicker(false);
    }
  };

  const handleEditTimeChange = (_event: any, date?: Date) => {
    setShowEditTimePicker(false);
    if (date) {
      const combined = new Date(editTempDate);
      combined.setHours(date.getHours(), date.getMinutes(), 0, 0);
      setEditDate(combined);
    }
  };

  const openEditDatePicker = () => {
    if (Platform.OS === "android") {
      setEditTempDate(editDate || new Date());
      setShowEditDatePicker(true);
    }
  };

  const renderTodoItem = useCallback(
    ({ item }: { item: Todo }) => {
      const stateInfo = getTodoStateInfo(item);
      const colors = Colors[colorScheme];

      return (
        <View style={[styles.todoItem, { backgroundColor: colors.surfaceSecondary }]}>
          <TouchableOpacity
            style={[styles.checkbox, { borderColor: stateInfo.urgencyColor }]}
            onPress={() => handleToggleTodo(item.id)}
            activeOpacity={0.7}
          >
            {item.completed && (
              <View style={[styles.checkboxInner, { backgroundColor: stateInfo.urgencyColor }]}>
                <Check size={16} color="#fff" strokeWidth={3} />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.todoContent}>
            <Text
              style={[
                styles.todoTitle,
                stateInfo.shouldStrikethrough && styles.todoTitleCompleted,
                stateInfo.shouldBold && styles.todoTitleBold,
                {
                  color: stateInfo.shouldStrikethrough
                    ? colors.textMuted
                    : stateInfo.urgencyColor === "#ef4444"
                      ? stateInfo.urgencyColor
                      : colors.text
                },
              ]}
            >
              {item.title}
            </Text>
            {(stateInfo.deadlineLabel || hasActiveNotifications(item)) && (
              <View style={styles.deadlineContainer}>
                {stateInfo.deadlineLabel && (
                  <>
                    <Calendar size={12} color={stateInfo.urgencyColor} strokeWidth={2} />
                    <Text style={[styles.deadlineText, { color: stateInfo.urgencyColor }]}>
                      {stateInfo.deadlineLabel}
                    </Text>
                  </>
                )}
                {hasActiveNotifications(item) && (
                  <View style={styles.notificationIndicator}>
                    <Bell size={12} color="#E2BA6F" strokeWidth={2} />
                  </View>
                )}
              </View>
            )}
          </View>

          <TouchableOpacity
            onPress={() => handleEditTodo(item)}
            style={styles.editButton}
            activeOpacity={0.7}
          >
            <Edit3 size={18} color={colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleDeleteTodo(item.id)}
            style={styles.deleteButton}
            activeOpacity={0.7}
          >
            <Trash2 size={18} color={colors.textMuted} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      );
    },
    [handleToggleTodo, handleDeleteTodo, handleEditTodo, hasActiveNotifications, colorScheme]
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIconContainer, { backgroundColor: colors.surface }]}>
        <Check size={64} color={colors.borderAccent} strokeWidth={1.5} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No todos yet</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>Add your first task to get started</Text>
    </View>
  );

  const openDatePicker = () => {
    setTempDate(selectedDate || new Date());
    setShowCreateDateModal(true);
  };

  const colors = Colors[colorScheme];

  return (
    <LinearGradient colors={colors.gradient as any} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Buddy</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              {sortedTodos.length} {sortedTodos.length === 1 ? "task" : "tasks"}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={toggleTheme}
              activeOpacity={0.7}
            >
              {isDark ? (
                <Sun size={22} color={colors.text} strokeWidth={2} />
              ) : (
                <Moon size={22} color={colors.text} strokeWidth={2} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleExport}
              activeOpacity={0.7}
            >
              <Download size={22} color={colors.text} strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleImport}
              activeOpacity={0.7}
            >
              <Upload size={22} color={colors.text} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputContainer}>
          <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Add a new task..."
              placeholderTextColor={colors.textMuted}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleAddTodo}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[
                styles.calendarButton,
                { backgroundColor: '#E2BA6F' },
              ]}
              onPress={openDatePicker}
              activeOpacity={0.7}
            >
              <Calendar
                size={20}
                color="#fff"
                strokeWidth={2}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.dateButton,
                { backgroundColor: '#E2BA6F' },
              ]}
              onPress={() => openNotificationSettings(true)}
              activeOpacity={0.7}
            >
              <Bell
                size={20}
                color="#fff"
                strokeWidth={2}
              />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.addButton, !inputText.trim() && styles.addButtonDisabled]}
            onPress={handleAddTodo}
            disabled={!inputText.trim()}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#E2BA6F', '#D4A853'] as any}
              style={styles.addButtonGradient}
            >
              <Plus size={24} color="#fff" strokeWidth={2.5} />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <FlatList
          data={sortedTodos}
          renderItem={renderTodoItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />


        {showCreateDateModal && (
          <Modal
            visible={showCreateDateModal}
            transparent
            animationType="fade"
            onRequestClose={() => {
              setShowCreateDateModal(false);
            }}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => {
                setShowCreateDateModal(false);
              }}
            >
              <TouchableOpacity activeOpacity={1}>
                <View style={[styles.datePickerModal, { backgroundColor: colors.surfaceSecondary }]}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Deadline</Text>

                    {Platform.OS === "ios" ? (
                    <ScrollView style={styles.pickerScrollContainer}>
                      <View style={styles.dateTimePickerContainer}>
                        <DateTimePicker
                          value={tempDate}
                          mode="date"
                          display="spinner"
                          onChange={handleDateChange}
                          minimumDate={new Date()}
                          textColor={colors.text}
                          style={styles.picker}
                        />
                        <DateTimePicker
                          value={tempDate}
                          mode="time"
                          display="spinner"
                          onChange={(_, date) => {
                            if (date) {
                              const combined = new Date(tempDate);
                              combined.setHours(date.getHours(), date.getMinutes(), 0, 0);
                              setTempDate(combined);
                            }
                          }}
                          textColor={colors.text}
                          style={styles.picker}
                        />
                      </View>
                    </ScrollView>
                  ) : (
                    <View>
                      <TouchableOpacity
                        style={[styles.androidDateButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        onPress={() => {
                          setShowDatePicker(true);
                        }}
                        activeOpacity={0.7}
                      >
                        <Calendar size={20} color="#E2BA6F" strokeWidth={2} />
                        <Text style={[styles.androidDateButtonText, { color: colors.text }]}>
                          {tempDate ? tempDate.toLocaleDateString() : "Set date"}
                        </Text>
                      </TouchableOpacity>

                      {tempDate && (
                        <Text style={[styles.selectedEditDate, { color: colors.textSecondary }]}>
                          Selected: {tempDate.toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          })}
                        </Text>
                      )}
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={handleConfirmDateTime}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#E2BA6F', '#D4A853'] as any}
                      style={styles.confirmButtonGradient}
                    >
                      <Text style={styles.confirmButtonText}>Done</Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.clearDateButton}
                    onPress={() => {
                      setSelectedDate(null);
                      setShowCreateDateModal(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.clearDateText, { color: colors.textSecondary }]}>Clear deadline</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        )}

        {Platform.OS === "android" && showDatePicker && (
          <DateTimePicker
            value={tempDate}
            mode="date"
            display="calendar"
            onChange={handleDateChange}
            minimumDate={new Date()}
          />
        )}

        {Platform.OS === "android" && showTimePicker && (
          <DateTimePicker
            value={tempDate}
            mode="time"
            is24Hour={false}
            display="default"
            onChange={handleTimeChange}
          />
        )}

        {showEditModal && editingTodo && (
          <Modal
            visible={showEditModal}
            transparent
            animationType="fade"
            onRequestClose={() => {
              setShowEditModal(false);
              setEditingTodo(null);
            }}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => {
                setShowEditModal(false);
                setEditingTodo(null);
              }}
            >
              <TouchableOpacity activeOpacity={1}>
                <View style={[styles.datePickerModal, { backgroundColor: colors.surfaceSecondary }]}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Task</Text>

                  <TextInput
                    style={[styles.editTaskInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                    placeholder="Task name"
                    placeholderTextColor={colors.textMuted}
                    value={editText}
                    onChangeText={setEditText}
                    autoFocus
                    multiline={false}
                    selectTextOnFocus={true}
                  />

                  {/* Notification Button */}
                  <TouchableOpacity
                    style={[styles.notificationButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => openNotificationSettings(false)}
                    activeOpacity={0.7}
                  >
                    <Bell size={16} color={editingTodo?.notifications?.early?.enabled || editingTodo?.notifications?.repeat?.enabled ? colors.primary : colors.textMuted} strokeWidth={2} />
                    <Text style={[styles.notificationButtonText, { color: colors.text }]}>
                      {editingTodo?.notifications?.early?.enabled || editingTodo?.notifications?.repeat?.enabled ? 'Notifications Set' : 'Set Notifications'}
                    </Text>
                  </TouchableOpacity>

                  {Platform.OS === "ios" ? (
                    <ScrollView style={styles.pickerScrollContainer}>
                      <View style={styles.dateTimePickerContainer}>
                        <DateTimePicker
                          value={editDate || new Date()}
                          mode="date"
                          display="spinner"
                          onChange={(_, date) => {
                            if (date) {
                              const combined = editDate ? new Date(editDate) : new Date();
                              combined.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                              setEditDate(combined);
                            }
                          }}
                          minimumDate={new Date()}
                          textColor={colors.text}
                          style={styles.picker}
                        />
                        <DateTimePicker
                          value={editDate || new Date()}
                          mode="time"
                          display="spinner"
                          onChange={(_, date) => {
                            if (date) {
                              const combined = editDate ? new Date(editDate) : new Date();
                              combined.setHours(date.getHours(), date.getMinutes(), 0, 0);
                              setEditDate(combined);
                            }
                          }}
                          textColor={colors.text}
                          style={styles.picker}
                        />
                      </View>
                    </ScrollView>
                  ) : (
                    <View>
                      <TouchableOpacity
                        style={[styles.androidDateButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        onPress={openEditDatePicker}
                        activeOpacity={0.7}
                      >
                        <Calendar size={20} color="#E2BA6F" strokeWidth={2} />
                        <Text style={[styles.androidDateButtonText, { color: colors.text }]}>
                          {editDate ? editDate.toLocaleDateString() : "Set date"}
                        </Text>
                      </TouchableOpacity>

                      {editDate && (
                        <Text style={[styles.selectedEditDate, { color: colors.textSecondary }]}>
                          Selected: {editDate.toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          })}
                        </Text>
                      )}
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={handleSaveEdit}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#E2BA6F', '#D4A853'] as any}
                      style={styles.confirmButtonGradient}
                    >
                      <Text style={styles.confirmButtonText}>Save Changes</Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.clearDateButton}
                    onPress={() => {
                      setEditDate(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.clearDateText, { color: colors.textSecondary }]}>Clear deadline</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        )}

        {Platform.OS === "android" && showEditDatePicker && (
          <DateTimePicker
            value={editTempDate}
            mode="date"
            display="calendar"
            onChange={handleEditDateChange}
            minimumDate={new Date()}
          />
        )}

        {Platform.OS === "android" && showEditTimePicker && (
          <DateTimePicker
            value={editTempDate}
            mode="time"
            is24Hour={false}
            display="default"
            onChange={handleEditTimeChange}
          />
        )}

        {/* Notification Settings Modal */}
        <NotificationSettingsModal
          visible={showNotificationSettings}
          onClose={() => setShowNotificationSettings(false)}
          onSave={handleNotificationSave}
          initialSettings={currentNotifications}
          todoTitle={notificationTodoTitle}
          todoDeadline={notificationTodoDeadline}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flex: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: "800" as const,
    color: "#0f172a",
    letterSpacing: -1,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "#64748b",
    marginTop: 4,
    fontWeight: "500" as const,
  },
  inputContainer: {
    paddingHorizontal: 24,
    marginBottom: 20,
    flexDirection: "row",
    gap: 12,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 16,
    shadowColor: "#0ea5e9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#1e293b",
    paddingVertical: 16,
    fontWeight: "500" as const,
  },
  dateButton: {
    padding: 8,
    borderRadius: 8,
  },
  calendarButton: {
    padding: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  dateButtonActive: {
    backgroundColor: "#e0f2fe",
  },
  addButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#0ea5e9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  addButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  addButtonGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    flexGrow: 1,
  },
  todoItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#0ea5e9",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  checkboxInner: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  todoContent: {
    flex: 1,
    gap: 4,
  },
  todoTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    lineHeight: 22,
  },
  todoTitleCompleted: {
    textDecorationLine: "line-through",
    opacity: 0.6,
  },
  todoTitleBold: {
    fontWeight: "700" as const,
  },
  deadlineContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  deadlineText: {
    fontSize: 13,
    fontWeight: "600" as const,
  },
  editButton: {
    padding: 8,
    marginLeft: 8,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: "#334155",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#94a3b8",
    fontWeight: "500" as const,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  datePickerModal: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700" as const,
    color: "#0f172a",
    marginBottom: 20,
    textAlign: "center",
  },

  clearDateButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  clearDateText: {
    fontSize: 15,
    color: "#64748b",
    fontWeight: "600" as const,
  },
  selectedDateContainer: {
    marginHorizontal: 24,
    marginBottom: 16,
    backgroundColor: "#e0f2fe",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectedDateContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  selectedDateText: {
    fontSize: 14,
    color: "#0284c7",
    fontWeight: "600" as const,
  },
  clearSelectedDate: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  clearSelectedDateText: {
    fontSize: 13,
    color: "#0284c7",
    fontWeight: "600" as const,
  },
  pickerScrollContainer: {
    maxHeight: 500,
  },

  dateTimePickerContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  picker: {
    width: "100%",
  },
  confirmButton: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 8,
  },
  confirmButtonGradient: {
    paddingVertical: 14,
    alignItems: "center",
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#fff",
  },
  androidDateButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
  },
  androidDateButtonText: {
    fontSize: 16,
    fontWeight: "500" as const,
  },
  selectedEditDate: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
  },
  editTaskInput: {
    fontSize: 16,
    fontWeight: "500" as const,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
    minHeight: 50,
  },
  notificationIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
  },
  notificationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
  },
  notificationButtonText: {
    fontSize: 16,
    fontWeight: "500" as const,
  },
});
