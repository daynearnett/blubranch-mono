import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./sidebar";
import AuthGuard from "./auth-guard";

export default function AppShell() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <AuthGuard>
      <div className="flex h-screen bg-gray-50">
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(!collapsed)}
        />
        <main className="flex-1 overflow-y-auto p-3 pt-14 sm:p-6 lg:pt-6">
          <Outlet />
        </main>
      </div>
    </AuthGuard>
  );
}
