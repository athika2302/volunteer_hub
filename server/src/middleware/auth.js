import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * requireAuth — verifies the JWT token in the Authorization header
 *
 * Flow:
 *  1. Extract the Bearer token from the header
 *  2. Verify the token signature using the JWT_SECRET
 *  3. Look up the user in the database (to catch deleted/suspended users)
 *  4. Attach user to req.user for downstream handlers
 */
export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user from DB to ensure they still exist and haven't been deleted
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User no longer exists. Please register again.' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token. Please log in again.' });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    next(err);
  }
}

/**
 * requireAdmin — must be used AFTER requireAuth
 *
 * Only users with role === 'admin' can access this route.
 * This prevents volunteers from accessing admin-only endpoints
 * even if they somehow obtain the URL.
 */
export function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

/**
 * requireApproved — must be used AFTER requireAuth
 *
 * Why on the server?
 * Hiding a button in the UI is cosmetic — anyone can call the API directly.
 * The server must independently verify that the volunteer has been approved.
 * Admins are always considered approved.
 */
export function requireApproved(req, res, next) {
  // Admins bypass the approval check
  if (req.user.role === 'admin') {
    return next();
  }
  if (!req.user.approved) {
    return res.status(403).json({
      error: 'Your account is pending approval. An admin will review your profile shortly.',
    });
  }
  next();
}

