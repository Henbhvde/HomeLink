import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AdminLayout from '../layouts/AdminLayout';
import PlatformLayout from '../layouts/PlatformLayout';
import AccountantLayout from '../layouts/AccountantLayout';
import StaffLayout from '../layouts/StaffLayout';
import ResidentLayout from '../layouts/ResidentLayout';
import { useAuth } from '../contexts/AuthContext';

const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const BuildingManagementPage = lazy(() => import('../pages/BuildingManagementPage'));
const ResidentsPage = lazy(() => import('../pages/ResidentsPage'));
const BillingPage = lazy(() => import('../pages/BillingPage'));
const PaymentsPage = lazy(() => import('../pages/PaymentsPage'));
const MetersPage = lazy(() => import('../pages/MetersPage'));
const MaintenancePage = lazy(() => import('../pages/MaintenancePage'));
const ReportsPage = lazy(() => import('../pages/ReportsPage'));
const SettingsPage = lazy(() => import('../pages/SettingsPage'));
const AccountantDashboardPage = lazy(() => import('../pages/AccountantDashboardPage'));
const ExpensePage = lazy(() => import('../pages/ExpensePage'));
const StaffWorkOrdersPage = lazy(() => import('../pages/StaffWorkOrdersPage'));
const PlatformDashboardPage = lazy(() => import('../pages/PlatformDashboardPage'));
const PlatformRequestsPage = lazy(() => import('../pages/PlatformRequestsPage'));
const PlatformTenantsPage = lazy(() => import('../pages/PlatformTenantsPage'));
const PlatformRevenuePage = lazy(() => import('../pages/PlatformRevenuePage'));
const PlatformSettingsPage = lazy(() => import('../pages/PlatformSettingsPage'));
const LandingPage = lazy(() => import('../pages/LandingPage'));
const AuthPage = lazy(() => import('../pages/AuthPage'));
const ResidentPortalPage = lazy(() => import('../pages/ResidentPortalPage'));
const ResidentPaymentsPage = lazy(() => import('../pages/ResidentPaymentsPage'));
const ResidentServicesPage = lazy(() => import('../pages/ResidentServicesPage'));
const ResidentCommunityPage = lazy(() => import('../pages/ResidentCommunityPage'));
const PricingPage = lazy(() => import('../pages/PricingPage'));
const GoogleCallbackPage = lazy(() => import('../pages/GoogleCallbackPage'));
const AccessDeniedPage = lazy(() => import('../pages/AccessDeniedPage'));
const SohRegistrationPage = lazy(() => import('../pages/SohRegistrationPage'));
const ResidentJoinPage = lazy(() => import('../pages/ResidentJoinPage'));
const InvitePage = lazy(() => import('../pages/InvitePage'));

const LazyPage = ({ element }: { element: JSX.Element }) => (
  <Suspense fallback={<div className="min-h-screen bg-[#121211] px-4 py-10 text-center text-sm text-sand-400">Уншиж байна...</div>}>
    {element}
  </Suspense>
);

