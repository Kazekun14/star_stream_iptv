import React from "react";
import { useTheme } from "./theme";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import AuthGate from "./components/AuthGate";
import Shell from "./components/Shell";
import AdminPortal from "./pages/adminPortal";
import DashboardPage from "./pages/DashboardPage";
import CategoriesPage from "./pages/live/CategoriesPage";
import ChannelsPage from "./pages/live/ChannelsPage";
import RegUsersPage from "./pages/users/RegUsersPage";
import { ToastProvider } from "./components/Toast";
import PackagesPage from "./pages/packages/PackagesPage";
import PackageChannelsPage from "./pages/packages/PackageChannelsPage";
import SettingsPage from "./pages/SettingsPage";

const pageTitles: Record<string, string> = {
  "/portal": "Portal",
  "/dashboard": "Dashboard",
  "/categories": "Categories",
  "/packages": "Packages",
  "/package-channels": "Package Channels",
  "/channels": "Channels",
  "/users": "Users",
  "/settings": "Settings",
};

function LegacyRedirect({ to }: { to: string }) {
  const { search, hash, state } = useLocation();
  return <Navigate to={{ pathname: to, search, hash }} state={state} replace />;
}

export default function App({ baseTitle }: { baseTitle: string }) {
  useTheme();
  const { pathname } = useLocation();
  const pagePath = pathname.replace(/\/+$/, "").toLowerCase() || "/";
  const pageTitle = pageTitles[pagePath];

  React.useEffect(() => {
    document.title = pageTitle ? `${baseTitle} | ${pageTitle}` : baseTitle;
  }, [baseTitle, pageTitle]);

  return (
    <ToastProvider>
      <Routes>
        <Route path="/adminDashboard" element={<LegacyRedirect to="/dashboard" />} />
        <Route path="/adminCategories" element={<LegacyRedirect to="/categories" />} />
        <Route path="/adminPackages" element={<LegacyRedirect to="/packages" />} />
        <Route path="/adminPackageChannels" element={<LegacyRedirect to="/package-channels" />} />
        <Route path="/adminChannels" element={<LegacyRedirect to="/channels" />} />
        <Route path="/adminUsers" element={<LegacyRedirect to="/users" />} />
        <Route path="/adminSettings" element={<LegacyRedirect to="/settings" />} />
        <Route path="/packages/channels" element={<LegacyRedirect to="/package-channels" />} />
        <Route path="/adminAssignPackage" element={<LegacyRedirect to="/package-channels" />} />
        <Route path="/live/categories" element={<LegacyRedirect to="/categories" />} />
        <Route path="/live/channels" element={<LegacyRedirect to="/channels" />} />
        <Route path="/reg-users" element={<LegacyRedirect to="/users" />} />
        <Route path="/" element={<LegacyRedirect to="/dashboard" />} />
        <Route path="/portal" element={<AdminPortal />} />
        <Route path="/adminPortal" element={<LegacyRedirect to="/portal" />} />
        <Route path="/login" element={<LegacyRedirect to="/portal" />} />
        <Route path="/settings" element={<AuthGate><Shell><SettingsPage /></Shell></AuthGate>} />

        <Route
          path="/dashboard"
          element={
            <AuthGate>
              <Shell>
                <DashboardPage />
              </Shell>
            </AuthGate>
          }
        />

        <Route
          path="/categories"
          element={
            <AuthGate>
              <Shell>
                <CategoriesPage />
              </Shell>
            </AuthGate>
          }
        />

        <Route
          path="/packages"
          element={
            <AuthGate>
              <Shell>
                <PackagesPage />
              </Shell>
            </AuthGate>
          }
        />

        <Route
          path="/package-channels"
          element={
            <AuthGate>
              <Shell>
                <PackageChannelsPage />
              </Shell>
            </AuthGate>
          }
        />

        <Route
          path="/channels"
          element={
            <AuthGate>
              <Shell>
                <ChannelsPage />
              </Shell>
            </AuthGate>
          }
        />

      <Route
        path="/users"
        element={
          <AuthGate>
            <Shell>
              <RegUsersPage />
            </Shell>
          </AuthGate>
        }
      />

      

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </ToastProvider>
  );
}
