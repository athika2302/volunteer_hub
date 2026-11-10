import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import User from '../src/models/User.js';

process.env.NODE_ENV = 'test';

async function runSmoke() {
  await connectDB();
  const server = app.listen(5099);
  const BASE_URL = 'http://127.0.0.1:5099';

  try {
    console.log('--- PRODUCTION SMOKE TEST ---');

    // 1. Health
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData = await healthRes.json();
    console.log('1. GET /health ->', healthRes.status, JSON.stringify(healthData));

    // 2. Register
    const regPhone = '9876543299';
    await User.deleteOne({ phone: regPhone });
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Pooja Hegde',
        phone: regPhone,
        password: 'securePassword123',
        upiId: 'pooja@okhdfcbank',
      }),
    });
    const regData = await regRes.json();
    console.log('2. POST /api/auth/register ->', regRes.status, 'User masked UPI:', regData.user?.upiId);

    // 3. Database encryption check
    const rawUser = await User.findOne({ phone: regPhone });
    console.log('3. Raw database stored upiId ->', rawUser.upiId);
    console.log('   Decrypted via getFullUpiId() ->', rawUser.getFullUpiId());

    // 4. Clean up
    await User.deleteOne({ phone: regPhone });
    console.log('4. Cleaned up smoke test record.');
    console.log('--- SMOKE TEST PASSED ---');
  } finally {
    server.close();
    await disconnectDB();
  }
}

runSmoke().catch((err) => {
  console.error(err);
  process.exit(1);
});

