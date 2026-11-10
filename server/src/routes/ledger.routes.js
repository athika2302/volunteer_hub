import { Router } from 'express';
import { requireAuth, requireAdmin, requireApproved } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { recordPaymentSchema } from '../validators/schemas.js';
import {
  getVolunteerLedger,
  getPendingPayoutsOverview,
  recordPayment,
} from '../services/ledger.service.js';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/ledger/my
 * Volunteer views their own earnings breakdown (Pending, Paid, Attended Shifts)
 */
router.get('/my', requireApproved, async (req, res, next) => {
  try {
    const ledger = await getVolunteerLedger(req.user._id);
    res.json(ledger);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/ledger/payouts
 * Admin views all pending volunteer payouts, sorted by highest pending amount
 */
router.get('/payouts', requireAdmin, async (req, res, next) => {
  try {
    const overview = await getPendingPayoutsOverview();
    res.json(overview);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/ledger/pay
 * Admin records a payment made via UPI
 * Body: { volunteerId, amount, upiReference, signupIds }
 */
router.post('/pay', requireAdmin, validate(recordPaymentSchema), async (req, res, next) => {
  try {
    const { volunteerId, amount, upiReference, signupIds } = req.body;
    if (!volunteerId || !amount) {
      return res.status(400).json({ error: 'volunteerId and amount are required.' });
    }

    const result = await recordPayment({
      adminId: req.user._id,
      volunteerId,
      amount,
      upiReference,
      signupIds,
    });

    res.status(201).json({
      message: 'Payment recorded successfully.',
      ...result,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

export default router;
