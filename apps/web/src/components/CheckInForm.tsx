'use client';

import React, { useState } from 'react';
import { CheckInData, FormErrors } from '../types';

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

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

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
    const newErrors: FormErrors = {};
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mark all fields as touched
    setTouched({
      name: true,
      phone: true,
      appointmentTime: true,
    });

    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Check-in error:', error);
    }
  };

  const isFieldInvalid = (field: keyof CheckInData): boolean => {
    return touched[field] && !!errors[field];
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Check In</h1>
        <p className="text-gray-600">
          Enter your information to join the virtual queue
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name Field */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Full Name *
          </label>
          <input
            id="name"
            type="text"
            placeholder="Enter your full name"
            value={formData.name}
            onChange={(e) => handleFieldChange('name', e.target.value)}
            onBlur={() => handleFieldBlur('name')}
            disabled={loading}
            className={`input w-full ${
              isFieldInvalid('name') 
                ? 'border-red-500 bg-red-50 focus-visible:ring-red-500' 
                : ''
            }`}
            autoComplete="name"
          />
          {isFieldInvalid('name') && (
            <p className="text-red-500 text-sm mt-1">{errors.name}</p>
          )}
        </div>

        {/* Phone Field */}
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
            Phone Number *
          </label>
          <input
            id="phone"
            type="tel"
            placeholder="(555) 123-4567"
            value={formData.phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            onBlur={() => handleFieldBlur('phone')}
            disabled={loading}
            className={`input w-full ${
              isFieldInvalid('phone') 
                ? 'border-red-500 bg-red-50 focus-visible:ring-red-500' 
                : ''
            }`}
            autoComplete="tel"
          />
          {isFieldInvalid('phone') && (
            <p className="text-red-500 text-sm mt-1">{errors.phone}</p>
          )}
        </div>

        {/* Appointment Time Field */}
        <div>
          <label htmlFor="appointmentTime" className="block text-sm font-medium text-gray-700 mb-2">
            Appointment Time *
          </label>
          <input
            id="appointmentTime"
            type="text"
            placeholder="2:30 PM or 14:30"
            value={formData.appointmentTime}
            onChange={(e) => handleFieldChange('appointmentTime', e.target.value)}
            onBlur={() => handleFieldBlur('appointmentTime')}
            disabled={loading}
            className={`input w-full ${
              isFieldInvalid('appointmentTime') 
                ? 'border-red-500 bg-red-50 focus-visible:ring-red-500' 
                : ''
            }`}
          />
          {isFieldInvalid('appointmentTime') && (
            <p className="text-red-500 text-sm mt-1">{errors.appointmentTime}</p>
          )}
          <p className="text-gray-500 text-sm mt-1">
            Enter your scheduled appointment time
          </p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className={`w-full py-3 px-4 rounded-md text-white font-medium transition-colors ${
            loading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'
          }`}
        >
          {loading ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Checking In...</span>
            </div>
          ) : (
            'Check In'
          )}
        </button>
      </form>

      {/* Help Section */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-900 mb-2">What happens next?</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• You'll receive your queue position and estimated wait time</li>
          <li>• We'll send you updates as your turn approaches</li>
          <li>• You can wait anywhere and return when it's your turn</li>
        </ul>
      </div>
    </div>
  );
};

export default CheckInForm;