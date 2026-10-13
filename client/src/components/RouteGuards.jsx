import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, homeFor } from '../context/AuthContext';
import { FullPageSpinner } from './common';

/** Requires login; optionally restricts to specific roles. */
export function RequireAuth({ roles }) {
  const { user, booting } = useAuth();
  const location = useLocation();
  if (booting) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <Outlet />;
}

/** For login/register pages: signed-in users go to their dashboard. */
export function GuestOnly() {
  const { user, booting } = useAuth();
  if (booting) return <FullPageSpinner />;
  if (user) return <Navigate to={homeFor(user.role)} replace />;
  return <Outlet />;
}
