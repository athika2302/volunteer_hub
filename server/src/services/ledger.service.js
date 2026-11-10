import Payment from '../models/Payment.js';
import Signup from '../models/Signup.js';
import User from '../models/User.js';
import { decrypt } from '../utils/crypto.js';

/**
 * Ledger Service
 * --------------
 * Handles attendance marking, payment tracking, and ledger balance computations.
 *
 * Core Concept:
 * Pay is based strictly on ATTENDANCE, not the posted amount on sign-up:
 * 1. A volunteer who is confirmed but fails to show up (no-show) must not be paid.
 * 2. Real-world events frequently have dropouts; paying on sign-up would create debt/fraud.
 * 3. Marking attendance creates a transparent audit trail linking worked hours to ledger credit.
 */

/**
 * Mark a volunteer signup as attended or no-show
 */
export async function markAttendance(signupId, status) {
  if (!['attended', 'no-show', 'confirmed'].includes(status)) {
    throw Object.assign(new Error('Status must be attended, no-show, or confirmed.'), { status: 400 });
  }

  const signup = await Signup.findById(signupId)
    .populate('volunteer', 'name phone upiId')
    .populate('role', 'name payAmount')
    .populate('event', 'title date startTime endTime venue');

  if (!signup) {
    throw Object.assign(new Error('Signup not found.'), { status: 404 });
  }

  signup.status = status;
  await signup.save();

  return signup;
}

/**
 * Get attendance roster for an event
 */
export async function getEventAttendance(eventId) {
  const signups = await Signup.find({
    event: eventId,
    status: { $in: ['confirmed', 'attended', 'no-show'] },
  })
    .populate('volunteer', 'name phone upiId approved')
    .populate('role', 'name payAmount dressCode')
    .sort({ 'role.name': 1, 'volunteer.name': 1 });

  const total = signups.length;
  const attendedCount = signups.filter((s) => s.status === 'attended').length;
  const noShowCount = signups.filter((s) => s.status === 'no-show').length;
  const markedCount = attendedCount + noShowCount;

  return {
    signups,
    summary: {
      total,
      markedCount,
      attendedCount,
      noShowCount,
      pendingCount: total - markedCount,
    },
  };
}

/**
 * Calculate volunteer's earnings ledger:
 * - Pending amount = sum(attended shift amounts) - sum(payments)
 * - Paid amount = sum(payments)
 * - Detailed shift breakdown and payment history
 */
export async function getVolunteerLedger(volunteerId) {
  // 1. Get all attended shifts
  const attendedSignups = await Signup.find({
    volunteer: volunteerId,
    status: 'attended',
  })
    .populate('role', 'name payAmount')
    .populate('event', 'title date startTime endTime venue')
    .sort({ 'event.date': -1 });

  // 2. Get all payments made to this volunteer
  const payments = await Payment.find({ volunteer: volunteerId })
    .sort({ paidAt: -1 })
    .populate('recordedBy', 'name');

  const totalEarned = attendedSignups.reduce((sum, s) => sum + (s.role?.payAmount || 0), 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const pendingAmount = Math.max(0, totalEarned - totalPaid);

  // Set of signup IDs that have been explicitly recorded in payments
  const paidSignupIdSet = new Set(
    payments.flatMap((p) => p.signups.map((id) => id.toString()))
  );

  const shifts = attendedSignups.map((s) => ({
    _id: s._id,
    eventTitle: s.event?.title || 'Unknown Event',
    eventDate: s.event?.date,
    startTime: s.event?.startTime,
    endTime: s.event?.endTime,
    venue: s.event?.venue,
    roleName: s.role?.name || 'Volunteer',
    amount: s.role?.payAmount || 0,
    isPaid: paidSignupIdSet.has(s._id.toString()) || totalEarned <= totalPaid,
  }));

  return {
    totalEarned,
    totalPaid,
    pendingAmount,
    shifts,
    payments,
  };
}

/**
 * Admin view: all volunteers with pending payments, sorted by highest pending
 */
export async function getPendingPayoutsOverview() {
  const volunteers = await User.find({ role: 'volunteer' }).select('name phone upiId');

  const ledgerSummaries = await Promise.all(
    volunteers.map(async (v) => {
      const { totalEarned, totalPaid, pendingAmount, shifts } = await getVolunteerLedger(v._id);
      return {
        volunteer: {
          _id: v._id,
          name: v.name,
          phone: v.phone,
          // Admins require unmasked UPI ID to execute the external transfer
          upiId: v.getFullUpiId ? v.getFullUpiId() : decrypt(v.upiId),
        },
        totalEarned,
        totalPaid,
        pendingAmount,
        attendedShiftsCount: shifts.length,
      };
    })
  );

  // Filter only those with pending amounts > 0 or with attended shifts
  const pendingList = ledgerSummaries
    .filter((l) => l.pendingAmount > 0)
    .sort((a, b) => b.pendingAmount - a.pendingAmount);

  const totalPendingPayout = pendingList.reduce((sum, item) => sum + item.pendingAmount, 0);

  return {
    pendingList,
    totalPendingPayout,
    totalVolunteersOwed: pendingList.length,
  };
}

/**
 * Record a payment made to a volunteer (UPI reference recorded manually)
 */
export async function recordPayment({ adminId, volunteerId, amount, upiReference, signupIds }) {
  const volunteer = await User.findById(volunteerId);
  if (!volunteer) {
    throw Object.assign(new Error('Volunteer not found.'), { status: 404 });
  }

  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw Object.assign(new Error('Payment amount must be a positive number.'), { status: 400 });
  }

  // If specific signupIds not provided, link all unpaid attended signups
  let targetSignupIds = signupIds;
  if (!targetSignupIds || targetSignupIds.length === 0) {
    const attended = await Signup.find({ volunteer: volunteerId, status: 'attended' }).select('_id');
    targetSignupIds = attended.map((s) => s._id);
  }

  const payment = await Payment.create({
    volunteer: volunteerId,
    amount: numAmount,
    upiReference: upiReference ? upiReference.trim() : '',
    signups: targetSignupIds,
    paidAt: new Date(),
    recordedBy: adminId,
  });

  const updatedLedger = await getVolunteerLedger(volunteerId);

  return {
    payment,
    updatedLedger,
  };
}
