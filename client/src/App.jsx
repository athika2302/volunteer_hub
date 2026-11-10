import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Navbar from './components/Navbar.jsx';
import Skeleton from './components/Skeleton.jsx';

// Auth screen
import AuthPage from './pages/AuthPage.jsx';

// Volunteer screens
import EventsPage from './pages/volunteer/EventsPage.jsx';
import EventDetailPage from './pages/volunteer/EventDetailPage.jsx';
import MyShiftsPage from './pages/volunteer/MyShiftsPage.jsx';
import MyLedgerPage from './pages/volunteer/MyLedgerPage.jsx';
import NotificationsPage from './pages/volunteer/NotificationsPage.jsx';

// Admin screens
import AdminEventsPage from './pages/admin/AdminEventsPage.jsx';
import AdminCreateEventPage from './pages/admin/AdminCreateEventPage.jsx';
import AdminAttendancePage from './pages/admin/AdminAttendancePage.jsx';
import AdminCheckinPage from './pages/admin/AdminCheckinPage.jsx';
import AdminPaymentsPage from './pages/admin/AdminPaymentsPage.jsx';
import AdminVolunteersPage from './pages/admin/AdminVolunteersPage.jsx';

function MainApp() {
  const { user, loading, isAdmin, isApproved, apiFetch } = useAuth();

  // Navigation tab state
  const [currentTab, setTab] = useState(isAdmin ? 'admin-events' : 'events');
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [targetEventForAttendance, setTargetEventForAttendance] = useState(null);
  const [targetEventForCheckin, setTargetEventForCheckin] = useState(null);
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  // Sync initial tab when user role changes
  useEffect(() => {
    if (isAdmin) {
      setTab('admin-events');
    } else {
      setTab('events');
      fetchUnreadCount();
    }
  }, [isAdmin, user?._id]);

  const fetchUnreadCount = async () => {
    if (!user || user.role !== 'volunteer') return;
    try {
      const data = await apiFetch('/api/checkin/notifications');
      setUnreadAlerts(data.unreadCount || 0);
    } catch {
      // Ignore background notification fetch errors
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
        <div className="w-full max-w-sm space-y-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-bold text-xl mx-auto animate-pulse">
            VH
          </div>
          <Skeleton variant="title" className="mx-auto" />
          <Skeleton variant="text" count={2} />
        </div>
      </div>
    );
  }

  // Not logged in or pending approval
  if (!user || (user.role === 'volunteer' && !user.approved)) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-150">
      {/* Top Navbar & Mobile Bottom Tab Bar */}
      <Navbar
        currentTab={currentTab}
        setTab={(tab) => {
          setSelectedEventId(null);
          setTab(tab);
        }}
        unreadCount={unreadAlerts}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8">
        {/* Volunteer Views */}
        {!isAdmin && (
          <>
            {currentTab === 'events' && (
              selectedEventId ? (
                <EventDetailPage
                  eventId={selectedEventId}
                  onBack={() => setSelectedEventId(null)}
                  onGoToShifts={() => {
                    setSelectedEventId(null);
                    setTab('my-shifts');
                  }}
                />
              ) : (
                <EventsPage onSelectEvent={(id) => setSelectedEventId(id)} />
              )
            )}

            {currentTab === 'my-shifts' && (
              <MyShiftsPage onFindEvents={() => setTab('events')} />
            )}

            {currentTab === 'ledger' && <MyLedgerPage />}

            {currentTab === 'notifications' && <NotificationsPage />}
          </>
        )}

        {/* Admin Views */}
        {isAdmin && (
          <>
            {currentTab === 'admin-events' && (
              <AdminEventsPage
                onCreateNew={() => setTab('admin-create')}
                onNavigateAttendance={(id) => {
                  setTargetEventForAttendance(id);
                  setTab('admin-attendance');
                }}
                onNavigateCheckin={(id) => {
                  setTargetEventForCheckin(id);
                  setTab('admin-checkin');
                }}
              />
            )}

            {currentTab === 'admin-create' && (
              <AdminCreateEventPage
                onEventCreated={() => setTab('admin-events')}
              />
            )}

            {currentTab === 'admin-attendance' && (
              <AdminAttendancePage selectedEventId={targetEventForAttendance} />
            )}

            {currentTab === 'admin-checkin' && (
              <AdminCheckinPage selectedEventId={targetEventForCheckin} />
            )}

            {currentTab === 'admin-payments' && <AdminPaymentsPage />}

            {currentTab === 'admin-volunteers' && <AdminVolunteersPage />}
          </>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <MainApp />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
