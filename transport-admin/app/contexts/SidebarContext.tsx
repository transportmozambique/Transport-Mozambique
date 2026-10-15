"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SidebarContextType {
  isExpanded: boolean;
  toggleSidebar: () => void;
  setIsExpanded: (value: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Load sidebar state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('sidebarExpanded');
    if (savedState !== null) {
      setIsExpanded(savedState === 'true');
    }
    setMounted(true);
  }, []);

  // Save sidebar state to localStorage whenever it changes
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('sidebarExpanded', String(isExpanded));
    }
  }, [isExpanded, mounted]);

  const toggleSidebar = () => {
    setIsExpanded(prev => !prev);
  };

  return (
    <SidebarContext.Provider value={{ isExpanded, toggleSidebar, setIsExpanded }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
