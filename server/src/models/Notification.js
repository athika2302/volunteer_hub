import mongoose from 'mongoose';

/**
 * Notification Model (Step 7)
 * ----------------------------
 * Logs reminders and event updates for volunteers.
 * In Version 1, these records are stored in the database and surfaced in the UI.
 * In Version 2, these can trigger WhatsApp / SMS messages via Twilio / Meta Graph API.
 */
const notificationSchema = new mongoose.Schema(
  {
    volunteer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
    },
    signup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Signup',
    },
    type: {
      type: String,
      enum: ['reminder_24h', 'promoted_from_waitlist', 'account_approved', 'payment_recorded'],
      default: 'reminder_24h',
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    read: {
      type: Boolean,
      default: false,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Prevent duplicate 24h reminders for the same signup
notificationSchema.index({ volunteer: 1, signup: 1, type: 1 }, { unique: true });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
