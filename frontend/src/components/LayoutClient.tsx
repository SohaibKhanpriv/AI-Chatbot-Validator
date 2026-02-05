"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";

export default function LayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  return (
    <>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
      />
      <main
        className={`min-h-screen p-6 transition-[margin] duration-200 ${
          sidebarCollapsed ? "ml-14" : "ml-56"
        }`}
      >
        {children}
      </main>
    </>
  );
}