function AppRoutes() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const isManagerWorkspaceUser = user?.role === 'manager';

  if (isLoading) return <div className="min-h-screen bg-[#121211] px-4 py-10 text-center text-sm text-sand-400">Уншиж байна...</div>;

  return (
    <Routes>
      <Route path="/login" element={<LazyPage element={<LandingPage />} />} />
      <Route path="/signup" element={<LazyPage element={<LandingPage />} />} />
      <Route path="/register" element={<LazyPage element={<AuthPage screen="register" />} />} />
      <Route path="/forgot-password" element={<LazyPage element={<AuthPage screen="forgot-password" />} />} />
      <Route path="/verify-otp" element={<LazyPage element={<AuthPage screen="verify-otp" />} />} />
      <Route path="/reset-password" element={<LazyPage element={<AuthPage screen="reset-password" />} />} />
      <Route path="/auth/callback" element={<LazyPage element={<GoogleCallbackPage />} />} />
      <Route path="/onboarding" element={<LazyPage element={<AuthPage screen="onboarding" />} />} />
      <Route path="/choose-role" element={<Navigate to="/soh/register" replace />} />
      <Route path="/soh/register" element={<LazyPage element={<SohRegistrationPage />} />} />
      <Route path="/resident/join" element={<LazyPage element={<ResidentJoinPage />} />} />
      <Route path="/invite" element={<LazyPage element={<InvitePage />} />} />
      <Route path="/" element={<LazyPage element={<LandingPage />} />} />
      <Route path="/pricing" element={<LazyPage element={<PricingPage />} />} />
      <Route
        path="/manager"
        element={isAuthenticated && isManagerWorkspaceUser ? <AdminLayout /> : <LazyPage element={<AccessDeniedPage expectedRole="manager" />} />}
      >
        <Route index element={<LazyPage element={<DashboardPage />} />} />
        <Route path="buildings" element={<LazyPage element={<BuildingManagementPage />} />} />
        <Route path="residents" element={<LazyPage element={<ResidentsPage />} />} />
        <Route path="billing" element={<Navigate to="/manager" replace />} />
        <Route path="payments" element={<Navigate to="/manager" replace />} />
        <Route path="meters" element={<Navigate to="/manager" replace />} />
        <Route path="maintenance" element={<LazyPage element={<MaintenancePage />} />} />
        <Route path="reports" element={<LazyPage element={<ReportsPage />} />} />
        <Route path="settings" element={<LazyPage element={<SettingsPage />} />} />
      </Route>
      <Route path="/dashboard/*" element={<Navigate to="/manager" replace />} />
      <Route
        path="/accountant"
        element={isAuthenticated && user?.role === 'accountant' ? <AccountantLayout /> : <LazyPage element={<AccessDeniedPage expectedRole="accountant" />} />}
      >
        <Route index element={<LazyPage element={<AccountantDashboardPage />} />} />
        <Route path="meters" element={<LazyPage element={<MetersPage />} />} />
        <Route path="billing" element={<LazyPage element={<BillingPage />} />} />
        <Route path="payments" element={<LazyPage element={<PaymentsPage />} />} />
        <Route path="expenses" element={<LazyPage element={<ExpensePage />} />} />
      </Route>
      <Route
        path="/staff"
        element={isAuthenticated && user?.role === 'staff' ? <StaffLayout /> : <LazyPage element={<AccessDeniedPage expectedRole="staff" />} />}
      >
        <Route index element={<LazyPage element={<StaffWorkOrdersPage />} />} />
      </Route>
      <Route
        path="/platform"
        element={isAuthenticated && user?.role === 'super_admin' ? <PlatformLayout /> : <LazyPage element={<AccessDeniedPage expectedRole="super_admin" />} />}
      >
        <Route index element={<LazyPage element={<PlatformDashboardPage />} />} />
        <Route path="requests" element={<LazyPage element={<PlatformRequestsPage />} />} />
        <Route path="tenants" element={<LazyPage element={<PlatformTenantsPage />} />} />
        <Route path="revenue" element={<LazyPage element={<PlatformRevenuePage />} />} />
        <Route path="settings" element={<LazyPage element={<PlatformSettingsPage />} />} />
      </Route>
      <Route
        path="/resident"
        element={isAuthenticated && user?.role === 'resident' ? <ResidentLayout /> : <LazyPage element={<AccessDeniedPage expectedRole="resident" />} />}
      >
        <Route index element={<LazyPage element={<ResidentPortalPage />} />} />
        <Route path="payments" element={<LazyPage element={<ResidentPaymentsPage />} />} />
        <Route path="services" element={<LazyPage element={<ResidentServicesPage />} />} />
        <Route path="community" element={<LazyPage element={<ResidentCommunityPage />} />} />
      </Route>
    </Routes>
  );
}

export default AppRoutes;
