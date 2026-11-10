/**
 * Concurrency Test — The Core Learning Step
 * ==========================================
 * Fires N simultaneous sign-up requests at a role with capacity C.
 * Asserts exactly C are confirmed, N-C are waitlisted, and filled === C.
 *
 * This test PROVES that the atomic findOneAndUpdate pattern prevents
 * the race condition that would occur with the naive read-then-write approach.
 */
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

const PORT = 5062;
const TOTAL_VOLUNTEERS = 20;
const ROLE_CAPACITY = 5;

async function request(method, path, body = null, token = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`, opts);
  return res.json();
}

async function run() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  VOLUNTEERHUB — CONCURRENCY TEST');
  console.log(`  ${TOTAL_VOLUNTEERS} simultaneous requests · Role capacity: ${ROLE_CAPACITY}`);
  console.log('═══════════════════════════════════════════════════════\n');

  await connectDB();
  await User.deleteMany({});
  await Event.deleteMany({});
  await Role.deleteMany({});
  await Signup.deleteMany({});

  // Create admin
  const adminHash = await bcrypt.hash('admin123', 10);
  await User.create({ name: 'Admin', phone: '9000000001', passwordHash: adminHash, role: 'admin', approved: true });

  // Create N volunteers
  console.log(`[Setup] Creating ${TOTAL_VOLUNTEERS} volunteer accounts...`);
  const volunteers = [];
  for (let i = 0; i < TOTAL_VOLUNTEERS; i++) {
    const hash = await bcrypt.hash('vol123', 10);
    const phone = `80000000${String(i).padStart(2, '0')}`;
    await User.create({ name: `Volunteer ${i + 1}`, phone, passwordHash: hash, role: 'volunteer', approved: true });
    volunteers.push(phone);
  }

  // Start the server
  const server = await new Promise((resolve, reject) => {
    const s = app.listen(PORT, '127.0.0.1', (err) => {
      if (err) return reject(err);
      resolve(s);
    });
    s.on('error', reject);
  });
  console.log(`[Setup] Server started on port ${PORT}`);

  // Log in all volunteers to get their tokens
  console.log('[Setup] Logging in all volunteers...');
  const tokens = await Promise.all(
    volunteers.map((phone) =>
      request('POST', '/api/auth/login', { phone, password: 'vol123' })
        .then((d) => d.token)
    )
  );

  // Create the event and role (admin)
  const adminLogin = await request('POST', '/api/auth/login', { phone: '9000000001', password: 'admin123' });
  const adminToken = adminLogin.token;

  const eventRes = await request('POST', '/api/events', {
    title: 'Concurrency Test Event',
    date: new Date().toISOString(),
    startTime: '09:00',
    endTime: '17:00',
    venue: 'Test Venue',
    roles: [{ name: 'Test Role', capacity: ROLE_CAPACITY, payAmount: 1000 }],
  }, adminToken);

  const roleId = eventRes.roles[0]._id;
  console.log(`[Setup] Created role with capacity ${ROLE_CAPACITY}. ID: ${roleId}\n`);

  // ── THE CONCURRENCY TEST ─────────────────────────────────────────────────
  console.log(`[Test] Firing ${TOTAL_VOLUNTEERS} sign-up requests SIMULTANEOUSLY...`);
  const startTime = Date.now();

  // Promise.all fires all requests at the same instant, exposing any race conditions
  const results = await Promise.all(
    tokens.map((token) =>
      request('POST', '/api/signups', { roleId }, token)
    )
  );

  const elapsed = Date.now() - startTime;
  console.log(`[Test] All ${TOTAL_VOLUNTEERS} requests completed in ${elapsed}ms\n`);

  // ── VERIFY RESULTS ───────────────────────────────────────────────────────
  const confirmed = results.filter((r) => r.signup?.status === 'confirmed');
  const waitlisted = results.filter((r) => r.signup?.status === 'waitlisted');
  const errors = results.filter((r) => !r.signup);

  // Verify the Role document's filled field is exactly ROLE_CAPACITY
  const finalRole = await Role.findById(roleId);

  console.log('─────────────────────────────────────────────────────');
  console.log('  RESULTS');
  console.log('─────────────────────────────────────────────────────');

  function pass(label) { console.log(`  ✓ PASS: ${label}`); }
  function fail(label) { console.error(`  ✗ FAIL: ${label}`); process.exitCode = 1; }

  const confirmedOk  = confirmed.length  === ROLE_CAPACITY;
  const waitlistedOk = waitlisted.length === TOTAL_VOLUNTEERS - ROLE_CAPACITY;
  const filledOk     = finalRole.filled  === ROLE_CAPACITY;
  const noErrorsOk   = errors.length     === 0;

  confirmedOk  ? pass(`Confirmed:  ${confirmed.length} (expected ${ROLE_CAPACITY})`)
               : fail(`Confirmed:  ${confirmed.length} (expected ${ROLE_CAPACITY}) ← RACE CONDITION!`);

  waitlistedOk ? pass(`Waitlisted: ${waitlisted.length} (expected ${TOTAL_VOLUNTEERS - ROLE_CAPACITY})`)
               : fail(`Waitlisted: ${waitlisted.length} (expected ${TOTAL_VOLUNTEERS - ROLE_CAPACITY})`);

  filledOk     ? pass(`Role.filled = ${finalRole.filled} (expected ${ROLE_CAPACITY})`)
               : fail(`Role.filled = ${finalRole.filled} (expected ${ROLE_CAPACITY}) ← DB INCONSISTENT!`);

  noErrorsOk   ? pass(`No unexpected errors (${errors.length} errors)`)
               : fail(`${errors.length} requests returned errors (unexpected)`);

  // Print waitlist positions to show ordering is preserved
  const waitlistPositions = waitlisted
    .map((r) => r.signup.waitlistPosition)
    .sort((a, b) => a - b);

  console.log(`\n  Waitlist positions: [${waitlistPositions.join(', ')}]`);

  const positionsOk = waitlistPositions.every((pos, idx) => pos === idx + 1);
  positionsOk ? pass('Waitlist positions are sequential (1, 2, 3, ...)')
              : fail('Waitlist positions are NOT sequential');

  console.log('─────────────────────────────────────────────────────');

  if (process.exitCode === 1) {
    console.error('\n  ✗ CONCURRENCY TEST FAILED — race condition detected!');
    console.error('    The atomic findOneAndUpdate fix is not working correctly.');
  } else {
    console.log('\n  ✓ CONCURRENCY TEST PASSED');
    console.log('    The atomic findOneAndUpdate prevented all race conditions.');
    console.log('    Exactly 5 of 20 concurrent requests received confirmed spots.');
  }
  console.log('═══════════════════════════════════════════════════════\n');

  server.close(async () => {
    await disconnectDB();
  });
}

run().catch((err) => {
  console.error('[Concurrency Test] Fatal:', err);
  process.exit(1);
});
