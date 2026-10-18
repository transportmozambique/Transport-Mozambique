"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSidebar } from "../contexts/SidebarContext";

const menuItems = [
  {
    name: "Dashboard",
    path: "/dashboard",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    name: "Transportes",
    path: "/transportes",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
  {
    name: "Vias",
    path: "/vias",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
  {
    name: "Paragens",
    path: "/paragens",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    name: "Proprietários",
    path: "/proprietarios",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    name: "Motoristas",
    path: "/motoristas",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    name: "Províncias",
    path: "/provincias",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    name: "Municípios",
    path: "/municipios",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    name: "Utentes",
    path: "/utentes",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    name: "Administradores",
    path: "/administradores",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    name: "Tarifa",
    path: "/tarifa",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    name: "Relatórios",
    path: "/relatorios",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
];

/** As secções, em grupos: a rede, as pessoas, o território, os relatórios e a configuração */
const groups: { label: string; paths: string[] }[] = [
  { label: "Rede", paths: ["/dashboard", "/transportes", "/vias", "/paragens"] },
  { label: "Pessoas", paths: ["/motoristas", "/proprietarios", "/utentes", "/administradores"] },
  { label: "Território", paths: ["/provincias", "/municipios"] },
  { label: "Análise", paths: ["/relatorios"] },
  { label: "Configuração", paths: ["/tarifa"] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { isExpanded, toggleSidebar, mobileOpen, setMobileOpen } = useSidebar();
  // Abaixo de lg (telemóveis, tablets) não há barra lateral: o botão do cabeçalho abre o menu por cima do ecrã inteiro
  const wide = isExpanded || mobileOpen;

  // Esc fecha o menu
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen, setMobileOpen]);

  return (
    <>
      <aside
        className={`scroll-dark fixed inset-0 z-50 w-full shrink-0 flex-col bg-slate-900 text-white lg:static lg:z-auto lg:flex lg:transition-[width] lg:duration-300 ${
          mobileOpen ? "flex" : "hidden"
        } ${isExpanded ? "lg:w-64" : "lg:w-20"}`}
      >
        {/* Marca, e o botão que recolhe a barra lateral (fecha o menu num telemóvel) */}
        <div className="flex items-center gap-3 px-3 py-3 sm:px-6 lg:px-4 lg:py-5">
          <button
            onClick={() => (mobileOpen ? setMobileOpen(false) : toggleSidebar())}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 transition-colors hover:bg-white/20"
            aria-label={mobileOpen ? "Fechar o menu" : isExpanded ? "Recolher o menu" : "Expandir o menu"}
          >
            <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              )}
            </svg>
          </button>
          {wide && (
            <div className="min-w-0">
              <h2 className="text-sm font-bold leading-tight text-white">Transportes Moçambique</h2>
              <p className="text-xs text-slate-400">Administração</p>
            </div>
          )}
        </div>

        <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 pb-6">
          {groups.map((group) => (
            <div key={group.label}>
              {wide ? (
                <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{group.label}</p>
              ) : (
                <div className="mx-auto mb-2 h-px w-8 bg-white/10" aria-hidden />
              )}
              <div className="space-y-1">
                {menuItems
                  .filter((item) => group.paths.includes(item.path))
                  .map((item) => {
                    // Activa também nas páginas da própria secção (detalhes, edição)
                    const isActive = pathname === item.path || pathname.startsWith(item.path + "/");
                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-base font-medium transition-colors lg:py-2.5 lg:text-sm ${wide ? "" : "justify-center"} ${
                          isActive ? "bg-white text-slate-900 shadow-sm" : "text-slate-300 hover:bg-white/10 hover:text-white"
                        }`}
                        title={!wide ? item.name : undefined}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <span className={isActive ? "text-slate-900" : "text-slate-400 group-hover:text-white"}>{item.icon}</span>
                        {wide && <span>{item.name}</span>}
                      </Link>
                    );
                  })}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
