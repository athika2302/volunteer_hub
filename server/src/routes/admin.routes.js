import { Router } from 'express';
import User from '../models/User.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// All routes here require admin access
router.use(requireAuth, requireAdmin);

/**
 * GET /api/admin/pending-approvals
 * Returns all volunteers who are awaiting approval.
 */
router.get('/pending-approvals', async (req, res, next) => {
  try {
    const pending = await User.find({ role: 'volunteer', approved: false })
      .sort({ createdAt: -1 });
    res.json({ users: pending });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/admin/approve/:userId
 * Approves a volunteer so they can start signing up for events.
 */
router.patch('/approve/:userId', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    if (user.role !== 'volunteer') {
      return res.status(400).json({ error: 'Only volunteers can be approved.' });
    }
    if (user.approved) {
      return res.status(400).json({ error: 'This volunteer is already approved.' });
    }

    user.approved = true;
    await user.save();

    res.json({ message: `${user.name} has been approved.`, user });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/admin/reject/:userId
 * Rejects (deletes) a pending volunteer's account.
 */
router.patch('/reject/:userId', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    if (user.approved) {
      return res.status(400).json({ error: 'Cannot reject an already-approved volunteer.' });
    }

    await User.findByIdAndDelete(req.params.userId);
    res.json({ message: `${user.name}'s account has been rejected and removed.` });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/volunteers
 * Returns all approved volunteers.
 */
router.get('/volunteers', async (req, res, next) => {
  try {
    const volunteers = await User.find({ role: 'volunteer', approved: true })
      .sort({ name: 1 });
    res.json({ users: volunteers });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/volunteers/:userId/anonymize
 * Anonymizes or deletes a volunteer's personal data upon erasure request (DPDP Act, 2023 compliance).
 * Preserves financial payment records for legal and audit obligations while scrubbing PII.
 */
router.delete('/volunteers/:userId/anonymize', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    if (user.role === 'admin') {
      return res.status(400).json({ error: 'Admin accounts cannot be anonymized via this endpoint.' });
    }

    const anonymizedIdentifier = `anon_${Date.now()}`;
    // Replace PII with anonymized values to preserve foreign key references in past records
    user.name = `Anonymized Volunteer (${user._id.toString().slice(-4)})`;
    user.phone = `000000${user._id.toString().slice(-4)}`; // Scrub active mobile number
    user.upiId = ''; // Permanently purge financial UPI handle
    user.approved = false;
    user.passwordHash = 'DELETED_ACCOUNT';
    await user.save();

    res.json({
      message: 'Volunteer account successfully anonymized. PII purged while retaining audit ledger records.',
      userId: user._id,
    });
  } catch (err) {
    next(err);
  }
});

export default router;

