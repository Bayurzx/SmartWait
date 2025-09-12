// apps\mobile\src\components\CheckInForm.tsx 
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import { CheckInData, ValidationError } from '../types';
import {
  webStyles,
  platformStyles,
  getSpacing,
  getFontSize,
  isWeb,
  getWebContainerStyle,
  getWebSpecificStyles
} from '../utils/responsive';

interface CheckInFormProps {
  onSubmit: (data: CheckInData) => Promise<void>;
  loading?: boolean;
}

export const CheckInForm: React.FC<CheckInFormProps> = ({ onSubmit, loading = false }) => {
  const [formData, setFormData] = useState<CheckInData>({
    name: '',
    phone: '',
    appointmentTime: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Get web-specific styles
  const webSpecificStyles = getWebSpecificStyles();

  const validateField = (field: keyof CheckInData, value: string): string | null => {
    switch (field) {
      case 'name':
        if (!value.trim()) return 'Name is required';
        if (value.trim().length < 2) return 'Name must be at least 2 characters';
        if (value.trim().length > 50) return 'Name must be less than 50 characters';
        if (!/^[a-zA-Z\s'-]+$/.test(value.trim())) return 'Name can only contain letters, spaces, hyphens, and apostrophes';
        return null;

      case 'phone':
        if (!value.trim()) return 'Phone number is required';
        // Remove all non-digit characters for validation
        const digitsOnly = value.replace(/\D/g, '');
        if (digitsOnly.length < 10) return 'Phone number must be at least 10 digits';
        if (digitsOnly.length > 15) return 'Phone number must be less than 15 digits';
        return null;

      case 'appointmentTime':
        if (!value.trim()) return 'Appointment time is required';
        // Basic time format validation (supports various formats)
        const timeRegex = /^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM|am|pm)$|^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(value.trim())) {
          return 'Please enter a valid time (e.g., 2:30 PM or 14:30)';
        }
        return null;

      default:
        return null;
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    // Validate all fields
    Object.keys(formData).forEach((field) => {
      const error = validateField(field as keyof CheckInData, formData[field as keyof CheckInData]);
      if (error) {
        newErrors[field] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleFieldChange = (field: keyof CheckInData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleFieldBlur = (field: keyof CheckInData) => {
    setTouched(prev => ({ ...prev, [field]: true }));

    // Validate field on blur
    const error = validateField(field, formData[field]);
    if (error) {
      setErrors(prev => ({ ...prev, [field]: error }));
    }
  };

  const formatPhoneNumber = (value: string): string => {
    // Remove all non-digit characters
    const digitsOnly = value.replace(/\D/g, '');

    // Format as (XXX) XXX-XXXX
    if (digitsOnly.length <= 3) {
      return digitsOnly;
    } else if (digitsOnly.length <= 6) {
      return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3)}`;
    } else {
      return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6, 10)}`;
    }
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value);
    handleFieldChange('phone', formatted);
  };

  const handleSubmit = async () => {
    // Mark all fields as touched
    setTouched({
      name: true,
      phone: true,
      appointmentTime: true,
    });

    if (!validateForm()) {
      Alert.alert(
        'Validation Error',
        'Please correct the errors in the form before submitting.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Check-in error:', error);
      Alert.alert(
        'Check-in Failed',
        'Unable to check in at this time. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const isFieldInvalid = (field: keyof CheckInData): boolean => {
    return touched[field] && !!errors[field];
  };

  return (
    <KeyboardAvoidingView
      style={[
        styles.container,
        webSpecificStyles.container as ViewStyle
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={[
          styles.content,
          getWebContainerStyle()
        ]}>
          <Text style={[
            styles.title,
            webSpecificStyles.text as ViewStyle
          ]}>Check In</Text>
          <Text style={[
            styles.subtitle,
            webSpecificStyles.text as ViewStyle
          ]}>
            Enter your information to join the virtual queue
          </Text>

          {/* Name Field */}
          <View style={styles.fieldContainer}>
            <Text style={[
              styles.label,
              webSpecificStyles.text as ViewStyle
            ]}>Full Name *</Text>
            <TextInput
              style={[
                styles.input,
                webSpecificStyles.input as ViewStyle,
                webSpecificStyles.inputBox as ViewStyle,
                isFieldInvalid('name') && styles.inputError
              ]}
              placeholder="Enter your full name"
              value={formData.name}
              onChangeText={(value) => handleFieldChange('name', value)}
              onBlur={() => handleFieldBlur('name')}
              autoCapitalize="words"
              autoCorrect={false}
              editable={!loading}
            />
            {isFieldInvalid('name') && (
              <Text style={styles.errorText}>{errors.name}</Text>
            )}
          </View>

          {/* Phone Field */}
          <View style={styles.fieldContainer}>
            <Text style={[
              styles.label,
              webSpecificStyles.text as ViewStyle
            ]}>Phone Number *</Text>
            <TextInput
              style={[
                styles.input,
                webSpecificStyles.input as ViewStyle,
                webSpecificStyles.inputBox as ViewStyle,
                isFieldInvalid('phone') && styles.inputError
              ]}
              placeholder="(555) 123-4567"
              value={formData.phone}
              onChangeText={handlePhoneChange}
              onBlur={() => handleFieldBlur('phone')}
              keyboardType="phone-pad"
              autoCorrect={false}
              editable={!loading}
            />
            {isFieldInvalid('phone') && (
              <Text style={styles.errorText}>{errors.phone}</Text>
            )}
          </View>

          {/* Appointment Time Field */}
          <View style={styles.fieldContainer}>
            <Text style={[
              styles.label,
              webSpecificStyles.text as ViewStyle
            ]}>Appointment Time *</Text>
            <TextInput
              style={[
                styles.input,
                webSpecificStyles.input as ViewStyle,
                webSpecificStyles.inputBox as ViewStyle,
                isFieldInvalid('appointmentTime') && styles.inputError
              ]}
              placeholder="2:30 PM or 14:30"
              value={formData.appointmentTime}
              onChangeText={(value) => handleFieldChange('appointmentTime', value)}
              onBlur={() => handleFieldBlur('appointmentTime')}
              autoCorrect={false}
              editable={!loading}
            />
            {isFieldInvalid('appointmentTime') && (
              <Text style={styles.errorText}>{errors.appointmentTime}</Text>
            )}
            <Text style={styles.helpText}>
              Enter your scheduled appointment time
            </Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              webSpecificStyles.button as ViewStyle,
              webSpecificStyles.submitButton as ViewStyle,
              loading && styles.submitButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Check In"
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="white" size="small" />
                <Text style={styles.submitButtonText}>Checking In...</Text>
              </View>
            ) : (
              <Text style={styles.submitButtonText}>Check In</Text>
            )}
          </TouchableOpacity>

          {/* Help Text */}
          <View style={styles.helpContainer}>
            <Text style={[
              styles.helpTitle,
              webSpecificStyles.text as ViewStyle
            ]}>What happens next?</Text>
            <Text style={[
              styles.helpDescription,
              webSpecificStyles.text as ViewStyle
            ]}>
              • You'll receive your queue position and estimated wait time
            </Text>
            <Text style={[
              styles.helpDescription,
              webSpecificStyles.text as ViewStyle
            ]}>
              • We'll send you updates as your turn approaches
            </Text>
            <Text style={[
              styles.helpDescription,
              webSpecificStyles.text as ViewStyle
            ]}>
              • You can wait anywhere and return when it's your turn
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: getSpacing('lg'),
    paddingBottom: getSpacing('xl'),
  },
  title: {
    fontSize: getFontSize('xxxl'),
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: getSpacing('sm'),
  },
  subtitle: {
    fontSize: getFontSize('md'),
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: getSpacing('xl'),
  },
  fieldContainer: {
    marginBottom: getSpacing('lg'),
  },
  label: {
    fontSize: getFontSize('md'),
    fontWeight: '600',
    color: '#374151',
    marginBottom: getSpacing('sm'),
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: getSpacing('md'),
    fontSize: getFontSize('md'),
    color: '#1F2937',
    minHeight: 50,
    textAlignVertical: 'center',
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginTop: 4,
  },
  helpText: {
    color: '#6B7280',
    fontSize: 14,
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    padding: getSpacing('md'),
    alignItems: 'center',
    marginTop: getSpacing('md'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 48,
  },
  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  submitButtonText: {
    color: 'white',
    fontSize: getFontSize('lg'),
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  helpContainer: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 8,
  },
  helpDescription: {
    fontSize: 14,
    color: '#1E40AF',
    marginBottom: 4,
  },
});

export default CheckInForm;