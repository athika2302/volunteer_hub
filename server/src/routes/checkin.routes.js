import { Router } from 'express';
import Signup from '../models/Signup.js';
import Notification from '../models/Notification.js';
import { requireAuth, requireAdmin, requireApproved } from '../middleware/auth.js';
import { process24HourReminders } from '../services/reminder.service.js';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/checkin/event/:eventId
 * Event-day check-in roster with search and counters
 */
router.get('/event/:eventId', requireAdmin, async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { q } = req.query;

    const query = {
      event: eventId,
      status: { $in: ['confirmed', 'attended'] },
    };

    let signups = await Signup.find(query)
      .populate('volunteer', 'name phone upiId')
      .populate('role', 'name payAmount dressCode')
      .sort({ 'volunteer.name': 1 });

    if (q && q.trim()) {
      const term = q.trim().toLowerCase();
      signups = signups.filter(
        (s) =>
          s.volunteer?.name?.toLowerCase().includes(term) ||
          s.volunteer?.phone?.includes(term) ||
          s.role?.name?.toLowerCase().includes(term)
      );
    }

    const total = signups.length;
    const arrivedCount = signups.filter((s) => s.checkedIn).length;

    res.json({
      signups,
      total,
      arrivedCount,
      remainingCount: total - arrivedCount,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/checkin/toggle/:signupId
 * Admin marks volunteer as arrived on event day
 */
router.patch('/toggle/:signupId', requireAdmin, async (req, res, next) => {
  try {
    const signup = await Signup.findById(req.params.signupId)
      .populate('volunteer', 'name phone')
      .populate('role', 'name');

    if (!signup) return res.status(404).json({ error: 'Signup not found.' });

    // Toggle check-in status
    signup.checkedIn = !signup.checkedIn;
    signup.checkedInAt = signup.checkedIn ? new Date() : null;

    // If checked in, automatically mark status as attended as well
    if (signup.checkedIn) {
      signup.status = 'attended';
    }

    await signup.save();

    res.json({
      message: signup.checkedIn
        ? `${signup.volunteer.name} marked as arrived.`
        : `${signup.volunteer.name} unmarked.`,
      signup,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/checkin/trigger-reminders
 * Admin / test endpoint to trigger 24h reminder batch manually
 */
router.post('/trigger-reminders', requireAdmin, async (req, res, next) => {
  try {
    const count = await process24HourReminders();
    res.json({ message: '24h reminder process completed.', remindersLogged: count });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/checkin/notifications
 * Volunteer retrieves their notifications
 */
router.get('/notifications', requireApproved, async (req, res, next) => {
  try {
    const notifications = await Notification.find({ volunteer: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30);

    const unreadCount = await Notification.countDocuments({
      volunteer: req.user._id,
      read: false,
    });

    res.json({ notifications, unreadCount });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/checkin/notifications/read-all
 * Mark all user notifications as read
 */
router.patch('/notifications/read-all', requireApproved, async (req, res, next) => {
  try {
    await Notification.updateMany({ volunteer: req.user._id, read: false }, { read: true });
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    next(err);
  }
});

export default router;
