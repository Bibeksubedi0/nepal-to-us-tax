import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
};

const HTML_TEMPLATE = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
            <tr>
              <td style="padding:32px 40px 16px;border-bottom:1px solid #eee;">
                <div style="font-size:18px;font-weight:700;color:#0f1b3d;">Focus Academy</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 40px 8px;">
                <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#0f1b3d;">Welcome aboard, {{first_name}} 🎉</h1>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">You just took the first step, and we're so glad you're here.</p>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Your account is set up and waiting for you at your student dashboard. Log in tonight and take a few minutes to explore — you'll see the full course outline, what each class covers week by week, the instructors you'll learn from, and exactly what you'll walk away knowing.</p>
                <p style="margin:24px 0;text-align:center;">
                  <a href="https://academy.focusyourfinance.com/portal" style="display:inline-block;background:#c9a84c;color:#0f1b3d;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:8px;font-size:16px;">Open your dashboard</a>
                </p>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">A small piece of advice: don't overthink it. The hardest part of any financial education journey is starting. You've already done that. The next step is just showing up to look around.</p>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Questions about the program, the schedule, or what to expect? Just reply to this email and we'll walk you through it personally.</p>
                <p style="margin:0 0 8px;font-size:16px;line-height:1.6;">Looking forward to seeing you inside,</p>
                <p style="margin:0 0 24px;font-size:16px;line-height:1.6;font-weight:600;">The Focus Academy team</p>
                <p style="margin:0;font-size:14px;line-height:1.6;color:#555;font-style:italic;">P.S. The students who get the most out of Focus Academy aren't the ones who watch the most videos. They're the ones who show up consistently and apply what they learn one decision at a time. You can absolutely be one of them.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px;border-top:1px solid #eee;font-size:12px;color:#888;text-align:center;">
                © Focus Academy · academy.focusyourfinance.com
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

const TEXT_TEMPLATE = `Welcome aboard, {{first_name}} 🎉

You just took the first step, and we're so glad you're here.

Your account is set up and waiting for you at your student dashboard. Log in tonight and take a few minutes to explore — you'll see the full course outline, what each class covers week by week, the instructors you'll learn from, and exactly what you'll walk away knowing.

Open your dashboard: https://academy.focusyourfinance.com/portal

A small piece of advice: don't overthink it. The hardest part of any financial education journey is starting. You've already done that. The next step is just showing up to look around.

Questions about the program, the schedule, or what to expect? Just reply to this email and we'll walk you through it personally.

Looking forward to seeing you inside,
The Focus Academy team

P.S. The students who get the most out of Focus Academy aren't the ones who watch the most videos. They're the ones who show up consistently and apply what they learn one decision at a time. You can absolutely be one of them.

© Focus Academy · academy.focusyourfinance.com`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY_1") ?? Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("Missing RESEND_API_KEY");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json();
    const record = payload?.record ?? {};
    let email: string | undefined = record.email;
    let fullName: string | undefined =
      record.raw_user_meta_data?.full_name ?? record.full_name ?? record.user_metadata?.full_name;

    console.log("send-welcome-email invoked for user id:", record.id);

    if (!email && record.id) {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(SUPABASE_URL, SERVICE_KEY);
      const { data, error } = await admin.auth.admin.getUserById(record.id);
      if (error) {
        console.error("Failed to look up user:", error.message);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      email = data.user?.email ?? undefined;
      fullName = fullName ?? (data.user?.user_metadata?.full_name as string | undefined);
    }

    if (!email) {
      console.error("No email found in payload or auth lookup");
      return new Response(JSON.stringify({ error: "Email not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const firstName = (fullName?.trim().split(/\s+/)[0]) || "there";
    const html = HTML_TEMPLATE.replaceAll("{{first_name}}", firstName);
    const text = TEXT_TEMPLATE.replaceAll("{{first_name}}", firstName);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Focus Academy <academy@focusyourfinance.com>",
        to: [email],
        subject: "Welcome to Focus Academy 🎉",
        html,
        text,
      }),
    });

    const body = await res.json();
    if (!res.ok) {
      console.error("Resend error:", body);
      return new Response(JSON.stringify({ error: body }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Welcome email sent:", body.id, "to", email);
    return new Response(JSON.stringify({ success: true, id: body.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-welcome-email exception:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
