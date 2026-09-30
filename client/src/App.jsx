import { BrowserRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import AdminLayout from './layouts/AdminLayout';
import AppLayout from './layouts/AppLayout';
import HomePage from './pages/HomePage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminLoginPage from './pages/admin/AdminLoginPage';
import TeamSquadPage from './pages/admin/TeamSquadPage';
import TeamsPage from './pages/admin/TeamsPage';
import TournamentPage from './pages/admin/TournamentPage';
import MatchesPage from './pages/admin/MatchesPage';
import MatchLineupPage from './pages/admin/MatchLineupPage';
import MatchScoringPage from './pages/admin/MatchScoringPage';
import MatchAuditPage from './pages/admin/MatchAuditPage';
import LiveMatchPage from './pages/public/LiveMatchPage';
import PublicMatchesPage from './pages/public/MatchesPage';
import StandingsPage from './pages/public/StandingsPage';
import StatsPage from './pages/public/StatsPage';
import TeamPage from './pages/public/TeamPage';
import PlayerPage from './pages/public/PlayerPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="match/:matchId" element={<LiveMatchPage />} />
            <Route path="matches" element={<PublicMatchesPage />} />
            <Route path="standings" element={<StandingsPage />} />
            <Route path="stats" element={<StatsPage />} />
            <Route path="teams/:teamId" element={<TeamPage />} />
            <Route path="players/:playerId" element={<PlayerPage />} />
          </Route>
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="matches/:matchId/lineup" element={<MatchLineupPage />} />
              <Route path="matches/:matchId/scoring" element={<MatchScoringPage />} />
              <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']} />}>
                <Route path="tournament" element={<TournamentPage />} />
                <Route path="teams" element={<TeamsPage />} />
                <Route path="teams/:teamId" element={<TeamSquadPage />} />
                <Route path="matches" element={<MatchesPage />} />
                <Route path="matches/:matchId/audit" element={<MatchAuditPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
