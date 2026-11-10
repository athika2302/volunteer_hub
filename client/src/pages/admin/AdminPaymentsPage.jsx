import React, { useState, useEffect } from 'react';
import {
  Wallet,
  IndianRupee,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  CreditCard,
  Send,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import Card from '../../components/Card.jsx';
import Button from '../../components/Button.jsx';
import Input from '../../components/Input.jsx';
import BottomSheet from '../../components/BottomSheet.jsx';
import Skeleton from '../../components/Skeleton.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import Avatar from '../../components/Avatar.jsx';

export default function AdminPaymentsPage() {
  const { apiFetch } = useAuth();
  const { showSuccess, showError } = useToast();

  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedVolunteer, setSelectedVolunteer] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [upiReference, setUpiReference] = useState('');
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    loadPayouts();
  }, []);

  const loadPayouts = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/ledger/payouts');
      setOverview(data);
    } catch (err) {
      showError(err.message || 'Failed to load payouts');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPaymentSheet = (item) => {
    setSelectedVolunteer(item.volunteer);
    setPaymentAmount(String(item.pendingAmount));
    setUpiReference('');
  };

  const handleRecordPayment = async () => {
    if (!selectedVolunteer) return;
    setRecording(true);
    try {
      const res = await apiFetch('/api/ledger/pay', {
        method: 'POST',
        body: JSON.stringify({
          volunteerId: selectedVolunteer._id,
          amount: Number(paymentAmount),
          upiReference,
        }),
      });

      showSuccess(`Recorded ₹${paymentAmount} payment for ${selectedVolunteer.name}`);
      setSelectedVolunteer(null);
      await loadPayouts();
    } catch (err) {
      showError(err.message || 'Failed to record payment');
    } finally {
      setRecording(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Skeleton variant="card" />
        <Skeleton variant="card" count={3} />
      </div>
    );
  }

  const pendingList = overview?.pendingList || [];
  const totalPendingPayout = overview?.totalPendingPayout || 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="pb-3 border-b border-slate-200/80 dark:border-slate-800">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Wallet className="w-6 h-6 text-indigo-600" />
          <span>Volunteer Payouts & Disbursals</span>
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Record external UPI payments against verified attendance. The app tracks records without moving funds.
        </p>
      </div>

      {/* Summary Card */}
      <Card className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-amber-200/80 dark:border-amber-900/50">
        <div className="flex items-center justify-between text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2">
          <span>Total Pending Disbursals</span>
          <Clock className="w-4 h-4 text-amber-600" />
        </div>
        <div className="text-3xl sm:text-4xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
          ₹{totalPendingPayout.toLocaleString('en-IN')}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          Owed across {overview?.totalVolunteersOwed || 0} volunteers for completed shifts. Sorted by highest pending balance.
        </p>
      </Card>

      {/* Pending Volunteers List */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-600" />
          <span>Volunteers Awaiting Payout</span>
        </h2>

        {pendingList.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="All Payouts Settled"
            description="There are currently no outstanding volunteer balances. Great job!"
          />
        ) : (
          <div className="space-y-3">
            {pendingList.map((item) => (
              <Card key={item.volunteer._id} padding="p-4" className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={item.volunteer.name} size="md" />
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                        {item.volunteer.name}
                      </h3>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {item.volunteer.phone} {item.volunteer.upiId && `· ${item.volunteer.upiId}`}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {item.attendedShiftsCount} shifts completed · Total earned: ₹{item.totalEarned} · Paid: ₹{item.totalPaid}
                      </div>
                    </div>
                  </div>

                  {/* Pending Balance & Action */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                    <div className="text-left sm:text-right">
                      <span className="text-lg font-black text-amber-600 dark:text-amber-400 block leading-tight">
                        ₹{item.pendingAmount.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">Pending Balance</span>
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleOpenPaymentSheet(item)}
                      icon={CreditCard}
                    >
                      Record Payment
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Record Payment Bottom Sheet */}
      <BottomSheet
        isOpen={Boolean(selectedVolunteer)}
        onClose={() => setSelectedVolunteer(null)}
        title={`Record Payment for ${selectedVolunteer?.name}`}
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs space-y-1.5 text-slate-600 dark:text-slate-400">
            <div><span className="font-semibold text-slate-900 dark:text-slate-200">Volunteer:</span> {selectedVolunteer?.name}</div>
            <div><span className="font-semibold text-slate-900 dark:text-slate-200">Mobile:</span> {selectedVolunteer?.phone}</div>
            <div>
              <span className="font-semibold text-slate-900 dark:text-slate-200">Registered UPI ID:</span>{' '}
              <strong className="text-indigo-600 dark:text-indigo-400 font-mono">
                {selectedVolunteer?.upiId || 'Not specified'}
              </strong>
            </div>
          </div>

          <Input
            label="Payment Amount (₹)"
            type="number"
            min="1"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            required
            helperText="Prefilled with total outstanding balance."
          />

          <Input
            label="UPI Reference / Transaction UTR (Optional)"
            placeholder="e.g. UPI/20261120/1234567890"
            value={upiReference}
            onChange={(e) => setUpiReference(e.target.value)}
            helperText="The reference number from your PhonePe, Google Pay, or Paytm transaction."
          />

          <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 text-xs text-indigo-900 dark:text-indigo-200">
            <strong>Audit Record:</strong> This will record the payment in the volunteer's statement and clear their pending balance. No real money moves through this app.
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="primary"
              fullWidth
              size="lg"
              loading={recording}
              onClick={handleRecordPayment}
              icon={Send}
            >
              Confirm Payment Record
            </Button>
            <Button
              variant="ghost"
              fullWidth
              onClick={() => setSelectedVolunteer(null)}
              disabled={recording}
            >
              Cancel
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

