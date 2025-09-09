'use client';

import React from 'react';
import { QueuePatient } from '../types/staff';

interface QueueTableProps {
  patients: QueuePatient[];
  onCallNext: () => void;
  onCompletePatient: (patientId: string) => void;
  loading: boolean;
  callingPatient?: string | null;
  completingPatient?: string | null;
}

export const QueueTable: React.FC<QueueTableProps> = ({
  patients,
  onCallNext,
  onCompletePatient,
  loading,
  callingPatient,
  completingPatient,
}) => {
  const formatTime = (dateString: string): string => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatWaitTime = (checkInTime: string): string => {
    const checkIn = new Date(checkInTime);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - checkIn.getTime()) / (1000 * 60));
    
    if (diffMinutes < 60) {
      return `${diffMinutes}m`;
    } else {
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      return `${hours}h ${minutes}m`;
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'waiting':
        return 'text-blue-600 bg-blue-100';
      case 'called':
        return 'text-green-600 bg-green-100';
      case 'completed':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'waiting':
        return 'Waiting';
      case 'called':
        return 'Called';
      case 'completed':
        return 'Completed';
      default:
        return status;
    }
  };

  const formatPhoneNumber = (phone: string): string => {
    // Format phone number for display (e.g., (555) 123-4567)
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const waitingPatients = patients.filter(p => p.status === 'waiting');
  const nextPatient = waitingPatients.length > 0 ? waitingPatients[0] : null;

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Header with Call Next Button */}
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Patient Queue</h2>
            <p className="text-sm text-gray-600">
              {waitingPatients.length} patients waiting
              {nextPatient && ` • Next: ${nextPatient.patient.name}`}
            </p>
          </div>
          <button
            onClick={onCallNext}
            disabled={loading || !nextPatient || !!callingPatient}
            className={`px-6 py-2 rounded-md font-medium transition-colors ${
              loading || !nextPatient || !!callingPatient
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2'
            }`}
          >
            {callingPatient ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Calling...</span>
              </div>
            ) : (
              'Call Next Patient'
            )}
          </button>
        </div>
      </div>

      {/* Queue Table */}
      <div className="overflow-x-auto">
        {patients.length === 0 ? (
          <div className="text-center py-12">
            <svg className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No patients in queue</h3>
            <p className="text-gray-600">Patients will appear here when they check in.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Position
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Check-in Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Wait Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {patients.map((patient) => (
                <tr key={patient.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      #{patient.position}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {patient.patient.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">
                      {formatPhoneNumber(patient.patient.phone)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">
                      {formatTime(patient.checkInTime)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">
                      {formatWaitTime(patient.checkInTime)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(patient.status)}`}>
                      {getStatusText(patient.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {patient.status === 'called' && (
                      <button
                        onClick={() => onCompletePatient(patient.patientId)}
                        disabled={completingPatient === patient.patientId}
                        className={`text-blue-600 hover:text-blue-900 ${
                          completingPatient === patient.patientId ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        {completingPatient === patient.patientId ? (
                          <div className="flex items-center space-x-1">
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                            <span>Completing...</span>
                          </div>
                        ) : (
                          'Mark Complete'
                        )}
                      </button>
                    )}
                    {patient.status === 'waiting' && patient.position > 1 && (
                      <span className="text-gray-400">Waiting</span>
                    )}
                    {patient.status === 'completed' && (
                      <span className="text-gray-400">Completed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};