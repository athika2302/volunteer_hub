import rateLimit from 'express-rate-limit';

/**
 * Strict rate limiter for authentication routes (login & register)
 * Prevents password guessing, brute force attacks, and account creation spam.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req) => (process.env.NODE_ENV === 'test' ? 10000 : 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many login or registration attempts. Please try again in 15 minutes.',
  },
  skip: (req) => process.env.NODE_ENV === 'test',
});

/**
 * General rate limiter for all other API endpoints
 * Protects server resources from denial of service and runaway scraping scripts.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req) => (process.env.NODE_ENV === 'test' ? 50000 : 300),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP. Please try again later.',
  },
  skip: (req) => process.env.NODE_ENV === 'test',
});

