import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Shirt,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Users,
  ShieldCheck,
  IndianRupee,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import Card from '../../components/Card.jsx';
import Button from '../../components/Button.jsx';
import ProgressBar from '../../components/ProgressBar.jsx';
import BottomSheet from '../../components/BottomSheet.jsx';
import Skeleton from '../../components/Skeleton.jsx';

export default function EventDetailPage({ eventId, onBack, onGoToShifts }) {
  const { user, apiFetch } = useAuth();
  const { showSuccess, showError } = useToast();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [conflictError, setConflictError] = useState(null);
  const [successData, setSuccessData] = useState(null);
  const [userSignups, setUserSignups] = useState([]);

  useEffect(() => {
    loadEventData();
  }, [eventId]);

  const loadEventData = async () => {
    setLoading(true);
    try {
      const [evData, mySignups] = await Promise.all([
        apiFetch(`/api/events/${eventId}`),
        apiFetch('/api/signups/my'),
      ]);
      setEvent(evData.event);
      setUserSignups(mySignups.signups || []);
    } catch (err) {
      showError(err.message || 'Failed to load event details');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSheet = (role) => {
    setSelectedRole(role);
    setConflictError(null);
    setSuccessData(null);
  };

  const handleConfirmSignup = async () => {
    if (!selectedRole) return;
    setSubmitting(true);
    setConflictError(null);

    try {
      const res = await apiFetch('/api/signups', {
        method: 'POST',
        body: JSON.stringify({ roleId: selectedRole._id }),
      });

      setSuccessData(res);
      showSuccess(res.message);
      // Refresh event to get updated capacity count
      const updated = await apiFetch(`/api/events/${eventId}`);
      setEvent(updated.event);
      const mySignups = await apiFetch('/api/signups/my');
      setUserSignups(mySignups.signups || []);
    } catch (err) {
      if (err.status === 409 && err.message.includes('Time conflict')) {
        setConflictError(err.message);
      } else {
        showError(err.message || 'Failed to sign up');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton variant="button" />
        <Skeleton variant="card" className="h-48" />
        <Skeleton variant="card" count={2} />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500 mb-4">Event could not be found.</p>
        <Button variant="secondary" onClick={onBack} icon={ArrowLeft}>
          Back to Events
        </Button>
      </div>
    );
  }

  // Format event date
  const eventDateStr = new Date(event.date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
      {/* Back button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to all events</span>
      </button>

      {/* Hero Card */}
      <Card className="relative overflow-hidden bg-gradient-to-br from-white via-white to-indigo-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/20">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
          {event.title}
        </h1>

        {/* Icon-labeled Rows */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="font-medium">{eventDateStr}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>{event.startTime} to {event.endTime}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <MapPin className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>{event.venue}</span>
          </div>
          {event.dressCode && (
            <div className="flex items-center gap-2.5">
              <Shirt className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>Dress Code: {event.dressCode}</span>
            </div>
          )}
        </div>

        {event.description && (
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {event.description}
          </div>
        )}
      </Card>

      {/* Available Roles Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600" />
            <span>Select a Role for this Shift</span>
          </h2>
          <span className="text-xs text-slate-500">
            {event.roles?.length || 0} {event.roles?.length === 1 ? 'role' : 'roles'} available
          </span>
        </div>

        <div className="space-y-4">
          {event.roles?.map((role) => {
            const isFull = role.filled >= role.capacity;
            const existingSignup = userSignups.find(
              (s) => s.role?._id === role._id && s.status !== 'cancelled'
            );

            return (
              <Card key={role._id} className="transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        {role.name}
                      </h3>
                      {existingSignup && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                          {existingSignup.status === 'confirmed' ? '✓ You are in' : 'On Waitlist'}
                        </span>
                      )}
                    </div>

                    {/* Pay amount large and prominent */}
                    <div className="flex items-baseline gap-1 my-2">
                      <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
                        ₹{role.payAmount.toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs text-slate-500">/ shift</span>
                    </div>

                    {role.dressCode && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                        <strong className="text-slate-700 dark:text-slate-300">Role Dress:</strong> {role.dressCode}
                      </p>
                    )}

                    {/* Progress Bar of Capacity */}
                    <div className="max-w-xs">
                      <ProgressBar filled={role.filled} capacity={role.capacity} />
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="shrink-0 pt-2 sm:pt-0">
                    {existingSignup ? (
                      <Button
                        variant="secondary"
                        size="md"
                        onClick={onGoToShifts}
                        className="w-full sm:w-auto"
                      >
                        View in My Shifts
                      </Button>
                    ) : (
                      <Button
                        variant={isFull ? 'secondary' : 'primary'}
                        size="md"
                        onClick={() => handleOpenSheet(role)}
                        className="w-full sm:w-auto"
                      >
                        {isFull ? 'Join Waitlist' : 'Sign Up for Shift'}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Confirmation BottomSheet */}
      <BottomSheet
        isOpen={Boolean(selectedRole)}
        onClose={() => setSelectedRole(null)}
        title={successData ? 'Shift Confirmed!' : `Confirm: ${selectedRole?.name}`}
      >
        {successData ? (
          <div className="text-center py-4 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-200 dark:border-emerald-800 animate-scale-in">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {successData.wasWaitlisted ? 'Added to Waitlist' : 'You are Confirmed!'}
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                {successData.message}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 text-left text-xs space-y-2">
              <div><span className="font-semibold text-slate-500">Event:</span> {event.title}</div>
              <div><span className="font-semibold text-slate-500">Role:</span> {selectedRole?.name}</div>
              <div><span className="font-semibold text-slate-500">Timing:</span> {event.startTime} – {event.endTime}</div>
              <div><span className="font-semibold text-slate-500">Venue:</span> {event.venue}</div>
              <div>
                <span className="font-semibold text-slate-500">Expected Pay:</span>{' '}
                <strong className="text-emerald-600 font-bold">₹{selectedRole?.payAmount?.toLocaleString('en-IN')}</strong>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button variant="primary" fullWidth onClick={() => { setSelectedRole(null); onGoToShifts(); }}>
                View in My Shifts
              </Button>
              <Button variant="ghost" fullWidth onClick={() => setSelectedRole(null)}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Pay Preview */}
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
              <div className="text-xs uppercase font-bold tracking-wider text-emerald-800 dark:text-emerald-300 mb-1 flex items-center gap-1.5">
                <IndianRupee className="w-3.5 h-3.5" />
                <span>Earnings Preview</span>
              </div>
              <div className="text-xl font-black text-emerald-900 dark:text-emerald-100">
                ₹{selectedRole?.payAmount?.toLocaleString('en-IN')}
              </div>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                Pay is recorded after the shift and based strictly on attendance.
              </p>
            </div>

            {/* Shift Rules & Timing */}
            <div className="text-xs space-y-2 text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                <span><strong>Shift Hours:</strong> {event.startTime} to {event.endTime}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <span><strong>Venue:</strong> {event.venue}</span>
              </div>
              <div className="flex items-center gap-2">
                <Shirt className="w-4 h-4 text-slate-400 shrink-0" />
                <span><strong>Dress Code:</strong> {selectedRole?.dressCode || event.dressCode || 'Standard Formal'}</span>
              </div>
            </div>

            {/* Inline Conflict Warning if exists */}
            {conflictError && (
              <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <strong className="block font-semibold mb-0.5">Scheduling Conflict</strong>
                  <p>{conflictError}</p>
                </div>
              </div>
            )}

            {/* Capacity Status Note */}
            <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
              {selectedRole?.filled >= selectedRole?.capacity
                ? '⚠️ This role is currently full. Confirming will place you on the waitlist.'
                : 'Spots are reserved on a strict first-come, first-served basis.'}
            </p>

            {/* Actions anchored at bottom for mobile thumb */}
            <div className="flex flex-col gap-2 pt-2">
              <Button
                variant="primary"
                fullWidth
                size="lg"
                loading={submitting}
                onClick={handleConfirmSignup}
              >
                {selectedRole?.filled >= selectedRole?.capacity
                  ? 'Confirm Join Waitlist'
                  : 'Confirm & Reserve Spot'}
              </Button>
              <Button
                variant="ghost"
                fullWidth
                onClick={() => setSelectedRole(null)}
                disabled={submitting}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

