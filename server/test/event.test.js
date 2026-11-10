/**
 * Event & Role CRUD Integration Test
 * Tests: create event with roles, read, update, delete, validation guards
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

const PORT = 5057;
let baseUrl;
let server;
let adminToken;
let volunteerToken;

async function request(method, path, body = null, token = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${baseUrl}${path}`, opts);
  const data = await res.json();
  return { status: res.status, data };
}

function assert(condition, label) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${label}`);
    process.exitCode = 1;
  } else {
    console.log(`  ✓ ${label}`);
  }
}

async function setup() {
  await connectDB();
  await User.deleteMany({});
  await Event.deleteMany({});
  await Role.deleteMany({});

  const hash = await bcrypt.hash('admin123', 10);
  await User.create({ name: 'Admin', phone: '9000000001', passwordHash: hash, role: 'admin', approved: true });

  const vhash = await bcrypt.hash('vol123', 10);
  await User.create({ name: 'Volunteer', phone: '9000000002', passwordHash: vhash, role: 'volunteer', approved: true });

  // Wait for server to fully start before proceeding
  await new Promise((resolve) => {
    server = app.listen(PORT, resolve);
  });
  baseUrl = `http://127.0.0.1:${PORT}`;

  const aRes = await request('POST', '/api/auth/login', { phone: '9000000001', password: 'admin123' });
  adminToken = aRes.data.token;
  const vRes = await request('POST', '/api/auth/login', { phone: '9000000002', password: 'vol123' });
  volunteerToken = vRes.data.token;
}

async function run() {
  console.log('[Event Test] Setting up...');
  await setup();
  console.log(`[Event Test] Server on ${baseUrl}\n`);

  try {
    // --- 1. Create event with roles ---
    console.log('1. Create event with two roles (admin)');
    const create = await request('POST', '/api/events', {
      title: 'Palace Ground – Gayatri Vihar',
      date: '2026-11-20',
      startTime: '07:30',
      endTime: '16:30',
      venue: 'Palace Ground, Bengaluru',
      dressCode: 'Formal',
      description: 'Annual cultural event',
      roles: [
        { name: 'Hostess', capacity: 6, payAmount: 1500, dressCode: 'Formal' },
        { name: 'Boy Coordinator', capacity: 9, payAmount: 800, dressCode: 'Formal' },
      ],
    }, adminToken);
    assert(create.status === 201, 'Event created (201)');
    assert(create.data.roles.length === 2, 'Two roles created');
    assert(create.data.roles[0].filled === 0, 'filled starts at 0');
    assert(create.data.roles[0].capacity === 6, 'Hostess capacity is 6');
    assert(create.data.roles[1].payAmount === 800, 'Coordinator pay is 800');
    const eventId = create.data.event._id;
    const hostessRoleId = create.data.roles[0]._id;

    // --- 2. Validation: endTime before startTime ---
    console.log('\n2. Reject event where endTime <= startTime');
    const badTime = await request('POST', '/api/events', {
      title: 'Bad Times Event',
      date: '2026-11-25',
      startTime: '16:00',
      endTime: '08:00',
      venue: 'Somewhere',
      createdBy: 'dummy',
    }, adminToken);
    assert(badTime.status === 400, 'Bad end time rejected (400)');

    // --- 3. Validation: capacity must be positive integer ---
    console.log('\n3. Reject role with invalid capacity');
    const badCap = await request('POST', `/api/events/${eventId}/roles`, {
      name: 'Bad Role',
      capacity: -1,
      payAmount: 500,
    }, adminToken);
    assert(badCap.status === 400, 'Negative capacity rejected (400)');

    const decimalCap = await request('POST', `/api/events/${eventId}/roles`, {
      name: 'Decimal Role',
      capacity: 2.5,
      payAmount: 500,
    }, adminToken);
    assert(decimalCap.status === 400, 'Decimal capacity rejected (400)');

    // --- 4. Read event list (volunteer) ---
    console.log('\n4. Volunteer reads event list');
    const list = await request('GET', '/api/events', null, volunteerToken);
    assert(list.status === 200, 'Events list returns 200');
    assert(list.data.events.length === 1, 'One event in list');
    assert(list.data.events[0].roles.length === 2, 'Roles are populated on event');

    // --- 5. Read single event ---
    console.log('\n5. Read single event by ID');
    const single = await request('GET', `/api/events/${eventId}`, null, volunteerToken);
    assert(single.status === 200, 'Single event returns 200');
    assert(single.data.event.title === 'Palace Ground – Gayatri Vihar', 'Title correct');

    // --- 6. Update event ---
    console.log('\n6. Admin updates event description');
    const update = await request('PUT', `/api/events/${eventId}`, {
      title: 'Palace Ground – Gayatri Vihar (Updated)',
      date: '2026-11-20',
      startTime: '07:30',
      endTime: '16:30',
      venue: 'Palace Ground, Bengaluru',
      description: 'Updated description',
    }, adminToken);
    assert(update.status === 200, 'Update returns 200');
    assert(update.data.event.description === 'Updated description', 'Description updated');

    // --- 7. Update role ---
    console.log('\n7. Admin updates hostess role capacity');
    const roleUpdate = await request('PUT', `/api/events/${eventId}/roles/${hostessRoleId}`, {
      name: 'Hostess',
      capacity: 8,
      payAmount: 1500,
    }, adminToken);
    assert(roleUpdate.status === 200, 'Role update returns 200');
    assert(roleUpdate.data.role.capacity === 8, 'Capacity updated to 8');

    // --- 8. Volunteer cannot create/delete events ---
    console.log('\n8. Volunteer cannot create events');
    const volCreate = await request('POST', '/api/events', {
      title: 'Sneaky Event',
      date: '2026-12-01',
      startTime: '09:00',
      endTime: '17:00',
      venue: 'Nowhere',
    }, volunteerToken);
    assert(volCreate.status === 403, 'Volunteer gets 403 on create');

    // --- 9. Delete event ---
    console.log('\n9. Admin deletes event (cascades roles)');
    const del = await request('DELETE', `/api/events/${eventId}`, null, adminToken);
    assert(del.status === 200, 'Delete returns 200');

    const afterDelete = await request('GET', `/api/events/${eventId}`, null, adminToken);
    assert(afterDelete.status === 404, 'Deleted event returns 404');

    const orphanRoles = await Role.find({ event: eventId });
    assert(orphanRoles.length === 0, 'Roles cascade-deleted with event');

    console.log('\n--- All event CRUD tests passed! ---');
  } catch (err) {
    console.error('\n[Event Test] Error:', err);
    process.exitCode = 1;
  } finally {
    server.close(async () => {
      await disconnectDB();
      console.log('[Event Test] Cleaned up.');
    });
  }
}

run().catch((err) => {
  console.error('[Event Test] Fatal:', err);
  process.exit(1);
});
