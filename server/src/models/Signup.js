import mongoose from 'mongoose';

/**
 * Signup Model
 * ------------
 * Tracks a single volunteer's registration for a specific role within an event.
 *
 * Status flow:
 *   confirmed → attended  (admin marks them as arrived and worked)
 *   confirmed → no-show   (admin marks them as absent)
 *   confirmed → cancelled (volunteer cancels; may record 24h flag)
 *   waitlisted → confirmed (a spot opens up and they're promoted atomically)
 *   waitlisted → cancelled (volunteer cancels from waitlist)
 *
 * The unique compound index on (volunteer, role) prevents a volunteer
 * from signing up for the same role twice, even under concurrent requests.
 * MongoDB enforces this at the storage layer, so the second insert is rejected
 * with error code 11000 regardless of timing.
 */
const signupSchema = new mongoose.Schema(
  {
    volunteer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      required: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    status: {
      type: String,
      enum: ['confirmed', 'waitlisted', 'cancelled', 'attended', 'no-show'],
      default: 'confirmed',
    },
    // Position in the waitlist (1 = next to be promoted); null when confirmed/cancelled
    waitlistPosition: {
      type: Number,
      default: null,
    },
    // True if the volunteer cancelled within 24 hours of the event start time
    cancelledWithin24h: {
      type: Boolean,
      default: false,
    },
    // Event-day check-in status (Step 7)
    checkedIn: {
      type: Boolean,
      default: false,
    },
    checkedInAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt = time of signup
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

/**
 * Unique index: one person cannot sign up for the same role twice.
 * This is enforced at the DB layer — even concurrent inserts can't bypass it.
 * On duplicate, MongoDB returns error code 11000 which we handle in the service.
 */
signupSchema.index({ volunteer: 1, role: 1 }, { unique: true });

// Index for looking up all signups for an event (attendance view)
signupSchema.index({ event: 1, status: 1 });

// Index for looking up a volunteer's own signups
signupSchema.index({ volunteer: 1, status: 1 });

// Index for role status queries (e.g. finding waitlisted signups for promotion)
signupSchema.index({ role: 1, status: 1 });

// Index for waitlist ordering
signupSchema.index({ role: 1, waitlistPosition: 1 });

const Signup = mongoose.model('Signup', signupSchema);

export default Signup;

