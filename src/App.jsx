import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { ClientsPage } from './pages/ClientsPage'
import { ClientFormPage } from './pages/ClientFormPage'
import { ClientDetailPage } from './pages/ClientDetailPage'
import { InterventionFormPage } from './pages/InterventionFormPage'
import { InterventionsListPage } from './pages/InterventionsListPage'
import { AdminPage } from './pages/AdminPage'

function AppLayout({ children, adminOnly }) {
  return (
    <ProtectedRoute adminOnly={adminOnly}>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<AppLayout adminOnly><DashboardPage /></AppLayout>} />
          <Route path="/clients" element={<AppLayout><ClientsPage /></AppLayout>} />
          <Route path="/clients/nouveau" element={<AppLayout><ClientFormPage /></AppLayout>} />
          <Route path="/clients/:id" element={<AppLayout><ClientDetailPage /></AppLayout>} />
          <Route path="/interventions" element={<AppLayout><InterventionsListPage /></AppLayout>} />
          <Route path="/intervention/nouveau" element={<AppLayout><InterventionFormPage /></AppLayout>} />
          <Route path="/admin" element={<AppLayout adminOnly><AdminPage /></AppLayout>} />
          <Route path="*" element={<Navigate to="/clients" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
