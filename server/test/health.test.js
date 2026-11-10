import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Set test mode BEFORE importing app so rate limiters are disabled
process.env.NODE_ENV = 'test';

import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';

async function runHealthCheckTest() {
  console.log('[Test] Connecting to database...');
  await connectDB();

  const PORT = 5055;
  const server = app.listen(PORT, async () => {
    console.log(`[Test] Server running on http://127.0.0.1:${PORT}`);
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/api/health`);
      const body = await response.json();
      console.log('[Test] Response status:', response.status);
      console.log('[Test] Response body:', JSON.stringify(body, null, 2));

      if (response.status === 200 && body.status === 'ok') {
        console.log('[Test] Health check PASSED successfully!');
      } else {
        console.error('[Test] Health check FAILED: Unexpected response');
        process.exitCode = 1;
      }
    } catch (err) {
      console.error('[Test] Fetch error:', err);
      process.exitCode = 1;
    } finally {
      server.close(async () => {
        await disconnectDB();
        console.log('[Test] Closed server and disconnected DB cleanly.');
      });
    }
  });
}

runHealthCheckTest().catch((err) => {
  console.error('[Test] Fatal test error:', err);
  process.exit(1);
});

