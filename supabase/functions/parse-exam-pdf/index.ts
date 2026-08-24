// Admin-only: converts raw text extracted from a question-paper PDF into structured MCQs
// using the Google Gemini API. Returns questions for admin review before saving.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SYSTEM = `You convert exam/quiz papers into structured multiple-choice questions.
Rules:
- Return every question found in the text, in the original order.
- Each question must have 2-6 answer options (prefer 4) and exactly one correct option.
- If the source marks an answer (answer key, bold, asterisk, "Ans:"), use it. Otherwise infer the best correct answer.
- Strip numbering ("1.", "Q3)") and option letters ("A.", "(b)") from the text you return.
- marks defaults to 1 unless the paper states otherwise.
- Never invent questions that are not in the text.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(url, service);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    if (!(roles || []).some((r: any) => r.role === "admin")) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (text.length < 40) return json({ error: "Could not read any text from this PDF." }, 400);
    if (text.length > 120000) return json({ error: "PDF is too large. Split it into smaller files." }, 400);

    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return json({ error: "AI is not configured" }, 500);

    // Google's OpenAI-compatible endpoint: same request/response shape as the old gateway.
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Extract all questions from this paper:\n\n${text}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "save_questions",
            description: "Return the extracted multiple-choice questions",
            parameters: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      question_text: { type: "string" },
                      options: { type: "array", items: { type: "string" } },
                      correct_index: { type: "integer" },
                      marks: { type: "integer" },
                    },
                    required: ["question_text", "options", "correct_index"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["questions"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "save_questions" } },
      }),
    });

    if (res.status === 429) return json({ error: "AI rate limit reached. Try again shortly." }, 429);
    if (res.status === 402) return json({ error: "AI quota exhausted. Check billing for the Gemini API key." }, 402);
    if (!res.ok) return json({ error: `AI error: ${await res.text()}` }, 502);

    const data = await res.json();
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return json({ error: "AI could not extract questions from this PDF." }, 422);

    let parsed: any;
    try { parsed = JSON.parse(args); } catch { return json({ error: "AI returned an unreadable result." }, 422); }

    const questions = (parsed.questions ?? [])
      .map((q: any) => {
        const options = (Array.isArray(q.options) ? q.options : [])
          .map((o: any) => String(o ?? "").trim()).filter(Boolean);
        const idx = Number.isInteger(q.correct_index) ? q.correct_index : 0;
        return {
          question_text: String(q.question_text ?? "").trim(),
          options,
          correct_index: Math.min(Math.max(idx, 0), Math.max(options.length - 1, 0)),
          marks: Number(q.marks) > 0 ? Math.round(Number(q.marks)) : 1,
        };
      })
      .filter((q: any) => q.question_text && q.options.length >= 2);

    if (!questions.length) return json({ error: "No multiple-choice questions were found in this PDF." }, 422);

    return json({ questions });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
