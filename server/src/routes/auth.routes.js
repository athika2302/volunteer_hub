import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { registerSchema, loginSchema } from '../validators/schemas.js';

const router = Router();

// Bcrypt cost factor >= 12 for strong brute-force resistance
const SALT_ROUNDS = 12;

function getAccessSecret() {
  return process.env.JWT_SECRET || 'dev_jwt_access_secret';
}

function getRefreshSecret() {
  return process.env.JWT_REFRESH_SECRET || `${getAccessSecret()}_refresh`;
}

/**
 * Signs a short-lived access token (default 1 hour).
 */
function signAccessToken(userId) {
  return jwt.sign({ userId }, getAccessSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  });
}

/**
 * Signs a longer-lived refresh token (7 days).
 */
function signRefreshToken(userId) {
  return jwt.sign({ userId }, getRefreshSecret(), {
    expiresIn: '7d',
  });
}

/**
 * Sets the refresh token into an httpOnly, Secure, SameSite cookie.
 */
function setRefreshTokenCookie(res, refreshToken) {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/auth',
  });
}

/**
 * POST /api/auth/register
 * Creates a new volunteer account with validated input and rate limiting.
 */
router.post('/register', authLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const { name, phone, password, upiId } = req.body;

    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this phone number already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await User.create({
      name,
      phone,
      passwordHash,
      upiId: upiId || '',
      role: 'volunteer',
      approved: false,
    });

    const accessToken = signAccessToken(user._id);
    const refreshToken = signRefreshToken(user._id);
    setRefreshTokenCookie(res, refreshToken);

    res.status(201).json({
      message: 'Registration successful! Your profile will be reviewed by an admin before you can sign up for events.',
      token: accessToken,
      user,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'An account with this phone number already exists.' });
    }
    next(err);
  }
});

/**
 * POST /api/auth/login
 * Authenticates user, returning short-lived JWT + httpOnly refresh cookie.
 */
router.post('/login', authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { phone, password } = req.body;

    const user = await User.findOne({ phone }).select('+passwordHash');
    if (!user) {
      return res.status(401).json({ error: 'Invalid phone number or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid phone number or password.' });
    }

    const accessToken = signAccessToken(user._id);
    const refreshToken = signRefreshToken(user._id);
    setRefreshTokenCookie(res, refreshToken);

    res.json({
      message: 'Login successful.',
      token: accessToken,
      user,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/refresh
 * Exchanges a valid httpOnly refresh token for a fresh short-lived access token.
 */
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token provided.' });
    }

    const decoded = jwt.verify(refreshToken, getRefreshSecret());
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found.' });
    }

    const newAccessToken = signAccessToken(user._id);
    const newRefreshToken = signRefreshToken(user._id);
    setRefreshTokenCookie(res, newRefreshToken);

    res.json({
      token: newAccessToken,
      user,
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired refresh token.' });
  }
});

/**
 * POST /api/auth/logout
 * Clears the refresh token cookie.
 */
router.post('/logout', (req, res) => {
  res.clearCookie('refreshToken', {
    path: '/api/auth',
  });
  res.json({ message: 'Logged out successfully.' });
});

/**
 * GET /api/auth/me
 * Returns the currently authenticated user's profile with masked UPI.
 */
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
