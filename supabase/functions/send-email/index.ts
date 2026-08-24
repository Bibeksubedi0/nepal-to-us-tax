// Generic admin-triggered email sender via the Resend API. Logs every send to email_logs
// and injects open/click tracking + optional CTA button.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_URL = "https://api.resend.com/emails";
const FROM = "Focus Academy <academy@focusyourfinance.com>";

interface Recipient { id?: string | null; name?: string | null; email: string; inquiry_id?: string | null }
interface Payload {
  to: Recipient[] | string[];
  subject: string;
  body: string;
  cta_label?: string | null;
  cta_url?: string | null;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const LOGO_URL = "https://heupdkfdjdrbdwvzlywf.supabase.co/storage/v1/object/public/email-assets/logo.png";
const SITE_URL = "https://academy.focusyourfinance.com";
const SUPPORT_EMAIL = "academy@focusyourfinance.com";
const SUPPORT_PHONE = "+977 970-9139754";
const TRACK_BASE = "https://heupdkfdjdrbdwvzlywf.supabase.co/functions/v1/email-track";

const wrapHtml = (
  body: string,
  subject: string,
  logId: string,
  cta?: { label: string; url: string } | null,
) => {
  const content = body.includes("<") ? body : escapeHtml(body).replace(/\n/g, "<br/>");
  const ctaBlock = cta && cta.label && cta.url ? `
        <tr>
          <td style="padding:8px 32px 28px;text-align:center;">
            <a href="${TRACK_BASE}?e=click&id=${logId}&u=${encodeURIComponent(cta.url)}"
               style="display:inline-block;background:linear-gradient(135deg,#0c4a6e,#0369a1);color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 32px;border-radius:10px;box-shadow:0 4px 12px rgba(3,105,161,0.3);">
              ${escapeHtml(cta.label)}
            </a>
          </td>
        </tr>` : "";
  const pixel = `<img src="${TRACK_BASE}?e=open&id=${logId}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(subject)} — Focus Academy</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef2f7;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#0c4a6e 0%,#075985 50%,#0369a1 100%);padding:28px 32px;text-align:center;">
            <img src="${LOGO_URL}" alt="Focus Academy" width="64" height="64" style="display:inline-block;border-radius:12px;background:#ffffff;padding:6px;margin-bottom:10px;" />
            <div style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.3px;">Focus Academy</div>
            <div style="color:#fcd34d;font-size:12px;font-weight:500;margin-top:4px;letter-spacing:1.5px;text-transform:uppercase;">US Tax Career Program</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 8px;line-height:1.65;font-size:15px;color:#1f2937;">
            ${content}
          </td>
        </tr>
        ${ctaBlock}
        <tr><td style="padding:0 32px;"><div style="height:1px;background:#e5e7eb;"></div></td></tr>
        <tr>
          <td style="padding:20px 32px;font-size:13px;color:#475569;">
            <div style="font-weight:600;color:#0c4a6e;margin-bottom:6px;">Need help?</div>
            <div>📧 <a href="mailto:${SUPPORT_EMAIL}" style="color:#0369a1;text-decoration:none;">${SUPPORT_EMAIL}</a></div>
            <div>📞 ${SUPPORT_PHONE}</div>
            <div style="margin-top:8px;">🌐 <a href="${SITE_URL}" style="color:#0369a1;text-decoration:none;">academy.focusyourfinance.com</a></div>
          </td>
        </tr>
        <tr>
          <td style="background:#0c4a6e;padding:18px 32px;text-align:center;color:#cbd5e1;font-size:12px;">
            © ${new Date().getFullYear()} Focus Academy · Bridging Nepal to US Tax Careers
            <div style="margin-top:6px;color:#94a3b8;">You received this email because you engaged with Focus Academy.</div>
          </td>
        </tr>
      </table>
      ${pixel}
    </td></tr>
  </table>
</body>
</html>`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  let sentBy: string | null = null;
  const auth = req.headers.get("Authorization");
  if (auth) {
    try {
      const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: auth } },
      });
      const { data } = await userClient.auth.getUser();
      sentBy = data.user?.id ?? null;
    } catch { /* ignore */ }
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY_1") ?? Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (await req.json()) as Payload;
    if (!payload?.to || !Array.isArray(payload.to) || payload.to.length === 0) {
      return new Response(JSON.stringify({ error: "Missing recipients" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!payload.subject?.trim() || !payload.body?.trim()) {
      return new Response(JSON.stringify({ error: "Subject and body required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cta = payload.cta_label?.trim() && payload.cta_url?.trim()
      ? { label: payload.cta_label.trim(), url: payload.cta_url.trim() }
      : null;

    const recipients: Recipient[] = payload.to.map((r) =>
      typeof r === "string" ? { email: r, name: null } : r
    ).filter((r) => !!r.email);

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ error: "No valid email addresses" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const personalize = (text: string, name: string | null | undefined) => {
      const full = (name ?? "").trim();
      const first = full.split(/\s+/)[0] || "there";
      const safeFull = full || first;
      // Match [First Name], [FirstName], [first_name], {name}, {{name}}, [Full Name], etc.
      return text
        .replace(/\[\s*first[\s_-]*name\s*\]/gi, first)
        .replace(/\{\{?\s*first[\s_-]*name\s*\}?\}/gi, first)
        .replace(/\[\s*full[\s_-]*name\s*\]/gi, safeFull)
        .replace(/\{\{?\s*full[\s_-]*name\s*\}?\}/gi, safeFull)
        .replace(/\[\s*name\s*\]/gi, first)
        .replace(/\{\{?\s*name\s*\}?\}/gi, first);
    };

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    // Resend free tier allows 2 req/sec — pace at ~1.5 emails/sec to be safe.
    const PACE_MS = 700;

    const results: Array<{ to: string; ok: boolean; status: number; error: string | null }> = [];
    for (let i = 0; i < recipients.length; i++) {
      const r = recipients[i];
      if (i > 0) await sleep(PACE_MS);
      const sendOne = async () => {
        const personalBody = personalize(payload.body, r.name);
        // Insert pending log first to get an id used for tracking links.
        const { data: inserted } = await admin.from("email_logs").insert({
          recipient_name: r.name ?? null,
          recipient_email: r.email,
          subject: payload.subject,
          body: personalBody,
          status: "sent", // optimistic; will update on failure
          sent_by: sentBy,
          inquiry_id: r.inquiry_id ?? r.id ?? null,
          cta_label: cta?.label ?? null,
          cta_url: cta?.url ?? null,
        }).select("id").single();

        const logId = inserted?.id as string;
        const html = wrapHtml(personalBody, payload.subject, logId, cta);

        let ok = false, status = 0, errMsg: string | null = null;
        // Retry up to 3 times on 429 rate-limit
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const res = await fetch(RESEND_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${RESEND_API_KEY}`,
              },
              body: JSON.stringify({ from: FROM, to: [r.email], subject: payload.subject, html }),
            });
            status = res.status;
            ok = res.ok;
            if (ok) break;
            const data = await res.json().catch(() => ({}));
            errMsg = data?.message || data?.error || `HTTP ${status}`;
            if (status === 429) {
              await sleep(1200 * (attempt + 1));
              continue;
            }
            break;
          } catch (e) {
            errMsg = (e as Error).message;
            break;
          }
        }

        if (!ok && logId) {
          await admin.from("email_logs").update({
            status: "failed", error_message: errMsg,
          }).eq("id", logId);
        }

        return { to: r.email, ok, status, error: errMsg };
      };
      results.push(await sendOne());
    }

    const failed = results.filter((r) => !r.ok).length;
    return new Response(
      JSON.stringify({ sent: results.length - failed, failed, results }),
      {
        status: failed === results.length ? 502 : 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
