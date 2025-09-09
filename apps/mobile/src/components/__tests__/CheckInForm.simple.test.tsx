import React from 'react';
import { render } from '@testing-library/react-native';
import CheckInForm from '../CheckInForm';

describe('CheckInForm - Simple Tests', () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { getByText, getByRole } = render(
      <CheckInForm onSubmit={mockOnSubmit} />
    );

    expect(getByRole('button')).toBeTruthy();
    expect(getByText('Enter your information to join the virtual queue')).toBeTruthy();
  });

  it('renders all form fields', () => {
    const { getByPlaceholderText } = render(
      <CheckInForm onSubmit={mockOnSubmit} />
    );

    expect(getByPlaceholderText('Enter your full name')).toBeTruthy();
    expect(getByPlaceholderText('(555) 123-4567')).toBeTruthy();
    expect(getByPlaceholderText('2:30 PM or 14:30')).toBeTruthy();
  });

  it('shows loading state when loading prop is true', () => {
    const { getByText } = render(
      <CheckInForm onSubmit={mockOnSubmit} loading={true} />
    );

    expect(getByText('Checking In...')).toBeTruthy();
  });
});