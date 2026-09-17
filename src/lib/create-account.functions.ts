import { createServerFn } from "@tanstack/react-start";
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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
    });

    if (createError || !created.user) {
      const message = createError?.message ?? "Kunde inte skapa kontot.";
      const duplicate = /already (been )?registered|already exists|user_already_exists/i.test(message);
      return {
        ok: false as const,
        message: duplicate ? "E-postadressen används redan. Välj en annan e-post." : message,
      };
    }

    let customerId: string | null = null;
    if (data.role === "customer" && data.customer_id) {
      const { data: customer, error } = await supabaseAdmin
        .from("customers")
        .select("id")
        .eq("id", data.customer_id)
        .maybeSingle();
      if (error || !customer) {
        await supabaseAdmin.auth.admin.deleteUser(created.user.id);
        return { ok: false as const, message: "Den valda kunden finns inte längre." };
      }
      customerId = customer.id;
    } else if (data.role === "customer" && data.customer_name) {
      const { data: customer, error } = await supabaseAdmin
        .from("customers")
        .insert({ name: data.customer_name })
        .select("id")
        .single();
      if (error || !customer) {
        await supabaseAdmin.auth.admin.deleteUser(created.user.id);
        return { ok: false as const, message: "Kunden kunde inte skapas. Försök igen." };
      }
      customerId = customer.id;
    }

    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: created.user.id,
      full_name: data.full_name,
      role: data.role,
      customer_id: customerId,
    });
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      return { ok: false as const, message: "Kontot kunde inte kopplas till en profil. Försök igen." };
    }

    return { ok: true as const };
  });