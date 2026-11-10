import mongoose from 'mongoose';

/**
 * Role Model
 * ----------
 * A Role belongs to an Event and represents one type of position
 * (e.g., "Hostess" or "Boy Coordinator") with its own headcount and pay.
 *
 * Key design decisions:
 * - `filled` starts at 0 and is incremented atomically during sign-up (Step 3)
 *   to prevent race conditions. We NEVER derive it by counting Signup documents
 *   because that would require two database reads in the hot sign-up path.
 * - `dressCode` overrides the event-level dress code for this specific role
 * - `capacity` validated as a positive integer at the schema level
 */
const roleSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event reference is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Role name is required'],
      trim: true,
      maxlength: [100, 'Role name must be at most 100 characters'],
    },
    capacity: {
      type: Number,
      required: [true, 'Capacity is required'],
      min: [1, 'Capacity must be at least 1'],
      validate: {
        validator: Number.isInteger,
        message: 'Capacity must be a whole number',
      },
    },
    // `filled` is maintained atomically via findOneAndUpdate; never updated manually
    filled: {
      type: Number,
      default: 0,
      min: [0, 'Filled cannot be negative'],
    },
    // Monotonically increasing counter for assigning sequential waitlist positions atomically
    waitlistCounter: {
      type: Number,
      default: 0,
      min: [0, 'Counter cannot be negative'],
    },
    payAmount: {
      type: Number,
      required: [true, 'Pay amount is required'],
      min: [0, 'Pay amount cannot be negative'],
    },
    dressCode: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Virtual: available spots remaining (capacity - filled)
roleSchema.virtual('available').get(function () {
  return Math.max(0, this.capacity - this.filled);
});

// Virtual: is this role full?
roleSchema.virtual('isFull').get(function () {
  return this.filled >= this.capacity;
});

const Role = mongoose.model('Role', roleSchema);

export default Role;

