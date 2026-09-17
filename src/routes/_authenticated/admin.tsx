import { useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { createAccountFn } from "@/lib/create-account.functions";

type AccountRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  customer_name: string | null;
};

type CustomerRow = { id: string; name: string };

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin | ATS" },
      { name: "description", content: "Administrera konton och kunder i ATS." },
      { property: "og:title", content: "Admin | ATS" },
      { property: "og:description", content: "Administrera konton och kunder i ATS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile?.role !== "admin") throw redirect({ to: "/dashboard" });
  },
  component: AdminPage,
});

function AdminPage() {
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const [role, setRole] = useState<"admin" | "customer">("customer");
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const createAccountOnServer = useServerFn(createAccountFn);

  const customersQuery = useQuery({
    queryKey: ["customers"],
    queryFn: async (): Promise<CustomerRow[]> => {
      const { data, error } = await supabase.from("customers").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const accountsQuery = useQuery({
    queryKey: ["accounts"],
    queryFn: async (): Promise<AccountRow[]> => {
      const { data, error } = await supabase.rpc("admin_list_accounts");
      if (error) throw error;
      return (data ?? []) as AccountRow[];
    },
  });

  const resetForm = () => {
    setRole("customer");
    setCustomerMode("existing");
    setCustomerId("");
    setCustomerName("");
    setEmail("");
    setPassword("");
    setFullName("");
    setFormError(null);
  };

  const translateError = (message: string): string => {
    if (/password should be at least 6 characters|minst 6 tecken/i.test(message))
      return "Lösenordet måste vara minst 6 tecken.";
    if (
      /already (been )?registered|already exists|email address has already|already in use|används redan|user_already_exists/i.test(
        message,
      )
    )
      return "E-postadressen används redan. Välj en annan e-post.";
    if (/invalid email|unable to validate email/i.test(message))
      return "E-postadressen verkar inte vara giltig.";
    return message;
  };


  const createAccount = useMutation({
    mutationFn: async (): Promise<{ ok: boolean; message?: string }> => {
      if (password.length < 6) {
        return { ok: false, message: "Lösenordet måste vara minst 6 tecken." };
      }

      const normalizedEmail = email.trim().toLocaleLowerCase("sv-SE");
      const emailAlreadyExists = (accountsQuery.data ?? []).some(
        (account) => account.email?.trim().toLocaleLowerCase("sv-SE") === normalizedEmail,
      );
      if (emailAlreadyExists) {
        return {
          ok: false,
          message: "E-postadressen används redan. Välj en annan e-post.",
        };
      }

      try {
        return await createAccountOnServer({
          data: {
            email: normalizedEmail,
            password,
            full_name: fullName.trim(),
            role,
            ...(role === "customer" && customerMode === "existing"
              ? { customer_id: customerId }
              : {}),
            ...(role === "customer" && customerMode === "new"
              ? { customer_name: customerName.trim() }
              : {}),
          },
        });
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : String(err) };
      }
    },
    onSuccess: (result) => {
      if (!result.ok) {
        setFormError(translateError(result.message || "Kunde inte skapa kontot"));
        return;
      }
      toast.success("Kontot har skapats");
      resetForm();
      setShowForm(false);
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (error: Error) => {
      setFormError(translateError(error.message || "Kunde inte skapa kontot"));
    },
  });

  const canSubmit =
    email.trim() !== "" &&
    password !== "" &&
    fullName.trim() !== "" &&
    (role === "admin" ||
      (customerMode === "existing" ? customerId !== "" : customerName.trim() !== ""));


  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <Link to="/" className="text-xl font-bold tracking-tight text-foreground">
          ATS
        </Link>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard">Dashboard</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => signOut()}>
            Logga ut
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">Adminpanel</h1>
          <Button onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Avbryt" : "Skapa konto"}
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Nytt konto</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  setFormError(null);
                  createAccount.mutate();
                }}
              >
                <div className="space-y-2">
                  <Label>Roll</Label>
                  <RadioGroup
                    value={role}
                    onValueChange={(v) => setRole(v as "admin" | "customer")}
                    className="flex gap-6"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="admin" id="role-admin" />
                      <Label htmlFor="role-admin" className="font-normal">
                        Admin
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="customer" id="role-customer" />
                      <Label htmlFor="role-customer" className="font-normal">
                        Kund
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {role === "customer" && (
                  <div className="space-y-3 rounded-md border p-4">
                    <RadioGroup
                      value={customerMode}
                      onValueChange={(v) => setCustomerMode(v as "existing" | "new")}
                      className="flex gap-6"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="existing" id="cust-existing" />
                        <Label htmlFor="cust-existing" className="font-normal">
                          Befintlig kund
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="new" id="cust-new" />
                        <Label htmlFor="cust-new" className="font-normal">
                          Ny kund
                        </Label>
                      </div>
                    </RadioGroup>

                    {customerMode === "existing" ? (
                      <div className="space-y-2">
                        <Label>Välj kund</Label>
                        <Select value={customerId} onValueChange={setCustomerId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Välj en kund" />
                          </SelectTrigger>
                          <SelectContent>
                            {(customersQuery.data ?? []).map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="customer-name">Nytt kundnamn</Label>
                        <Input
                          id="customer-name"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Företagsnamn"
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="full-name">Fullständigt namn</Label>
                    <Input
                      id="full-name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Anna Andersson"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-post</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                       onChange={(e) => {
                         setEmail(e.target.value);
                         if (formError) setFormError(null);
                       }}
                      placeholder="anna@foretag.se"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Lösenord</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                    <p className="text-xs text-muted-foreground">Minst 6 tecken</p>
                  </div>
                </div>

                {formError && (
                  <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {formError}
                  </p>
                )}

                <Button type="submit" disabled={!canSubmit || createAccount.isPending}>
                  {createAccount.isPending ? "Skapar…" : "Skapa konto"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Befintliga konton</CardTitle>
          </CardHeader>
          <CardContent>
            {accountsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Laddar konton…</p>
            ) : accountsQuery.isError ? (
              <p className="text-sm text-destructive">Kunde inte hämta konton.</p>
            ) : (accountsQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Inga konton ännu.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Namn</TableHead>
                    <TableHead>E-post</TableHead>
                    <TableHead>Roll</TableHead>
                    <TableHead>Kund</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(accountsQuery.data ?? []).map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.full_name ?? "—"}</TableCell>
                      <TableCell>{a.email ?? "—"}</TableCell>
                      <TableCell>{a.role === "admin" ? "Admin" : "Kund"}</TableCell>
                      <TableCell>{a.customer_name ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
