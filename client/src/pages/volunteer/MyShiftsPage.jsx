import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  AlertTriangle,
  XCircle,
  CheckCircle,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import Card from '../../components/Card.jsx';
import Badge from '../../components/Badge.jsx';
import Button from '../../components/Button.jsx';
import Modal from '../../components/Modal.jsx';
import Skeleton from '../../components/Skeleton.jsx';
import EmptyState from '../../components/EmptyState.jsx';

export default function MyShiftsPage({ onFindEvents }) {
  const { apiFetch } = useAuth();
  const { showSuccess, showError } = useToast();

  const [signups, setSignups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedForCancel, setSelectedForCancel] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    loadShifts();
  }, []);

  const loadShifts = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/signups/my');
      setSignups(data.signups || []);
    } catch (err) {
      showError(err.message || 'Failed to load shifts');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!selectedForCancel) return;
    setCancelling(true);
    try {
      const res = await apiFetch(`/api/signups/${selectedForCancel._id}`, {
        method: 'DELETE',
      });
      showSuccess(res.message);
      setSelectedForCancel(null);
      await loadShifts();
    } catch (err) {
      showError(err.message || 'Failed to cancel shift');
    } finally {
      setCancelling(false);
    }
  };

  // Determine if a shift is within 24h of starting
  const isWithin24Hours = (signup) => {
    if (!signup.event) return false;
    const [hours, minutes] = signup.event.startTime.split(':').map(Number);
    const start = new Date(signup.event.date);
    start.setHours(hours, minutes, 0, 0);
    const diffHours = (start.getTime() - Date.now()) / (1000 * 60 * 60);
    return diffHours < 24 && diffHours >= 0;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton variant="card" count={3} />
      </div>
    );
  }

  if (signups.length === 0) {
    return (
      <EmptyState
        title="No Shifts Registered"
        description="You have not signed up for any event shifts yet."
        actionLabel="Browse Available Events"
        onAction={onFindEvents}
      />
    );
  }

  // Group shifts by date
  const groupedShifts = signups.reduce((groups, item) => {
    const dateKey = item.event?.date
      ? new Date(item.event.date).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : 'Unscheduled';

    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(item);
    return groups;
  }, {});

  return (
    <div className="space-y-8 max-w-3xl mx-auto pb-12">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            My Registered Shifts
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Track your confirmed positions, waitlist queue, and shift records
          </p>
        </div>
      </div>

      {Object.entries(groupedShifts).map(([dateLabel, shifts]) => (
        <div key={dateLabel} className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span>{dateLabel}</span>
          </div>

          <div className="space-y-3">
            {shifts.map((s) => {
              const canCancel = ['confirmed', 'waitlisted'].includes(s.status);
              const within24 = isWithin24Hours(s);

              return (
                <Card key={s._id} className="relative overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge status={s.status} />
                        {s.status === 'waitlisted' && s.waitlistPosition && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300">
                            Queue Position #{s.waitlistPosition}
                          </span>
                        )}
                        {s.cancelledWithin24h && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300">
                            Late Cancellation (&lt;24h)
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        {s.role?.name || 'Assigned Role'}
                      </h3>
                      <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                        {s.event?.title}
                      </p>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 pt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {s.event?.startTime} – {s.event?.endTime}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {s.event?.venue}
                        </span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          ₹{s.role?.payAmount?.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    {/* Action button */}
                    {canCancel && (
                      <div className="shrink-0 pt-2 sm:pt-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 w-full sm:w-auto"
                          onClick={() => setSelectedForCancel(s)}
                        >
                          Cancel Shift
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {/* Cancellation Confirmation Dialog */}
      <Modal
        isOpen={Boolean(selectedForCancel)}
        onClose={() => setSelectedForCancel(null)}
        title="Cancel Shift Confirmation"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Are you sure you want to cancel your spot as{' '}
            <strong className="text-slate-900 dark:text-slate-200">
              {selectedForCancel?.role?.name}
            </strong>{' '}
            for <strong className="text-slate-900 dark:text-slate-200">{selectedForCancel?.event?.title}</strong>?
          </p>

          {selectedForCancel && isWithin24Hours(selectedForCancel) && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold mb-0.5">Late Cancellation Warning</strong>
                This shift is scheduled to begin in less than 24 hours. Cancelling now will be permanently recorded on your volunteer profile.
              </div>
            </div>
          )}

          <p className="text-xs text-slate-500">
            Your spot will be automatically offered to the next volunteer on the waitlist.
          </p>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              variant="danger"
              fullWidth
              loading={cancelling}
              onClick={handleCancel}
            >
              Yes, Cancel Shift
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setSelectedForCancel(null)}
              disabled={cancelling}
            >
              Keep My Spot
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

