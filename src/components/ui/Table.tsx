interface TableColumn {
  key: string;
  label: string;
  width?: string;
}

interface TableRow {
  [key: string]: string | number;
}

interface TableProps {
  columns: TableColumn[];
  data: TableRow[];
}

export function Table({ columns, data }: TableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
      <table className="w-full text-sm text-slate-700">
        <thead>
          <tr>
            {columns.map((column) => (
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
          {data.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
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
      </table>
    </div>
  );
}