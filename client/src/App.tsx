import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import BudgetView from './components/budget/BudgetView';
import AccountView from './components/accounts/AccountView';

function App() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/budget" replace />} />
        <Route path="budget" element={<BudgetView />} />
        <Route path="accounts/:accountId" element={<AccountView />} />
      </Route>
    </Routes>
  );
}

export default App;
