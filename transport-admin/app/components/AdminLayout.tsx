"use client";

import { SidebarProvider } from "../contexts/SidebarContext";
import Sidebar from "./Sidebar";
import Header from "./Header";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex h-[100dvh] overflow-hidden bg-slate-50">
        <Sidebar />
        <div className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden transition-all duration-300">
          <Header />
          <main className="relative flex-1 min-h-0 overflow-y-auto bg-slate-50">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
