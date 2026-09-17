import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CreateAccountInput = z
  .object({
    email: z.string().trim().email("E-postadressen verkar inte vara giltig."),
    password: z.string().min(6, "Lösenordet måste vara minst 6 tecken."),
    full_name: z.string().trim().min(1, "Fullständigt namn krävs."),
    role: z.enum(["admin", "customer"]),
    customer_id: z.string().uuid().optional(),
    customer_name: z.string().trim().optional(),
  })
  .refine(
    (data) => data.role === "admin" || Boolean(data.customer_id || data.customer_name),
    { message: "Välj en befintlig kund eller ange ett nytt kundnamn." },
  );

export const createAccountFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreateAccountInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: callerProfile, error: callerError } = await context.supabase
      .from("profiles")
      .select("role")
      .eq("id", context.userId)
      .maybeSingle();

    if (callerError || callerProfile?.role !== "admin") {
      return { ok: false as const, message: "Endast administratörer får skapa konton." };
    }

    const request = getRequest();
    const authorization = request?.headers.get("authorization");
    const supabaseUrl = process.env["SUPABASE_URL"];
    const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!authorization || !supabaseUrl || !publishableKey) {
      return { ok: false as const, message: "Din session har gått ut. Logga in igen." };
    }

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/create-account`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: publishableKey,
          Authorization: authorization,
        },
        body: JSON.stringify({ ...data, email: data.email.toLowerCase() }),
      });
      const raw = await response.text();
      let payload: { error?: string; message?: string; ok?: boolean } = {};
      try {
        payload = raw ? (JSON.parse(raw) as typeof payload) : {};
      } catch {
        payload = { error: raw };
      }

      if (!response.ok || payload.error || payload.ok === false) {
        const message = payload.error ?? payload.message ?? "Kunde inte skapa kontot.";
        const duplicate = /already (been )?registered|already exists|user_already_exists/i.test(message);
        return {
          ok: false as const,
          message: duplicate ? "E-postadressen används redan. Välj en annan e-post." : message,
        };
      }
      return { ok: true as const };
    } catch {
      return { ok: false as const, message: "Kunde inte nå kontotjänsten. Försök igen." };
    }
  });