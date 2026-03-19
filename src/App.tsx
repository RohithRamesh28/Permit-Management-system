import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AuthGuard from './components/AuthGuard';
import PermitListView from './components/PermitListView';
import PermitForm from './components/PermitForm';
import NewPermitForm from './components/NewPermitForm';
import PermitDetailView from './components/PermitDetailView';
import { triggerJobSyncIfNeeded } from './services/jobSync';

function AppContent() {
  const navigate = useNavigate();

  useEffect(() => {
    triggerJobSyncIfNeeded();
    const interval = setInterval(triggerJobSyncIfNeeded, 2 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleNavigate = (view: string) => {
    if (view === 'list') {
      navigate('/');
    } else if (view === 'new') {
      navigate('/new');
    }
  };

  const handleSelectPermit = (permitId: string) => {
    navigate(`/permit/${permitId}`);
  };

  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Routes>
          <Route
            path="/"
            element={
              <PermitListView
                onNavigate={handleNavigate}
                onSelectPermit={handleSelectPermit}
              />
            }
          />
          <Route
            path="/new"
            element={<NewPermitForm onNavigate={handleNavigate} />}
          />
          <Route
            path="/approve/:id"
            element={<PermitFormWrapper mode="approve" onNavigate={handleNavigate} />}
          />
          <Route
            path="/resubmit/:id"
            element={<PermitFormWrapper mode="rejected" onNavigate={handleNavigate} />}
          />
          <Route
            path="/permit/:id"
            element={<PermitDetailViewWrapper onNavigate={handleNavigate} />}
          />
        </Routes>
      </div>
    </AuthGuard>
  );
}

function PermitFormWrapper({ mode, onNavigate }: { mode: 'approve' | 'rejected'; onNavigate: (view: string) => void }) {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <div>Permit not found</div>;
  }

  return <PermitForm mode={mode} permitId={parseInt(id)} onNavigate={onNavigate} />;
}

function PermitDetailViewWrapper({ onNavigate }: { onNavigate: (view: string) => void }) {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <div>Permit not found</div>;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const readOnlyMode = searchParams.get('readOnly') === 'true';

  return <PermitDetailView permitId={id} onNavigate={onNavigate} readOnlyMode={readOnlyMode} />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
