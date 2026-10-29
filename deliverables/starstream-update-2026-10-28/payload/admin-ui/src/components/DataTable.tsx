import React from "react";

export type Col<T> = {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  width?: number;
};

export function DataTable<T>({
  cols,
  rows,
  emptyText,
}: {
  cols: Col<T>[];
  rows: T[];
  emptyText?: string;
}) {
  return (
    <div className="tableWrap">
      <table className="table">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.key} style={c.width ? { width: c.width } : undefined}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={cols.length} style={{ padding: 16, color: "var(--muted)" }}>
                {emptyText || "No items"}
              </td>
            </tr>
          ) : (
            rows.map((r, idx) => (
              <tr key={idx}>
                {cols.map((c) => (
                  <td key={c.key}>{c.render(r)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
