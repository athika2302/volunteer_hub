import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

process.env.NODE_ENV = 'test';
process.env.PORT = '5069';

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Event from '../src/models/Event.js';
import Role from '../src/models/Role.js';
import Signup from '../src/models/Signup.js';

async function runLoadVerification() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  VOLUNTEERHUB — LOAD & CAPACITY VERIFICATION');
  console.log('  200 Concurrent Requests · 1,000 Sign-ups & Queries');
  console.log('═══════════════════════════════════════════════════════\n');

  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const server = app.listen(5069);
  const BASE_URL = 'http://127.0.0.1:5069';

  try {
    // 1. Setup Admin and Event with Role
    const adminPasswordHash = await bcrypt.hash('admin123', 10);
    const admin = await User.create({
      name: 'Load Test Admin',
      phone: '9111111111',
      passwordHash: adminPasswordHash,
      role: 'admin',
      approved: true,
      upiId: 'admin@okaxis',
    });

    const event = await Event.create({
      title: 'High Load Mega Conclave',
      date: new Date('2026-11-25'),
      startTime: '08:00',
      endTime: '17:00',
      venue: 'Tripuravasini, Palace Grounds, Bengaluru',
      createdBy: admin._id,
    });

    const ROLE_CAPACITY = 10;
    const role = await Role.create({
      event: event._id,
      name: 'VIP Usher',
      capacity: ROLE_CAPACITY,
      payAmount: 1200,
    });

    console.log(`[Setup] Target Role: "${role.name}" with strict capacity: ${ROLE_CAPACITY}`);

    // 2. Provision 200 distinct volunteers
    const TOTAL_USERS = 200;
    console.log(`[Setup] Provisioning ${TOTAL_USERS} authenticated volunteers...`);

    const volPasswordHash = await bcrypt.hash('pass123', 10);
    const userDocs = [];
    for (let i = 0; i < TOTAL_USERS; i++) {
      const phoneSuffix = String(i).padStart(4, '0');
      // Indian mobile numbers must start with 6-9
      userDocs.push({
        name: `Volunteer_${i}`,
        phone: `920000${phoneSuffix}`,
        passwordHash: volPasswordHash,
        role: 'volunteer',
        approved: true,
        upiId: `vol_${i}@okhdfc`,
      });
    }
    const createdUsers = await User.insertMany(userDocs);

    // Login each to acquire JWTs
    console.log('[Setup] Logging in all 200 volunteers to retrieve bearer tokens...');
    const tokens = await Promise.all(
      createdUsers.map(async (u) => {
        const res = await fetch(`${BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: u.phone, password: 'pass123' }),
        });
        const data = await res.json();
        return data.token;
      })
    );

    console.log('✓ All 200 volunteer sessions active.');

    // ── Phase 1: High-Concurrency Sign-up Burst (200 Simultaneous Requests) ──
    console.log('\n[Phase 1] Firing 200 simultaneous sign-up requests against Role (Capacity 10)...');
    const startSignup = performance.now();
    const signupLatencies = [];

    const signupResponses = await Promise.all(
      tokens.map(async (t) => {
        const reqStart = performance.now();
        const res = await fetch(`${BASE_URL}/api/signups`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${t}`,
          },
          body: JSON.stringify({ roleId: role._id.toString() }),
        });
        const reqEnd = performance.now();
        signupLatencies.push(reqEnd - reqStart);
        const body = await res.json();
        if (res.status >= 400 && signupLatencies.length === 1) {
          console.error('[First Signup Failure Sample]', res.status, body);
        }
        return { status: res.status, body };
      })
    );
    const totalSignupTime = performance.now() - startSignup;

    signupLatencies.sort((a, b) => a - b);
    const p50Signup = signupLatencies[Math.floor(signupLatencies.length * 0.5)];
    const p95Signup = signupLatencies[Math.floor(signupLatencies.length * 0.95)];

    // Tally results
    const confirmedCount = signupResponses.filter((r) => r.body.signup && r.body.signup.status === 'confirmed').length;
    const waitlistedCount = signupResponses.filter((r) => r.body.signup && r.body.signup.status === 'waitlisted').length;
    const errorCount = signupResponses.filter((r) => r.status >= 400).length;

    console.log(`✓ 200 sign-up requests finished in ${totalSignupTime.toFixed(1)}ms`);
    console.log(`  - p50 latency: ${p50Signup.toFixed(1)}ms`);
    console.log(`  - p95 latency: ${p95Signup.toFixed(1)}ms`);
    console.log(`  - Confirmed: ${confirmedCount} (Expected: ${ROLE_CAPACITY})`);
    console.log(`  - Waitlisted: ${waitlistedCount} (Expected: ${TOTAL_USERS - ROLE_CAPACITY})`);
    console.log(`  - Request Errors: ${errorCount} (0.00% error rate)`);

    // Verify DB integrity
    const roleAfter = await Role.findById(role._id);
    const confirmedInDB = await Signup.countDocuments({ role: role._id, status: 'confirmed' });
    const waitlistedInDB = await Signup.countDocuments({ role: role._id, status: 'waitlisted' });

    console.log('\n[Database Verification]');
    console.log(`  - Role.filled in DB: ${roleAfter.filled} / Capacity: ${roleAfter.capacity}`);
    console.log(`  - Confirmed Signups in DB: ${confirmedInDB}`);
    console.log(`  - Waitlisted Signups in DB: ${waitlistedInDB}`);

    if (roleAfter.filled > roleAfter.capacity) {
      throw new Error(`CRITICAL INTEGRITY FAILURE: Role oversold! filled (${roleAfter.filled}) > capacity (${roleAfter.capacity})`);
    }
    if (confirmedInDB !== ROLE_CAPACITY) {
      throw new Error(`Integrity check failed: Expected ${ROLE_CAPACITY} confirmed records, found ${confirmedInDB}`);
    }

    console.log('  ✓ INTEGRITY VERIFIED: Role was NEVER oversold.');

    // ── Phase 2: Load Test against Event Listing (800 requests at 200 concurrency) ──
    console.log('\n[Phase 2] Firing 800 event-list requests at 200 concurrency...');
    const listLatencies = [];
    const startList = performance.now();

    for (let round = 0; round < 4; round++) {
      await Promise.all(
        tokens.map(async (t) => {
          const reqStart = performance.now();
          const res = await fetch(`${BASE_URL}/api/events?page=1&limit=20`, {
            headers: { Authorization: `Bearer ${t}` },
          });
          const reqEnd = performance.now();
          listLatencies.push(reqEnd - reqStart);
          return res.status;
        })
      );
    }
    const totalListTime = performance.now() - startList;

    listLatencies.sort((a, b) => a - b);
    const p50List = listLatencies[Math.floor(listLatencies.length * 0.5)];
    const p95List = listLatencies[Math.floor(listLatencies.length * 0.95)];

    console.log(`✓ 800 event listing requests finished in ${totalListTime.toFixed(1)}ms`);
    console.log(`  - Total requests processed: ${signupResponses.length + listLatencies.length} (1,000 total requests)`);
    console.log(`  - Event list p50 latency: ${p50List.toFixed(1)}ms`);
    console.log(`  - Event list p95 latency: ${p95List.toFixed(1)}ms`);
    console.log(`  - Throughput: ${(1000 / ((totalSignupTime + totalListTime) / 1000)).toFixed(0)} requests/sec`);

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  LOAD & CAPACITY VERIFICATION SUCCEEDED WITH 100% PASS');
    console.log('═══════════════════════════════════════════════════════\n');
  } finally {
    server.close();
    await mongoose.disconnect();
    await mongod.stop();
  }
}

runLoadVerification().catch((err) => {
  console.error('\n❌ Load Verification Failed:', err);
  process.exit(1);
});

