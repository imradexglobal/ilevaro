import type { ReactNode } from "react";

interface TableColumn {
  key: string;
  label: string;
  width?: string;
}

interface TableRow {
  id?: string | number;
  [key: string]: string | number | undefined;
}

interface TableProps {
  columns?: TableColumn[];
  data?: TableRow[];
  children?: ReactNode;
}

export function Table({ columns, data, children }: TableProps) {
  const hasColumns = Array.isArray(columns) && columns.length > 0;

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
      <table className="w-full text-sm text-slate-700">
        {hasColumns && !children ? (
          <>
            <thead>
              <tr>
                {columns!.map((column) => (
                  <th
                    key={column.key}
                    className="text-left py-3 px-4 border-b font-medium text-slate-500"
                    style={{ width: column.width }}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((row, rowIndex) => (
                <tr key={row.id ?? rowIndex}>
                  {columns!.map((column) => (
                    <td
                      key={column.key}
                      className="py-3 px-4 border-b text-slate-500"
                    >
                      {row[column.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </>
        ) : (
          children
        )}
      </table>
    </div>
  );
}