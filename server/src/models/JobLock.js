import mongoose from 'mongoose';

/**
 * JobLock Model
 * --------------
 * Provides distributed locking across multi-instance or clustered server deployments.
 * Only the single instance that acquires or refreshes the lock runs the designated job.
 *
 * - jobName: unique job identifier (e.g., 'shift_24h_reminder')
 * - lockedBy: identifier of instance/worker holding the lock (e.g., hostname:pid)
 * - lockedAt: timestamp when lock was acquired
 * - expiresAt: timestamp after which the lock is considered stale and re-claimable
 */
const jobLockSchema = new mongoose.Schema(
  {
    jobName: {
      type: String,
      required: true,
      unique: true,
    },
    lockedBy: {
      type: String,
      required: true,
    },
    lockedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index automatically removes expired locks
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

const JobLock = mongoose.model('JobLock', jobLockSchema);

export default JobLock;

