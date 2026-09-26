import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  Modal,
  ScrollView,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import { Bell, Clock, Repeat, Calendar, X } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/colors';
import { NotificationSettings as NotificationSettingsType, RepeatFrequency, REPEAT_FREQUENCY_LABELS } from '@/types/todo';

interface NotificationSettingsProps {
  visible: boolean;
  onClose: () => void;
  onSave: (settings: NotificationSettingsType) => void;
  initialSettings?: NotificationSettingsType;
  todoTitle: string;
  todoDeadline?: string | null;
}

export function NotificationSettings({
  visible,
  onClose,
  onSave,
  initialSettings,
  todoTitle,
  todoDeadline
}: NotificationSettingsProps) {
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme];


  // Update state when initialSettings changes
  useEffect(() => {
    if (initialSettings?.early?.enabled !== undefined) {
      setEarlyEnabled(initialSettings.early.enabled);
    }
    if (initialSettings?.repeat?.enabled !== undefined) {
      setRepeatEnabled(initialSettings.repeat.enabled);
    }
    if (initialSettings?.repeat?.frequency) {
      setRepeatFrequency(initialSettings.repeat.frequency);
    }

    // Update early date time if provided
    if (initialSettings?.early?.dateTime) {
      const existingDate = new Date(initialSettings.early.dateTime);
      if (!isNaN(existingDate.getTime())) {
        const now = new Date();
        if (existingDate <= now) {
          setEarlyDateTime(new Date(now.getTime() + 60 * 60 * 1000)); // 1 hour from now
        } else {
          setEarlyDateTime(existingDate);
        }
      }
    }

    // Update repeat time if provided
    if (initialSettings?.repeat?.customTime) {
      const timeParts = initialSettings.repeat.customTime.split(':');
      if (timeParts.length >= 2) {
        const hour = parseInt(timeParts[0], 10);
        const minute = parseInt(timeParts[1], 10);
        if (!isNaN(hour) && !isNaN(minute) && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
          const time = new Date();
          time.setHours(hour, minute, 0, 0);
          setRepeatTime(time);
        }
      }
    }

    // Update repeat end date if provided
    if (initialSettings?.repeat?.endDate) {
      const endDate = new Date(initialSettings.repeat.endDate);
      if (!isNaN(endDate.getTime()) && endDate > new Date()) {
        setRepeatEndDate(endDate);
      }
    }
  }, [initialSettings]);

  // Early notification state
  const [earlyEnabled, setEarlyEnabled] = useState(initialSettings?.early?.enabled || false);
  const [earlyDateTime, setEarlyDateTime] = useState<Date>(() => {
    try {
      // First try to use existing settings
      if (initialSettings?.early?.dateTime) {
        const existingDate = new Date(initialSettings.early.dateTime);
        if (!isNaN(existingDate.getTime())) {
          // If existing date is in the past, adjust it to be 1 hour from now to avoid validation errors
          const now = new Date();
          if (existingDate <= now) {
            console.warn('Existing early notification time is in the past, adjusting to 1 hour from now');
            return new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
          }
          return existingDate;
        }
        console.warn('Initial early dateTime is invalid, using default');
      }

      // Create safe default date
      const now = new Date();
      let defaultDate = new Date(now);

      if (todoDeadline && typeof todoDeadline === 'string') {
        try {
          const deadlineDate = new Date(todoDeadline);
          if (!isNaN(deadlineDate.getTime()) && deadlineDate > now) {
            // Valid future deadline - set early reminder 1 day before
            defaultDate = new Date(deadlineDate);
            defaultDate.setDate(defaultDate.getDate() - 1);

            // Ensure early date is still in the future
            if (defaultDate <= now) {
              // If 1 day before is in the past, set to 1 hour from now
              defaultDate = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
            }
          } else {
            // Invalid or past deadline - default to 1 hour from now to avoid instant notifications
            defaultDate = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
          }
        } catch {
          console.warn('Error parsing todoDeadline, using default time');
          // Default to 1 hour from now to avoid instant notifications
          defaultDate = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
        }
      } else {
        // No deadline - default to 1 hour from now to avoid instant notifications
        defaultDate = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
      }

      // Final validation
      if (isNaN(defaultDate.getTime())) {
        console.error('Generated invalid default date, falling back to 1 hour from now');
        const fallback = new Date();
        fallback.setHours(fallback.getHours() + 1);
        return fallback;
      }

      return defaultDate;
    } catch (error) {
      console.error('Error in earlyDateTime initialization:', error);
      const fallback = new Date();
      fallback.setHours(fallback.getHours() + 1);
      return fallback;
    }
  });

  // Repeat notification state
  const [repeatEnabled, setRepeatEnabled] = useState(initialSettings?.repeat?.enabled || false);
  const [repeatFrequency, setRepeatFrequency] = useState<RepeatFrequency>(
    initialSettings?.repeat?.frequency || 'daily'
  );
  const [repeatTime, setRepeatTime] = useState<Date>(() => {
    try {
      const time = new Date();

      if (initialSettings?.repeat?.customTime && typeof initialSettings.repeat.customTime === 'string') {
        try {
          const timeParts = initialSettings.repeat.customTime.split(':');
          if (timeParts.length >= 2) {
            const hour = parseInt(timeParts[0], 10);
            const minute = parseInt(timeParts[1], 10);

            // Validate parsed values
            if (!isNaN(hour) && !isNaN(minute) && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
              time.setHours(hour, minute, 0, 0);

              // Final validation
              if (!isNaN(time.getTime())) {
                return time;
              }
            }
          }
          console.warn('Invalid customTime format, using default 9:00 AM');
        } catch {
          console.warn('Error parsing customTime, using default 9:00 AM');
        }
      }

      // Default to 9 AM
      time.setHours(9, 0, 0, 0);

      // Validate default time
      if (isNaN(time.getTime())) {
        console.error('Failed to create valid default time');
        const fallback = new Date();
        fallback.setHours(9, 0, 0, 0);
        return fallback;
      }

      return time;
    } catch (error) {
      console.error('Error in repeatTime initialization:', error);
      const fallback = new Date();
      fallback.setHours(9, 0, 0, 0);
      return fallback;
    }
  });
  const [repeatEndDate, setRepeatEndDate] = useState<Date | null>(() => {
    try {
      if (initialSettings?.repeat?.endDate && typeof initialSettings.repeat.endDate === 'string') {
        try {
          const endDate = new Date(initialSettings.repeat.endDate);
          if (!isNaN(endDate.getTime())) {
            // Validate it's in the future
            if (endDate > new Date()) {
              return endDate;
            }
            console.warn('Initial endDate is in the past, using default');
          } else {
            console.warn('Initial endDate is invalid, using default');
          }
        } catch {
          console.warn('Error parsing initial endDate, using default');
        }
      }

      // Default to 1 year from now
      const defaultEndDate = new Date();
      defaultEndDate.setFullYear(defaultEndDate.getFullYear() + 1);

      // Validate default date
      if (isNaN(defaultEndDate.getTime())) {
        console.error('Failed to create valid default end date');
        const fallback = new Date();
        fallback.setFullYear(fallback.getFullYear() + 1);
        return fallback;
      }

      return defaultEndDate;
    } catch (error) {
      console.error('Error in repeatEndDate initialization:', error);
      const fallback = new Date();
      fallback.setFullYear(fallback.getFullYear() + 1);
      return fallback;
    }
  });

  // UI state
  const [showEarlyDatePicker, setShowEarlyDatePicker] = useState(false);
  const [showEarlyTimePicker, setShowEarlyTimePicker] = useState(false);
  const [showRepeatTimePicker, setShowRepeatTimePicker] = useState(false);
  const [showRepeatEndDatePicker, setShowRepeatEndDatePicker] = useState(false);
  const [showFrequencyPicker, setShowFrequencyPicker] = useState(false);

  const isValidTimeFormat = (timeString: string): boolean => {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(timeString);
  };

  const handleSave = () => {
    try {
      const settings: NotificationSettingsType = {};
      const errors: string[] = [];
      const now = new Date();
      const maxFutureLimit = new Date();
      maxFutureLimit.setFullYear(maxFutureLimit.getFullYear() + 10);

      console.log('Validating notification settings...');
      console.log('Early enabled:', earlyEnabled);
      console.log('Repeat enabled:', repeatEnabled);
      console.log('Todo deadline:', todoDeadline);

      // CRITICAL: Validate early notification
      if (earlyEnabled) {
        console.log('Validating early notification...', earlyDateTime);

        if (!earlyDateTime) {
          errors.push('Early reminder date and time must be selected');
        } else if (!(earlyDateTime instanceof Date) || isNaN(earlyDateTime.getTime())) {
          errors.push('Early reminder date is invalid or corrupted');
        } else {
          // Validate time is at least 5 minutes in the future
          const minFutureTime = new Date(now.getTime() + 300 * 1000);
          if (earlyDateTime <= minFutureTime) {
            errors.push('Early reminder must be scheduled for at least 5 minutes in the future');
          } else if (earlyDateTime > maxFutureLimit) {
            errors.push('Early reminder cannot be more than 10 years in the future');
          } else {
            // Validate against deadline if it exists and is valid
            if (todoDeadline) {
              try {
                const deadline = new Date(todoDeadline);
                if (!isNaN(deadline.getTime())) {
                  if (earlyDateTime >= deadline) {
                    errors.push('Early reminder must be scheduled before the task deadline');
                  }
                } else {
                  console.warn('Todo deadline is invalid, but allowing early notification');
                }
              } catch (deadlineError) {
                console.warn('Error parsing todo deadline:', deadlineError);
                // Allow early notification even if deadline parsing fails
              }
            }

            // If no errors for early notification, add it to settings
            if (errors.length === 0) {
              settings.early = {
                enabled: true,
                dateTime: earlyDateTime.toISOString(),
              };
              console.log('Early notification validated successfully');
            }
          }
        }
      }

      // CRITICAL: Validate repeat notification
      if (repeatEnabled) {
        console.log('Validating repeat notification...');
        console.log('Repeat frequency:', repeatFrequency);
        console.log('Repeat time:', repeatTime);
        console.log('Repeat end date:', repeatEndDate);

        // Validate frequency is set
        if (!repeatFrequency) {
          errors.push('Please select a repeat frequency');
        } else {
          // Validate repeat time
          if (!repeatTime || !(repeatTime instanceof Date) || isNaN(repeatTime.getTime())) {
            errors.push('Repeat reminder time is invalid');
          } else {
            // Generate time string safely
            let timeString: string;
            try {
              const hours = repeatTime.getHours();
              const minutes = repeatTime.getMinutes();

              if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
                errors.push('Repeat time values are out of valid range');
              } else {
                timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

                // Double-check the generated time string format
                if (!isValidTimeFormat(timeString)) {
                  errors.push('Generated time format is invalid');
                } else {
                  // Validate end date if provided
                  let validEndDate: string | undefined = undefined;

                  if (repeatEndDate) {
                    if (!(repeatEndDate instanceof Date) || isNaN(repeatEndDate.getTime())) {
                      errors.push('Repeat end date is invalid');
                    } else if (repeatEndDate <= now) {
                      errors.push('Repeat end date must be in the future');
                    } else if (repeatEndDate > maxFutureLimit) {
                      errors.push('Repeat end date cannot be more than 10 years in the future');
                    } else {
                      validEndDate = repeatEndDate.toISOString();
                    }
                  }

                  // If no errors for repeat notification, add it to settings
                  if (errors.length === 0) {
                    settings.repeat = {
                      enabled: true,
                      frequency: repeatFrequency,
                      customTime: timeString,
                      ...(validEndDate && { endDate: validEndDate })
                    };
                    console.log('Repeat notification validated successfully');
                  }
                }
              }
            } catch (timeError) {
              console.error('Error processing repeat time:', timeError);
              errors.push('Failed to process repeat reminder time');
            }
          }
        }
      }

      // CRITICAL: Validate that at least one notification type is enabled
      if (!earlyEnabled && !repeatEnabled) {
        Alert.alert(
          'No Notifications Selected',
          'Please enable either Early Reminder or Repeating Reminder to save notification settings.\n\nAlternatively, cancel to exit without saving.'
        );
        return;
      }

      // Show validation errors if any
      if (errors.length > 0) {
        console.error('Validation errors:', errors);
        Alert.alert(
          'Invalid Notification Settings',
          errors.join('\n\n') + '\n\nPlease correct these issues and try again.'
        );
        return;
      }

      // Final safety check: ensure we have valid settings to save
      if (!settings.early && !settings.repeat) {
        console.error('No valid notification settings generated');
        Alert.alert(
          'Configuration Error',
          'No valid notification settings were generated. Please review your settings and try again.'
        );
        return;
      }

      onSave(settings);
      onClose();

    } catch (error) {
      console.error('CRITICAL ERROR in NotificationSettings handleSave:', error);
      Alert.alert(
        'System Error',
        `An unexpected error occurred while saving notification settings:\n\n${error instanceof Error ? error.message : String(error)}\n\nPlease try again or contact support if the problem persists.`
      );
    }
  };


  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.surfaceSecondary }]}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Bell size={24} color="#E2BA6F" strokeWidth={2} />
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                Notifications
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

            {/* Early Notification */}
            <View style={[styles.section, { borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <Clock size={20} color="#E2BA6F" strokeWidth={2} />
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Early Reminder
                  </Text>
                </View>
                <Switch
                  value={earlyEnabled}
                  onValueChange={setEarlyEnabled}
                  trackColor={{ false: colors.border, true: '#E2BA6F40' }}
                  thumbColor={earlyEnabled ? '#E2BA6F' : colors.textMuted}
                />
              </View>

              {earlyEnabled && (
                <View style={styles.sectionContent}>
                  <Text style={[styles.description, { color: colors.textSecondary }]}>
                    Get notified before your deadline
                  </Text>

                  <TouchableOpacity
                    style={[styles.dateTimeButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => {
                      try {
                        if (!earlyDateTime || isNaN(earlyDateTime.getTime())) {
                          console.warn('Invalid earlyDateTime when opening picker, using default');
                          const defaultDate = new Date();
                          defaultDate.setHours(defaultDate.getHours() + 1);
                          setEarlyDateTime(defaultDate);
                        }
                        setShowEarlyDatePicker(true);
                      } catch (error) {
                        console.error('Error opening early date picker:', error);
                        Alert.alert('Error', 'Unable to open date picker. Please try again.');
                      }
                    }}
                  >
                    <Calendar size={16} color="#E2BA6F" strokeWidth={2} />
                    <Text style={[styles.dateTimeText, { color: colors.text }]}>
                      {earlyDateTime.toLocaleDateString()}
                    </Text>
                  </TouchableOpacity>

                  {/* Time Picker Button */}
                  <TouchableOpacity
                    style={[styles.dateTimeButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => {
                      try {
                        if (!earlyDateTime || isNaN(earlyDateTime.getTime())) {
                          console.warn('Invalid earlyDateTime when opening time picker, using default');
                          const defaultDate = new Date();
                          defaultDate.setHours(defaultDate.getHours() + 1);
                          setEarlyDateTime(defaultDate);
                        }
                        setShowEarlyTimePicker(true);
                      } catch (error) {
                        console.error('Error opening early time picker:', error);
                        Alert.alert('Error', 'Unable to open time picker. Please try again.');
                      }
                    }}
                  >
                    <Clock size={16} color="#E2BA6F" strokeWidth={2} />
                    <Text style={[styles.dateTimeText, { color: colors.text }]}>
                      {earlyDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Repeat Notification */}
            <View style={[styles.section, { borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <Repeat size={20} color="#E2BA6F" strokeWidth={2} />
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Repeating Reminder
                  </Text>
                </View>
                <Switch
                  value={repeatEnabled}
                  onValueChange={setRepeatEnabled}
                  trackColor={{ false: colors.border, true: '#E2BA6F40' }}
                  thumbColor={repeatEnabled ? '#E2BA6F' : colors.textMuted}
                />
              </View>

              {repeatEnabled && (
                <View style={styles.sectionContent}>
                  <Text style={[styles.description, { color: colors.textSecondary }]}>
                    {todoDeadline
                      ? "Get reminders at intervals based on your deadline time"
                      : "Get regular reminders starting from now"
                    }
                  </Text>

                  {/* Frequency Picker */}
                  <TouchableOpacity
                    style={[styles.pickerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => setShowFrequencyPicker(true)}
                  >
                    <Text style={[styles.pickerButtonText, { color: colors.text }]}>
                      {REPEAT_FREQUENCY_LABELS[repeatFrequency]}
                    </Text>
                    <Text style={[styles.pickerButtonArrow, { color: colors.textMuted }]}>›</Text>
                  </TouchableOpacity>

                  {/* Frequency Display */}
                  <View style={[styles.infoDisplay, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Repeat size={16} color="#E2BA6F" strokeWidth={2} />
                    <Text style={[styles.infoText, { color: colors.text }]}>
                      {todoDeadline
                        ? `${REPEAT_FREQUENCY_LABELS[repeatFrequency]} until deadline`
                        : `${REPEAT_FREQUENCY_LABELS[repeatFrequency]} starting now`
                      }
                    </Text>
                  </View>

                  {/* End Date */}
                  <TouchableOpacity
                    style={[styles.dateTimeButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => {
                      try {
                        if (repeatEndDate && isNaN(repeatEndDate.getTime())) {
                          console.warn('Invalid repeatEndDate when opening picker, using default');
                          const defaultEndDate = new Date();
                          defaultEndDate.setFullYear(defaultEndDate.getFullYear() + 1);
                          setRepeatEndDate(defaultEndDate);
                        }
                        setShowRepeatEndDatePicker(true);
                      } catch (error) {
                        console.error('Error opening repeat end date picker:', error);
                        Alert.alert('Error', 'Unable to open date picker. Please try again.');
                      }
                    }}
                  >
                    <Calendar size={16} color="#E2BA6F" strokeWidth={2} />
                    <Text style={[styles.dateTimeText, { color: colors.text }]}>
                      Until {repeatEndDate?.toLocaleDateString() || 'No end date'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Save Button */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <LinearGradient
                colors={['#E2BA6F', '#D4A853'] as any}
                style={styles.saveButtonGradient}
              >
                <Text style={styles.saveButtonText}>Save Notifications</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Date/Time Pickers */}
          {Platform.OS === 'ios' && showEarlyDatePicker && (
            <Modal transparent animationType="fade">
              <View style={styles.pickerOverlay}>
                <View style={[styles.pickerModal, { backgroundColor: colors.surfaceSecondary }]}>
                  <DateTimePicker
                    value={earlyDateTime}
                    mode="date"
                    display="spinner"
                    onChange={(_, date) => {
                      try {
                        setShowEarlyDatePicker(false);
                        if (date && !isNaN(date.getTime())) {
                          // CRITICAL FIX: Properly preserve the selected time, only update date
                          setEarlyDateTime(current => {
                            const combined = new Date(current);
                            combined.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());

                            // Ensure the result is at least 5 minutes in the future
                            const now = new Date();
                            const minFuture = new Date(now.getTime() + 300 * 1000);
                            if (combined <= minFuture) {
                              console.warn('Selected date/time is too soon, adjusting to 1 hour from now');
                              return new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
                            }

                            return combined;
                          });
                        } else {
                          console.warn('DateTimePicker returned invalid date for early reminder');
                        }
                      } catch (error) {
                        console.error('Error handling early date picker change:', error);
                        setShowEarlyDatePicker(false);
                      }
                    }}
                    textColor={colors.text}
                    minimumDate={new Date()}
                  />
                </View>
              </View>
            </Modal>
          )}

          {Platform.OS === 'ios' && showEarlyTimePicker && (
            <Modal transparent animationType="fade">
              <View style={styles.pickerOverlay}>
                <View style={[styles.pickerModal, { backgroundColor: colors.surfaceSecondary }]}>
                  <DateTimePicker
                    value={earlyDateTime}
                    mode="time"
                    display="spinner"
                    onChange={(_, date) => {
                      try {
                        setShowEarlyTimePicker(false);
                        if (date && !isNaN(date.getTime())) {
                          // CRITICAL FIX: Properly preserve the selected date, only update time
                          setEarlyDateTime(current => {
                            const combined = new Date(current);
                            combined.setHours(date.getHours(), date.getMinutes(), 0, 0);

                            // Ensure the result is at least 5 minutes in the future
                            const now = new Date();
                            const minFuture = new Date(now.getTime() + 300 * 1000);
                            if (combined <= minFuture) {
                              console.warn('Combined date/time is too soon, adjusting to 1 hour from now');
                              return new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
                            }

                            return combined;
                          });
                        } else {
                          console.warn('DateTimePicker returned invalid time for early reminder');
                        }
                      } catch (error) {
                        console.error('Error handling early time picker change:', error);
                        setShowEarlyTimePicker(false);
                      }
                    }}
                    textColor={colors.text}
                  />
                </View>
              </View>
            </Modal>
          )}

          {Platform.OS === 'ios' && showRepeatTimePicker && (
            <Modal transparent animationType="fade">
              <View style={styles.pickerOverlay}>
                <View style={[styles.pickerModal, { backgroundColor: colors.surfaceSecondary }]}>
                  <DateTimePicker
                    value={repeatTime}
                    mode="time"
                    display="spinner"
                    onChange={(_, date) => {
                      try {
                        setShowRepeatTimePicker(false);
                        if (date && !isNaN(date.getTime())) {
                          setRepeatTime(date);
                        } else {
                          console.warn('DateTimePicker returned invalid date for repeat time');
                        }
                      } catch (error) {
                        console.error('Error handling repeat time picker change:', error);
                        setShowRepeatTimePicker(false);
                      }
                    }}
                    textColor={colors.text}
                  />
                </View>
              </View>
            </Modal>
          )}

          {/* Frequency Picker */}
          {showFrequencyPicker && (
            <Modal transparent animationType="slide">
              <View style={styles.pickerOverlay}>
                <View style={[styles.frequencyPickerModal, { backgroundColor: colors.surfaceSecondary }]}>
                  <View style={styles.pickerHeader}>
                    <Text style={[styles.pickerTitle, { color: colors.text }]}>Select Frequency</Text>
                    <TouchableOpacity onPress={() => setShowFrequencyPicker(false)}>
                      <X size={24} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <ScrollView>
                    {(Object.keys(REPEAT_FREQUENCY_LABELS) as RepeatFrequency[]).map((frequency) => (
                      <TouchableOpacity
                        key={frequency}
                        style={[
                          styles.frequencyOption,
                          { backgroundColor: frequency === repeatFrequency ? colors.surface : 'transparent' }
                        ]}
                        onPress={() => {
                          setRepeatFrequency(frequency);
                          setShowFrequencyPicker(false);
                        }}
                      >
                        <Text style={[styles.frequencyOptionText, { color: colors.text }]}>
                          {REPEAT_FREQUENCY_LABELS[frequency]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </Modal>
          )}
        </View>
      </View>

      {/* Android Date Pickers */}
      {Platform.OS === 'android' && showEarlyDatePicker && (
        <DateTimePicker
          value={earlyDateTime}
          mode="date"
          display="calendar"
          onChange={(_, date) => {
            try {
              setShowEarlyDatePicker(false);
              if (date && !isNaN(date.getTime())) {
                // CRITICAL FIX: Properly preserve the selected time, only update date
                setEarlyDateTime(current => {
                  const combined = new Date(current);
                  combined.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());

                  // Ensure the result is still in the future
                  const now = new Date();
                  if (combined <= now) {
                    console.warn('Android: Selected date/time is in the past, adjusting to 1 hour from now');
                    return new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
                  }

                  return combined;
                });
              } else {
                console.warn('Android DateTimePicker returned invalid date for early reminder');
              }
            } catch (error) {
              console.error('Error handling Android early date picker change:', error);
              setShowEarlyDatePicker(false);
            }
          }}
          minimumDate={new Date()}
        />
      )}

      {Platform.OS === 'android' && showEarlyTimePicker && (
        <DateTimePicker
          value={earlyDateTime}
          mode="time"
          is24Hour={false}
          display="default"
          onChange={(_, date) => {
            try {
              setShowEarlyTimePicker(false);
              if (date && !isNaN(date.getTime())) {
                // CRITICAL FIX: Properly preserve the selected date, only update time
                setEarlyDateTime(current => {
                  const combined = new Date(current);
                  combined.setHours(date.getHours(), date.getMinutes(), 0, 0);

                  // Ensure the result is still in the future
                  const now = new Date();
                  if (combined <= now) {
                    console.warn('Android: Combined date/time is in the past, adjusting to 1 hour from now');
                    return new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
                  }

                  return combined;
                });
              } else {
                console.warn('Android DateTimePicker returned invalid time for early reminder');
              }
            } catch (error) {
              console.error('Error handling Android early time picker change:', error);
              setShowEarlyTimePicker(false);
            }
          }}
        />
      )}

      {Platform.OS === 'android' && showRepeatTimePicker && (
        <DateTimePicker
          value={repeatTime}
          mode="time"
          onChange={(_, date) => {
            try {
              setShowRepeatTimePicker(false);
              if (date && !isNaN(date.getTime())) {
                setRepeatTime(date);
              } else {
                console.warn('Android DateTimePicker returned invalid date for repeat time');
              }
            } catch (error) {
              console.error('Error handling Android repeat time picker change:', error);
              setShowRepeatTimePicker(false);
            }
          }}
        />
      )}

      {Platform.OS === 'android' && showRepeatEndDatePicker && (
        <DateTimePicker
          value={repeatEndDate || new Date()}
          mode="date"
          onChange={(_, date) => {
            try {
              setShowRepeatEndDatePicker(false);
              if (date && !isNaN(date.getTime())) {
                setRepeatEndDate(date);
              } else {
                console.warn('Android DateTimePicker returned invalid date for repeat end date');
              }
            } catch (error) {
              console.error('Error handling Android repeat end date picker change:', error);
              setShowRepeatEndDatePicker(false);
            }
          }}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    minHeight: '60%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
    borderBottomWidth: 1,
    paddingBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  sectionContent: {
    gap: 12,
  },
  description: {
    fontSize: 14,
    marginBottom: 8,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  dateTimeText: {
    fontSize: 16,
    fontWeight: '500',
  },
  infoDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  infoText: {
    fontSize: 16,
    fontWeight: '500',
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  pickerButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  pickerButtonArrow: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  saveButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    margin: 20,
    minWidth: 300,
  },
  frequencyPickerModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    margin: 20,
    maxHeight: '70%',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  frequencyOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  frequencyOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
});