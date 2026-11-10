/**
 * Auth Integration Test
 * Tests registration, login, /me, approval flow, and middleware guards
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Set test mode BEFORE importing app so rate limiters are disabled
process.env.NODE_ENV = 'test';

import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import User from '../src/models/User.js';

const PORT = 5056;
let server;
let baseUrl;

async function request(method, path, body = null, token = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
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

async function run() {
  console.log('[Auth Test] Connecting to database...');
  await connectDB();

  // Clear users from previous test runs
  await User.deleteMany({});

  server = app.listen(PORT, async () => {
    baseUrl = `http://127.0.0.1:${PORT}`;
    console.log(`[Auth Test] Server on ${baseUrl}\n`);

    try {
      // --- Test 1: Register a volunteer ---
      console.log('1. Register a volunteer');
      const reg = await request('POST', '/api/auth/register', {
        name: 'Aarav Sharma',
        phone: '9876543210',
        password: 'test1234',
        upiId: 'aarav@upi',
      });
      assert(reg.status === 201, 'Registration returns 201');
      assert(reg.data.token, 'Token is returned');
      assert(reg.data.user.approved === false, 'New volunteer is NOT approved');
      assert(reg.data.user.role === 'volunteer', 'Role is volunteer');
      const volunteerToken = reg.data.token;
      const volunteerId = reg.data.user._id;

      // --- Test 2: Duplicate phone rejected ---
      console.log('\n2. Duplicate phone number');
      const dup = await request('POST', '/api/auth/register', {
        name: 'Another Aarav',
        phone: '9876543210',
        password: 'test5678',
      });
      assert(dup.status === 409, 'Duplicate phone returns 409');

      // --- Test 3: Login ---
      console.log('\n3. Login with correct credentials');
      const login = await request('POST', '/api/auth/login', {
        phone: '9876543210',
        password: 'test1234',
      });
      assert(login.status === 200, 'Login returns 200');
      assert(login.data.token, 'Login returns a token');

      // --- Test 4: Login with wrong password ---
      console.log('\n4. Login with wrong password');
      const badLogin = await request('POST', '/api/auth/login', {
        phone: '9876543210',
        password: 'wrongpass',
      });
      assert(badLogin.status === 401, 'Wrong password returns 401');

      // --- Test 5: /me endpoint ---
      console.log('\n5. GET /me with valid token');
      const me = await request('GET', '/api/auth/me', null, volunteerToken);
      assert(me.status === 200, '/me returns 200');
      assert(me.data.user.name === 'Aarav Sharma', '/me returns correct user');

      // --- Test 6: /me without token ---
      console.log('\n6. GET /me without token');
      const noToken = await request('GET', '/api/auth/me');
      assert(noToken.status === 401, 'No token returns 401');

      // --- Test 7: Admin endpoints require admin role ---
      console.log('\n7. Volunteer cannot access admin endpoints');
      const adminGuard = await request('GET', '/api/admin/pending-approvals', null, volunteerToken);
      assert(adminGuard.status === 403, 'Volunteer gets 403 on admin route');

      // --- Test 8: Create an admin and approve the volunteer ---
      console.log('\n8. Admin approval flow');
      // Create admin directly in DB (in production, first user would be seeded)
      const bcrypt = await import('bcryptjs');
      const adminHash = await bcrypt.default.hash('admin123', 10);
      await User.create({
        name: 'Admin User',
        phone: '9000000001',
        passwordHash: adminHash,
        role: 'admin',
        approved: true,
      });

      const adminLogin = await request('POST', '/api/auth/login', {
        phone: '9000000001',
        password: 'admin123',
      });
      assert(adminLogin.status === 200, 'Admin login succeeds');
      const adminToken = adminLogin.data.token;

      // Get pending approvals
      const pending = await request('GET', '/api/admin/pending-approvals', null, adminToken);
      assert(pending.status === 200, 'Admin can list pending approvals');
      assert(pending.data.users.length === 1, 'One volunteer pending');

      // Approve the volunteer
      const approve = await request('PATCH', `/api/admin/approve/${volunteerId}`, {}, adminToken);
      assert(approve.status === 200, 'Approval succeeds');
      assert(approve.data.user.approved === true, 'Volunteer is now approved');

      // Verify via /me
      const meAfterApproval = await request('GET', '/api/auth/me', null, volunteerToken);
      assert(meAfterApproval.data.user.approved === true, 'Volunteer sees approved:true via /me');

      console.log('\n--- All auth tests passed! ---');
    } catch (err) {
      console.error('\n[Auth Test] Error:', err);
      process.exitCode = 1;
    } finally {
      server.close(async () => {
        await disconnectDB();
        console.log('[Auth Test] Cleaned up.');
      });
    }
  });
}

run().catch((err) => {
  console.error('[Auth Test] Fatal:', err);
  process.exit(1);
});
