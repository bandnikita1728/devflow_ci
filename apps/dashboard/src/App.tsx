import { Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { DashboardPage } from '@/pages/DashboardPage'
import { ReviewsPage } from '@/pages/ReviewsPage'
import { ReviewDetailPage } from '@/pages/ReviewDetailPage'
import { LoginPage } from '@/pages/LoginPage'
import { PrivacyPage } from '@/pages/PrivacyPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { ReposPage } from '@/pages/ReposPage'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { LandingPage } from '@/pages/LandingPage'
import { Navigate } from 'react-router-dom'

function IndexRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : <Navigate to="/landing" replace />;
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<IndexRoute />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/repos" element={<ReposPage />} />
            <Route path="/reviews" element={<ReviewsPage />} />
            <Route path="/reviews/:id" element={<ReviewDetailPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  )
}

export default App
