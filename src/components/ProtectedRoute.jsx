import { Navigate } from 'react-router-dom';

export function ProtectedRoute({ session, children }) {
  if (!session) {
    return <Navigate to="/admin?signin=1" replace />;
  }
  return children;
}