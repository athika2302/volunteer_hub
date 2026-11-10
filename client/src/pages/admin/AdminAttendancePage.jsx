import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  UserCheck,
  UserX,
  Calendar,
  Clock,
  ArrowLeft,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import Card from '../../components/Card.jsx';
import Button from '../../components/Button.jsx';
import Badge from '../../components/Badge.jsx';
import Select from '../../components/Select.jsx';
import Skeleton from '../../components/Skeleton.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import Avatar from '../../components/Avatar.jsx';

export default function AdminAttendancePage({ selectedEventId }) {
  const { apiFetch } = useAuth();
  const { showSuccess, showError } = useToast();

  const [events, setEvents] = useState([]);
  const [activeEventId, setActiveEventId] = useState(selectedEventId || '');
  const [attendanceData, setAttendanceData] = useState(null);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    loadEventsList();
  }, []);

  useEffect(() => {
    if (activeEventId) {
      loadEventRoster(activeEventId);
    }
  }, [activeEventId]);

  const loadEventsList = async () => {
    setLoadingEvents(true);
    try {
      const data = await apiFetch('/api/events');
      setEvents(data.events || []);
      if (!activeEventId && data.events?.length > 0) {
        setActiveEventId(data.events[0]._id);
      }
    } catch (err) {
      showError(err.message || 'Failed to load events');
    } finally {
      setLoadingEvents(false);
    }
  };

  const loadEventRoster = async (eventId) => {
    setLoadingRoster(true);
    try {
      const data = await apiFetch(`/api/attendance/event/${eventId}`);
      setAttendanceData(data);
    } catch (err) {
      showError(err.message || 'Failed to load roster');
    } finally {
      setLoadingRoster(false);
    }
  };

  const handleSetStatus = async (signupId, status) => {
    setUpdatingId(signupId);
    try {
      await apiFetch(`/api/attendance/${signupId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      showSuccess(`Marked as ${status}`);
      // Refresh roster
      await loadEventRoster(activeEventId);
    } catch (err) {
      showError(err.message || 'Failed to update attendance');
    } finally {
      setUpdatingId(null);
    }
  };

  const signups = attendanceData?.signups || [];
  const summary = attendanceData?.summary || { total: 0, markedCount: 0, attendedCount: 0, noShowCount: 0 };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-24">
      {/* Header & Event Selector */}
      <div className="space-y-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-indigo-600" />
            <span>Mark Attendance</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Mark volunteers present or absent. Pay is credited immediately for attended shifts.
          </p>
        </div>

        {events.length > 0 && (
          <Select
            label="Selected Event"
            value={activeEventId}
            onChange={(e) => setActiveEventId(e.target.value)}
            options={events.map((ev) => ({
              value: ev._id,
              label: `${ev.title} (${new Date(ev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`,
            }))}
          />
        )}
      </div>

      {/* Roster List */}
      {loadingRoster ? (
        <div className="space-y-3">
          <Skeleton variant="card" count={3} />
        </div>
      ) : signups.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No Volunteers Registered"
          description="There are no confirmed volunteer sign-ups for this event yet."
        />
      ) : (
        <div className="space-y-3">
          {signups.map((s) => {
            const isAttended = s.status === 'attended';
            const isNoShow = s.status === 'no-show';
            const isPending = s.status === 'confirmed';
            const isUpdating = updatingId === s._id;

            return (
              <Card key={s._id} padding="p-4" className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={s.volunteer?.name || 'Volunteer'} size="md" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                          {s.volunteer?.name}
                        </span>
                        <Badge status={s.status} size="sm" />
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {s.volunteer?.phone} {s.volunteer?.upiId && `· ${s.volunteer.upiId}`}
                      </div>
                      <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-1">
                        Role: {s.role?.name} · ₹{s.role?.payAmount}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Large One-handed Action Buttons (44px min touch target) */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => handleSetStatus(s._id, 'attended')}
                    className={`
                      min-h-[44px] rounded-btn font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]
                      ${
                        isAttended
                          ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/20'
                          : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 hover:bg-emerald-100'
                      }
                    `}
                  >
                    <UserCheck className="w-4 h-4 shrink-0" />
                    <span>Attended</span>
                  </button>

                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => handleSetStatus(s._id, 'no-show')}
                    className={`
                      min-h-[44px] rounded-btn font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]
                      ${
                        isNoShow
                          ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-500/20'
                          : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80 hover:bg-rose-100'
                      }
                    `}
                  >
                    <UserX className="w-4 h-4 shrink-0" />
                    <span>No-Show</span>
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Sticky Bottom Footer Summary (Mobile & Desktop) */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 py-3 px-4 shadow-lg pb-safe">
        <div className="max-w-3xl mx-auto flex items-center justify-between text-xs sm:text-sm font-semibold">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
            <span className="text-slate-900 dark:text-slate-100 font-bold">
              {summary.markedCount} of {summary.total} marked
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="text-emerald-600 dark:text-emerald-400">
              {summary.attendedCount} Attended
            </span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span className="text-rose-600 dark:text-rose-400">
              {summary.noShowCount} No-show
            </span>
            {summary.pendingCount > 0 && (
              <>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <span className="text-amber-600 dark:text-amber-400">
                  {summary.pendingCount} Unmarked
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

