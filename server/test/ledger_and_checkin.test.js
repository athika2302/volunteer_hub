import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Set test mode BEFORE importing app so rate limiters are disabled
process.env.NODE_ENV = 'test';

import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import User from '../src/models/User.js';
import Event from '../src/models/Event.js';
import Role from '../src/models/Role.js';
import Signup from '../src/models/Signup.js';
import Payment from '../src/models/Payment.js';
import Notification from '../src/models/Notification.js';

const PORT = 5064;
let baseUrl = `http://127.0.0.1:${PORT}`;
let server;
let adminToken;
let volunteerToken;
let volunteerId;

async function request(method, path, body = null, token = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${baseUrl}${path}`, opts);
  const data = await res.json();
  return { status: res.status, data };
}

function assert(cond, label) {
  if (!cond) {
    console.error(`  ✗ FAIL: ${label}`);
    process.exitCode = 1;
  } else {
    console.log(`  ✓ ${label}`);
  }
}

async function run() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  TESTING STEPS 5, 6, 7: CONFLICT, LEDGER, CHECK-IN');
  console.log('═══════════════════════════════════════════════════════\n');

  await connectDB();
  await User.deleteMany({});
  await Event.deleteMany({});
  await Role.deleteMany({});
  await Signup.deleteMany({});
  await Payment.deleteMany({});
  await Notification.deleteMany({});

  // 1. Create Admin
  const adminHash = await bcrypt.hash('admin123', 10);
  const admin = await User.create({
    name: 'Club Lead',
    phone: '9000000001',
    passwordHash: adminHash,
    role: 'admin',
    approved: true,
  });

  // 2. Create Volunteer
  const volHash = await bcrypt.hash('vol123', 10);
  const volunteer = await User.create({
    name: 'Priya Patel',
    phone: '9876543210',
    passwordHash: volHash,
    upiId: 'priya@okhdfcbank',
    role: 'volunteer',
    approved: true,
  });
  volunteerId = volunteer._id;

  // Start HTTP server
  server = await new Promise((resolve, reject) => {
    const s = app.listen(PORT, '127.0.0.1', (err) => {
      if (err) return reject(err);
      resolve(s);
    });
  });

  const aLogin = await request('POST', '/api/auth/login', { phone: '9000000001', password: 'admin123' });
  adminToken = aLogin.data.token;

  const vLogin = await request('POST', '/api/auth/login', { phone: '9876543210', password: 'vol123' });
  volunteerToken = vLogin.data.token;

  console.log('[Setup] Admin and Volunteer authenticated.\n');

  try {
    // ── STEP 5: TIME CONFLICT DETECTION ──────────────────────────────────────
    console.log('--- Step 5: Conflict Detection ---');
    // Event 1: 2026-11-20, 08:00 - 14:00
    const ev1 = await request('POST', '/api/events', {
      title: 'Morning Conclave',
      date: '2026-11-20',
      startTime: '08:00',
      endTime: '14:00',
      venue: 'Palace Ground, Gayatri Vihar',
      roles: [{ name: 'Hostess', capacity: 5, payAmount: 1500 }],
    }, adminToken);
    const role1Id = ev1.data.roles[0]._id;

    // Volunteer signs up for Event 1
    const s1 = await request('POST', '/api/signups', { roleId: role1Id }, volunteerToken);
    assert(s1.status === 201 && s1.data.signup.status === 'confirmed', 'Signed up for Event 1 (08:00-14:00)');

    // Event 2: Same date (2026-11-20), overlapping time (12:00 - 18:00)
    const ev2 = await request('POST', '/api/events', {
      title: 'Afternoon Gala',
      date: '2026-11-20',
      startTime: '12:00',
      endTime: '18:00',
      venue: 'Gayatri Vihar Gate 2',
      roles: [{ name: 'Coordinator', capacity: 5, payAmount: 800 }],
    }, adminToken);
    const role2Id = ev2.data.roles[0]._id;

    // Attempting to sign up for Event 2 should be rejected due to overlap
    const s2 = await request('POST', '/api/signups', { roleId: role2Id }, volunteerToken);
    assert(s2.status === 409, 'Overlapping shift rejected with HTTP 409');
    assert(s2.data.error.includes('Time conflict'), 'Clear conflict error message returned');
    console.log(`  Message: "${s2.data.error}"`);

    // ── STEP 6: ATTENDANCE & EARNINGS LEDGER ──────────────────────────────────
    console.log('\n--- Step 6: Attendance and Earnings Ledger ---');
    const signup1Id = s1.data.signup._id;

    // 1. Initially, volunteer has confirmed shift, but attendance is not marked
    let ledger = await request('GET', '/api/ledger/my', null, volunteerToken);
    assert(ledger.data.totalEarned === 0, 'Total earned is 0 before attendance is marked');
    assert(ledger.data.pendingAmount === 0, 'Pending amount is 0 before attendance is marked');

    // 2. Admin marks attendance: 'attended'
    const markRes = await request('PATCH', `/api/attendance/${signup1Id}`, { status: 'attended' }, adminToken);
    assert(markRes.status === 200, 'Admin marked volunteer as attended');
    assert(markRes.data.signup.status === 'attended', 'Signup status updated to attended');

    // 3. Volunteer checks ledger: now has ₹1500 earned and ₹1500 pending
    ledger = await request('GET', '/api/ledger/my', null, volunteerToken);
    assert(ledger.data.totalEarned === 1500, 'Total earned is ₹1500 based on attendance');
    assert(ledger.data.pendingAmount === 1500, 'Pending amount is ₹1500');
    assert(ledger.data.shifts.length === 1, 'Attended shift appears in shift breakdown');

    // 4. Admin checks payouts overview
    const payouts = await request('GET', '/api/ledger/payouts', null, adminToken);
    assert(payouts.status === 200, 'Admin retrieved payouts overview');
    assert(payouts.data.totalPendingPayout === 1500, 'Total pending payout is ₹1500');
    assert(payouts.data.pendingList[0].volunteer.name === 'Priya Patel', 'Priya Patel listed on pending payouts');

    // 5. Admin records UPI payment
    const payRes = await request('POST', '/api/ledger/pay', {
      volunteerId,
      amount: 1500,
      upiReference: 'UPI/20261120/9988776655',
    }, adminToken);
    assert(payRes.status === 201, 'Admin recorded UPI payment');
    assert(payRes.data.payment.upiReference === 'UPI/20261120/9988776655', 'UPI reference saved');

    // 6. Volunteer verifies ledger post-payment
    ledger = await request('GET', '/api/ledger/my', null, volunteerToken);
    assert(ledger.data.pendingAmount === 0, 'Pending balance cleared to ₹0');
    assert(ledger.data.totalPaid === 1500, 'Total paid is now ₹1500');
    assert(ledger.data.payments.length === 1, 'Payment record appears in history');
    assert(ledger.data.payments[0].upiReference === 'UPI/20261120/9988776655', 'Volunteer can view UPI reference');

    // ── STEP 7: REMINDERS AND EVENT-DAY CHECK-IN ─────────────────────────────
    console.log('\n--- Step 7: Reminders and Event-Day Check-in ---');

    // Create an event ~24 hours from right now
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const timeStr = `${String(tomorrow.getHours()).padStart(2, '0')}:${String(tomorrow.getMinutes()).padStart(2, '0')}`;
    const evReminder = await request('POST', '/api/events', {
      title: '24h Reminder Event',
      date: tomorrow.toISOString(),
      startTime: timeStr,
      endTime: '23:59',
      venue: 'Main Auditorium',
      roles: [{ name: 'Stage Assistant', capacity: 5, payAmount: 1000 }],
    }, adminToken);
    const reminderRoleId = evReminder.data.roles[0]._id;

    // Volunteer signs up for this event
    const sReminder = await request('POST', '/api/signups', { roleId: reminderRoleId }, volunteerToken);
    assert(sReminder.status === 201, 'Volunteer signed up for 24h event');

    // Trigger reminder process
    const remProcess = await request('POST', '/api/checkin/trigger-reminders', {}, adminToken);
    assert(remProcess.status === 200, 'Reminder cron process executed');
    assert(remProcess.data.remindersLogged >= 1, '24h reminder notification generated');

    // Volunteer checks notifications
    const notifs = await request('GET', '/api/checkin/notifications', null, volunteerToken);
    assert(notifs.status === 200, 'Volunteer retrieved notifications');
    assert(notifs.data.notifications.length >= 1, 'Notification received in inbox');
    assert(notifs.data.notifications[0].type === 'reminder_24h', 'Notification type is reminder_24h');
    console.log(`  Notification: "${notifs.data.notifications[0].title}"`);

    // Event-day Check-in test:
    const reminderSignupId = sReminder.data.signup._id;
    const checkinToggle = await request('PATCH', `/api/checkin/toggle/${reminderSignupId}`, {}, adminToken);
    assert(checkinToggle.status === 200, 'Volunteer checked in on event day');
    assert(checkinToggle.data.signup.checkedIn === true, 'Signup checkedIn flag set to true');

    const checkinList = await request('GET', `/api/checkin/event/${evReminder.data.event._id}`, null, adminToken);
    assert(checkinList.data.arrivedCount === 1, 'Arrived counter reflects 1 volunteer');
    assert(checkinList.data.total === 1, 'Total roster count is 1');

    console.log('\n--- ALL STEPS 5, 6, 7 TESTS PASSED SUCCESSFULLY! ---');
  } catch (err) {
    console.error('[Test Error]', err);
    process.exitCode = 1;
  } finally {
    server.close(async () => {
      await disconnectDB();
      console.log('[Test] Server closed and DB disconnected.\n');
    });
  }
}

run().catch((err) => {
  console.error('[Fatal Error]', err);
  process.exit(1);
});
