import React, { useState, useEffect } from 'react';
import {
  Users,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Phone,
  CreditCard,
  Search,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import Card from '../../components/Card.jsx';
import Button from '../../components/Button.jsx';
import Badge from '../../components/Badge.jsx';
import Input from '../../components/Input.jsx';
import Skeleton from '../../components/Skeleton.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import Avatar from '../../components/Avatar.jsx';

export default function AdminVolunteersPage() {
  const { apiFetch } = useAuth();
  const { showSuccess, showError } = useToast();

  const [pendingUsers, setPendingUsers] = useState([]);
  const [approvedUsers, setApprovedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pendingRes, approvedRes] = await Promise.all([
        apiFetch('/api/admin/pending-approvals'),
        apiFetch('/api/admin/volunteers'),
      ]);
      setPendingUsers(pendingRes.users || []);
      setApprovedUsers(approvedRes.users || []);
    } catch (err) {
      showError(err.message || 'Failed to load volunteer directory');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId) => {
    setProcessingId(userId);
    try {
      const res = await apiFetch(`/api/admin/approve/${userId}`, { method: 'PATCH' });
      showSuccess(res.message);
      await loadData();
    } catch (err) {
      showError(err.message || 'Approval failed');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (userId) => {
    setProcessingId(userId);
    try {
      const res = await apiFetch(`/api/admin/reject/${userId}`, { method: 'PATCH' });
      showSuccess(res.message);
      await loadData();
    } catch (err) {
      showError(err.message || 'Rejection failed');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <Skeleton variant="card" count={3} />
      </div>
    );
  }

  const filteredApproved = approvedUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.phone.includes(search) ||
      (u.upiId && u.upiId.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-16">
      {/* Page Header */}
      <div className="pb-3 border-b border-slate-200/80 dark:border-slate-800">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Users className="w-6 h-6 text-indigo-600" />
          <span>Volunteer Roster & Approvals</span>
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Review new account requests and manage verified event personnel
        </p>
      </div>

      {/* 1. Pending Approvals Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <span>Pending Approvals</span>
          </h2>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300">
            {pendingUsers.length} waiting
          </span>
        </div>

        {pendingUsers.length === 0 ? (
          <Card padding="p-6" className="text-center text-slate-500 text-xs">
            ✓ No accounts pending approval. All volunteers are up to date!
          </Card>
        ) : (
          <div className="space-y-3">
            {pendingUsers.map((u) => {
              const isProcessing = processingId === u._id;
              return (
                <Card key={u._id} padding="p-4" className="border-amber-200 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/20">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} size="md" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                            {u.name}
                          </h3>
                          <Badge status="waitlisted" label="Under Review" size="sm" />
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 space-x-2">
                          <span>Phone: {u.phone}</span>
                          {u.upiId && <span>· UPI: {u.upiId}</span>}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Registered: {new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>

                    {/* Approve / Reject Actions */}
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={isProcessing}
                        onClick={() => handleReject(u._id)}
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      >
                        Reject
                      </Button>
                      <Button
                        variant="success"
                        size="sm"
                        disabled={isProcessing}
                        onClick={() => handleApprove(u._id)}
                        icon={CheckCircle2}
                      >
                        Approve Profile
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Approved Volunteers Section */}
      <div className="space-y-4 pt-4 border-t border-slate-200/80 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Approved Volunteer Directory</span>
          </h2>

          <div className="w-full sm:w-64">
            <Input
              placeholder="Search by name, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={Search}
            />
          </div>
        </div>

        {filteredApproved.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No Volunteers Found"
            description="No approved volunteers match your search."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredApproved.map((u) => (
              <Card key={u._id} padding="p-3.5">
                <div className="flex items-center gap-3">
                  <Avatar name={u.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">
                      {u.name}
                    </h3>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {u.phone}
                    </div>
                    {u.upiId && (
                      <div className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 truncate mt-0.5">
                        {u.upiId}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

