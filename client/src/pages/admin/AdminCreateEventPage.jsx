import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Calendar,
  Clock,
  MapPin,
  Shirt,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Eye,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import Card from '../../components/Card.jsx';
import Button from '../../components/Button.jsx';
import Input from '../../components/Input.jsx';
import TextArea from '../../components/TextArea.jsx';
import ProgressBar from '../../components/ProgressBar.jsx';

export default function AdminCreateEventPage({ onEventCreated }) {
  const { apiFetch } = useAuth();
  const { showSuccess, showError } = useToast();

  const [step, setStep] = useState(1); // 1: Event Details, 2: Add Roles, 3: Review & Publish
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Event Details
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const [venue, setVenue] = useState('');
  const [dressCode, setDressCode] = useState('');
  const [description, setDescription] = useState('');
  const [eventErrors, setEventErrors] = useState({});

  // Step 2: Roles List
  const [roles, setRoles] = useState([
    { name: 'Hostess', capacity: 6, payAmount: 1500, dressCode: 'Formal' },
  ]);

  const addRole = () => {
    setRoles((prev) => [
      ...prev,
      { name: '', capacity: 5, payAmount: 1000, dressCode: '' },
    ]);
  };

  const removeRole = (index) => {
    if (roles.length === 1) return;
    setRoles((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRole = (index, field, value) => {
    setRoles((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Validate Step 1
  const validateStep1 = () => {
    const errs = {};
    if (!title.trim()) errs.title = 'Event title is required';
    if (!date) errs.date = 'Date is required';
    if (!venue.trim()) errs.venue = 'Venue is required';
    if (!startTime) errs.startTime = 'Start time required';
    if (!endTime) errs.endTime = 'End time required';
    if (startTime && endTime && endTime <= startTime) {
      errs.endTime = 'End time must be after start time';
    }
    setEventErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Validate Step 2
  const validateStep2 = () => {
    if (roles.length === 0) {
      showError('At least one role is required');
      return false;
    }
    for (let i = 0; i < roles.length; i++) {
      const r = roles[i];
      if (!r.name.trim()) {
        showError(`Role #${i + 1} requires a name`);
        return false;
      }
      const cap = Number(r.capacity);
      if (!Number.isInteger(cap) || cap < 1) {
        showError(`Role #${i + 1} capacity must be a whole positive integer`);
        return false;
      }
      const pay = Number(r.payAmount);
      if (isNaN(pay) || pay < 0) {
        showError(`Role #${i + 1} pay amount must be non-negative`);
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1) {
      if (validateStep1()) setStep(2);
    } else if (step === 2) {
      if (validateStep2()) setStep(3);
    }
  };

  const handlePublish = async () => {
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/events', {
        method: 'POST',
        body: JSON.stringify({
          title,
          date,
          startTime,
          endTime,
          venue,
          dressCode,
          description,
          roles: roles.map((r) => ({
            name: r.name,
            capacity: Number(r.capacity),
            payAmount: Number(r.payAmount),
            dressCode: r.dressCode,
          })),
        }),
      });

      showSuccess(`Event "${title}" published with ${roles.length} roles!`);
      if (onEventCreated) onEventCreated(res.event);
    } catch (err) {
      showError(err.message || 'Failed to create event');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Header with Step Indicator */}
      <div className="pb-4 border-b border-slate-200/80 dark:border-slate-800">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Create New Event & Roles
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Step {step} of 3:{' '}
          {step === 1 && 'Basic Event Details'}
          {step === 2 && 'Staffing Roles & Headcounts'}
          {step === 3 && 'Live Card Preview & Publish'}
        </p>

        {/* Progress pills */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className={`h-1.5 rounded-full transition-all ${step >= 1 ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-800'}`} />
          <div className={`h-1.5 rounded-full transition-all ${step >= 2 ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-800'}`} />
          <div className={`h-1.5 rounded-full transition-all ${step >= 3 ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-800'}`} />
        </div>
      </div>

      {/* Step 1: Event Details */}
      {step === 1 && (
        <Card className="space-y-4">
          <Input
            label="Event Title"
            placeholder="e.g. Bangalore Cultural Gala – Palace Ground"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={eventErrors.title}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              error={eventErrors.date}
              required
            />
            <Input
              label="Start Time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              error={eventErrors.startTime}
              required
            />
            <Input
              label="End Time"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              error={eventErrors.endTime}
              required
            />
          </div>

          <Input
            label="Venue & Landmark"
            placeholder="e.g. Palace Ground, Gayatri Vihar, Gate 2"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            error={eventErrors.venue}
            required
          />

          <Input
            label="General Dress Code"
            placeholder="e.g. Formal dress / Business Casual"
            value={dressCode}
            onChange={(e) => setDressCode(e.target.value)}
          />

          <TextArea
            label="Event Description & Instructions"
            placeholder="Provide context, VIP attendee notes, volunteer perks, and logistics..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />

          <div className="pt-2 flex justify-end">
            <Button variant="primary" onClick={handleNext} icon={ArrowRight}>
              Continue to Roles
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: Roles Definition */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Staffing Headcounts & Pay Rates
            </h2>
            <Button variant="secondary" size="sm" icon={Plus} onClick={addRole}>
              Add Another Role
            </Button>
          </div>

          {roles.map((r, idx) => (
            <Card key={idx} padding="p-4 sm:p-5" className="relative space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Role #{idx + 1}
                </span>
                {roles.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRole(idx)}
                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                    title="Remove this role"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="Role Name"
                  placeholder="e.g. Hostess, Coordinator"
                  value={r.name}
                  onChange={(e) => updateRole(idx, 'name', e.target.value)}
                  required
                />
                <Input
                  label="Capacity (Headcount)"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="6"
                  value={r.capacity}
                  onChange={(e) => updateRole(idx, 'capacity', e.target.value)}
                  required
                />
                <Input
                  label="Pay Rate (₹)"
                  type="number"
                  min="0"
                  placeholder="1500"
                  value={r.payAmount}
                  onChange={(e) => updateRole(idx, 'payAmount', e.target.value)}
                  required
                />
              </div>

              <Input
                label="Role-Specific Dress Code (Optional)"
                placeholder="e.g. Formal Saree or Suit"
                value={r.dressCode}
                onChange={(e) => updateRole(idx, 'dressCode', e.target.value)}
              />
            </Card>
          ))}

          <div className="flex items-center justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep(1)} icon={ArrowLeft}>
              Back to Details
            </Button>
            <Button variant="primary" onClick={handleNext} icon={ArrowRight}>
              Preview & Review
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Live Card Preview & Final Publish */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            <Eye className="w-4 h-4 text-indigo-600" />
            <span>Volunteer Feed Live Card Preview</span>
          </div>

          {/* Live Preview Card */}
          <Card className="border-2 border-indigo-500/30">
            <div className="flex items-start gap-4">
              <div className="shrink-0 w-16 h-20 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/60 flex flex-col items-center justify-center text-center p-2">
                <span className="text-[11px] font-bold tracking-wider text-indigo-600 dark:text-indigo-400">
                  {date ? new Date(date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase() : 'DATE'}
                </span>
                <span className="text-2xl font-black text-slate-900 dark:text-slate-100 leading-none my-0.5">
                  {date ? new Date(date).getDate() : '--'}
                </span>
                <span className="text-[10px] text-slate-500 uppercase font-medium">
                  {date ? new Date(date).toLocaleDateString('en-US', { weekday: 'short' }) : 'DAY'}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {title || 'Untitled Event'}
                </h3>
                <div className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{venue || 'No venue provided'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{startTime} – {endTime}</span>
                  </div>
                  {dressCode && (
                    <div className="flex items-center gap-1.5">
                      <Shirt className="w-3.5 h-3.5 text-slate-400" />
                      <span>{dressCode}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Roles preview */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Roles Configured:
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {roles.map((r, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-xs flex justify-between items-center"
                  >
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">{r.name}</div>
                      <div className="text-slate-500">{r.capacity} spots</div>
                    </div>
                    <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                      ₹{Number(r.payAmount || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <div className="flex items-center justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep(2)} icon={ArrowLeft} disabled={submitting}>
              Back to Roles
            </Button>
            <Button
              variant="primary"
              size="lg"
              loading={submitting}
              onClick={handlePublish}
              icon={CheckCircle2}
            >
              Publish Event & Open Shifts
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

