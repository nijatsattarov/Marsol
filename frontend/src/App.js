import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Members from "./pages/Members";
import DashboardLayout from "./layouts/DashboardLayout";
import ComingSoon from "./pages/ComingSoon";

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
            <Route path="members" element={<Members />} />
            <Route path="meetings" element={<ComingSoon title="Görüşlər" />} />
            <Route path="finance" element={<ComingSoon title="Maliyyə" />} />
            <Route path="marketing" element={<ComingSoon title="Marketing" />} />
            <Route path="hr" element={<ComingSoon title="İnsan Resurları" />} />
            <Route path="tasks" element={<ComingSoon title="Tapşırıqlar" />} />
            <Route path="messages" element={<ComingSoon title="Mesajlar" />} />
          </Route>
          
          {/* Redirect unknown routes */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
