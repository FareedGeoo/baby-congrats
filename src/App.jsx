import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Home } from './pages/Home.jsx';
import { I18nProvider, useI18n } from './i18n/index.js';

const AdminPrint = lazy(() => import('./pages/AdminPrint.jsx').then((module) => ({
  default: module.AdminPrint,
})));
const Admin = lazy(() => import('./pages/Admin.jsx').then((module) => ({
  default: module.Admin,
})));

function SkipLink() {
  const { t } = useI18n();

  return (
    <a
      href="#main"
      className="skip-link fixed start-4 top-4 z-[100] -translate-y-24 rounded-full bg-white px-4 py-3 font-bold text-slate-900 shadow-lg focus:translate-y-0"
    >
      {t('skipLink')}
    </a>
  );
}

function AppRoutes() {
  const { t } = useI18n();

  return (
    <>
      <SkipLink />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/admin/print"
          element={(
            <Suspense fallback={(
              <main id="main" className="admin-access theme-bg theme-text" role="status" aria-live="polite">
                {t('admin.printLoading')}
              </main>
            )}>
              <AdminPrint />
            </Suspense>
          )}
        />
        <Route
          path="/admin"
          element={(
            <Suspense fallback={(
              <main id="main" className="admin-access theme-bg theme-text" role="status" aria-live="polite">
                {t('admin.authChecking')}
              </main>
            )}>
              <Admin />
            </Suspense>
          )}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </I18nProvider>
  );
}

export default App;