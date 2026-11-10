import cron from 'node-cron';
import os from 'os';
import Signup from '../models/Signup.js';
import Notification from '../models/Notification.js';
import JobLock from '../models/JobLock.js';
import { logger } from '../utils/logger.js';

const INSTANCE_ID = `${os.hostname()}:${process.pid}`;

/**
 * Attempt to acquire an atomic distributed lock in MongoDB for the given job.
 * Lock duration defaults to 10 minutes (600,000ms).
 */
export async function acquireJobLock(jobName, lockDurationMs = 10 * 60 * 1000) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + lockDurationMs);

  try {
    // Atomic upsert/claim: lock succeeds if either the document does not exist
    // or its previous lease has expired (expiresAt < now)
    const lock = await JobLock.findOneAndUpdate(
      {
        jobName,
        $or: [{ expiresAt: { $lt: now } }, { lockedBy: INSTANCE_ID }],
      },
      {
        $set: {
          jobName,
          lockedBy: INSTANCE_ID,
          lockedAt: now,
          expiresAt,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );
    return !!lock;
  } catch (err) {
    // E11000 duplicate key error means another active instance holds the unexpired lock
    if (err.code === 11000) {
      return false;
    }
    logger.error({ err, jobName }, 'Error acquiring job lock');
    return false;
  }
}

/**
 * Release an acquired job lock.
 */
export async function releaseJobLock(jobName) {
  try {
    await JobLock.deleteOne({ jobName, lockedBy: INSTANCE_ID });
  } catch (err) {
    logger.error({ err, jobName }, 'Error releasing job lock');
  }
}

/**
 * Scan confirmed signups and send a 24-hour reminder notification
 * if the shift starts within the window [now + 23 hours, now + 25 hours].
 * Uses atomic upsert / Notification unique index to guarantee idempotency.
 */
export async function process24HourReminders() {
  const now = new Date();
  const lowerBound = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const upperBound = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  // Find all confirmed signups
  const signups = await Signup.find({ status: 'confirmed' })
    .populate('volunteer')
    .populate('role')
    .populate('event');

  let sentCount = 0;

  for (const signup of signups) {
    if (!signup.event || !signup.volunteer || !signup.role) continue;

    // Combine event.date and event.startTime into a single Date object
    const [hours, minutes] = signup.event.startTime.split(':').map(Number);
    const shiftStart = new Date(signup.event.date);
    shiftStart.setHours(hours, minutes, 0, 0);

    // Check if shiftStart falls in the 23-25h window
    if (shiftStart >= lowerBound && shiftStart <= upperBound) {
      try {
        const title = `Reminder: Shift Tomorrow for ${signup.event.title}`;
        const message = `Hi ${signup.volunteer.name}! Your shift as "${signup.role.name}" starts at ${signup.event.startTime} at ${signup.event.venue}. Dress code: ${signup.role.dressCode || signup.event.dressCode || 'Standard'}.`;

        await Notification.create({
          volunteer: signup.volunteer._id,
          event: signup.event._id,
          signup: signup._id,
          type: 'reminder_24h',
          title,
          message,
        });

        console.log(`[Reminder Service] Sent 24h reminder to ${signup.volunteer.name} (${signup.volunteer.phone})`);
        sentCount++;
      } catch (err) {
        // Code 11000 = unique index duplicate (reminder already sent - idempotent)
        if (err.code !== 11000) {
          console.error('[Reminder Service] Error creating notification:', err);
        }
      }
    }
  }

  return sentCount;
}

/**
 * Initialize background cron task.
 * Runs every hour at minute 0 with distributed cluster locking.
 */
export function initReminderCron() {
  // Cron expression: At minute 0 of every hour
  cron.schedule('0 * * * *', async () => {
    const jobName = 'shift_24h_reminder';
    const acquired = await acquireJobLock(jobName);
    if (!acquired) {
      logger.info({ jobName, instanceId: INSTANCE_ID }, 'Skipping reminder cron; another instance holds the lock');
      return;
    }

    logger.info({ jobName, instanceId: INSTANCE_ID }, 'Acquired distributed lock; executing 24h shift reminder check...');
    try {
      const count = await process24HourReminders();
      logger.info({ count }, `24h reminder check complete. Notifications logged: ${count}`);
    } catch (err) {
      logger.error({ err }, 'Error running reminder task');
    } finally {
      await releaseJobLock(jobName);
    }
  });

  logger.info('24-hour reminder scheduler initialized with cluster-safe JobLock.');
}
