import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { api } from './api/client';
import { useTelegram } from './hooks/useTelegram';
import { AdminPage } from './pages/AdminPage';
import { ResultPage } from './pages/ResultPage';
import { TestList } from './pages/TestList';
import { TestRunner } from './pages/TestRunner';

function ProtectedAdminRoute({
  role,
  loading,
}: {
  role: 'STUDENT' | 'ADMIN' | null;
  loading: boolean;
}) {
  if (loading) {
    return <div className="page">Проверка доступа...</div>;
  }

  if (role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  return <AdminPage />;
}

function AppShell() {
  const { user } = useTelegram();
  const [role, setRole] = useState<'STUDENT' | 'ADMIN' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getMe()
      .then((data) => {
        setRole(data.user.role);
      })
      .catch(() => {
        setRole('STUDENT');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const isAdmin = role === 'ADMIN';

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Mini App Tests</h1>
          <p className="muted">{user?.first_name ?? 'Пользователь'} · Telegram mini app</p>
        </div>
      </header>

      <nav className="nav">
        <NavLink to="/" end>
          Все тесты
        </NavLink>
        {isAdmin && <NavLink to="/admin">Админ</NavLink>}
      </nav>

      <Routes>
        <Route path="/" element={<TestList />} />
        <Route path="/test/:testId" element={<TestRunner />} />
        <Route path="/result/:attemptId" element={<ResultPage />} />
        <Route
          path="/admin"
          element={<ProtectedAdminRoute role={role} loading={loading} />}
        />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
