import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

process.env.NODE_ENV = 'test';

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from '../src/models/User.js';
import Event from '../src/models/Event.js';
import Role from '../src/models/Role.js';
import Signup from '../src/models/Signup.js';
import Payment from '../src/models/Payment.js';
import { getVolunteerLedger, recordPayment } from '../src/services/ledger.service.js';

async function testLedgerCalculation() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  LEDGER CALCULATION VERIFICATION TEST');
  console.log('═══════════════════════════════════════════════════════\n');

  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  try {
    // 1. Create volunteer and admin
    const volunteer = await User.create({
      name: 'Ledger Test Volunteer',
      phone: '9900001111',
      passwordHash: 'dummyhash',
      role: 'volunteer',
      approved: true,
      upiId: 'ledger_vol@okhdfc',
    });

    const admin = await User.create({
      name: 'Ledger Test Admin',
      phone: '9900002222',
      passwordHash: 'dummyhash',
      role: 'admin',
      approved: true,
      upiId: 'ledger_admin@okaxis',
    });

    // 2. Create Event and Role with payAmount ₹1,200
    const event = await Event.create({
      title: 'Ledger Conclave Event',
      date: new Date('2026-11-20'),
      startTime: '09:00',
      endTime: '17:00',
      venue: 'Palace Grounds, Bengaluru',
      createdBy: admin._id,
    });

    const ROLE_PAY = 1200;
    const role = await Role.create({
      event: event._id,
      name: 'Event Coordinator',
      capacity: 5,
      payAmount: ROLE_PAY,
    });

    // 3. Create ONE attended signup
    const signup = await Signup.create({
      volunteer: volunteer._id,
      role: role._id,
      event: event._id,
      status: 'attended',
    });

    console.log('[Step 1] Attended shift created with role pay ₹1,200.');

    // 4. Check initial ledger
    let ledger = await getVolunteerLedger(volunteer._id);
    console.log(`Initial Ledger Check:`);
    console.log(`  - Total Earned: ₹${ledger.totalEarned}`);
    console.log(`  - Pending Amount: ₹${ledger.pendingAmount}`);
    console.log(`  - Total Paid: ₹${ledger.totalPaid}`);

    if (ledger.pendingAmount !== 1200) {
      throw new Error(`Expected pending amount ₹1,200, but got ₹${ledger.pendingAmount}`);
    }
    if (ledger.totalPaid !== 0) {
      throw new Error(`Expected paid amount ₹0, but got ₹${ledger.totalPaid}`);
    }
    console.log('✓ ASSERTION PASSED: Pending equals ₹1,200 before payment.\n');

    // 5. Record payment of ₹1,200
    console.log('[Step 2] Recording payment of ₹1,200 with UPI reference...');
    await recordPayment({
      adminId: admin._id,
      volunteerId: volunteer._id,
      amount: 1200,
      upiReference: 'UPI/TEST/20261110/1200',
      signupIds: [signup._id.toString()],
    });

    // 6. Check updated ledger
    ledger = await getVolunteerLedger(volunteer._id);
    console.log(`Post-Payment Ledger Check:`);
    console.log(`  - Total Earned: ₹${ledger.totalEarned}`);
    console.log(`  - Pending Amount: ₹${ledger.pendingAmount}`);
    console.log(`  - Total Paid: ₹${ledger.totalPaid}`);

    if (ledger.pendingAmount !== 0) {
      throw new Error(`Expected pending amount ₹0, but got ₹${ledger.pendingAmount}`);
    }
    if (ledger.totalPaid !== 1200) {
      throw new Error(`Expected paid amount ₹1,200, but got ₹${ledger.totalPaid}`);
    }
    console.log('✓ ASSERTION PASSED: Pending equals ₹0 and Paid equals ₹1,200 after payment.\n');

    console.log('═══════════════════════════════════════════════════════');
    console.log('  LEDGER TEST RESULT: 100% SUCCESS');
    console.log('═══════════════════════════════════════════════════════\n');
  } finally {
    await mongoose.disconnect();
    await mongod.stop();
  }
}

testLedgerCalculation().catch((err) => {
  console.error('Ledger Test Error:', err);
  process.exit(1);
});
