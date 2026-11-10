import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Search,
  CheckCircle2,
  Circle,
  Calendar,
  Users,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import Card from '../../components/Card.jsx';
import Button from '../../components/Button.jsx';
import Input from '../../components/Input.jsx';
import Select from '../../components/Select.jsx';
import Skeleton from '../../components/Skeleton.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import Avatar from '../../components/Avatar.jsx';

export default function AdminCheckinPage({ selectedEventId }) {
  const { apiFetch } = useAuth();
  const { showSuccess, showError } = useToast();

  const [events, setEvents] = useState([]);
  const [activeEventId, setActiveEventId] = useState(selectedEventId || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [rosterData, setRosterData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState(null);

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (activeEventId) {
      loadCheckinRoster(activeEventId, searchQuery);
    }
  }, [activeEventId, searchQuery]);

  const loadEvents = async () => {
    try {
      const data = await apiFetch('/api/events');
      const allEvents = data.events || [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Only show events occurring today or in the future in the active check-in dropdown
      const activeEvents = allEvents.filter((e) => {
        const eventDate = new Date(e.date);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate >= today;
      });

      setEvents(activeEvents);
      if (!activeEventId && activeEvents.length > 0) {
        setActiveEventId(activeEvents[0]._id);
      }
    } catch (err) {
      showError(err.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const loadCheckinRoster = async (eventId, query) => {
    try {
      const url = `/api/checkin/event/${eventId}${query ? `?q=${encodeURIComponent(query)}` : ''}`;
      const data = await apiFetch(url);
      setRosterData(data);
    } catch (err) {
      showError(err.message || 'Failed to load check-in list');
    }
  };

  const handleToggle = async (signupId) => {
    setTogglingId(signupId);
    try {
      const res = await apiFetch(`/api/checkin/toggle/${signupId}`, {
        method: 'PATCH',
      });
      showSuccess(res.message);
      await loadCheckinRoster(activeEventId, searchQuery);
    } catch (err) {
      showError(err.message || 'Failed to toggle check-in');
    } finally {
      setTogglingId(null);
    }
  };

  const signups = rosterData?.signups || [];
  const arrivedCount = rosterData?.arrivedCount || 0;
  const total = rosterData?.total || 0;

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-16">
      {/* Top Header & Event Day Counter */}
      <div className="space-y-4 pb-3 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <QrCode className="w-6 h-6 text-indigo-600" />
              <span>Event-Day Check-in</span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Verify volunteer arrivals at the gate in real time
            </p>
          </div>

          {/* Arrived Counter Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300 font-bold text-sm sm:text-base self-start sm:self-auto shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{arrivedCount} of {total} arrived</span>
          </div>
        </div>

        {/* Event Selector */}
        {events.length > 0 && (
          <Select
            label="Active Event"
            value={activeEventId}
            onChange={(e) => setActiveEventId(e.target.value)}
            options={events.map((ev) => ({
              value: ev._id,
              label: `${ev.title} (${new Date(ev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`,
            }))}
          />
        )}

        {/* Instant Search Bar */}
        <Input
          placeholder="Search volunteer by name, phone, or role..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          icon={Search}
        />
      </div>

      {/* Volunteer List */}
      {signups.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No Volunteers Found"
          description={searchQuery ? 'No volunteer matched your search query.' : 'No confirmed volunteers for this event yet.'}
        />
      ) : (
        <div className="space-y-2.5">
          {signups.map((s) => {
            const isArrived = s.checkedIn;
            const isToggling = togglingId === s._id;

            return (
              <Card
                key={s._id}
                padding="p-3.5 sm:p-4"
                className={`transition-all ${
                  isArrived
                    ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/20 dark:bg-emerald-950/20'
                    : ''
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={s.volunteer?.name || 'V'} size="md" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base truncate">
                          {s.volunteer?.name}
                        </span>
                        {isArrived && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                            Arrived
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                        {s.volunteer?.phone}
                      </div>
                      <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5 truncate">
                        {s.role?.name} · ₹{s.role?.payAmount}
                      </div>
                    </div>
                  </div>

                  {/* Large Arrived Button turning into Green Checkmark */}
                  <button
                    type="button"
                    disabled={isToggling}
                    onClick={() => handleToggle(s._id)}
                    className={`
                      shrink-0 min-h-[44px] min-w-[100px] px-4 py-2 rounded-btn font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.97]
                      ${
                        isArrived
                          ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/30'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 dark:border-slate-700'
                      }
                    `}
                  >
                    {isArrived ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-white" />
                        <span>Arrived</span>
                      </>
                    ) : (
                      <>
                        <Circle className="w-4 h-4 text-slate-400" />
                        <span>Check In</span>
                      </>
                    )}
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

