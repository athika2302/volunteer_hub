import mongoose from 'mongoose';

/**
 * Payment Model
 * -------------
 * Records a payment made by an admin to a volunteer.
 * The app does NOT move money — it only tracks the record.
 *
 * Design decisions:
 * - `signups` is an array of Signup refs so one payment can cover multiple attended shifts
 * - `upiReference` is optional — the admin can record it after the UPI transfer
 * - Pay is based on ATTENDANCE, not the posted amount, because:
 *   1. A volunteer who doesn't show up shouldn't be paid
 *   2. The admin needs a clear audit trail of what was actually worked vs. paid
 *   3. If pay were automatic on sign-up, no-shows would steal from the pool
 */
const paymentSchema = new mongoose.Schema(
  {
    volunteer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    upiReference: {
      type: String,
      trim: true,
      default: '',
    },
    // Which attended signups this payment covers
    signups: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Signup',
    }],
    paidAt: {
      type: Date,
      default: Date.now,
    },
    // Which admin recorded this payment (audit trail)
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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

paymentSchema.index({ volunteer: 1, paidAt: -1 });

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;

