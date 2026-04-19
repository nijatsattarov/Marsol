import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Companies from "./pages/Companies";
import HR from "./pages/HR";
import Attendance from "./pages/Attendance";
import Finance from "./pages/Finance";
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
import Organization from "./pages/Organization";
import OrgDashboard from "./pages/organization/OrgDashboard";
import VendorModule from "./pages/organization/VendorModule";
import OrgRatings from "./pages/organization/OrgRatings";
import { ORG_CONFIGS } from "./pages/organization/configs";
import Reports from "./pages/Reports";
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
            <Route path="organization" element={<OrgDashboard />} />
            <Route path="organization/ratings" element={<OrgRatings />} />
            <Route path="organization/venues" element={<VendorModule config={ORG_CONFIGS.venues} />} />
            <Route path="organization/catering" element={<VendorModule config={ORG_CONFIGS.catering} />} />
            <Route path="organization/decor" element={<VendorModule config={ORG_CONFIGS.decor} />} />
            <Route path="organization/musicians" element={<VendorModule config={ORG_CONFIGS.musicians} />} />
            <Route path="organization/photovideo" element={<VendorModule config={ORG_CONFIGS.photovideo} />} />
            <Route path="organization/transport" element={<VendorModule config={ORG_CONFIGS.transport} />} />
            <Route path="organization/materials" element={<VendorModule config={ORG_CONFIGS.materials} />} />
            <Route path="organization/legacy" element={<Organization />} />
            <Route path="reports" element={<Reports />} />
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
