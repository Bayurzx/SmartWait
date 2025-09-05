import { format, formatDistanceToNow, addMinutes, isAfter, isBefore } from 'date-fns';

// Format date for display
export const formatDate = (date: Date): string => {
  return format(date, 'MMM dd, yyyy');
};

// Format time for display
export const formatTime = (date: Date): string => {
  return format(date, 'h:mm a');
};

// Format date and time for display
export const formatDateTime = (date: Date): string => {
  return format(date, 'MMM dd, yyyy h:mm a');
};

// Get relative time (e.g., "5 minutes ago")
export const getRelativeTime = (date: Date): string => {
  return formatDistanceToNow(date, { addSuffix: true });
};

// Calculate wait time in minutes
export const calculateWaitTime = (checkInTime: Date, currentTime: Date = new Date()): number => {
  const diffMs = currentTime.getTime() - checkInTime.getTime();
  return Math.floor(diffMs / (1000 * 60));
};

// Add minutes to a date
export const addMinutesToDate = (date: Date, minutes: number): Date => {
  return addMinutes(date, minutes);
};

// Check if a time is in the past
export const isInPast = (date: Date): boolean => {
  return isBefore(date, new Date());
};

// Check if a time is in the future
export const isInFuture = (date: Date): boolean => {
  return isAfter(date, new Date());
};

// Format duration in minutes to human readable format
export const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    return `${hours} hr`;
  }
  
  return `${hours} hr ${remainingMinutes} min`;
};

// Get current timestamp in ISO format
export const getCurrentTimestamp = (): string => {
  return new Date().toISOString();
};