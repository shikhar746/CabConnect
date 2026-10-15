import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { RequireAuth, GuestOnly } from './components/RouteGuards';
import { FullPageSpinner } from './components/common';
import AppLayout from './layouts/AppLayout';

const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const NotFound = lazy(() => import('./pages/NotFound'));

const BookRide = lazy(() => import('./pages/rider/BookRide'));
const RideDetail = lazy(() => import('./pages/rider/RideDetail'));
const RideHistory = lazy(() => import('./pages/rider/RideHistory'));
const Profile = lazy(() => import('./pages/rider/Profile'));
const SupportList = lazy(() => import('./pages/rider/SupportList'));
const TicketDetail = lazy(() => import('./pages/rider/TicketDetail'));
const DriverProfile = lazy(() => import('./pages/rider/DriverProfile'));

const DriverDashboard = lazy(() => import('./pages/driver/DriverDashboard'));
const DriverEarnings = lazy(() => import('./pages/driver/DriverEarnings'));
const DriverReviews = lazy(() => import('./pages/driver/DriverReviews'));

const AdminOverview = lazy(() => import('./pages/admin/AdminOverview'));
const AdminRides = lazy(() => import('./pages/admin/AdminRides'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminPayments = lazy(() => import('./pages/admin/AdminPayments'));
const AdminPromos = lazy(() => import('./pages/admin/AdminPromos'));
const AdminSos = lazy(() => import('./pages/admin/AdminSos'));
const AdminOutbox = lazy(() => import('./pages/admin/AdminOutbox'));

export default function App() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route element={<GuestOnly />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            {/* Shared by riders & drivers */}
            <Route element={<RequireAuth roles={['rider', 'driver']} />}>
              <Route path="/profile" element={<Profile />} />
              <Route path="/support" element={<SupportList />} />
              <Route path="/support/:id" element={<TicketDetail />} />
            </Route>
            <Route path="/ride/:id" element={<RideDetail />} />
            <Route path="/drivers/:id" element={<DriverProfile />} />

            <Route element={<RequireAuth roles={['rider']} />}>
              <Route path="/book" element={<BookRide />} />
              <Route path="/history" element={<RideHistory />} />
            </Route>

            <Route element={<RequireAuth roles={['driver']} />}>
              <Route path="/driver" element={<DriverDashboard />} />
              <Route path="/driver/earnings" element={<DriverEarnings />} />
              <Route path="/driver/history" element={<RideHistory />} />
              <Route path="/driver/reviews" element={<DriverReviews />} />
            </Route>

            <Route element={<RequireAuth roles={['admin']} />}>
              <Route path="/admin" element={<AdminOverview />} />
              <Route path="/admin/rides" element={<AdminRides />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/payments" element={<AdminPayments />} />
              <Route path="/admin/promos" element={<AdminPromos />} />
              <Route path="/admin/support" element={<SupportList admin />} />
              <Route path="/admin/support/:id" element={<TicketDetail admin />} />
              <Route path="/admin/sos" element={<AdminSos />} />
              <Route path="/admin/outbox" element={<AdminOutbox />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
