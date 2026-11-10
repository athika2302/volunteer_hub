/**
 * Signup Service — Business Logic for Volunteer Sign-ups
 * =======================================================
 * This service contains the core concurrency-safe sign-up logic.
 * Route handlers remain thin; they just call these functions.
 */

import mongoose from 'mongoose';
import Role from '../models/Role.js';
import Event from '../models/Event.js';
import Signup from '../models/Signup.js';

// ─── Sign Up ──────────────────────────────────────────────────────────────────

/**
 * signUpForRole
 * -------------
 * Attempts to sign a volunteer up for a role.
 * Returns { signup, wasWaitlisted } on success.
 * Throws an Error with a user-readable `.message` on failure.
 *
 * RACE CONDITION PREVENTION
 * -------------------------
 * The naive two-step approach:
 *   1. Read: const role = await Role.findById(id)  → role.filled < role.capacity ✓
 *   2. Write: role.filled += 1; await role.save()
 *
 * ...is UNSAFE. If 20 concurrent requests all read filled=4,capacity=5 at the
 * same instant, all 20 see "spot available" and all 20 increment → filled=24.
 *
 * The fix: ONE atomic findOneAndUpdate that CHECKS AND WRITES in a single
 * MongoDB operation. MongoDB applies document-level locking during this op,
 * so no two threads can both "win" the same last spot.
 *
 * If the returned document is null, the condition (filled < capacity) was false
 * at write time — the role was full. The volunteer is then waitlisted.
 */
export async function signUpForRole(volunteerId, roleId) {
  // 1. Load the role to get event ID and capacity
  const role = await Role.findById(roleId).populate('event');
  if (!role) throw Object.assign(new Error('Role not found.'), { status: 404 });

  const event = role.event;
  if (!event) throw Object.assign(new Error('Event not found.'), { status: 404 });

  // ── STEP 2: Conflict Check ────────────────────────────────────────────────
  // Check if the volunteer has another CONFIRMED shift that overlaps this one.
  // We do this BEFORE the capacity check to give a clear error message.
  await assertNoTimeConflict(volunteerId, event);

  // ── STEP 3: Atomic Capacity Grab ─────────────────────────────────────────
  //
  // RACE CONDITION FIX: This single atomic operation BOTH checks whether a spot
  // is available AND increments `filled` in one database instruction.
  //
  // If `filled >= capacity`, MongoDB will NOT apply the $inc, and returns null.
  // This guarantees that at most `capacity` spots are ever confirmed, even under
  // heavy concurrent traffic (e.g., 20 volunteers hitting the endpoint in 1ms).
  //
  const updatedRole = await Role.findOneAndUpdate(
    { _id: roleId, filled: { $lt: role.capacity } }, // condition: spot available
    { $inc: { filled: 1 } },                          // action: take the spot
    { new: true }                                     // return updated doc
  );

  const wasWaitlisted = updatedRole === null; // null → role was full at write time

  // ── STEP 4: Create the Signup document ───────────────────────────────────
  let signup;
  try {
    if (wasWaitlisted) {
      // ATOMIC WAITLIST POSITION ASSIGNMENT
      // Atomically increment the role's waitlistCounter using findByIdAndUpdate + $inc.
      // MongoDB applies a document-level write lock, guaranteeing each waitlisted signup
      // receives a strictly sequential, unique position even under high concurrency.
      const updatedCounterRole = await Role.findByIdAndUpdate(
        roleId,
        { $inc: { waitlistCounter: 1 } },
        { new: true }
      );
      const assignedPosition = updatedCounterRole ? updatedCounterRole.waitlistCounter : 1;

      signup = await Signup.create({
        volunteer: volunteerId,
        role: roleId,
        event: event._id,
        status: 'waitlisted',
        waitlistPosition: assignedPosition,
      });
    } else {
      signup = await Signup.create({
        volunteer: volunteerId,
        role: roleId,
        event: event._id,
        status: 'confirmed',
        waitlistPosition: null,
      });
    }
  } catch (err) {
    // Duplicate key: volunteer already signed up for this role
    if (err.code === 11000) {
      // If we already incremented filled, roll it back
      if (!wasWaitlisted) {
        await Role.findByIdAndUpdate(roleId, { $inc: { filled: -1 } });
      }
      throw Object.assign(
        new Error('You have already signed up for this role.'),
        { status: 409 }
      );
    }
    throw err;
  }

  return { signup, wasWaitlisted, role: updatedRole || role };
}

// ─── Cancel Signup ────────────────────────────────────────────────────────────

/**
 * Helper to run an operation inside a MongoDB transaction if replica set supports it,
 * or fallback gracefully for standalone/in-memory environments without replica sets.
 */
async function withOptionalTransaction(workFn) {
  const session = await mongoose.startSession();
  try {
    let result;
    // Check if the current deployment supports transactions (replica sets/mongos)
    // Standalone mongod instances throw error on startTransaction
    try {
      session.startTransaction();
      result = await workFn(session);
      await session.commitTransaction();
    } catch (txErr) {
      // If standalone doesn't support transactions (code 20 or message contains 'Transaction numbers'), fallback without session
      if (
        txErr.message &&
        (txErr.message.includes('Transactions are not supported') ||
          txErr.message.includes('replica set') ||
          txErr.message.includes('standalone'))
      ) {
        await session.abortTransaction().catch(() => {});
        return await workFn(null);
      }
      await session.abortTransaction().catch(() => {});
      throw txErr;
    }
    return result;
  } finally {
    await session.endSession();
  }
}

