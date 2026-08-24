import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Mail, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { expectedTotal } from "@/lib/pricing";

export interface InvoicePayment {
  id: string;
  amount: number;
  payment_method: string | null;
  transaction_reference: string | null;
  status: string;
  payment_date: string | null;
  created_at: string;
}

export interface InvoiceStudent {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  student: InvoiceStudent | null;
  plan: "full" | "installment";
  payments: InvoicePayment[];
  totalPaid: number;
  /** Total fee for this student (may be manually adjusted by an admin). */
  expected?: number;
}

const COMPANY_NAME = "Elysian Capital PVT. LTD.";
const COMPANY_TAGLINE = "US Tax Course";
const SUPPORT_EMAIL = "academy@focusyourfinance.com";
const SUPPORT_PHONE = "+977 970-9139754";
const COMPANY_WEBSITE = "academy.focusyourfinance.com";
const VAT_NUMBER = "622375005";
const VAT_RATE = 0.13;

const fmt = (n: number) => `NPR ${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const InvoiceDialog = ({ open, onOpenChange, student, plan, payments, totalPaid, expected: expectedProp }: Props) => {
  const [emailing, setEmailing] = useState(false);

  const data = useMemo(() => {
    if (!student) return null;
    // The fee is VAT-inclusive: VAT is extracted from the total, not added on top.
    const expected = expectedProp ?? expectedTotal(plan);
    const vat = Math.round(expected * (VAT_RATE / (1 + VAT_RATE)) * 100) / 100;
    const base = Math.round((expected - vat) * 100) / 100;
    const balance = Math.max(0, expected - totalPaid);
    const status =
      totalPaid >= expected ? "Fully Paid" :
      totalPaid > 0 ? "Partially Paid" : "Unpaid";
    return {
      issueDate: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      base, vat, expected, balance, status,
    };
  }, [student, plan, totalPaid, expectedProp]);


  const buildHtml = () => {
    if (!student || !data) return "";
    const rows = payments
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((p) => `
        <tr>
          <td style="padding:5px 6px;border-bottom:1px solid #e5e7eb;">${fmtDate(p.payment_date || p.created_at)}</td>
          <td style="padding:5px 6px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:10px;">${p.transaction_reference || "—"}</td>
          <td style="padding:5px 6px;border-bottom:1px solid #e5e7eb;text-transform:capitalize;">${(p.payment_method || "—").replace(/_/g, " ")}</td>
          <td style="padding:5px 6px;border-bottom:1px solid #e5e7eb;text-align:right;">${fmt(Number(p.amount))}</td>
          <td style="padding:5px 6px;border-bottom:1px solid #e5e7eb;text-transform:capitalize;">${p.status.replace(/_/g, " ")}</td>
        </tr>`).join("");

    return `
