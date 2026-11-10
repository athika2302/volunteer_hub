import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import { pinoHttp } from 'pino-http';
import mongoose from 'mongoose';
import crypto from 'crypto';

import { logger } from './utils/logger.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import eventRoutes from './routes/event.routes.js';
import signupRoutes from './routes/signup.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import ledgerRoutes from './routes/ledger.routes.js';
import checkinRoutes from './routes/checkin.routes.js';

const app = express();

// 0. Structured HTTP Logging with pino-http
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.headers['x-request-id'] || crypto.randomUUID(),
    autoLogging: {
      ignore: (req) => req.url === '/health' || req.url === '/api/health' || process.env.NODE_ENV === 'test',
    },
    customProps: (req) => ({
      requestId: req.id,
    }),
  })
);

// 1. HTTP Security Headers with Helmet
app.use(helmet());

// 2. Strict CORS allowlist from CLIENT_ORIGIN (evaluated dynamically)
function getAllowedOrigins() {
  return process.env.CLIENT_ORIGIN
    ? process.env.CLIENT_ORIGIN.split(',').map((o) => o.trim())
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173'];
}

app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = getAllowedOrigins();
      // Allow non-browser requests (mobile apps, curl, server-to-server) or matching origins
      if (!origin || allowed.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('CORS policy: Origin not allowed'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// 3. Body parsers with payload size limits (prevents payload DoS)
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// 4. Cookie parser for httpOnly refresh tokens
app.use(cookieParser());

// 5. Sanitize against MongoDB Operator / NoSQL Injection ($gt, $ne, etc.)
app.use(mongoSanitize());

// 6. Global API Rate Limiter
app.use('/api', apiLimiter);

// 7. Health check endpoint (lightweight, verifies DB connection & uptime)
const healthHandler = (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  const isHealthy = dbState === 1;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    app: 'VolunteerHub API',
    uptime: process.uptime(),
    database: {
      status: dbStatusMap[dbState] || 'unknown',
      connected: isHealthy,
    },
    timestamp: new Date().toISOString(),
  });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// 8. Mount route modules
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/signups', signupRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/checkin', checkinRoutes);

// 9. Centralized Error Handling Middleware (No Stack Traces or DB Leaks)
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  // Log error via pino
  if (req.log) {
    req.log.error({ err, status, url: req.originalUrl, method: req.method }, err.message);
  } else {
    logger.error({ err, status, url: req.originalUrl, method: req.method }, err.message);
  }

  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({ error: err.message, code: 'CORS_ERROR' });
  }

  if (err.name === 'ZodError') {
    const messages = (err.issues || []).map((e) => `${e.path.join('.') || 'field'}: ${e.message}`);
    return res.status(400).json({ error: messages.join('; '), code: 'VALIDATION_ERROR' });
  }

  // Mask internal 500 server errors in production to avoid leaking implementation details
  const message =
    status === 500 && isProduction
      ? 'An unexpected error occurred. Please try again later.'
      : err.message || 'Internal Server Error';

  res.status(status).json({
    error: message,
    code: err.code || (status === 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR'),
  });
});

export default app;