/**
 * cancelSignup
 * ------------
 * Cancels a confirmed or waitlisted signup.
 * - Decrements `filled` atomically for confirmed signups
 * - Records whether cancellation was within 24h of event start
 * - Promotes the first waitlisted volunteer when a confirmed spot is freed
 * Uses a MongoDB transaction where supported to ensure multi-document consistency.
 */
export async function cancelSignup(signupId, volunteerId) {
  return await withOptionalTransaction(async (session) => {
    const opts = session ? { session } : {};

    const signup = await Signup.findById(signupId, null, opts).populate({
      path: 'role',
      populate: { path: 'event' },
    });

    if (!signup) throw Object.assign(new Error('Signup not found.'), { status: 404 });
    if (signup.volunteer.toString() !== volunteerId.toString()) {
      throw Object.assign(new Error('You can only cancel your own signups.'), { status: 403 });
    }
    if (!['confirmed', 'waitlisted'].includes(signup.status)) {
      throw Object.assign(new Error('Only confirmed or waitlisted signups can be cancelled.'), { status: 400 });
    }

    const event = signup.role.event;
    const eventStart = buildEventDatetime(event.date, event.startTime);
    const hoursUntilEvent = (eventStart - Date.now()) / (1000 * 60 * 60);
    const cancelledWithin24h = hoursUntilEvent < 24 && hoursUntilEvent >= 0;

    const wasConfirmed = signup.status === 'confirmed';

    // Update the signup record
    signup.status = 'cancelled';
    signup.cancelledWithin24h = cancelledWithin24h;
    signup.waitlistPosition = null;
    await signup.save(opts);

    if (wasConfirmed) {
      // Atomically decrement filled
      await Role.findByIdAndUpdate(signup.role._id, { $inc: { filled: -1 } }, opts);

      // Promote the next person on the waitlist
      await promoteNextWaitlisted(signup.role._id, session);
    } else {
      // Reorder remaining waitlist positions (compact the gap)
      await recomputeWaitlistPositions(signup.role._id, session);
    }

    return { signup, cancelledWithin24h };
  });
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * assertNoTimeConflict
 * --------------------
 * Checks if the volunteer has any confirmed signup whose event time overlaps
 * with the given event's time window.
 * Throws if a conflict is found.
 */
async function assertNoTimeConflict(volunteerId, newEvent) {
  // Find all confirmed signups for this volunteer on the same date
  const confirmedSignups = await Signup.find({
    volunteer: volunteerId,
    status: { $in: ['confirmed', 'attended'] },
  }).populate({ path: 'event' });

  const newDate = new Date(newEvent.date).toDateString();

  for (const existing of confirmedSignups) {
    const existingEvent = existing.event;
    if (!existingEvent) continue;

    // Only check same-day events
    if (new Date(existingEvent.date).toDateString() !== newDate) continue;

    // Check time overlap: two intervals [a1,a2] and [b1,b2] overlap when a1 < b2 AND b1 < a2
    const a1 = existingEvent.startTime;
    const a2 = existingEvent.endTime;
    const b1 = newEvent.startTime;
    const b2 = newEvent.endTime;

    if (a1 < b2 && b1 < a2) {
      throw Object.assign(
        new Error(
          `Time conflict: you already have a confirmed shift for "${existingEvent.title}" ` +
          `(${existingEvent.startTime}–${existingEvent.endTime}) which overlaps with ` +
          `${newEvent.startTime}–${newEvent.endTime}.`
        ),
        { status: 409 }
      );
    }
  }
}

/**
 * promoteNextWaitlisted
 * ---------------------
 * Atomically promotes the first waitlisted volunteer when a spot opens.
 */
async function promoteNextWaitlisted(roleId, session = null) {
  const opts = session ? { session } : {};
  const role = await Role.findById(roleId, null, opts);
  if (!role) return;

  // Grab the next waitlisted person in position order
  const next = await Signup.findOne({ role: roleId, status: 'waitlisted' }, null, opts)
    .sort({ waitlistPosition: 1 });
  if (!next) return; // nobody waiting

  // Atomic capacity increment (re-take the spot for the promoted person)
  const updatedRole = await Role.findOneAndUpdate(
    { _id: roleId, filled: { $lt: role.capacity } },
    { $inc: { filled: 1 } },
    { new: true, ...opts }
  );

  if (!updatedRole) return; // edge case: role somehow full already

  // Promote the waitlisted signup to confirmed
  next.status = 'confirmed';
  next.waitlistPosition = null;
  await next.save(opts);

  // Compact remaining waitlist positions
  await recomputeWaitlistPositions(roleId, session);
}

/**
 * recomputeWaitlistPositions
 * --------------------------
 * Assigns sequential waitlist positions (1, 2, 3, ...) to all waitlisted
 * signups for a role, ordered by their MongoDB _id (insertion order).
 *
 * This is called after any insertion or cancellation that affects the waitlist.
 * For V1 load levels this is correct and safe. In V2 with high traffic,
 * a Redis INCR counter would provide fully lock-free ordering.
 */
async function recomputeWaitlistPositions(roleId, session = null) {
  const opts = session ? { session } : {};
  const waitlisted = await Signup.find({ role: roleId, status: 'waitlisted' }, null, opts)
    .sort({ _id: 1 }); // _id is ObjectId — insertion order is deterministic

  for (let i = 0; i < waitlisted.length; i++) {
    const correctPosition = i + 1;
    if (waitlisted[i].waitlistPosition !== correctPosition) {
      waitlisted[i].waitlistPosition = correctPosition;
      await waitlisted[i].save(opts);
    }
  }
}

/**
 * Builds a Date object from an event's date field and an HH:mm time string.
 */
function buildEventDatetime(eventDate, timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  const dt = new Date(eventDate);
  dt.setHours(hours, minutes, 0, 0);
  return dt;
}
