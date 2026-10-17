"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";

interface SearchHit {
  href: string;
  title: string;
  subtitle: string;
}

interface SearchGroup {
  label: string;
  hits: SearchHit[];
}

const SEARCH_LIMIT = 5;

// Lists from this dashboard's API; a failed request just contributes no results
async function fetchList(url: string): Promise<any[]> {
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const json = await response.json();
    return Array.isArray(json.data) ? json.data : [];
  } catch {
    return [];
  }
}

const joinParts = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ");

export default function Header() {
  const router = useRouter();
  const { admin, logout } = useAuth();
  const [showProfile, setShowProfile] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchGroup[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProfile(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }

    if (showProfile || showResults) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showProfile, showResults]);

  // Vehicles, routes and drivers matching the search box, 300 ms after the last keystroke
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    let alive = true;
    setSearching(true);
    const timer = setTimeout(async () => {
      const q = encodeURIComponent(term);
      const [transportes, vias, motoristas] = await Promise.all([
        fetchList(`/api/transportes?search=${q}&limit=${SEARCH_LIMIT}`),
        fetchList(`/api/vias?search=${q}&limit=${SEARCH_LIMIT}`),
        fetchList(`/api/motoristas?search=${q}&limit=${SEARCH_LIMIT}`),
      ]);
      if (!alive) return;
      const groups: SearchGroup[] = [
        {
          label: "Transportes",
          hits: transportes.map((t) => ({ href: `/transportes/${t.id}`, title: t.matricula, subtitle: joinParts(t.marca, t.modelo, t.via?.nome) })),
        },
        {
          label: "Vias",
          hits: vias.map((v) => ({ href: `/vias/${v.id}`, title: v.nome, subtitle: joinParts(v.codigo, v.municipio?.nome) })),
        },
        {
          label: "Motoristas",
          hits: motoristas.map((m) => ({ href: `/motoristas/${m.id}`, title: m.nome, subtitle: joinParts(m.telefone, m.transporte?.matricula) })),
        },
      ];
      setResults(groups.filter((g) => g.hits.length > 0));
      setSearching(false);
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query]);

  const openResult = (href: string) => {
    setShowResults(false);
    setQuery("");
    router.push(href);
  };

  const getInitials = (nome: string) => {
    const names = nome.trim().split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return nome.substring(0, 2).toUpperCase();
  };

  const handleNavigate = (path: string) => {
    setShowProfile(false);
    router.push(path);
  };

  return (
    <header className="z-10 shrink-0 border-b border-gray-800 bg-black px-6 py-4 shadow-sm">
      <div className="flex justify-between items-center">
        {/* Search Bar */}
        <div className="flex-1 max-w-xl">
          <div className="relative" ref={searchRef}>
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowResults(true);
              }}
              onFocus={() => setShowResults(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setShowResults(false);
                // Enter opens the first result
                if (e.key === "Enter" && results?.[0]?.hits[0]) openResult(results[0].hits[0].href);
              }}
              placeholder="Pesquisar transportes, vias, motoristas..."
              aria-label="Pesquisar transportes, vias e motoristas"
              className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent text-sm text-white placeholder-gray-400"
            />

            {showResults && query.trim().length >= 2 && (
              <div className="absolute left-0 right-0 mt-2 max-h-[70vh] overflow-y-auto bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-20">
                {searching && !results ? (
                  <p className="px-4 py-3 text-sm text-gray-500">A pesquisar…</p>
                ) : results && results.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-gray-500">Sem resultados para &quot;{query.trim()}&quot;</p>
                ) : (
                  results?.map((group) => (
                    <div key={group.label} role="group" aria-label={group.label} className="py-1">
                      <p className="px-4 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{group.label}</p>
                      {group.hits.map((hit) => (
                        <button
                          key={hit.href}
                          onClick={() => openResult(hit.href)}
                          className="w-full px-4 py-2 text-left hover:bg-gray-50"
                        >
                          <p className="text-sm font-medium text-gray-900 truncate">{hit.title}</p>
                          {hit.subtitle && <p className="text-xs text-gray-500 truncate">{hit.subtitle}</p>}
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-4 ml-6">
          {/* Profile */}
          {admin && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowProfile(!showProfile)}
                className="flex items-center hover:bg-gray-900 rounded-lg p-2 transition-colors space-x-3"
              >
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black font-bold shadow-lg">
                  {getInitials(admin.nome)}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-semibold text-white">{admin.nome}</p>
                  <p className="text-xs text-gray-400 capitalize">{admin.role}</p>
                </div>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    showProfile ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Profile Dropdown */}
              {showProfile && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 py-2">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center text-white font-bold">
                        {getInitials(admin.nome)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-black truncate">{admin.nome}</p>
                        <p className="text-xs text-gray-600 truncate">{admin.email}</p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-black text-white mt-1 capitalize">
                          {admin.role}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="py-2">
                    <button 
                      onClick={() => handleNavigate("/perfil")}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3"
                    >
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      <span>Meu Perfil</span>
                    </button>
                  </div>

                  <div className="border-t border-gray-200 pt-2">
                    <button
                      onClick={logout}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-3 font-medium"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        />
                      </svg>
                      <span>Sair</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
