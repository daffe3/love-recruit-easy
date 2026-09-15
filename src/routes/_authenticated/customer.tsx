import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

type JobRow = {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  created_at: string | null;
};

type CustomerRow = { id: string; name: string };

export const Route = createFileRoute("/_authenticated/customer")({
  head: () => ({
    meta: [
      { title: "Jobb | ATS" },
      { name: "description", content: "Hantera jobbannonser för din kund i ATS." },
      { property: "og:title", content: "Jobb | ATS" },
      { property: "og:description", content: "Hantera jobbannonser för din kund i ATS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomerJobsPage,
});

function CustomerJobsPage() {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();

  const [actingCustomerId, setActingCustomerId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const profileQuery = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("role, customer_id")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const isAdmin = profileQuery.data?.role === "admin";

  const customersQuery = useQuery({
    queryKey: ["customers"],
    enabled: isAdmin,
    queryFn: async (): Promise<CustomerRow[]> => {
      const { data, error } = await supabase.from("customers").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const activeCustomerId = isAdmin
    ? actingCustomerId
    : (profileQuery.data?.customer_id ?? "");

  const jobsQuery = useQuery({
    queryKey: ["jobs", activeCustomerId],
    enabled: activeCustomerId !== "",
    queryFn: async (): Promise<JobRow[]> => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, title, description, status, created_at")
        .eq("customer_id", activeCustomerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setEditingId(null);
    setShowForm(false);
  };

  const saveJob = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const { error } = await supabase
          .from("jobs")
          .update({ title: title.trim(), description: description.trim() || null })
          .eq("id", editingId);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("jobs").insert({
        customer_id: activeCustomerId,
        title: title.trim(),
        description: description.trim() || null,
        status: "open",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editingId ? "Jobbet har uppdaterats" : "Jobbet har skapats");
      resetForm();
      void queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (error: Error) => toast.error(error.message || "Kunde inte spara jobbet"),
  });

  const toggleStatus = useMutation({
    mutationFn: async (job: JobRow) => {
      const next = job.status === "closed" ? "open" : "closed";
      const { error } = await supabase.from("jobs").update({ status: next }).eq("id", job.id);
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      toast.success(next === "closed" ? "Jobbet är stängt" : "Jobbet är öppnat igen");
      void queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (error: Error) => toast.error(error.message || "Kunde inte ändra status"),
  });

  const startEdit = (job: JobRow) => {
    setEditingId(job.id);
    setTitle(job.title);
    setDescription(job.description ?? "");
    setShowForm(true);
  };

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-foreground">Jobb</h1>
          <Button
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
            disabled={activeCustomerId === ""}
          >
            {showForm ? "Avbryt" : "Skapa jobb"}
          </Button>
        </div>

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Agera som kund</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={actingCustomerId}
                onValueChange={(v) => {
                  setActingCustomerId(v);
                  resetForm();
                }}
              >
                <SelectTrigger className="max-w-sm">
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
            </CardContent>
          </Card>
        )}

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>{editingId ? "Redigera jobb" : "Nytt jobb"}</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveJob.mutate();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="job-title">Titel</Label>
                  <Input
                    id="job-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Systemutvecklare"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="job-description">Beskrivning</Label>
                  <Textarea
                    id="job-description"
                    rows={5}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Beskriv rollen…"
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={title.trim() === "" || saveJob.isPending}>
                    {saveJob.isPending ? "Sparar…" : editingId ? "Spara ändringar" : "Skapa jobb"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={resetForm}>
                    Avbryt
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Jobbannonser</CardTitle>
          </CardHeader>
          <CardContent>
            {profileQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Laddar…</p>
            ) : activeCustomerId === "" ? (
              <p className="text-sm text-muted-foreground">
                {isAdmin
                  ? "Välj en kund ovan för att hantera jobb."
                  : "Ditt konto är inte kopplat till någon kund."}
              </p>
            ) : jobsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Laddar jobb…</p>
            ) : jobsQuery.isError ? (
              <p className="text-sm text-destructive">Kunde inte hämta jobben.</p>
            ) : (jobsQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Inga jobb ännu.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Åtgärder</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(jobsQuery.data ?? []).map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <div className="font-medium">{job.title}</div>
                        {job.description && (
                          <div className="line-clamp-2 text-sm text-muted-foreground">
                            {job.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{job.status === "closed" ? "Stängt" : "Öppet"}</TableCell>
                      <TableCell className="space-x-2 text-right">
                        <Button variant="outline" size="sm" onClick={() => startEdit(job)}>
                          Redigera
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleStatus.mutate(job)}
                          disabled={toggleStatus.isPending}
                        >
                          {job.status === "closed" ? "Öppna" : "Stäng"}
                        </Button>
                      </TableCell>
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
