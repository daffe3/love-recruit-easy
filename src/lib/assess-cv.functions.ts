import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const AssessInput = z.object({
  cv_text: z.string().min(1),
  job_description: z.string().default(""),
});

export const assessCvFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AssessInput.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI-tjänsten är inte konfigurerad");

    const prompt = [
      "Du är en rekryteringsassistent. Bedöm hur väl kandidatens CV matchar jobbet.",
      "Svara på svenska. ai_score är ett heltal 0-100. ai_summary är max 3 meningar.",
      "",
      `JOBBESKRIVNING:\n${data.job_description || "(ingen beskrivning angiven)"}`,
      "",
      `CV:\n${data.cv_text}`,
    ].join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        reasoning_effort: "low",
        max_completion_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "cv_assessment",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                ai_score: { type: "integer" },
                ai_summary: { type: "string" },
              },
              required: ["ai_score", "ai_summary"],
            },
          },
        },
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      if (res.status === 429) throw new Error("För många förfrågningar just nu, försök igen om en stund.");
      if (res.status === 402) throw new Error("AI-krediterna är slut. Fyll på dem i Lovable.");
      console.error("AI gateway error", res.status, detail);
      throw new Error("AI-tjänsten svarade med ett fel. Försök igen.");
    }

    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = payload.choices?.[0]?.message?.content ?? "";
    if (!raw.trim()) throw new Error("AI:n gav ett tomt svar. Försök igen.");

    let parsed: { ai_score?: unknown; ai_summary?: unknown };
    try {
      parsed = JSON.parse(raw) as typeof parsed;
    } catch {
      throw new Error("AI-svaret kunde inte tolkas. Försök igen.");
    }

    const score = Number(parsed.ai_score);
    return {
      ai_score: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : null,
      ai_summary: typeof parsed.ai_summary === "string" ? parsed.ai_summary : "",
    };
  });
