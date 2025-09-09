import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CheckInForm } from '../CheckInForm';
import { CheckInData } from '../../types';

const mockOnSubmit = jest.fn();

const defaultProps = {
  onSubmit: mockOnSubmit,
  loading: false,
};

describe('CheckInForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all form fields', () => {
    render(<CheckInForm {...defaultProps} />);
    
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/appointment time/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /check in/i })).toBeInTheDocument();
  });

  it('displays validation errors for empty fields', async () => {
    render(<CheckInForm {...defaultProps} />);
    
    const submitButton = screen.getByRole('button', { name: /check in/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/phone number is required/i)).toBeInTheDocument();
      expect(screen.getByText(/appointment time is required/i)).toBeInTheDocument();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('formats phone number correctly', () => {
    render(<CheckInForm {...defaultProps} />);
    
    const phoneInput = screen.getByLabelText(/phone number/i);
    fireEvent.change(phoneInput, { target: { value: '1234567890' } });

    expect(phoneInput).toHaveValue('(123) 456-7890');
  });

  it('validates name field correctly', async () => {
    render(<CheckInForm {...defaultProps} />);
    
    const nameInput = screen.getByLabelText(/full name/i);
    
    // Test too short name
    fireEvent.change(nameInput, { target: { value: 'A' } });
    fireEvent.blur(nameInput);

    await waitFor(() => {
      expect(screen.getByText(/name must be at least 2 characters/i)).toBeInTheDocument();
    });

    // Test invalid characters
    fireEvent.change(nameInput, { target: { value: 'John123' } });
    fireEvent.blur(nameInput);

    await waitFor(() => {
      expect(screen.getByText(/name can only contain letters/i)).toBeInTheDocument();
    });

    // Test valid name
    fireEvent.change(nameInput, { target: { value: 'John Doe' } });
    fireEvent.blur(nameInput);

    await waitFor(() => {
      expect(screen.queryByText(/name must be at least 2 characters/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/name can only contain letters/i)).not.toBeInTheDocument();
    });
  });

  it('validates appointment time correctly', async () => {
    render(<CheckInForm {...defaultProps} />);
    
    const timeInput = screen.getByLabelText(/appointment time/i);
    
    // Test invalid time format
    fireEvent.change(timeInput, { target: { value: '25:00' } });
    fireEvent.blur(timeInput);

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid time/i)).toBeInTheDocument();
    });

    // Test valid time format (12-hour)
    fireEvent.change(timeInput, { target: { value: '2:30 PM' } });
    fireEvent.blur(timeInput);

    await waitFor(() => {
      expect(screen.queryByText(/please enter a valid time/i)).not.toBeInTheDocument();
    });

    // Test valid time format (24-hour)
    fireEvent.change(timeInput, { target: { value: '14:30' } });
    fireEvent.blur(timeInput);

    await waitFor(() => {
      expect(screen.queryByText(/please enter a valid time/i)).not.toBeInTheDocument();
    });
  });

  it('submits form with valid data', async () => {
    const mockSubmit = jest.fn().mockResolvedValue(undefined);
    render(<CheckInForm onSubmit={mockSubmit} loading={false} />);
    
    // Fill in valid data
    fireEvent.change(screen.getByLabelText(/full name/i), { 
      target: { value: 'John Doe' } 
    });
    fireEvent.change(screen.getByLabelText(/phone number/i), { 
      target: { value: '1234567890' } 
    });
    fireEvent.change(screen.getByLabelText(/appointment time/i), { 
      target: { value: '2:30 PM' } 
    });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /check in/i }));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith({
        name: 'John Doe',
        phone: '(123) 456-7890',
        appointmentTime: '2:30 PM',
      });
    });
  });

  it('shows loading state when submitting', () => {
    render(<CheckInForm {...defaultProps} loading={true} />);
    
    const submitButton = screen.getByRole('button', { name: /checking in/i });
    expect(submitButton).toBeDisabled();
    expect(screen.getByText(/checking in/i)).toBeInTheDocument();
  });

  it('disables form fields when loading', () => {
    render(<CheckInForm {...defaultProps} loading={true} />);
    
    expect(screen.getByLabelText(/full name/i)).toBeDisabled();
    expect(screen.getByLabelText(/phone number/i)).toBeDisabled();
    expect(screen.getByLabelText(/appointment time/i)).toBeDisabled();
  });
});