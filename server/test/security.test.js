import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

import app from '../src/app.js';
import User from '../src/models/User.js';
import { encrypt, decrypt, maskUpi } from '../src/utils/crypto.js';

let mongod;
let server;
let baseUrl;
const TEST_PORT = 5090;

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.CLIENT_ORIGIN = 'http://localhost:3000,http://test-allowed.com';
  process.env.JWT_SECRET = 'test_jwt_secret_key_1234567890123456';
  process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret_key_1234567890123456';
  process.env.ENCRYPTION_KEY = 'c4a8b79e20561e1b5f63d08a98f1a14b3d7e52a92c4b8e612f0a5d4e3b2c1a0f';

  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  await new Promise((resolve) => {
    server = app.listen(TEST_PORT, () => {
      baseUrl = `http://127.0.0.1:${TEST_PORT}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) await new Promise((res) => server.close(res));
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe('Step 2: Security Hardening Verification', () => {
  it('1. Helmet sets secure HTTP headers (X-Content-Type-Options, etc.)', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(res.headers.get('x-dns-prefetch-control') !== null);
  });

  it('2. CORS blocks unauthorized external origins', async () => {
    const res = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'http://malicious-attacker.com' },
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.ok(body.error.includes('CORS'));
  });

  it('3. CORS allows configured CLIENT_ORIGIN', async () => {
    const res = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'http://test-allowed.com' },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://test-allowed.com');
  });

  it('4. Zod schema validation blocks invalid registration input', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'A', // too short (< 2)
        phone: '12345', // invalid phone
        password: '123', // too short (< 6)
      }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes('Name must be at least 2 characters'));
  });

  it('5. Registration hashes password with cost factor 12 and encrypts UPI ID at rest', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Security Test Volunteer',
        phone: '9888877777',
        password: 'securePassword123',
        upiId: 'security@okhdfcbank',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();

    // Sensitive field checks in response:
    assert.equal(body.user.passwordHash, undefined, 'passwordHash must never be exposed');
    assert.equal(body.user.upiId, 'se***@okhdfcbank', 'UPI ID must be masked in response');

    // Verify refresh token cookie
    const cookieHeader = res.headers.get('set-cookie');
    assert.ok(cookieHeader, 'Set-Cookie header must be present');
    assert.ok(cookieHeader.includes('HttpOnly'), 'Cookie must be HttpOnly');

    // Verify stored database record:
    const rawUser = await User.findOne({ phone: '9888877777' }).select('+passwordHash');
    assert.ok(rawUser, 'User must exist in DB');

    // Verify bcrypt cost factor is 12 ($2a$12$ or $2b$12$)
    assert.ok(rawUser.passwordHash.startsWith('$2a$12$') || rawUser.passwordHash.startsWith('$2b$12$'));

    // Verify raw UPI ID in DB is stored in ciphertext format (iv:tag:cipher)
    assert.ok(rawUser.upiId.includes(':'), 'Stored UPI ID must be ciphertext');
    assert.notEqual(rawUser.upiId, 'security@okhdfcbank');

    // Verify decryption restores original value
    const decrypted = rawUser.getFullUpiId();
    assert.equal(decrypted, 'security@okhdfcbank');
  });

  it('6. Refresh endpoint exchanges valid cookie for new access token', async () => {
    // 1. Login to get cookies
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '9888877777',
        password: 'securePassword123',
      }),
    });
    assert.equal(loginRes.status, 200);
    const cookie = loginRes.headers.get('set-cookie');
    const refreshCookie = cookie.split(';')[0]; // refreshToken=...

    // 2. Call refresh
    const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        Cookie: refreshCookie,
      },
    });
    assert.equal(refreshRes.status, 200);
    const refreshBody = await refreshRes.json();
    assert.ok(refreshBody.token, 'Must return new access token');
    assert.equal(refreshBody.user.phone, '9888877777');
  });

  it('7. Body parser enforces 100kb payload ceiling', async () => {
    const hugePayload = 'A'.repeat(120 * 1024); // 120 KB
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: hugePayload }),
    });
    assert.equal(res.status, 413); // Payload Too Large
  });

  it('8. Crypto utility maskUpi masks handles safely', () => {
    assert.equal(maskUpi('aarav@okicici'), 'aa***@okicici');
    assert.equal(maskUpi('a@paytm'), 'a***@paytm');
    assert.equal(maskUpi(''), '');
  });
});

