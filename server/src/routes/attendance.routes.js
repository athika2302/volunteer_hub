import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { markAttendanceSchema } from '../validators/schemas.js';
import { markAttendance, getEventAttendance } from '../services/ledger.service.js';

const router = Router();

// Attendance management requires admin rights
router.use(requireAuth, requireAdmin);

/**
 * GET /api/attendance/event/:eventId
 * Admin retrieves the volunteer roster for marking attendance
 */
router.get('/event/:eventId', async (req, res, next) => {
  try {
    const data = await getEventAttendance(req.params.eventId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/attendance/:signupId
 * Admin marks a signup as attended or no-show
 * Body: { status: 'attended' | 'no-show' | 'confirmed' }
 */
router.patch('/:signupId', validate(markAttendanceSchema), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Status is required.' });
    }
    const updated = await markAttendance(req.params.signupId, status);
    res.json({
      message: `Marked volunteer as ${status}.`,
      signup: updated,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

export default router;
