import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import app from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { initReminderCron } from './services/reminder.service.js';
import { logger } from './utils/logger.js';

// Resolve .env relative to the server directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { validateEnv } from './config/env.js';
validateEnv();

const PORT = process.env.PORT || 5000;

// Catch unhandled rejections and uncaught exceptions to fail cleanly
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception detected. Exiting process...');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ reason, promise }, 'Unhandled promise rejection detected. Exiting process...');
  process.exit(1);
});

async function bootstrap() {
  try {
    // 1. Establish database connection
    await connectDB();

    // 2. Auto-seed if database is empty (ensures demo data is always available in dev)
    const { default: User } = await import('./models/User.js');
    const userCount = await User.countDocuments();
    if (userCount === 0 && process.env.NODE_ENV !== 'production') {
      logger.info('Database is empty. Seeding initial demo data...');
      const { seedDatabase } = await import('./seed.js');
      await seedDatabase();
    }

    // 3. Initialize background jobs
    initReminderCron();

    // 4. Start HTTP server
    const server = app.listen(PORT, () => {
      logger.info({ port: PORT }, `VolunteerHub API running on port ${PORT}`);
    });

    // Graceful shutdown handling
    let isShuttingDown = false;
    const shutdown = (signal) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      logger.info({ signal }, `Received ${signal}. Shutting down gracefully...`);

      // Force exit if graceful shutdown hangs
      const forceExitTimer = setTimeout(() => {
        logger.error('Graceful shutdown timed out (10s). Forcing process exit.');
        process.exit(1);
      }, 10000);
      forceExitTimer.unref();

      server.close(async () => {
        logger.info('HTTP server closed. Finishing in-flight requests and closing MongoDB connection...');
        try {
          await disconnectDB();
          logger.info('MongoDB connection closed cleanly. Exiting.');
          process.exit(0);
        } catch (dbErr) {
          logger.error({ err: dbErr }, 'Error closing MongoDB during shutdown.');
          process.exit(1);
        }
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    logger.fatal({ err: error }, 'Fatal bootstrap error');
    process.exit(1);
  }
}

bootstrap();

