import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Companies from "./pages/Companies";
import HR from "./pages/HR";
import Attendance from "./pages/Attendance";
import Finance from "./pages/Finance";
import Inventory from "./pages/Inventory";
import Barter from "./pages/Barter";
import Sales from "./pages/Sales";
import Meetings from "./pages/Meetings";
import Tasks from "./pages/Tasks";
import Messages from "./pages/Messages";
import SettingsPage from "./pages/Settings";
import Notifications from "./pages/Notifications";
import Obligations from "./pages/Obligations";
import Members from "./pages/Members";
import DashboardLayout from "./layouts/DashboardLayout";
import Marketing from "./pages/Marketing";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Organization from "./pages/Organization";
import OrgDashboard from "./pages/organization/OrgDashboard";
import VendorModule from "./pages/organization/VendorModule";
import OrgRatings from "./pages/organization/OrgRatings";
import { ORG_CONFIGS } from "./pages/organization/configs";
import Reports from "./pages/Reports";
import PartnerEvaluation from "./pages/PartnerEvaluation";
import Assembly from "./pages/Assembly";
import Files from "./pages/Files";
import Notes from "./pages/Notes";
import CompanyDatabase from "./pages/CompanyDatabase";
import ObligationHistory from "./pages/ObligationHistory";
import MembershipForum from "./pages/MembershipForum";
import Proposals from "./pages/Proposals";
import Invitations from "./pages/Invitations";
import ContactLists from "./pages/ContactLists";
import PublicForm from "./pages/PublicForm";

// Global axios interceptor: expired/invalid token → auto logout + redirect to login.
// Only 401 (token invalid/expired) triggers logout — 403 (not authorized) shows
// the API error normally so the user stays where they are. Otherwise simply
// browsing into an admin-only module would log non-admins out.
let _redirecting = false;
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || "";
    // Skip the login endpoint itself (that 401 is a real "wrong password" case)
    const isAuthAttempt = url.includes("/auth/login") || url.includes("/form/");
    if (!isAuthAttempt && status === 401) {
      if (!_redirecting) {
        _redirecting = true;
        try { localStorage.removeItem("token"); } catch { /* ignore */ }
        // Give current state a tick to settle, then hard redirect
        setTimeout(() => {
          _redirecting = false;
          if (window.location.pathname !== "/login") {
            window.location.replace("/login");
          }
        }, 50);
      }
    }
    return Promise.reject(error);
  }
);

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/form/:token" element={<PublicForm />} />
          
          {/* Protected Routes */}
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="companies" element={<Companies />} />
            <Route path="hr" element={<HR />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="finance" element={<Finance />} />
            <Route path="finance/inventory" element={<Inventory />} />
            <Route path="barter" element={<Barter />} />
            <Route path="sales" element={<Sales />} />
            <Route path="sales/company-database" element={<CompanyDatabase />} />
            <Route path="sales/members" element={<Members />} />
            <Route path="sales/obligations" element={<Obligations />} />
            <Route path="sales/obligation-history" element={<ObligationHistory />} />
            <Route path="sales/membership-forum" element={<MembershipForum />} />
            <Route path="sales/proposals" element={<Proposals />} />
            <Route path="sales/invitations" element={<Invitations />} />
            <Route path="sales/contact-lists" element={<ContactLists />} />
            <Route path="marketing" element={<Marketing />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="organization" element={<OrgDashboard />} />
            <Route path="organization/ratings" element={<OrgRatings />} />
            <Route path="organization/venues" element={<VendorModule config={ORG_CONFIGS.venues} />} />
            <Route path="organization/catering" element={<VendorModule config={ORG_CONFIGS.catering} />} />
            <Route path="organization/decor" element={<VendorModule config={ORG_CONFIGS.decor} />} />
            <Route path="organization/musicians" element={<VendorModule config={ORG_CONFIGS.musicians} />} />
            <Route path="organization/photovideo" element={<VendorModule config={ORG_CONFIGS.photovideo} />} />
            <Route path="organization/transport" element={<VendorModule config={ORG_CONFIGS.transport} />} />
            <Route path="organization/materials" element={<VendorModule config={ORG_CONFIGS.materials} />} />
            <Route path="activities" element={<Organization />} />
            <Route path="reports" element={<Reports />} />
            <Route path="partner-evaluation" element={<PartnerEvaluation />} />
            <Route path="meetings" element={<Meetings />} />
            <Route path="assembly" element={<Assembly />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="messages" element={<Messages />} />
            <Route path="files" element={<Files />} />
            <Route path="notes" element={<Notes />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="notifications" element={<Notifications />} />
          </Route>
          
          {/* Redirect unknown routes */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
