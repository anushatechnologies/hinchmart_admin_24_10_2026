// Reusable paginated data table for the Delivery Pricing module (V41).
// Presentational; each page supplies its own columns + tooling.

import { formatInr, formatKm, formatNumber } from "../../utils/formatUtils";

export default function DeliveryTable({
  columns = [],
  items = [],
  loading = false,
  error = null,
  emptyMessage = "No records found.",
  rowKey = "id",
  onRowClick,
  actions,
  currency = false,
  km = false,
  alignRight = [],
}) {
  const renderCell = (item, column) => {
    if (column.render) {
      const value = column.key in item ? item[column.key] : undefined;
      return column.render(item, value, item);
    }
    let value = item[column.key] != null ? item[column.key] : "\u2014";
    if (currency && column.key === "rateAmount") value = formatInr(value);
    if (km && column.key === "fromDistanceKm") value = formatKm(value);
    if (alignRight.includes(column.key) && typeof value === "number") {
      value = formatNumber(value, 2);
    }
    return <span className="table-cell">{value}</span>;
  };

  return (
    <div className="delivery-table-scroll">
      <table className="delivery-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={`delivery-table-head ${column.align ? `align-${column.align}` : ""}`}>
                {column.label}
              </th>
            ))}
            {actions && <th className="delivery-table-head align-center">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length + (actions ? 1 : 0)} className="delivery-table-message">
                <span>Loading...</span>
              </td>
            </tr>
          ) : error ? (
            <tr>
              <td colSpan={columns.length + (actions ? 1 : 0)} className="delivery-table-message">
                <span className="delivery-table-error">{error}</span>
              </td>
            </tr>
          ) : items.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (actions ? 1 : 0)} className="delivery-table-message">
                <span>{emptyMessage}</span>
              </td>
            </tr>
          ) : (
            items.map((item, index) => (
              <tr
                key={(item && rowKey in item ? item[rowKey] : index)}
                className={onRowClick ? "clickable-row" : ""}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((column) => renderCell(item, column))}
                {actions && (
                  <td>
                    <div className="delivery-table-actions">{actions(item)}</div>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
