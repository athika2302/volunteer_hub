import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Resolve .env relative to the server directory, not the CWD
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

let mongodInstance = null;

/**
 * Connect to MongoDB with automatic local memory fallback for seamless local development
 */
export async function connectDB() {
  const targetUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/volunteerhub';

  try {
    // Attempt standard connection first with a 3-second timeout
    await mongoose.connect(targetUri, {
      serverSelectionTimeoutMS: 3000,
    });
    console.log(`[Database] Connected successfully to MongoDB at ${targetUri}`);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[Database] Could not reach external MongoDB (${err.message}). Starting in-memory MongoDB instance...`);
      try {
        const { MongoMemoryServer } = await import('mongodb-memory-server');
        mongodInstance = await MongoMemoryServer.create();
        const memoryUri = mongodInstance.getUri();
        await mongoose.connect(memoryUri);
        console.log(`[Database] In-memory MongoDB started and connected at: ${memoryUri}`);
      } catch (memErr) {
        console.error('[Database] Failed to start in-memory MongoDB:', memErr);
        throw memErr;
      }
    } else {
      console.error('[Database] MongoDB connection failed in production:', err);
      throw err;
    }
  }

  mongoose.connection.on('error', (err) => {
    console.error('[Database] Runtime connection error:', err);
  });
}

/**
 * Disconnect from MongoDB and stop memory instance if active
 */
export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongodInstance) {
    await mongodInstance.stop();
    mongodInstance = null;
  }
  console.log('[Database] Disconnected from MongoDB');
}

