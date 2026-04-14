import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AppShell } from './components/AppShell';
import { AdminLayout } from './components/AdminLayout';
import Home from './pages/Home';
import Focus from './pages/Focus';
import Tasks from './pages/Tasks';
import Work from './pages/Work';
import Stats from './pages/Stats';
import Settings from './pages/Settings';
import Notes from './pages/Notes';
import Admin from './pages/Admin';
import Login from './pages/Login';
import Register from './pages/Register';

function Protected() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-lg font-bold text-[color:var(--nudge-text)]">
        Loading your calm corner…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<Protected />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Admin />} />
            </Route>
            <Route path="/" element={<AppShell />}>
              <Route index element={<Home />} />
              <Route path="focus" element={<Focus />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="work" element={<Work />} />
              <Route path="notes" element={<Notes />} />
              <Route path="stats" element={<Stats />} />
              <Route path="settings" element={<Settings />} />
              <Route path="profile" element={<Settings />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ThemeProvider>
    </AuthProvider>
  );
}
