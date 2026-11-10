import { jsPDF } from "jspdf";
import type { Order } from "./types";

function money(paise: number): string {
  return `INR ${(paise / 100).toFixed(2)}`;
}

export function createInvoicePdf(order: Order): jsPDF {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const left = 48;
  const right = 548;
  let y = 52;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text("3D Print Co.", left, y);
  pdf.setFontSize(14);
  pdf.text("PAYMENT INVOICE", right, y, { align: "right" });
  y += 30;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(`Order: ${order.orderNumber}`, left, y);
  pdf.text(`Date: ${new Date(order.createdAt).toLocaleDateString("en-IN")}`, right, y, { align: "right" });
  y += 24;
  pdf.setDrawColor(210);
  pdf.line(left, y, right, y);
  y += 22;

  pdf.setFont("helvetica", "bold");
  pdf.text("Billed to", left, y);
  pdf.text("Payment", 330, y);
  y += 16;
  pdf.setFont("helvetica", "normal");
  const customerLines = [
    order.customerName,
    order.email ?? "",
    order.phone,
    order.address,
    [order.city, order.state, order.pin].filter(Boolean).join(", "),
  ].filter(Boolean);
  const customerText = pdf.splitTextToSize(customerLines.join("\n"), 245);
  const paymentText = pdf.splitTextToSize(
    [`Method: ${order.paymentMode || "Razorpay"}`, `Status: ${order.paymentStatus}`, `Transaction ID: ${order.paymentId || "Not available"}`].join("\n"),
    200,
  );
  pdf.text(customerText, left, y);
  pdf.text(paymentText, 330, y);
  y += Math.max(customerText.length, paymentText.length) * 12 + 18;

  pdf.setFont("helvetica", "bold");
  pdf.setFillColor(245, 242, 250);
  pdf.rect(left, y - 12, right - left, 24, "F");
  pdf.text("Item", left + 6, y + 4);
  pdf.text("Qty", 365, y + 4, { align: "right" });
  pdf.text("Unit price", 450, y + 4, { align: "right" });
  pdf.text("Amount", right - 6, y + 4, { align: "right" });
  y += 25;

  pdf.setFont("helvetica", "normal");
  for (const item of order.items) {
    const lineCount = pdf.splitTextToSize(item.name, 240);
    if (y + Math.max(20, lineCount.length * 13) > 745) {
      pdf.addPage();
      y = 55;
    }
    pdf.text(lineCount, left + 6, y);
    pdf.text(String(item.qty), 365, y, { align: "right" });
    pdf.text(money(item.price), 450, y, { align: "right" });
    pdf.text(money(item.lineTotal ?? item.price * item.qty), right - 6, y, { align: "right" });
    y += Math.max(20, lineCount.length * 13);
    pdf.setDrawColor(235);
    pdf.line(left, y - 7, right, y - 7);
  }

  if (y > 690) {
    pdf.addPage();
    y = 58;
  }
  y += 18;
  pdf.setFont("helvetica", "normal");
  pdf.text("Subtotal", 390, y, { align: "right" });
  pdf.text(money(order.subtotal), right - 6, y, { align: "right" });
  y += 18;
  pdf.text("Shipping", 390, y, { align: "right" });
  pdf.text(money(order.shipping), right - 6, y, { align: "right" });
  y += 22;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("Total paid", 390, y, { align: "right" });
  pdf.text(money(order.total), right - 6, y, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text("Payment verified by Razorpay. Thank you for shopping with 3D Print Co.", left, 790);
  return pdf;
}

export type RewardCardDetails = {
  title: string;
  description?: string;
  worth?: number;
  sponsor?: string;
  voucherCode?: string | null;
  prizeType?: string;
  revealedAt?: string;
};

export function createRewardCardPdf(reward: RewardCardDetails): jsPDF {
  const pdf = new jsPDF({ unit: "pt", format: [360, 520] });
  pdf.setFillColor(14, 12, 27);
  pdf.rect(0, 0, 360, 520, "F");
  pdf.setDrawColor(157, 125, 255);
  pdf.setLineWidth(2);
  pdf.roundedRect(20, 20, 320, 480, 22, 22, "S");
  pdf.setTextColor(184, 164, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("3D PRINT CO.  |  REWARD CARD", 180, 62, { align: "center" });
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(20);
  const titleLines = pdf.splitTextToSize(reward.title, 270).slice(0, 3);
  pdf.text(titleLines, 180, 140, { align: "center" });
  let y = 155 + titleLines.length * 22;
  if (typeof reward.worth === "number" && reward.worth > 0) {
    pdf.setTextColor(103, 232, 190);
    pdf.setFontSize(14);
    pdf.text(`Reward value: INR ${(reward.worth / 100).toFixed(2)}`, 180, y, { align: "center" });
    y += 26;
  }
  pdf.setTextColor(220, 216, 233);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(12);
  if (reward.description) {
    const lines = pdf.splitTextToSize(reward.description.slice(0, 420), 255).slice(0, 6);
    pdf.setFontSize(10);
    pdf.text(lines, 180, y, { align: "center" });
    y += lines.length * 14 + 14;
  }
  if (reward.sponsor) {
    pdf.setTextColor(180, 172, 201);
    pdf.setFontSize(10);
    pdf.text(`Provided by ${reward.sponsor}`, 180, y, { align: "center" });
    y += 22;
  }
  if (reward.voucherCode) {
    if (y + 60 > 438) y = 374;
    pdf.setDrawColor(120, 104, 160);
    pdf.roundedRect(48, y, 264, 54, 8, 8, "S");
    pdf.setTextColor(174, 160, 214);
    pdf.setFontSize(8);
    pdf.text("VOUCHER CODE", 180, y + 18, { align: "center" });
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text(reward.voucherCode, 180, y + 39, { align: "center" });
  }
  pdf.setTextColor(150, 143, 169);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text("Thank you for being part of our community.", 180, 470, { align: "center" });
  if (reward.revealedAt) pdf.text(`Revealed ${new Date(reward.revealedAt).toLocaleDateString("en-IN")}`, 180, 488, { align: "center" });
  return pdf;
}

export function invoicePdfBase64(pdf: jsPDF): string {
  const data = pdf.output("datauristring");
  const separator = data.indexOf(",");
  if (separator < 0) throw new Error("Invoice PDF could not be encoded.");
  return data.slice(separator + 1);
}
