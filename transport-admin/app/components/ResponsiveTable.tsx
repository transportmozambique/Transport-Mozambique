"use client";

import { ReactNode } from "react";
import LoadingScreen from "./LoadingScreen";

interface Column {
  header: string;
  accessor: string;
  render?: (value: any, row: any) => ReactNode;
  mobileLabel?: string;
  showOnMobile?: boolean; // New: control which columns show on mobile
}

interface ResponsiveTableProps {
  columns: Column[];
  data: any[];
  onRowClick?: (row: any) => void;
  actions?: (row: any) => ReactNode;
  emptyMessage?: string;
  loading?: boolean;
  mobileCardTitle?: (row: any) => ReactNode; // Main title for mobile card
  mobileCardSubtitle?: (row: any) => ReactNode; // Subtitle for mobile card
}

export default function ResponsiveTable({
  columns,
  data,
  onRowClick,
  actions,
  emptyMessage = "Nenhum item encontrado",
  loading = false,
  mobileCardTitle,
  mobileCardSubtitle,
}: ResponsiveTableProps) {
  if (loading) {
    return <LoadingScreen size="compact" />;
  }

  if (data.length === 0) {
    return (
      <div className="px-6 py-12 text-center">
        <div className="flex flex-col items-center justify-center text-slate-500">
          <svg className="w-12 h-12 mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p className="text-lg font-medium">{emptyMessage}</p>
          <p className="text-sm mt-1">Tente ajustar os filtros de pesquisa</p>
        </div>
      </div>
    );
  }

  // Filter columns for mobile (only show columns with showOnMobile !== false)
  const mobileColumns = columns.filter(col => col.showOnMobile !== false);

  return (
    <>
      {/* Desktop Table View */}
      <table className="w-full hidden lg:table">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            {columns.map((column, index) => (
              <th
                key={index}
                className="px-6 py-4 text-left text-xs font-bold text-black uppercase tracking-wider"
              >
                {column.header}
              </th>
            ))}
            {actions && (
              <th className="px-6 py-4 text-left text-xs font-bold text-black uppercase tracking-wider">
                Acções
              </th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-200">
          {data.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              onClick={() => onRowClick?.(row)}
              className={`border-b border-slate-100 ${onRowClick ? 'cursor-pointer hover:bg-slate-50' : ''}`}
            >
              {columns.map((column, colIndex) => (
                <td key={colIndex} className="px-6 py-4">
                  {column.render
                    ? column.render(row[column.accessor], row)
                    : row[column.accessor]}
                </td>
              ))}
              {actions && (
                <td className="px-6 py-4 text-sm font-medium">
                  <div className="flex items-center space-x-3" onClick={(e) => e.stopPropagation()}>
                    {actions(row)}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile Card View - Simplified */}
      <div className="lg:hidden divide-y divide-gray-200">
        {data.map((row, rowIndex) => (
          <div
            key={rowIndex}
            onClick={() => onRowClick?.(row)}
            className={`p-4 ${onRowClick ? 'hover:bg-gray-50 cursor-pointer' : ''}`}
          >
            {/* Title and Subtitle */}
            {(mobileCardTitle || mobileCardSubtitle) && (
              <div className="mb-3">
                {mobileCardTitle && (
                  <div className="text-base font-bold text-black mb-1">
                    {mobileCardTitle(row)}
                  </div>
                )}
                {mobileCardSubtitle && (
                  <div className="text-sm text-gray-600">
                    {mobileCardSubtitle(row)}
                  </div>
                )}
              </div>
            )}

            {/* Only show essential columns on mobile */}
            {mobileColumns.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                {mobileColumns.slice(0, 4).map((column, colIndex) => (
                  <div key={colIndex}>
                    <div className="text-xs text-gray-500">
                      {column.mobileLabel || column.header}
                    </div>
                    <div className="text-sm text-black font-medium">
                      {column.render
                        ? column.render(row[column.accessor], row)
                        : row[column.accessor]}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {actions && (
              <div
                className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-200"
                onClick={(e) => e.stopPropagation()}
              >
                {actions(row)}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
