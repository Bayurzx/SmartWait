import Joi from 'joi';

// Validation schemas for API requests
export const checkInSchema = Joi.object({
  name: Joi.string().min(1).max(100).required().messages({
    'string.empty': 'Name is required',
    'string.max': 'Name must be less than 100 characters'
  }),
  phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).required().messages({
    'string.pattern.base': 'Please enter a valid phone number',
    'string.empty': 'Phone number is required'
  }),
  appointmentTime: Joi.string().required().messages({
    'string.empty': 'Appointment time is required'
  })
});

export const staffLoginSchema = Joi.object({
  username: Joi.string().min(3).max(50).required(),
  password: Joi.string().min(6).required()
});

// Validation helper functions
export const validateCheckIn = (data: any) => {
  return checkInSchema.validate(data, { abortEarly: false });
};

export const validateStaffLogin = (data: any) => {
  return staffLoginSchema.validate(data, { abortEarly: false });
};

// Phone number validation
export const isValidPhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
  return phoneRegex.test(phone);
};

// Name validation
export const isValidName = (name: string): boolean => {
  return name.trim().length > 0 && name.length <= 100;
};