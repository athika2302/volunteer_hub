import React, { useState, useEffect } from 'react';
import {
  Wallet,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  CreditCard,
  Calendar,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import Card from '../../components/Card.jsx';
import Badge from '../../components/Badge.jsx';
import Skeleton from '../../components/Skeleton.jsx';
import EmptyState from '../../components/EmptyState.jsx';

export default function MyLedgerPage() {
  const { user, apiFetch } = useAuth();
  const { showError } = useToast();

  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLedger();
  }, []);

  const loadLedger = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/ledger/my');
      setLedger(data);
    } catch (err) {
      showError(err.message || 'Failed to load ledger');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
        <Skeleton variant="card" count={3} />
      </div>
    );
  }

  const shifts = ledger?.shifts || [];
  const payments = ledger?.payments || [];

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
      {/* Page Header */}
      <div className="pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          My Earnings & Ledger
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Real-time record of your completed shifts, pending disbursements, and UPI payments
        </p>
      </div>

      {/* Top Summary Cards (Two large numbers) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Pending Card */}
        <Card className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-amber-200/80 dark:border-amber-900/50">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2">
            <span>Pending Payout</span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-3xl sm:text-4xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
            ₹{(ledger?.pendingAmount || 0).toLocaleString('en-IN')}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Earned from verified attended shifts awaiting organizer transfer.
          </p>
        </Card>

        {/* Paid Card */}
        <Card className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-200/80 dark:border-emerald-900/50">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-2">
            <span>Total Paid Out</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
            ₹{(ledger?.totalPaid || 0).toLocaleString('en-IN')}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Transferred directly to your UPI ID outside the platform.
          </p>
        </Card>
      </div>

      {/* Educational Note: Attendance-Based Pay */}
      <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-3">
        <HelpCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <strong className="block font-semibold text-slate-900 dark:text-slate-100 mb-0.5">
            Why is pay credited strictly upon attendance?
          </strong>
          Sign-up amounts represent the contracted rate for completing a shift. Payments are credited only after your attendance is verified on event day to ensure honest staffing, protect pool funds against no-shows, and maintain an immutable ledger.
        </div>
      </div>

      {/* Attended Shifts Statement */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span>Attended Shift Statement</span>
          </h2>
          <span className="text-xs text-slate-500 font-medium">
            {shifts.length} {shifts.length === 1 ? 'shift' : 'shifts'} completed
          </span>
        </div>

        {shifts.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No Attended Shifts Yet"
            description="Once you attend confirmed shifts and are marked present by the organizer, your earnings will appear here."
          />
        ) : (
          <div className="space-y-3">
            {shifts.map((shift) => (
              <Card key={shift._id} padding="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                        {shift.roleName}
                      </h3>
                      <Badge status={shift.isPaid ? 'paid' : 'pending'} size="sm" />
                    </div>
                    <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                      {shift.eventTitle}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {shift.eventDate ? new Date(shift.eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''} · {shift.venue}
                    </p>
                  </div>

                  {/* Amount */}
                  <div className="text-right shrink-0">
                    <span className="text-lg font-black text-slate-900 dark:text-slate-100">
                      ₹{shift.amount.toLocaleString('en-IN')}
                    </span>
                    <span className="block text-[10px] text-slate-400">Credited</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Payment Transfers Record */}
      {payments.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-slate-200/80 dark:border-slate-800">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-600" />
            <span>Disbursement History</span>
          </h2>

          <div className="space-y-2">
            {payments.map((p) => (
              <Card key={p._id} padding="p-3.5 sm:p-4" className="bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      Disbursed by {p.recordedBy?.name || 'Organizer'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      {p.upiReference ? `Ref: ${p.upiReference}` : 'UPI Transfer Confirmed'}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(p.paidAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(p.paidAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  <div className="text-base font-black text-emerald-600 dark:text-emerald-400">
                    +₹{p.amount.toLocaleString('en-IN')}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