<div class="fa-invoice" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0f172a;max-width:760px;margin:0 auto;padding:20px 24px;background:#fff;box-sizing:border-box;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0c4a6e;padding-bottom:10px;margin-bottom:14px;">
    <div>
      <div style="font-size:19px;font-weight:700;color:#0c4a6e;">${COMPANY_NAME}</div>
      <div style="font-size:12px;color:#475569;margin-top:2px;">${COMPANY_TAGLINE}</div>
      <div style="font-size:11px;color:#64748b;margin-top:8px;line-height:1.55;">
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="color:#0c4a6e;">✉</span><span>${SUPPORT_EMAIL}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="color:#0c4a6e;">📞</span><span>${SUPPORT_PHONE}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="color:#0c4a6e;">🌐</span><span>${COMPANY_WEBSITE}</span>
        </div>
      </div>
      <div style="display:inline-block;margin-top:6px;padding:2px 8px;border:1px solid #cbd5e1;border-radius:4px;font-size:10px;font-weight:600;color:#475569;letter-spacing:0.5px;">VAT No.: ${VAT_NUMBER}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:17px;font-weight:700;color:#0c4a6e;letter-spacing:1px;">PROFORMA INVOICE</div>
      <div style="font-size:11px;color:#64748b;margin-top:4px;">Issued: ${data.issueDate}</div>
    </div>
  </div>

  <div style="margin-bottom:14px;">
    <div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">Bill To</div>
    <div style="font-size:13px;font-weight:600;">${student.full_name}</div>
    <div style="font-size:12px;color:#475569;">${student.email}</div>
    ${student.phone ? `<div style="font-size:12px;color:#475569;">${student.phone}</div>` : ""}
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:12px;">
    <thead>
      <tr style="background:#f1f5f9;">
        <th style="text-align:left;padding:6px;font-size:10px;color:#475569;text-transform:uppercase;letter-spacing:0.5px;">Description</th>
        <th style="text-align:right;padding:6px;font-size:10px;color:#475569;text-transform:uppercase;letter-spacing:0.5px;">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr><td style="padding:6px;border-bottom:1px solid #e5e7eb;">Course Fee — ${COMPANY_TAGLINE} <span style="color:#94a3b8;font-size:11px;">(VAT inclusive)</span></td><td style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:right;">${fmt(data.expected)}</td></tr>
      <tr><td style="padding:6px;border-bottom:1px solid #e5e7eb;color:#475569;">Amount excluding VAT</td><td style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:right;color:#475569;">${fmt(data.base)}</td></tr>
      <tr><td style="padding:6px;border-bottom:1px solid #e5e7eb;color:#475569;">VAT (13%, included)</td><td style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:right;color:#475569;">${fmt(data.vat)}</td></tr>
      <tr style="background:#f8fafc;">
        <td style="padding:7px 6px;font-weight:700;">Total Payable</td>
        <td style="padding:7px 6px;text-align:right;font-weight:700;">${fmt(data.expected)}</td>
      </tr>
    </tbody>
  </table>

  <div style="font-size:12px;font-weight:600;color:#0c4a6e;margin-bottom:5px;">Payments Received</div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:11px;">
    <thead>
      <tr style="background:#f1f5f9;">
        <th style="text-align:left;padding:5px 6px;font-size:10px;color:#475569;text-transform:uppercase;">Date</th>
        <th style="text-align:left;padding:5px 6px;font-size:10px;color:#475569;text-transform:uppercase;">Reference</th>
        <th style="text-align:left;padding:5px 6px;font-size:10px;color:#475569;text-transform:uppercase;">Method</th>
        <th style="text-align:right;padding:5px 6px;font-size:10px;color:#475569;text-transform:uppercase;">Amount</th>
        <th style="text-align:left;padding:5px 6px;font-size:10px;color:#475569;text-transform:uppercase;">Status</th>
      </tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="5" style="padding:10px;text-align:center;color:#94a3b8;">No payments recorded</td></tr>`}</tbody>
  </table>

  <div style="display:flex;justify-content:flex-end;margin-bottom:14px;">
    <table style="font-size:12px;min-width:290px;">
      <tr><td style="padding:3px 12px;color:#475569;">Amount excl. VAT</td><td style="padding:3px 0;text-align:right;font-weight:600;">${fmt(data.base)}</td></tr>
      <tr><td style="padding:3px 12px;color:#475569;">VAT 13% (included)</td><td style="padding:3px 0;text-align:right;font-weight:600;">${fmt(data.vat)}</td></tr>
      <tr><td style="padding:3px 12px;color:#475569;">Total Payable</td><td style="padding:3px 0;text-align:right;font-weight:600;">${fmt(data.expected)}</td></tr>
      <tr><td style="padding:3px 12px;color:#475569;">Amount Paid</td><td style="padding:3px 0;text-align:right;font-weight:600;color:#059669;">${fmt(totalPaid)}</td></tr>
      <tr style="border-top:2px solid #0c4a6e;"><td style="padding:6px 12px;font-weight:700;">Balance Due</td><td style="padding:6px 0;text-align:right;font-weight:700;color:${data.balance > 0 ? "#dc2626" : "#059669"};">${fmt(data.balance)}</td></tr>
      <tr><td style="padding:3px 12px;color:#475569;">Status</td><td style="padding:3px 0;text-align:right;font-weight:600;">${data.status}</td></tr>
    </table>
  </div>

  <div style="border-top:1px solid #e5e7eb;padding-top:10px;text-align:center;font-size:11px;color:#64748b;line-height:1.5;">
    Remarks: Original Tax Invoice will be shared separately.
  </div>
</div>`;
  };

  const handleDownload = () => {
    const html = buildHtml();
    const win = window.open("", "_blank", "width=900,height=1000");
    if (!win) { toast.error("Pop-up blocked. Allow pop-ups and try again."); return; }
    win.document.write(`<!doctype html><html><head><title>Invoice — ${student?.full_name || ""}</title>
      <style>
        body { background:#fff; margin:0; }
        @page { size: A4 portrait; margin: 0; }
        @media print {
          body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .fa-invoice {
            max-width: none !important;
            padding: 10mm !important;
            width: 190mm;
            transform-origin: top left;
          }
          .fa-invoice table { page-break-inside: avoid; break-inside: avoid; }
          .fa-invoice tr, .fa-invoice div { page-break-inside: avoid; break-inside: avoid; }
        }
      </style>
      </head><body>${html}
      <script>
        window.onload = () => {
          try {
            var el = document.querySelector('.fa-invoice');
            var pageHeightPx = 277 / 25.4 * 96; // A4 height minus 10mm margins
            var h = el.scrollHeight;
            if (h > pageHeightPx) {
              var scale = Math.max(0.5, (pageHeightPx - 4) / h);
              el.style.transform = 'scale(' + scale + ')';
            }
          } catch (e) {}
          window.print();
        };
      </script>
      </body></html>`);
    win.document.close();
  };


  const handleEmail = async () => {
    if (!student) return;
    setEmailing(true);
    try {
      const html = buildHtml();
      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          to: [{ name: student.full_name, email: student.email }],
          subject: `Invoice — ${COMPANY_NAME}`,
          body: html,
        },
      });
      if (error) throw error;
      toast.success(`Invoice emailed to ${student.email}`);
    } catch (e) {
      toast.error("Failed to send invoice email");
      console.error(e);
    } finally {
      setEmailing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invoice preview</DialogTitle>
          <DialogDescription>
            {student ? `${student.full_name} — ${student.email}` : "Select a student"}
          </DialogDescription>
        </DialogHeader>
        {student && data && (
          <>
            <div
              className="border border-border rounded-lg bg-white overflow-hidden"
              dangerouslySetInnerHTML={{ __html: buildHtml() }}
            />
          </>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleEmail} disabled={emailing || !student}>
            {emailing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
            Email to student
          </Button>
          <Button onClick={handleDownload} disabled={!student}>
            <Download className="w-4 h-4 mr-2" /> Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceDialog;
