import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Clock, ArrowRight, Sparkles, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import Card from '../../components/Card.jsx';
import Badge from '../../components/Badge.jsx';
import Skeleton from '../../components/Skeleton.jsx';
import EmptyState from '../../components/EmptyState.jsx';

export default function EventsPage({ onSelectEvent }) {
  const { user, apiFetch } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/events');
      setEvents(data.events || []);
    } catch (err) {
      setError(err.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return {
      month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
      day: d.getDate(),
      weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
    };
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>Hello, {user?.name?.split(' ')[0]}</span>
            <span className="inline-block animate-wave">👋</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Discover upcoming paid volunteer events and reserved shifts
          </p>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Event Cards List */}
      {loading ? (
        <div className="space-y-4">
          <Skeleton variant="card" count={3} />
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          title="No upcoming events"
          description="There are currently no events open for volunteer sign-up. Check back soon!"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {events.map((event) => {
            const dateInfo = formatDate(event.date);
            const roles = event.roles || [];
            const totalCapacity = roles.reduce((sum, r) => sum + r.capacity, 0);
            const totalFilled = roles.reduce((sum, r) => sum + r.filled, 0);
            const spotsRemaining = Math.max(0, totalCapacity - totalFilled);
            const maxPay = Math.max(0, ...roles.map((r) => r.payAmount || 0));

            return (
              <Card
                key={event._id}
                hoverable
                onClick={() => onSelectEvent(event._id)}
                className="group transition-all"
                padding="p-4 sm:p-5"
              >
                <div className="flex items-start gap-4">
                  {/* Left Date Block */}
                  <div className="shrink-0 w-16 h-20 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/60 flex flex-col items-center justify-center text-center p-2">
                    <span className="text-[11px] font-bold tracking-wider text-indigo-600 dark:text-indigo-400">
                      {dateInfo.month}
                    </span>
                    <span className="text-2xl font-black text-slate-900 dark:text-slate-100 leading-none my-0.5">
                      {dateInfo.day}
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase font-medium">
                      {dateInfo.weekday}
                    </span>
                  </div>

                  {/* Right Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                        {event.title}
                      </h2>
                      {maxPay > 0 && (
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                          Up to ₹{maxPay.toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>

                    {/* Venue & Timing */}
                    <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1.5 line-clamp-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{event.venue}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{event.startTime} – {event.endTime}</span>
                      </div>
                    </div>

                    {/* Roles Summary Footer */}
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">
                        {roles.length} {roles.length === 1 ? 'role' : 'roles'} open ·{' '}
                        <strong className={spotsRemaining > 0 ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-rose-500'}>
                          {spotsRemaining > 0 ? `${spotsRemaining} spots left` : 'Waitlist only'}
                        </strong>
                      </span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-semibold inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        <span>Details</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

