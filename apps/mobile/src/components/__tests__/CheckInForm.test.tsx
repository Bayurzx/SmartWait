import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import CheckInForm from '../CheckInForm';

describe('CheckInForm', () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all form fields', () => {
    const { getByPlaceholderText } = render(
      <CheckInForm onSubmit={mockOnSubmit} />
    );

    expect(getByPlaceholderText('Enter your full name')).toBeTruthy();
    expect(getByPlaceholderText('(555) 123-4567')).toBeTruthy();
    expect(getByPlaceholderText('2:30 PM or 14:30')).toBeTruthy();
  });

  it('validates required fields', async () => {
    const { getByRole, getByText } = render(
      <CheckInForm onSubmit={mockOnSubmit} />
    );

    const submitButton = getByRole('button');
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(getByText('Name is required')).toBeTruthy();
      expect(getByText('Phone number is required')).toBeTruthy();
      expect(getByText('Appointment time is required')).toBeTruthy();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('validates name format', async () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <CheckInForm onSubmit={mockOnSubmit} />
    );

    const nameInput = getByPlaceholderText('Enter your full name');
    
    // Test too short name
    fireEvent.changeText(nameInput, 'A');
    fireEvent(nameInput, 'blur');
    
    await waitFor(() => {
      expect(getByText('Name must be at least 2 characters')).toBeTruthy();
    });

    // Test invalid characters
    fireEvent.changeText(nameInput, 'John123');
    fireEvent(nameInput, 'blur');
    
    await waitFor(() => {
      expect(getByText('Name can only contain letters, spaces, hyphens, and apostrophes')).toBeTruthy();
    });

    // Test valid name
    fireEvent.changeText(nameInput, 'John Doe');
    fireEvent(nameInput, 'blur');
    
    await waitFor(() => {
      expect(queryByText('Name must be at least 2 characters')).toBeFalsy();
    });
  });

  it('formats phone number correctly', () => {
    const { getByPlaceholderText } = render(
      <CheckInForm onSubmit={mockOnSubmit} />
    );

    const phoneInput = getByPlaceholderText('(555) 123-4567');
    
    fireEvent.changeText(phoneInput, '1234567890');
    
    expect(phoneInput.props.value).toBe('(123) 456-7890');
  });

  it('validates phone number', async () => {
    const { getByPlaceholderText, getByText } = render(
      <CheckInForm onSubmit={mockOnSubmit} />
    );

    const phoneInput = getByPlaceholderText('(555) 123-4567');
    
    // Test too short phone
    fireEvent.changeText(phoneInput, '123');
    fireEvent(phoneInput, 'blur');
    
    await waitFor(() => {
      expect(getByText('Phone number must be at least 10 digits')).toBeTruthy();
    });
  });

  it('validates appointment time format', async () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <CheckInForm onSubmit={mockOnSubmit} />
    );

    const timeInput = getByPlaceholderText('2:30 PM or 14:30');
    
    // Test invalid format
    fireEvent.changeText(timeInput, '25:00');
    fireEvent(timeInput, 'blur');
    
    await waitFor(() => {
      expect(getByText('Please enter a valid time (e.g., 2:30 PM or 14:30)')).toBeTruthy();
    });

    // Test valid 12-hour format
    fireEvent.changeText(timeInput, '2:30 PM');
    fireEvent(timeInput, 'blur');
    
    await waitFor(() => {
      expect(queryByText('Please enter a valid time (e.g., 2:30 PM or 14:30)')).toBeFalsy();
    });

    // Test valid 24-hour format
    fireEvent.changeText(timeInput, '14:30');
    fireEvent(timeInput, 'blur');
    
    await waitFor(() => {
      expect(queryByText('Please enter a valid time (e.g., 2:30 PM or 14:30)')).toBeFalsy();
    });
  });

  it('submits form with valid data', async () => {
    const { getByPlaceholderText, getByRole } = render(
      <CheckInForm onSubmit={mockOnSubmit} />
    );

    const nameInput = getByPlaceholderText('Enter your full name');
    const phoneInput = getByPlaceholderText('(555) 123-4567');
    const timeInput = getByPlaceholderText('2:30 PM or 14:30');
    const submitButton = getByRole('button');

    fireEvent.changeText(nameInput, 'John Doe');
    fireEvent.changeText(phoneInput, '1234567890');
    fireEvent.changeText(timeInput, '2:30 PM');
    
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        name: 'John Doe',
        phone: '(123) 456-7890',
        appointmentTime: '2:30 PM',
      });
    });
  });

  it('shows loading state when submitting', () => {
    const { getByText } = render(
      <CheckInForm onSubmit={mockOnSubmit} loading={true} />
    );

    expect(getByText('Checking In...')).toBeTruthy();
  });
});