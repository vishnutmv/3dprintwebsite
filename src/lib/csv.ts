/**
 * CSV export utilities — for admin order exports, product listings, etc.
 * Generates a downloadable CSV blob from typed data.
 */

export function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const headerRow = rows[0].map((header) => `"${header}"`).join(",");
  const dataRows = rows.slice(1).map((row) =>
    row.map((cell) => `"${cell}"`).join(",")
  );
  const csvContent = [headerRow, ...dataRows].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ordersToCsv(orders: any[]): (string | number)[][] {
  const headers = [
    "Order",
    "Date",
    "Customer ID",
    "Customer",
    "City",
    "Items",
    "Total (INR)",
    "Status",
    "Payment ID",
  ];
  const rows = [headers];
  orders.forEach((order) => {
    rows.push([
      order.id,
      order.createdAt?.slice(0, 10) ?? "",
      order.customerId,
      order.customerName,
      order.city,
      order.items?.length ? order.items.reduce((c: number, it: { qty: number }) => c + it.qty, 0) : 0,
      (order.total / 100).toFixed(2),
      order.status,
      order.paymentId,
    ]);
  });
  return rows;
}