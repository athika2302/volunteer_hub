import { Router } from 'express';
import Signup from '../models/Signup.js';
import { requireAuth, requireApproved } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createSignupSchema } from '../validators/schemas.js';
import { signUpForRole, cancelSignup } from '../services/signup.service.js';

const router = Router();

router.use(requireAuth, requireApproved);

/**
 * POST /api/signups
 * Volunteer signs up for a role.
 * Body: { roleId }
 */
router.post('/', validate(createSignupSchema), async (req, res, next) => {
  try {
    const { roleId } = req.body;
    if (!roleId) return res.status(400).json({ error: 'roleId is required.' });

    const { signup, wasWaitlisted, role } = await signUpForRole(req.user._id, roleId);

    res.status(201).json({
      message: wasWaitlisted
        ? `Role is full. You are on the waitlist at position ${signup.waitlistPosition}.`
        : `Successfully signed up! Your spot is confirmed.`,
      signup,
      wasWaitlisted,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * GET /api/signups/my
 * Returns the authenticated volunteer's own signups, populated with event and role details.
 */
router.get('/my', async (req, res, next) => {
  try {
    const signups = await Signup.find({ volunteer: req.user._id })
      .populate('event')
      .populate('role')
      .sort({ createdAt: -1 });
    res.json({ signups });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/signups/:id
 * Volunteer cancels their own signup.
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { signup, cancelledWithin24h } = await cancelSignup(req.params.id, req.user._id);
    res.json({
      message: cancelledWithin24h
        ? 'Signup cancelled. Note: this cancellation was recorded within 24 hours of the event.'
        : 'Signup cancelled successfully.',
      signup,
      cancelledWithin24h,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

export default router;

