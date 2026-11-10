# VolunteerHub — Production Architecture & Operational Runbook

VolunteerHub is a full-stack MERN platform engineered for staffing and managing paid event volunteers in Bengaluru. It replaces unstructured messaging groups with atomic, concurrency-safe sign-ups, waitlist promotions, schedule conflict detection, attendance verification, encrypted UPI payout tracking, and cluster-safe scheduled reminders.

---

## 1. System Architecture

- **Client:** React 18, Vite, TailwindCSS. Communicates via authenticated REST JSON API with JWT Access Tokens and `httpOnly`, `SameSite=Strict`, `Secure` refresh cookies. Demo credentials are strictly guarded behind Vite's `import.meta.env.DEV` flag.
- **Server:** Node.js (v20 LTS), Express 4 (ES Modules).
  - **Security Layer:** Helmet (secure HTTP headers), dynamic CORS allowlist (`CLIENT_ORIGIN`), Express rate limiters, payload size limits (100kb), `express-mongo-sanitize` for NoSQL injection prevention, and Zod input validation schemas.
  - **Data Privacy & Cryptography:** AES-256-GCM symmetric encryption for UPI IDs at rest (`server/src/utils/crypto.js`). Password hashing with bcrypt cost factor 12. PII masking in JSON transforms.
  - **Concurrency & Transactions:** Document-level atomic check-and-write pattern via `Role.findOneAndUpdate({ _id, filled: { $lt: capacity } }, { $inc: { filled: 1 } })`. Multi-document cancellation and waitlist promotions execute within MongoDB Sessions (`withOptionalTransaction`).
  - **Distributed Jobs:** Cluster-wide atomic leases using `JobLock` collection with TTL indexes for 24h shift reminders, preventing duplicate messages across horizontal instances.
  - **Reliability:** Structured JSON logging via Pino with sensitive-path redaction, unhandled rejection traps, live database health check (`GET /health`), and graceful shutdown on SIGTERM/SIGINT.

---

## 2. Environment Variables Specification

Ensure all variables are populated in your hosting provider's secret manager (Render, Railway, or AWS):

| Variable | Description | Example / Format |
|---|---|---|
| `NODE_ENV` | Application environment mode | `production` |
| `PORT` | API server listening port | `5000` |
| `CLIENT_ORIGIN` | CORS allowed origins (comma-separated) | `https://volunteerhub.vercel.app` |
| `MONGODB_URI` | MongoDB Atlas Replica Set URI with credentials | `mongodb+srv://admin:pass@cluster0.mongodb.net/volunteerhub` |
| `JWT_SECRET` | Secret key for signing short-lived access tokens (1h) | 32+ character random alphanumeric string |
| `JWT_REFRESH_SECRET` | Secret key for signing refresh tokens | 32+ character random string (distinct from `JWT_SECRET`) |
| `JWT_EXPIRES_IN` | Access token lifespan | `1h` |
| `ENCRYPTION_KEY` | 256-bit AES key for UPI PII encryption | 64-character hexadecimal string |
| `LOG_LEVEL` | Pino logging threshold | `info` (or `debug` in staging) |
| `ADMIN_INITIAL_PASSWORD`| Initial bootstrap password for seed (optional) | Strong custom passphrase |

To generate the required keys securely:
```bash
# Generate 64-character hex ENCRYPTION_KEY:
node -e "console.log(crypto.randomBytes(32).toString('hex'))"

# Generate JWT_SECRET / JWT_REFRESH_SECRET:
node -e "console.log(crypto.randomBytes(32).toString('base64'))"
```

---

## 3. Local Development Setup

1. **Clone & Install Dependencies:**
   ```bash
   git clone <repo-url> volunteerhub
   cd volunteerhub
   npm install
   npm --prefix server install
   npm --prefix client install
   ```

2. **Configure Environment:**
   ```bash
   cp server/.env.example server/.env
   # Update variables in server/.env with development values
   ```

3. **Start Development Servers:**
   ```bash
   # Starts server (port 5000) and client (port 3000) concurrently:
   npm run dev
   ```

4. **Run Test Suites:**
   ```bash
   # Run all integration tests:
   node server/test/run_all.js

   # Run security suite:
   node server/test/security.test.js

   # Run 200-concurrent load verification:
   node server/test/load_verification.test.js
   ```

---

## 4. Production Deployment Guide

### A. Database (MongoDB Atlas)
1. Deploy an M0 or dedicated M10+ replica set cluster on MongoDB Atlas.
2. Under **Network Access**, whitelist your hosting provider's IP range or use `0.0.0.0/0` with strong SCRAM-SHA-256 database user credentials.
3. Enable automated daily backups in Atlas settings.

### B. Backend Deployment (Render / Railway)
1. Link the repository and set the root directory to `server/` (or use the provided multi-stage `server/Dockerfile`).
2. Set Environment Variables as outlined in the specification table.
3. Configure health check path to `/health`.
4. Deploy with HTTPS enabled.

### C. Frontend Deployment (Vercel / Netlify)
1. Configure root directory to `client/`.
2. Build command: `npm run build`. Output directory: `dist`.
3. Set environment variable:
   - `VITE_API_URL`: Your live backend HTTPS URL (e.g., `https://volunteerhub-api.onrender.com`).
4. Update `CLIENT_ORIGIN` on the backend to match the assigned Vercel domain.

---

## 5. First Admin Account Bootstrap

If starting on a clean production database:
1. Register a user via the registration screen with phone (e.g. `9000000001`).
2. In MongoDB Atlas Data Explorer, locate the user document in the `users` collection and set:
   ```json
   {
     "role": "admin",
     "approved": true
   }
   ```
3. Alternatively, supply `ADMIN_INITIAL_PASSWORD=your_pass` and run `FORCE_SEED=true node src/seed.js` once during initial maintenance window.

---

## 6. Operational Runbook & Incident Management

### Incident 1: Database Connection Failure (`MongooseServerSelectionError`)
- **Symptoms:** `/health` returns `503 degraded`, requests return 500.
- **Diagnostic:** Check Atlas cluster status; check if hosting outbound IP was blocked by Atlas IP Access List; verify DNS resolution of `mongodb+srv://`.
- **Mitigation:** Add hosting egress IPs to Atlas Network Access; verify cluster metrics are below memory/connection limits.

### Incident 2: High Contention & Waitlist Spikes
- **Symptoms:** High load of volunteers attempting simultaneous sign-ups.
- **Assurance:** The atomic findOneAndUpdate pattern prevents overselling. Unallocated volunteers are placed on sequential waitlist positions.
- **Action:** Monitor `Role.filled` vs `Role.capacity` in MongoDB. If admin increases role capacity via `PUT /api/events/:eventId/roles/:roleId`, volunteers are automatically promoted in order.

### Incident 3: Stale Distributed Lock (`JobLock`)
- **Symptoms:** Scheduled 24h reminders stop running across instances.
- **Diagnostic:** Check `joblocks` collection in MongoDB for `shift_24h_reminder`.
- **Mitigation:** Locks feature a self-expiring TTL index (10 minutes). To immediately release, execute `db.joblocks.deleteOne({ jobName: 'shift_24h_reminder' })`.

### Incident 4: Right to Erasure / Account Anonymization Request
- **Protocol:** When a volunteer exercises their right under India's DPDP Act, 2023, an authorized administrator triggers `DELETE /api/admin/volunteers/:userId/anonymize`.
- **Outcome:** Name is scrubbed, phone number is masked, UPI ID is purged, account is locked, while past shift records in ledger remain intact for legal tax and payout audits.
