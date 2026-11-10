import { Router } from 'express';
import Event from '../models/Event.js';
import Role from '../models/Role.js';
import { requireAuth, requireAdmin, requireApproved } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createEventSchema, updateEventSchema, roleSchema } from '../validators/schemas.js';

const router = Router();

// All event routes require authentication
router.use(requireAuth);

// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Validate role data before creating or updating.
 * Returns an error string or null if valid.
 */
function validateRoleData({ name, capacity, payAmount }) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    return 'Role name is required';
  }
  if (!Number.isInteger(Number(capacity)) || Number(capacity) < 1) {
    return 'Capacity must be a positive whole number';
  }
  if (payAmount === undefined || isNaN(Number(payAmount)) || Number(payAmount) < 0) {
    return 'Pay amount must be a non-negative number';
  }
  return null;
}

// ─── Event CRUD ──────────────────────────────────────────────────────────────

/**
 * GET /api/events
 * Returns paginated events (with their roles populated) sorted by date ascending.
 * Both volunteers (approved) and admins can view events.
 * Query params: page (default 1), limit (default 20, max 50)
 */
router.get('/', requireApproved, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      Event.find()
        .populate('roles')
        .sort({ date: 1, startTime: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Event.countDocuments(),
    ]);

    res.json({
      events,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/events/:id
 * Returns a single event with its roles.
 */
router.get('/:id', requireApproved, async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id).populate('roles').lean();
    if (!event) return res.status(404).json({ error: 'Event not found.' });
    res.json({ event });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/events
 * Admin only: creates a new event along with its roles in one request.
 * Body: { title, date, startTime, endTime, venue, dressCode, description, roles: [...] }
 */
router.post('/', requireAdmin, validate(createEventSchema), async (req, res, next) => {
  try {
    const { title, date, startTime, endTime, venue, dressCode, description, roles = [] } = req.body;

    // Create the event first
    const event = await Event.create({
      title,
      date,
      startTime,
      endTime,
      venue,
      dressCode,
      description,
      createdBy: req.user._id,
    });

    // Create all roles if provided, rolling back event if any role is invalid
    const createdRoles = [];
    for (const roleData of roles) {
      const validationError = validateRoleData(roleData);
      if (validationError) {
        // Clean up the event we just created
        await Event.findByIdAndDelete(event._id);
        return res.status(400).json({ error: `Role validation failed: ${validationError}` });
      }
      const role = await Role.create({
        event: event._id,
        name: roleData.name,
        capacity: Number(roleData.capacity),
        payAmount: Number(roleData.payAmount),
        dressCode: roleData.dressCode || '',
      });
      createdRoles.push(role);
    }

    res.status(201).json({ event, roles: createdRoles });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ error: messages.join(' ') });
    }
    next(err);
  }
});

/**
 * PUT /api/events/:id
 * Admin only: update event details (not roles — use role-specific endpoints).
 */
router.put('/:id', requireAdmin, validate(updateEventSchema), async (req, res, next) => {
  try {
    const { title, date, startTime, endTime, venue, dressCode, description } = req.body;

    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { title, date, startTime, endTime, venue, dressCode, description },
      { new: true, runValidators: true }
    ).populate('roles');

    if (!event) return res.status(404).json({ error: 'Event not found.' });
    res.json({ event });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ error: messages.join(' ') });
    }
    next(err);
  }
});

/**
 * DELETE /api/events/:id
 * Admin only: deletes the event and all its roles.
 * Note: in production you'd also want to cancel any active signups.
 */
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    // Cascade delete all roles belonging to this event
    await Role.deleteMany({ event: req.params.id });

    res.json({ message: 'Event and its roles have been deleted.' });
  } catch (err) {
    next(err);
  }
});

// ─── Role CRUD ───────────────────────────────────────────────────────────────

/**
 * POST /api/events/:eventId/roles
 * Admin only: add a new role to an existing event.
 */
router.post('/:eventId/roles', requireAdmin, validate(roleSchema), async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    const validationError = validateRoleData(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    const role = await Role.create({
      event: req.params.eventId,
      name: req.body.name,
      capacity: Number(req.body.capacity),
      payAmount: Number(req.body.payAmount),
      dressCode: req.body.dressCode || '',
    });

    res.status(201).json({ role });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ error: messages.join(' ') });
    }
    next(err);
  }
});

/**
 * PUT /api/events/:eventId/roles/:roleId
 * Admin only: update a role (name, capacity, pay, dress code).
 * Note: capacity cannot be reduced below the current filled count.
 */
router.put('/:eventId/roles/:roleId', requireAdmin, validate(roleSchema.partial()), async (req, res, next) => {
  try {
    const role = await Role.findOne({ _id: req.params.roleId, event: req.params.eventId });
    if (!role) return res.status(404).json({ error: 'Role not found.' });

    const { name, capacity, payAmount, dressCode } = req.body;

    // Guard: cannot reduce capacity below the number already filled
    if (capacity !== undefined && Number(capacity) < role.filled) {
      return res.status(400).json({
        error: `Cannot reduce capacity to ${capacity}; ${role.filled} spots are already filled.`,
      });
    }

    const validationError = validateRoleData({ name: name ?? role.name, capacity: capacity ?? role.capacity, payAmount: payAmount ?? role.payAmount });
    if (validationError) return res.status(400).json({ error: validationError });

    role.name = name ?? role.name;
    role.capacity = capacity !== undefined ? Number(capacity) : role.capacity;
    role.payAmount = payAmount !== undefined ? Number(payAmount) : role.payAmount;
    role.dressCode = dressCode !== undefined ? dressCode : role.dressCode;
    await role.save();

    res.json({ role });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/events/:eventId/roles/:roleId
 * Admin only: remove a role from an event.
 */
router.delete('/:eventId/roles/:roleId', requireAdmin, async (req, res, next) => {
  try {
    const role = await Role.findOneAndDelete({
      _id: req.params.roleId,
      event: req.params.eventId,
    });
    if (!role) return res.status(404).json({ error: 'Role not found.' });

    res.json({ message: `Role "${role.name}" deleted.` });
  } catch (err) {
    next(err);
  }
});

export default router;

