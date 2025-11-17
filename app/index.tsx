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
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus, Calendar, Trash2, Check, Clock, Edit3, Download, Upload, Settings, Sun, Moon } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as DocumentPicker from 'expo-document-picker';
import { useTodos, useSortedTodos, isExpired } from "@/contexts/TodoContext";
import { Todo } from "@/types/todo";
import { useTheme } from "@/contexts/ThemeContext";
import { Colors } from "@/constants/colors";

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
  const [showSettings, setShowSettings] = useState(false);
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [showEditTimePicker, setShowEditTimePicker] = useState(false);
  const [editTempDate, setEditTempDate] = useState<Date>(new Date());

  const handleAddTodo = useCallback(() => {
    if (inputText.trim()) {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      addTodo(inputText.trim(), selectedDate?.toISOString() || null);
      setInputText("");
      setSelectedDate(null);
    }
  }, [inputText, selectedDate, addTodo]);

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

  const getUrgencyColor = (todo: Todo): string => {
    if (todo.completed) return "#94a3b8";
    if (!todo.deadline) return "#64748b";

    const deadline = new Date(todo.deadline);
    const now = new Date();
    const hoursLeft = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursLeft < 0) return "#ef4444";
    if (hoursLeft < 24) return "#f97316";
    if (hoursLeft < 72) return "#eab308";
    return "#10b981";
  };

  const formatDeadline = (deadline: string | null): string => {
    if (!deadline) return "";

    const date = new Date(deadline);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatSelectedDateTime = (date: Date | null): string => {
    if (!date) return "";
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

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
      setSelectedDate(combined);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  };

  const handleConfirmDateTime = () => {
    if (Platform.OS === "ios") {
      setSelectedDate(tempDate);
      setShowDatePicker(false);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  };

  const handleEditTodo = useCallback((todo: Todo) => {
    setEditingTodo(todo);
    setEditText(todo.title);
    setEditDate(todo.deadline ? new Date(todo.deadline) : null);
    setShowEditModal(true);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (editingTodo && editText.trim()) {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      editTodo(editingTodo.id, editText.trim(), editDate?.toISOString() || null);
      setShowEditModal(false);
      setEditingTodo(null);
      setEditText("");
      setEditDate(null);
    }
  }, [editingTodo, editText, editDate, editTodo]);

  const handleExport = useCallback(async () => {
    try {
      const data = exportTodos();
      if (Platform.OS === 'web') {
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `buddy-tasks-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        await Share.share({
          message: data,
          title: 'Export Tasks',
        });
      }
    } catch (error) {
      Alert.alert('Export Failed', 'Could not export tasks.');
    }
  }, [exportTodos]);

  const handleImport = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: false,
      });

      if (!result.canceled && result.assets?.[0]) {
        const response = await fetch(result.assets[0].uri);
        const text = await response.text();
        const importResult = importTodos(text);

        if (importResult.success) {
          Alert.alert('Import Successful', `Imported ${importResult.count} tasks.`);
        } else {
          Alert.alert('Import Failed', importResult.error || 'Unknown error');
        }
      }
    } catch (error) {
      Alert.alert('Import Failed', 'Could not import tasks.');
    }
  }, [importTodos]);

  const toggleTheme = useCallback(() => {
    setTheme(isDark ? 'light' : 'dark');
  }, [isDark, setTheme]);

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
      const isItemExpired = isExpired(item.deadline);
      const shouldStrikethrough = item.completed || isItemExpired;
      const urgencyColor = getUrgencyColor(item);
      const colors = Colors[colorScheme];

      return (
        <View style={[styles.todoItem, { backgroundColor: colors.surfaceSecondary }]}>
          <TouchableOpacity
            style={[styles.checkbox, { borderColor: urgencyColor }]}
            onPress={() => handleToggleTodo(item.id)}
            activeOpacity={0.7}
          >
            {item.completed && (
              <View style={[styles.checkboxInner, { backgroundColor: urgencyColor }]}>
                <Check size={16} color="#fff" strokeWidth={3} />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.todoContent}>
            <Text
              style={[
                styles.todoTitle,
                shouldStrikethrough && styles.todoTitleCompleted,
                { color: shouldStrikethrough ? colors.textMuted : colors.text },
              ]}
            >
              {item.title}
            </Text>
            {item.deadline && (
              <View style={styles.deadlineContainer}>
                <Calendar size={12} color={urgencyColor} strokeWidth={2} />
                <Text style={[styles.deadlineText, { color: urgencyColor }]}>
                  {formatDeadline(item.deadline)}
                </Text>
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
    [handleToggleTodo, handleDeleteTodo, handleEditTodo, colorScheme]
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
    setShowDatePicker(true);
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
                styles.dateButton,
                selectedDate && { backgroundColor: colors.primary + '20' },
              ]}
              onPress={openDatePicker}
              activeOpacity={0.7}
            >
              <Calendar
                size={20}
                color={selectedDate ? colors.primary : colors.textSecondary}
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
              colors={inputText.trim() ? [colors.primary, colors.primaryDark] : [colors.borderAccent, colors.borderAccent] as any}
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

        {selectedDate && (
          <View style={[styles.selectedDateContainer, { backgroundColor: colors.primary + '20' }]}>
            <View style={styles.selectedDateContent}>
              <Clock size={16} color={colors.primary} strokeWidth={2} />
              <Text style={[styles.selectedDateText, { color: colors.primary }]}>
                {formatSelectedDateTime(selectedDate)}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setSelectedDate(null)}
              style={styles.clearSelectedDate}
              activeOpacity={0.7}
            >
              <Text style={[styles.clearSelectedDateText, { color: colors.primary }]}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}

        {Platform.OS === "ios" && (
          <Modal
            visible={showDatePicker}
            transparent
            animationType="fade"
            onRequestClose={() => {
              setShowDatePicker(false);
              setShowTimePicker(false);
            }}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => {
                setShowDatePicker(false);
                setShowTimePicker(false);
              }}
            >
              <TouchableOpacity activeOpacity={1}>
                <View style={[styles.datePickerModal, { backgroundColor: colors.surfaceSecondary }]}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Set deadline</Text>

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
                        onChange={(e, date) => {
                          if (date) {
                            setTempDate(date);
                          }
                        }}
                        textColor={colors.text}
                        style={styles.picker}
                      />
                    </View>

                    <TouchableOpacity
                      style={styles.confirmButton}
                      onPress={handleConfirmDateTime}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={[colors.primary, colors.primaryDark] as any}
                        style={styles.confirmButtonGradient}
                      >
                        <Text style={styles.confirmButtonText}>Confirm</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </ScrollView>

                  <TouchableOpacity
                    style={styles.clearDateButton}
                    onPress={() => {
                      setSelectedDate(null);
                      setShowDatePicker(false);
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
                    style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 16, marginBottom: 16 }]}
                    placeholder="Task name"
                    placeholderTextColor={colors.textMuted}
                    value={editText}
                    onChangeText={setEditText}
                    autoFocus
                  />

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
                        <Calendar size={20} color={colors.primary} strokeWidth={2} />
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
                      colors={[colors.primary, colors.primaryDark] as any}
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
  deadlineContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 6,
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
    maxHeight: "85%",
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
});
