// Sends transactional payment emails via the Resend API.
// Handles 4 events:
//   - "submitted_student": student confirmation
//   - "submitted_admin":   admin alert (with screenshot attached)
//   - "approved":          student approval email
//   - "rejected":          student rejection email with reason
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_URL = "https://api.resend.com/emails";
const FROM = "Focus Academy <academy@focusyourfinance.com>";
const ADMIN_EMAIL = "hello@focusyourfinance.com";
const APP_URL = "https://academy.focusyourfinance.com";

type Event = "submitted_student" | "submitted_admin" | "approved" | "rejected";

interface Payload {
  event: Event;
  student: { full_name: string; email: string; phone?: string | null };
  payment: {
    id: string;
    reference: string;
    amount: number;
    installment_number: number; // 0 = full
    is_full: boolean;
    date?: string;
    payment_method?: string | null;
    proof_url?: string | null;
    rejection_reason?: string | null;
  };
}

const installmentLabel = (p: Payload["payment"]) =>
  p.is_full ? "Full payment" : `Installment ${p.installment_number} of 2`;

const baseStyle = `
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  background:#ffffff; color:#1f2937; padding:24px; max-width:560px; margin:0 auto;
`;
const cardStyle = `
  border:1px solid #e5e7eb; border-radius:12px; padding:20px; margin:16px 0;
  background:#f9fafb;
`;
const btn = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#1e3a8a;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:12px;">${label}</a>`;

function studentSubmittedHtml(p: Payload) {
  return `<div style="${baseStyle}">
    <h2 style="color:#1e3a8a;margin:0 0 8px;">Payment received — pending verification</h2>
    <p>Hi ${p.student.full_name.split(" ")[0]},</p>
    <p>We've received your payment submission. Our team will verify it within 24 hours and you'll get a confirmation email shortly.</p>
    <div style="${cardStyle}">
      <p style="margin:4px 0;"><strong>Reference ID:</strong> ${p.payment.reference}</p>
      <p style="margin:4px 0;"><strong>Amount:</strong> Rs. ${Number(p.payment.amount).toLocaleString()}</p>
      <p style="margin:4px 0;"><strong>Type:</strong> ${installmentLabel(p.payment)}</p>
      <p style="margin:4px 0;"><strong>Date:</strong> ${p.payment.date || new Date().toLocaleString()}</p>
    </div>
    ${btn(`${APP_URL}/portal/payments`, "View payment status")}
    <p style="color:#6b7280;font-size:12px;margin-top:24px;">— Focus Academy</p>
  </div>`;
}

function adminAlertHtml(p: Payload) {
  return `<div style="${baseStyle}">
    <h2 style="color:#1e3a8a;margin:0 0 8px;">New payment needs verification</h2>
    <div style="${cardStyle}">
      <p style="margin:4px 0;"><strong>Student:</strong> ${p.student.full_name}</p>
      <p style="margin:4px 0;"><strong>Email:</strong> ${p.student.email}</p>
      <p style="margin:4px 0;"><strong>Phone:</strong> ${p.student.phone || "—"}</p>
      <p style="margin:4px 0;"><strong>Course:</strong> Stock Market Pro</p>
      <p style="margin:4px 0;"><strong>Type:</strong> ${installmentLabel(p.payment)}</p>
      <p style="margin:4px 0;"><strong>Amount:</strong> Rs. ${Number(p.payment.amount).toLocaleString()}</p>
      <p style="margin:4px 0;"><strong>Method:</strong> ${p.payment.payment_method || "—"}</p>
      <p style="margin:4px 0;"><strong>Reference ID:</strong> ${p.payment.reference}</p>
    </div>
    ${p.payment.proof_url ? `<p><a href="${p.payment.proof_url}" target="_blank">View screenshot</a> (also attached)</p>` : ""}
    ${btn(`${APP_URL}/admin/payments?highlight=${p.payment.id}`, "Open admin panel")}
  </div>`;
}

