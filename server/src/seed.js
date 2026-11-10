import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from './config/db.js';
import User from './models/User.js';
import Event from './models/Event.js';
import Role from './models/Role.js';
import Signup from './models/Signup.js';
import Payment from './models/Payment.js';
import Notification from './models/Notification.js';

export async function seedDatabase() {
  if (process.env.NODE_ENV === 'production' && process.env.FORCE_SEED !== 'true') {
    throw new Error('Refusing to seed database in production environment without FORCE_SEED=true.');
  }

  console.log('[Seed] Connecting to MongoDB...');
  await connectDB();

  console.log('[Seed] Clearing existing collections...');
  await User.deleteMany({});
  await Event.deleteMany({});
  await Role.deleteMany({});
  await Signup.deleteMany({});
  await Payment.deleteMany({});
  await Notification.deleteMany({});

  console.log('[Seed] Creating Admin account...');
  const rawAdminPassword = process.env.ADMIN_INITIAL_PASSWORD || 'admin123';
  const adminPasswordHash = await bcrypt.hash(rawAdminPassword, 12);
  const admin = await User.create({
    name: 'Club Lead (Admin)',
    phone: '9000000001',
    passwordHash: adminPasswordHash,
    role: 'admin',
    approved: true,
    upiId: 'admin@okaxis',
  });

  console.log('[Seed] Creating Sample Volunteers...');
  const volPasswordHash = await bcrypt.hash('vol123', 12);

  const volunteersData = [
    { name: 'Aarav Sharma', phone: '9876543210', upiId: 'aarav@okicici', approved: true },
    { name: 'Priya Patel', phone: '9876543211', upiId: 'priya@okhdfcbank', approved: true },
    { name: 'Rohan Verma', phone: '9876543212', upiId: 'rohan@paytm', approved: true },
    { name: 'Ananya Iyer', phone: '9876543213', upiId: 'ananya@oksbi', approved: true },
    { name: 'Kabir Mehta', phone: '9876543214', upiId: 'kabir@upi', approved: true },
    { name: 'Sneha Reddy', phone: '9876543215', upiId: 'sneha@ybl', approved: true },
    { name: 'Vikram Rao', phone: '9876543216', upiId: 'vikram@okaxis', approved: false }, // Pending approval
  ];

  const volunteers = await Promise.all(
    volunteersData.map((v) =>
      User.create({
        ...v,
        passwordHash: volPasswordHash,
        role: 'volunteer',
      })
    )
  );

  console.log('[Seed] Creating 20 Nov Example Event & Roles...');
  // 20 Nov, 7:30 AM to 4:30 PM, Palace Ground, Gayatri Vihar
  const eventDate = new Date();
  eventDate.setDate(eventDate.getDate() + 10); // 10 days in the future
  eventDate.setHours(0, 0, 0, 0);

  const exampleEvent = await Event.create({
    title: 'Bangalore Cultural Gala – Palace Ground',
    date: eventDate,
    startTime: '07:30',
    endTime: '16:30',
    venue: 'Palace Ground, Gayatri Vihar, Bengaluru',
    dressCode: 'Strict Formal',
    description: 'Flagship cultural conclave with 1,200 VIP attendees. Roles involve guest reception, VIP escorting, venue floor coordination, and stage management assistance.',
    createdBy: admin._id,
  });

  const hostessRole = await Role.create({
    event: exampleEvent._id,
    name: 'Hostess',
    capacity: 6,
    filled: 3, // 3 spots filled
    payAmount: 1500,
    dressCode: 'Formal Saree / Blazer',
  });

  const coordinatorRole = await Role.create({
    event: exampleEvent._id,
    name: 'Boy Coordinator',
    capacity: 9,
    filled: 4, // 4 spots filled
    payAmount: 800,
    dressCode: 'Formal Suit / White Shirt & Black Trousers',
  });

  // Seed signups for Hostess
  await Signup.create([
    { volunteer: volunteers[0]._id, role: hostessRole._id, event: exampleEvent._id, status: 'confirmed' },
    { volunteer: volunteers[1]._id, role: hostessRole._id, event: exampleEvent._id, status: 'confirmed' },
    { volunteer: volunteers[3]._id, role: hostessRole._id, event: exampleEvent._id, status: 'confirmed' },
  ]);

  // Seed signups for Coordinator
  await Signup.create([
    { volunteer: volunteers[2]._id, role: coordinatorRole._id, event: exampleEvent._id, status: 'confirmed' },
    { volunteer: volunteers[4]._id, role: coordinatorRole._id, event: exampleEvent._id, status: 'confirmed' },
    { volunteer: volunteers[5]._id, role: coordinatorRole._id, event: exampleEvent._id, status: 'confirmed' },
  ]);

  console.log('[Seed] Creating Past Event for Attendance & Ledger Demo...');
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 5);
  pastDate.setHours(0, 0, 0, 0);

  const pastEvent = await Event.create({
    title: 'National Startup Summit 2026',
    date: pastDate,
    startTime: '09:00',
    endTime: '18:00',
    venue: 'KTPO Whitefield, Bengaluru',
    dressCode: 'Business Formal',
    description: 'Annual entrepreneurship summit and showcase.',
    createdBy: admin._id,
  });

  const pastRole = await Role.create({
    event: pastEvent._id,
    name: 'Registration Executive',
    capacity: 10,
    filled: 2,
    payAmount: 1200,
    dressCode: 'Formal',
  });

  // Aarav attended and has pending payment
  const sAttended1 = await Signup.create({
    volunteer: volunteers[0]._id,
    role: pastRole._id,
    event: pastEvent._id,
    status: 'attended',
    checkedIn: true,
    checkedInAt: pastDate,
  });

  // Priya attended and was paid via UPI
  const sAttended2 = await Signup.create({
    volunteer: volunteers[1]._id,
    role: pastRole._id,
    event: pastEvent._id,
    status: 'attended',
    checkedIn: true,
    checkedInAt: pastDate,
  });

  await Payment.create({
    volunteer: volunteers[1]._id,
    amount: 1200,
    upiReference: 'UPI/20261105/9823412019',
    signups: [sAttended2._id],
    paidAt: new Date(pastDate.getTime() + 24 * 60 * 60 * 1000),
    recordedBy: admin._id,
  });

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  SEED COMPLETE!');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Admin Login:');
  console.log('    Phone:    9000000001');
  console.log('    Password: admin123');
  console.log('  Volunteer Logins (all password: vol123):');
  console.log('    Aarav:    9876543210 (Has ₹1,200 pending earnings)');
  console.log('    Priya:    9876543211 (Has ₹1,200 paid via UPI)');
  console.log('    Vikram:   9876543216 (Pending admin approval)');
  console.log('═══════════════════════════════════════════════════════\n');
}

// Allow direct CLI execution: node src/seed.js
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedDatabase()
    .then(async () => {
      await disconnectDB();
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed Error]', err);
      process.exit(1);
    });
}

