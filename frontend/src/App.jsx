import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import AskPage from './pages/AskPage';
import AuthPage from './pages/AuthPage';
import ProtectedRoute from './components/ProtectedRoute';
import WorkflowPage from './pages/WorkflowPage';
import ApprovalsPage from './pages/ApprovalsPage';
import IngestPage from './pages/IngestPage';
import DashboardPage from './pages/DashboardPage';
import SessionHistoryPage from './pages/SessionHistoryPage';

function protectedPage(page, requiredRole) {
  return <ProtectedRoute requiredRole={requiredRole}><Layout>{page}</Layout></ProtectedRoute>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route
          path="/"
          element={protectedPage(<DashboardPage />)}
        />
        <Route path="/ask" element={protectedPage(<AskPage />)} />
        <Route path="/workflow" element={protectedPage(<WorkflowPage />)} />
        <Route path="/approvals/:approvalId" element={protectedPage(<ApprovalsPage />)} />
        <Route path="/sessions/:sessionId" element={protectedPage(<SessionHistoryPage />)} />
        <Route path="/ingest" element={protectedPage(<IngestPage />)} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;