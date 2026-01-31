import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import BudgetView from './components/budget/BudgetView';
import AccountView from './components/accounts/AccountView';
import LoginPage from './components/auth/LoginPage';
import ProtectedRoute from './components/auth/ProtectedRoute';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/budget" replace />} />
          <Route path="budget" element={<BudgetView />} />
          <Route path="accounts/:accountId" element={<AccountView />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
