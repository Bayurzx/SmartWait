// Phone number utility functions

// Format phone number for display (e.g., "+1234567890" -> "(123) 456-7890")
export const formatPhoneNumber = (phone: string): string => {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Handle US phone numbers
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  
  // Handle US phone numbers with country code
  if (digits.length === 11 && digits.startsWith('1')) {
    const number = digits.slice(1);
    return `+1 (${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6)}`;
  }
  
  // Return original if not a standard US format
  return phone;
};

// Normalize phone number for storage (remove formatting, ensure +1 prefix for US numbers)
export const normalizePhoneNumber = (phone: string): string => {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Add +1 prefix for US numbers if not present
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // Add + prefix if not present
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // Return with + prefix for international numbers
  if (!phone.startsWith('+') && digits.length > 10) {
    return `+${digits}`;
  }
  
  return phone;
};

// Validate phone number format
export const isValidPhoneFormat = (phone: string): boolean => {
  const digits = phone.replace(/\D/g, '');
  
  // US phone numbers: 10 digits or 11 digits starting with 1
  if (digits.length === 10) return true;
  if (digits.length === 11 && digits.startsWith('1')) return true;
  
  // International numbers: 7-15 digits
  if (digits.length >= 7 && digits.length <= 15) return true;
  
  return false;
};

// Extract country code from phone number
export const getCountryCode = (phone: string): string => {
  const normalized = normalizePhoneNumber(phone);
  
  if (normalized.startsWith('+1')) return '+1';
  if (normalized.startsWith('+')) {
    // Extract country code (1-4 digits after +)
    const match = normalized.match(/^\+(\d{1,4})/);
    return match ? `+${match[1]}` : '+1';
  }
  
  return '+1'; // Default to US
};

// Get phone number without country code
export const getPhoneWithoutCountryCode = (phone: string): string => {
  const normalized = normalizePhoneNumber(phone);
  const countryCode = getCountryCode(normalized);
  return normalized.replace(countryCode, '');
};

// Mask phone number for display (e.g., "+1234567890" -> "+1***-***-7890")
export const maskPhoneNumber = (phone: string): string => {
  const formatted = formatPhoneNumber(phone);
  
  if (formatted.includes('(') && formatted.includes(')')) {
    // US format: (123) 456-7890 -> (***) ***-7890
    return formatted.replace(/\d(?=.*\d{4})/g, '*');
  }
  
  // International format: mask all but last 4 digits
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 4) {
    const lastFour = digits.slice(-4);
    const masked = '*'.repeat(digits.length - 4);
    return phone.replace(digits, masked + lastFour);
  }
  
  return phone;
};