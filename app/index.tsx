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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus, Calendar, Trash2, Check, Clock } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTodos, useSortedTodos, isExpired } from "@/contexts/TodoContext";
import { Todo } from "@/types/todo";

export default function TodoListScreen() {
  const { addTodo, toggleTodo, deleteTodo } = useTodos();
  const sortedTodos = useSortedTodos();

  const [inputText, setInputText] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [tempDate, setTempDate] = useState<Date>(new Date());

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
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffMs < 0) return "Overdue";
    if (diffHours < 1) return "Due soon";
    if (diffHours < 24) return `${diffHours}h left`;
    if (diffDays === 1) return "Tomorrow";
    if (diffDays < 7) return `${diffDays}d left`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
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

  const renderTodoItem = useCallback(
    ({ item }: { item: Todo }) => {
      const isItemExpired = isExpired(item.deadline);
      const shouldStrikethrough = item.completed || isItemExpired;
      const urgencyColor = getUrgencyColor(item);

      return (
        <View style={styles.todoItem}>
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
                { color: shouldStrikethrough ? "#94a3b8" : "#1e293b" },
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
            onPress={() => handleDeleteTodo(item.id)}
            style={styles.deleteButton}
            activeOpacity={0.7}
          >
            <Trash2 size={20} color="#94a3b8" strokeWidth={2} />
          </TouchableOpacity>
        </View>
      );
    },
    [handleToggleTodo, handleDeleteTodo]
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Check size={64} color="#cbd5e1" strokeWidth={1.5} />
      </View>
      <Text style={styles.emptyTitle}>No todos yet</Text>
      <Text style={styles.emptySubtitle}>Add your first task to get started</Text>
    </View>
  );

  const openDatePicker = () => {
    setTempDate(selectedDate || new Date());
    setShowDatePicker(true);
  };

  return (
    <LinearGradient colors={["#f8fafc", "#e0f2fe"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Buddy</Text>
          <Text style={styles.headerSubtitle}>
            {sortedTodos.length} {sortedTodos.length === 1 ? "task" : "tasks"}
          </Text>
        </View>

        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Add a new task..."
              placeholderTextColor="#94a3b8"
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleAddTodo}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[
                styles.dateButton,
                selectedDate && styles.dateButtonActive,
              ]}
              onPress={openDatePicker}
              activeOpacity={0.7}
            >
              <Calendar
                size={20}
                color={selectedDate ? "#0ea5e9" : "#64748b"}
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
              colors={inputText.trim() ? ["#0ea5e9", "#0284c7"] : ["#cbd5e1", "#cbd5e1"]}
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
          <View style={styles.selectedDateContainer}>
            <View style={styles.selectedDateContent}>
              <Clock size={16} color="#0ea5e9" strokeWidth={2} />
              <Text style={styles.selectedDateText}>
                {formatSelectedDateTime(selectedDate)}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setSelectedDate(null)}
              style={styles.clearSelectedDate}
              activeOpacity={0.7}
            >
              <Text style={styles.clearSelectedDateText}>Clear</Text>
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
                <View style={styles.datePickerModal}>
                  <Text style={styles.modalTitle}>Set deadline</Text>

                  <ScrollView style={styles.pickerScrollContainer}>
                    <View style={styles.dateTimePickerContainer}>
                      <DateTimePicker
                        value={tempDate}
                        mode="date"
                        display="spinner"
                        onChange={handleDateChange}
                        minimumDate={new Date()}
                        textColor="#1e293b"
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
                        textColor="#1e293b"
                        style={styles.picker}
                      />
                    </View>

                    <TouchableOpacity
                      style={styles.confirmButton}
                      onPress={handleConfirmDateTime}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={["#0ea5e9", "#0284c7"]}
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
                    <Text style={styles.clearDateText}>Clear deadline</Text>
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
});
