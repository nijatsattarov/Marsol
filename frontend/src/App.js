import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Companies from "./pages/Companies";
import HR from "./pages/HR";
import Finance from "./pages/Finance";
import Sales from "./pages/Sales";
import Meetings from "./pages/Meetings";
import Tasks from "./pages/Tasks";
import Messages from "./pages/Messages";
import DashboardLayout from "./layouts/DashboardLayout";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          
          {/* Protected Routes */}
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="companies" element={<Companies />} />
            <Route path="hr" element={<HR />} />
            <Route path="finance" element={<Finance />} />
            <Route path="sales" element={<Sales />} />
            <Route path="meetings" element={<Meetings />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="messages" element={<Messages />} />
          </Route>
          
          {/* Redirect unknown routes */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
