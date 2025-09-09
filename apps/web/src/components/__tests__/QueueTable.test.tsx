import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueueTable } from '../QueueTable';
import { QueuePatient } from '../../types/staff';

const mockPatients: QueuePatient[] = [
  {
    id: '1',
    patientId: 'patient-1',
    patient: {
      id: 'patient-1',
      name: 'John Doe',
      phone: '5551234567',
      createdAt: '2023-01-01T10:00:00Z',
    },
    position: 1,
    status: 'waiting',
    checkInTime: '2023-01-01T10:00:00Z',
    estimatedWaitMinutes: 15,
  },
  {
    id: '2',
    patientId: 'patient-2',
    patient: {
      id: 'patient-2',
      name: 'Jane Smith',
      phone: '5559876543',
      createdAt: '2023-01-01T10:05:00Z',
    },
    position: 2,
    status: 'called',
    checkInTime: '2023-01-01T10:05:00Z',
    estimatedWaitMinutes: 30,
    calledAt: '2023-01-01T10:15:00Z',
  },
];

describe('QueueTable', () => {
  const defaultProps = {
    patients: mockPatients,
    onCallNext: jest.fn(),
    onCompletePatient: jest.fn(),
    loading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders patient queue correctly', () => {
    render(<QueueTable {...defaultProps} />);
    
    expect(screen.getByText('Patient Queue')).toBeInTheDocument();
    expect(screen.getByText('1 patients waiting')).toBeInTheDocument(); // Only 1 waiting patient (John), Jane is called
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('displays formatted phone numbers', () => {
    render(<QueueTable {...defaultProps} />);
    
    expect(screen.getByText('(555) 123-4567')).toBeInTheDocument();
    expect(screen.getByText('(555) 987-6543')).toBeInTheDocument();
  });

  it('shows correct status badges', () => {
    render(<QueueTable {...defaultProps} />);
    
    expect(screen.getByText('Waiting')).toBeInTheDocument();
    expect(screen.getByText('Called')).toBeInTheDocument();
  });

  it('calls onCallNext when Call Next Patient button is clicked', () => {
    render(<QueueTable {...defaultProps} />);
    
    const callButton = screen.getByText('Call Next Patient');
    fireEvent.click(callButton);
    
    expect(defaultProps.onCallNext).toHaveBeenCalledTimes(1);
  });

  it('calls onCompletePatient when Mark Complete button is clicked', () => {
    render(<QueueTable {...defaultProps} />);
    
    const completeButton = screen.getByText('Mark Complete');
    fireEvent.click(completeButton);
    
    expect(defaultProps.onCompletePatient).toHaveBeenCalledWith('patient-2');
  });

  it('disables Call Next Patient button when no waiting patients', () => {
    const noWaitingPatients = mockPatients.map(p => ({ ...p, status: 'completed' as const }));
    render(<QueueTable {...defaultProps} patients={noWaitingPatients} />);
    
    const callButton = screen.getByText('Call Next Patient');
    expect(callButton).toBeDisabled();
  });

  it('shows empty state when no patients', () => {
    render(<QueueTable {...defaultProps} patients={[]} />);
    
    expect(screen.getByText('No patients in queue')).toBeInTheDocument();
    expect(screen.getByText('Patients will appear here when they check in.')).toBeInTheDocument();
  });

  it('shows loading state for calling patient', () => {
    render(<QueueTable {...defaultProps} callingPatient="patient-1" />);
    
    expect(screen.getByText('Calling...')).toBeInTheDocument();
  });

  it('shows loading state for completing patient', () => {
    render(<QueueTable {...defaultProps} completingPatient="patient-2" />);
    
    expect(screen.getByText('Completing...')).toBeInTheDocument();
  });
});