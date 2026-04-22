import { useEffect } from "react";
import { createBrowserRouter, Navigate, Outlet, useLocation } from "react-router";
import RootLayout from "./components/RootLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { BusinessProtectedRoute } from "./components/BusinessProtectedRoute";
import SalesPage from "./pages/SalesPage";
import MovementsPage from "./pages/MovementsPage";
import ProductsPage from "./pages/ProductsPage";
import PurchaseOrderPage from "./pages/PurchaseOrderPage";
import MorePage from "./pages/MorePage";
import ContactsPage from "./pages/ContactsPage";
import EmployeesPage from "./pages/EmployeesPage";
import SettingsPage from "./pages/SettingsPage";
import DiagnosticPage from "./pages/DiagnosticPage";
import ManualTestPage from "./pages/ManualTestPage";
import DirectAccessTest from "./pages/DirectAccessTest";
import QuickTestPage from "./pages/QuickTestPage";
import RLSSetupPage from "./pages/RLSSetupPage";
import CreateTablesPage from "./pages/CreateTablesPage";
import SimpleTestPage from "./pages/SimpleTestPage";
import CompleteTest from "./pages/CompleteTest";
import TestIndexPage from "./pages/TestIndexPage";
import FixRLSPage from "./pages/FixRLSPage";
import ServerStatusPage from "./pages/ServerStatusPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import VerifyPage from "./pages/VerifyPage";
import InvitePageDirect from "./pages/InvitePageDirect";
import TestStaticPage from "./pages/TestStaticPage";
import InviteNew from "./pages/InviteNew";
import TestInvite from "./pages/TestInvite";
import DiagnosticEmployeePage from "./pages/DiagnosticEmployeePage";
import SuperAdminPage from "./pages/SuperAdminPage";
import LandingPage from "./pages/LandingPage";
import MotionLabPage from "./pages/MotionLabPage";
import { useAuth } from "./contexts/AuthContext";
import CatalogPromptDemoPage from "./pages/CatalogPromptDemoPage";
import VirtualCatalogPublicPage from "./pages/VirtualCatalogPublicPage";
import VirtualCatalogAdminPage from "./pages/VirtualCatalogAdminPage";

/** Sincroniza la ruta actual con AuthProvider (mismo origen que el router) para excepciones como el modal de bloqueo en /superadmin. */
export const APP_PATHNAME_EVENT = "app:pathname";

const IS_DEV = import.meta.env.DEV;

// Providers are mounted in App.tsx above RouterProvider — just render Outlet here
function RootWithProviders() {
  const loc = useLocation();
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(APP_PATHNAME_EVENT, { detail: loc.pathname }));
  }, [loc.pathname]);
  return <Outlet />;
}

function HomeRoute() {
  const { user, loading } = useAuth();
  // Evita desmontar la ruta por completo (null): en móvil Chrome eso + toasts/portales
  // a veces provoca NotFoundError insertBefore al hidratar/reconciliar.
  if (loading) {
    return (
      <div
        className="min-h-[100dvh] bg-background"
        aria-busy="true"
        aria-label="Cargando"
      />
    );
  }
  if (user) return <Navigate to="/sales" replace />;
  return <LandingPage />;
}

export const router = createBrowserRouter([
  {
    element: <RootWithProviders />,
    children: [
      {
        index: true,
        Component: HomeRoute,
      },
      // Ruta pública para invitaciones - DEBE estar PRIMERO
      {
        path: "invite/:token",
        Component: InviteNew,
      },
      {
        path: "login",
        Component: LoginPage,
      },
      {
        path: "register",
        Component: RegisterPage,
      },
      {
        path: "verify",
        Component: VerifyPage,
      },
      {
        path: "auth",
        element: <Navigate to="/register" replace />,
      },
      // Super Admin: ruta pública (como /login); el acceso real lo protege la clave en la propia página y en el Edge Function.
      {
        path: "superadmin",
        Component: SuperAdminPage,
      },
      {
        path: "catalogo/:slug",
        Component: VirtualCatalogPublicPage,
      },
      // Rutas internas de diagnóstico/pruebas: solo en DEV para no exponerlas en producción.
      ...(IS_DEV
        ? [
            { path: "server-status", Component: ServerStatusPage },
            { path: "test-index", Component: TestIndexPage },
            { path: "diagnostic", Component: DiagnosticPage },
            { path: "manual-test", Component: ManualTestPage },
            { path: "direct-test", Component: DirectAccessTest },
            { path: "quick-test", Component: QuickTestPage },
            { path: "motion-lab", Component: MotionLabPage },
            { path: "demo-catalogo", Component: CatalogPromptDemoPage },
            { path: "rls-setup", Component: RLSSetupPage },
            { path: "create-tables", Component: CreateTablesPage },
            { path: "simple-test", Component: SimpleTestPage },
            { path: "complete-test", Component: CompleteTest },
            { path: "fix-rls", Component: FixRLSPage },
            { path: "test-static", Component: TestStaticPage },
            { path: "invite-direct/:token", Component: InvitePageDirect },
            { path: "test-invite", Component: TestInvite },
            { path: "diagnostic-employee", Component: DiagnosticEmployeePage },
          ]
        : []),
      {
        path: "",
        element: (
          <BusinessProtectedRoute>
            <RootLayout />
          </BusinessProtectedRoute>
        ),
        children: [
          { index: true, element: <Navigate to="/sales" replace /> },
          { path: "sales", Component: SalesPage },
          { path: "movements", Component: MovementsPage },
          { path: "products", Component: ProductsPage },
          { path: "purchase-order", Component: PurchaseOrderPage },
          { path: "more", Component: MorePage },
          { path: "contacts", Component: ContactsPage },
          { path: "employees", Component: EmployeesPage },
          { path: "settings", Component: SettingsPage },
          { path: "catalog/settings", Component: VirtualCatalogAdminPage },
        ],
      },
    ],
  },
]);