function approvedHtml(p: Payload) {
  return `<div style="${baseStyle}">
    <h2 style="color:#059669;margin:0 0 8px;">Payment confirmed ✓</h2>
    <p>Hi ${p.student.full_name.split(" ")[0]},</p>
    <p>Great news — your payment has been verified and approved.</p>
    <div style="${cardStyle}">
      <p style="margin:4px 0;"><strong>Reference ID:</strong> ${p.payment.reference}</p>
      <p style="margin:4px 0;"><strong>Amount:</strong> Rs. ${Number(p.payment.amount).toLocaleString()}</p>
      <p style="margin:4px 0;"><strong>Type:</strong> ${installmentLabel(p.payment)}</p>
    </div>
    ${btn(`${APP_URL}/portal/payments`, "View receipt")}
    <p style="color:#6b7280;font-size:12px;margin-top:24px;">— Focus Academy</p>
  </div>`;
}

function rejectedHtml(p: Payload) {
  return `<div style="${baseStyle}">
    <h2 style="color:#dc2626;margin:0 0 8px;">Payment couldn't be verified</h2>
    <p>Hi ${p.student.full_name.split(" ")[0]},</p>
    <p>Unfortunately, we couldn't verify your recent payment.</p>
    <div style="${cardStyle}">
      <p style="margin:4px 0;"><strong>Reference ID:</strong> ${p.payment.reference}</p>
      <p style="margin:4px 0;"><strong>Reason:</strong> ${p.payment.rejection_reason || "Not specified"}</p>
    </div>
    <p>Please re-submit with the correct details.</p>
    ${btn(`${APP_URL}/portal/payments`, "Try again")}
    <p style="color:#6b7280;font-size:12px;margin-top:24px;">— Focus Academy</p>
  </div>`;
}

async function fetchAttachment(url: string): Promise<{ filename: string; content: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.byteLength; i++) bin += String.fromCharCode(buf[i]);
    const filename = url.split("/").pop()?.split("?")[0] || "screenshot.png";
    return { filename, content: btoa(bin) };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY_1") ?? Deno.env.get("RESEND_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const p = (await req.json()) as Payload;
    if (!p?.event || !p?.student?.email || !p?.payment?.reference) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let to: string;
    let subject: string;
    let html: string;
    let attachments: { filename: string; content: string }[] | undefined;

    switch (p.event) {
      case "submitted_student":
        to = p.student.email;
        subject = "Payment received — pending verification";
        html = studentSubmittedHtml(p);
        break;
      case "submitted_admin":
        to = ADMIN_EMAIL;
        subject = `New payment from ${p.student.full_name} — Rs. ${Number(p.payment.amount).toLocaleString()} — needs verification`;
        html = adminAlertHtml(p);
        if (p.payment.proof_url) {
          const att = await fetchAttachment(p.payment.proof_url);
          if (att) attachments = [att];
        }
        break;
      case "approved":
        to = p.student.email;
        subject = "Payment confirmed ✓";
        html = approvedHtml(p);
        break;
      case "rejected":
        to = p.student.email;
        subject = "Payment couldn't be verified";
        html = rejectedHtml(p);
        break;
      default:
        return new Response(JSON.stringify({ error: "Unknown event" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const body: Record<string, unknown> = { from: FROM, to: [to], subject, html };
    if (attachments) body.attachments = attachments;

    const r = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("Resend error", r.status, data);
    }

    // Log to email_logs (skip admin alerts to keep history customer-facing)
    if (p.event !== "submitted_admin") {
      await admin.from("email_logs").insert({
        recipient_name: p.student.full_name,
        recipient_email: to,
        subject,
        body: html,
        status: r.ok ? "sent" : "failed",
        error_message: r.ok ? null : ((data as any)?.message || `HTTP ${r.status}`),
      }).then(() => {}, (e) => console.error("log insert", e));
    }

    if (!r.ok) {
      return new Response(JSON.stringify({ error: "Send failed", details: data }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
