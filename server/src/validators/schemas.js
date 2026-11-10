import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const indianPhoneRegex = /^[6-9]\d{9}$/;
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name cannot exceed 100 characters'),
  phone: z.string().trim().regex(indianPhoneRegex, 'Must be a valid 10-digit Indian phone number starting with 6-9'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128, 'Password cannot exceed 128 characters'),
  upiId: z.string().trim().max(100, 'UPI ID cannot exceed 100 characters').optional().or(z.literal('')),
});

export const loginSchema = z.object({
  phone: z.string().trim().regex(indianPhoneRegex, 'Must be a valid 10-digit Indian phone number'),
  password: z.string().min(1, 'Password is required').max(128, 'Password cannot exceed 128 characters'),
});

export const roleSchema = z.object({
  name: z.string().trim().min(2, 'Role name must be at least 2 characters').max(100, 'Role name cannot exceed 100 characters'),
  capacity: z.number().int('Capacity must be an integer').min(1, 'Capacity must be at least 1').max(500, 'Capacity cannot exceed 500'),
  payAmount: z.number().min(0, 'Pay amount must be non-negative').max(100000, 'Pay amount cannot exceed 100,000'),
  dressCode: z.string().trim().max(200, 'Dress code cannot exceed 200 characters').optional(),
});

export const createEventSchema = z.object({
  title: z.string().trim().min(2, 'Title must be at least 2 characters').max(200, 'Title cannot exceed 200 characters'),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid event date' }),
  startTime: z.string().regex(timeRegex, 'Start time must be in HH:mm format'),
  endTime: z.string().regex(timeRegex, 'End time must be in HH:mm format'),
  venue: z.string().trim().min(2, 'Venue must be at least 2 characters').max(300, 'Venue cannot exceed 300 characters'),
  dressCode: z.string().trim().max(200, 'Dress code cannot exceed 200 characters').optional(),
  description: z.string().trim().max(2000, 'Description cannot exceed 2000 characters').optional(),
  roles: z.array(roleSchema).optional(),
}).refine((data) => data.endTime > data.startTime, {
  message: 'End time must be after start time',
  path: ['endTime'],
});

export const updateEventSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid event date' }).optional(),
  startTime: z.string().regex(timeRegex, 'Start time must be in HH:mm format').optional(),
  endTime: z.string().regex(timeRegex, 'End time must be in HH:mm format').optional(),
  venue: z.string().trim().min(2).max(300).optional(),
  dressCode: z.string().trim().max(200).optional(),
  description: z.string().trim().max(2000).optional(),
});

export const createSignupSchema = z.object({
  roleId: z.string().regex(objectIdRegex, 'Invalid role ID format'),
});

export const recordPaymentSchema = z.object({
  volunteerId: z.string().regex(objectIdRegex, 'Invalid volunteer ID format'),
  amount: z.number().positive('Payment amount must be greater than 0').max(100000, 'Amount exceeds safety cap'),
  upiReference: z.string().trim().max(100, 'UPI reference cannot exceed 100 characters').optional(),
  signupIds: z.array(z.string().regex(objectIdRegex, 'Invalid signup ID')).optional(),
});

export const markAttendanceSchema = z.object({
  status: z.enum(['attended', 'no-show', 'confirmed'], {
    errorMap: () => ({ message: "Status must be 'attended', 'no-show', or 'confirmed'" }),
  }),
});

