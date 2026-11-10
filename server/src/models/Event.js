import mongoose from 'mongoose';

/**
 * Event Model
 * -----------
 * Represents a single volunteer event (e.g., "Palace Ground – Gayatri Vihar, 20 Nov").
 *
 * Design decisions:
 * - date is stored as a Date (midnight of the event day) for easy querying/sorting
 * - startTime and endTime are strings like "07:30" (HH:mm) for display simplicity
 *   We validate endTime > startTime at the schema level
 * - createdBy tracks which admin created this event for audit purposes
 */
const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
      maxlength: [200, 'Title must be at most 200 characters'],
    },
    date: {
      type: Date,
      required: [true, 'Event date is required'],
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required'],
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Start time must be in HH:mm format'],
    },
    endTime: {
      type: String,
      required: [true, 'End time is required'],
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'End time must be in HH:mm format'],
    },
    venue: {
      type: String,
      required: [true, 'Venue is required'],
      trim: true,
    },
    dressCode: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // True if event is archived by admin
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/**
 * Custom validation: endTime must be after startTime
 * We compare them as simple strings because HH:mm sorts lexicographically correctly
 */
eventSchema.pre('validate', function (next) {
  if (this.startTime && this.endTime && this.endTime <= this.startTime) {
    this.invalidate('endTime', 'End time must be after start time');
  }
  next();
});

/**
 * Virtual: populate roles associated with this event
 * This lets us do Event.find().populate('roles') without storing role IDs on the event
 */
eventSchema.virtual('roles', {
  ref: 'Role',
  localField: '_id',
  foreignField: 'event',
});

// Index for efficient date-based queries (upcoming events)
eventSchema.index({ date: 1, startTime: 1 });

const Event = mongoose.model('Event', eventSchema);

export default Event;

