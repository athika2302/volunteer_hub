import mongoose from 'mongoose';
import { encrypt, decrypt, maskUpi } from '../utils/crypto.js';

/**
 * User Model
 * -----------
 * - phone: unique Indian 10-digit mobile number starting with 6-9
 * - passwordHash: bcrypt hash with cost factor >= 12, select: false
 * - upiId: encrypted at rest using AES-256-GCM. Masked by default in toJSON.
 * - role: 'volunteer' or 'admin'
 * - approved: false by default for volunteers; true for admins
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name must be at most 100 characters'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
      match: [/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian mobile number'],
    },
    upiId: {
      type: String,
      trim: true,
      default: '',
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // Never returned in queries by default
    },
    role: {
      type: String,
      enum: ['admin', 'volunteer'],
      default: 'volunteer',
    },
    approved: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        // Financial PII protection: Mask UPI ID by default for normal responses
        if (ret.upiId) {
          ret.upiId = maskUpi(ret.upiId);
        }
        return ret;
      },
    },
  }
);

// Encrypt UPI ID at rest before saving
userSchema.pre('save', function (next) {
  if (this.isModified('upiId') && this.upiId && !this.upiId.includes(':')) {
    this.upiId = encrypt(this.upiId);
  }
  next();
});

// Decrypt helper for admin operations
userSchema.methods.getFullUpiId = function () {
  return decrypt(this.upiId);
};

const User = mongoose.model('User', userSchema);

export default User;
