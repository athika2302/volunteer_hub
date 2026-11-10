import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Trash2,
  PlusCircle,
  Users,
  CheckSquare,
  QrCode,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import Card from '../../components/Card.jsx';
import Button from '../../components/Button.jsx';
import Modal from '../../components/Modal.jsx';
import Skeleton from '../../components/Skeleton.jsx';
import EmptyState from '../../components/EmptyState.jsx';

export default function AdminEventsPage({ onCreateNew, onNavigateAttendance, onNavigateCheckin }) {
  const { apiFetch } = useAuth();
  const { showSuccess, showError } = useToast();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/events');
      setEvents(data.events || []);
    } catch (err) {
      showError(err.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/events/${deleteTarget._id}`, { method: 'DELETE' });
      showSuccess(`Deleted "${deleteTarget.title}"`);
      setDeleteTarget(null);
      await loadEvents();
    } catch (err) {
      showError(err.message || 'Failed to delete event');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton variant="card" count={3} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Event Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Create events, manage roles, track attendance, and monitor capacities
          </p>
        </div>
        <Button variant="primary" icon={PlusCircle} onClick={onCreateNew}>
          Create New Event
        </Button>
      </div>

      {events.length === 0 ? (
        <EmptyState
          title="No Events Created Yet"
          description="Create your first event to start publishing staffing roles and taking volunteer sign-ups."
          actionLabel="Create Event Now"
          onAction={onCreateNew}
        />
      ) : (
        <div className="space-y-4">
          {events.map((event) => {
            const roles = event.roles || [];
            const totalCapacity = roles.reduce((sum, r) => sum + r.capacity, 0);
            const totalFilled = roles.reduce((sum, r) => sum + r.filled, 0);

            return (
              <Card key={event._id} padding="p-5" className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {event.title}
                    </h2>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                        {new Date(event.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-indigo-600" />
                        {event.startTime} – {event.endTime}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                        {event.venue}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      icon={Trash2}
                      onClick={() => setDeleteTarget(event)}
                      title="Delete event"
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                {/* Roles breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  {roles.map((r) => (
                    <div
                      key={r._id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/80 text-xs flex flex-col justify-between"
                    >
                      <div className="flex justify-between items-center font-semibold text-slate-900 dark:text-slate-100 mb-1">
                        <span>{r.name}</span>
                        <span className="text-emerald-600 font-bold">₹{r.payAmount}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-500 text-[11px]">
                        <span>Filled: {r.filled} / {r.capacity}</span>
                        <span className={r.filled >= r.capacity ? 'text-rose-500 font-bold' : 'text-slate-400'}>
                          {r.filled >= r.capacity ? 'Full' : `${r.capacity - r.filled} left`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Event Actions Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <span className="text-slate-500 font-medium">
                    Overall Staffing: {totalFilled} of {totalCapacity} filled
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={CheckSquare}
                      onClick={() => onNavigateAttendance(event._id)}
                    >
                      Mark Attendance
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={QrCode}
                      onClick={() => onNavigateCheckin(event._id)}
                    >
                      Event-Day Check-in
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete Event"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Are you sure you want to permanently delete{' '}
            <strong className="text-slate-900 dark:text-slate-100">
              "{deleteTarget?.title}"
            </strong>? All associated roles and sign-up records will also be removed.
          </p>

          <div className="flex gap-2 pt-2">
            <Button
              variant="danger"
              fullWidth
              loading={deleting}
              onClick={handleDelete}
            >
              Delete Event
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

