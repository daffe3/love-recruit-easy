import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

type CandidateRow = {
  id: string;
  name: string;
  email: string | null;
  linkedin_url: string | null;
  notes: string | null;
  created_at: string | null;
};

type CustomerRow = { id: string; name: string };

type PipelineRow = {
  id: string;
  candidate_id: string;
  job_id: string;
  stage: string;
  ai_score: number | null;
  ai_summary: string | null;
  candidates: { name: string } | null;
  jobs: { title: string; description: string | null } | null;
};

const STAGES: { value: string; label: string }[] = [
  { value: "new", label: "Nya" },
  { value: "screening", label: "Screening" },
  { value: "interview", label: "Intervju" },
  { value: "offer", label: "Erbjudande" },
  { value: "hired", label: "Anställd" },
  { value: "rejected", label: "Avslag" },
];

const stageLabel = (value: string) =>
  STAGES.find((s) => s.value === value)?.label ?? value;

export const Route = createFileRoute("/_authenticated/customer")({
  head: () => ({
    meta: [
      { title: "Jobb & kandidater | ATS" },
      {
        name: "description",
        content: "Hantera jobbannonser och kandidater för din kund i ATS.",
      },
      { property: "og:title", content: "Jobb & kandidater | ATS" },
      {
        property: "og:description",
        content: "Hantera jobbannonser och kandidater för din kund i ATS.",
      },
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

  const [showCandidateForm, setShowCandidateForm] = useState(false);
  const [editingCandidateId, setEditingCandidateId] = useState<string | null>(null);
  const [candName, setCandName] = useState("");
  const [candEmail, setCandEmail] = useState("");
  const [candLinkedin, setCandLinkedin] = useState("");
  const [candNotes, setCandNotes] = useState("");
  const [candJobIds, setCandJobIds] = useState<string[]>([]);

  const [pipelineJobFilter, setPipelineJobFilter] = useState("all");
  const [pipelineNameFilter, setPipelineNameFilter] = useState("");

  const [assessRow, setAssessRow] = useState<PipelineRow | null>(null);
  const [cvText, setCvText] = useState("");

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

  const candidatesQuery = useQuery({
    queryKey: ["candidates", activeCustomerId],
    enabled: activeCustomerId !== "",
    queryFn: async (): Promise<CandidateRow[]> => {
      const { data, error } = await supabase
        .from("candidates")
        .select("id, name, email, linkedin_url, notes, created_at")
        .eq("customer_id", activeCustomerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const pipelineQuery = useQuery({
    queryKey: ["pipeline", activeCustomerId],
    enabled: activeCustomerId !== "",
    queryFn: async (): Promise<PipelineRow[]> => {
      const { data, error } = await supabase
        .from("candidate_pipeline")
        .select(
          "id, candidate_id, job_id, stage, ai_score, ai_summary, candidates(name), jobs!inner(title, description, customer_id)",
        )
        .eq("jobs.customer_id", activeCustomerId);
      if (error) throw error;
      return (data ?? []) as unknown as PipelineRow[];
    },
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setEditingId(null);
    setShowForm(false);
  };

  const resetCandidateForm = () => {
    setCandName("");
    setCandEmail("");
    setCandLinkedin("");
    setCandNotes("");
    setCandJobIds([]);
    setEditingCandidateId(null);
    setShowCandidateForm(false);
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

  const saveCandidate = useMutation({
    mutationFn: async () => {
      const payload = {
        name: candName.trim(),
        email: candEmail.trim() || null,
        linkedin_url: candLinkedin.trim() || null,
        notes: candNotes.trim() || null,
      };

      if (editingCandidateId) {
        const { error } = await supabase
          .from("candidates")
          .update(payload)
          .eq("id", editingCandidateId);
        if (error) throw error;
        return;
      }

      const { data, error } = await supabase
        .from("candidates")
        .insert({ ...payload, customer_id: activeCustomerId })
        .select("id")
        .single();
      if (error) throw error;

      if (candJobIds.length > 0 && data) {
        const { error: pipelineError } = await supabase.from("candidate_pipeline").insert(
          candJobIds.map((jobId) => ({
            candidate_id: data.id,
            job_id: jobId,
            stage: "new",
          })),
        );
        if (pipelineError) throw pipelineError;
      }
    },
    onSuccess: () => {
      toast.success(
        editingCandidateId ? "Kandidaten har uppdaterats" : "Kandidaten har lagts till",
      );
      resetCandidateForm();
      void queryClient.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: (error: Error) => toast.error(error.message || "Kunde inte spara kandidaten"),
  });

  const moveStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const { error } = await supabase
        .from("candidate_pipeline")
        .update({ stage })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Kandidaten har flyttats");
      void queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
    onError: (error: Error) => toast.error(error.message || "Kunde inte flytta kandidaten"),
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

  const startEditCandidate = (c: CandidateRow) => {
    setEditingCandidateId(c.id);
    setCandName(c.name);
    setCandEmail(c.email ?? "");
    setCandLinkedin(c.linkedin_url ?? "");
    setCandNotes(c.notes ?? "");
    setCandJobIds([]);
    setShowCandidateForm(true);
  };

  const noCustomerMessage = isAdmin
    ? "Välj en kund ovan för att fortsätta."
    : "Ditt konto är inte kopplat till någon kund.";

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
        <h1 className="text-2xl font-semibold text-foreground">Rekrytering</h1>

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
                  resetCandidateForm();
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

        <Tabs defaultValue="jobs" className="space-y-6">
          <TabsList>
            <TabsTrigger value="jobs">Jobb</TabsTrigger>
            <TabsTrigger value="candidates">Kandidater</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          </TabsList>

          <TabsContent value="jobs" className="space-y-6">
            <div className="flex justify-end">
              <Button
                onClick={() => (showForm ? resetForm() : setShowForm(true))}
                disabled={activeCustomerId === ""}
              >
                {showForm ? "Avbryt" : "Skapa jobb"}
              </Button>
            </div>

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
                        {saveJob.isPending
                          ? "Sparar…"
                          : editingId
                            ? "Spara ändringar"
                            : "Skapa jobb"}
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
                  <p className="text-sm text-muted-foreground">{noCustomerMessage}</p>
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
          </TabsContent>

          <TabsContent value="candidates" className="space-y-6">
            <div className="flex justify-end">
              <Button
                onClick={() =>
                  showCandidateForm ? resetCandidateForm() : setShowCandidateForm(true)
                }
                disabled={activeCustomerId === ""}
              >
                {showCandidateForm ? "Avbryt" : "Lägg till kandidat"}
              </Button>
            </div>

            {showCandidateForm && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    {editingCandidateId ? "Redigera kandidat" : "Ny kandidat"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    className="space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveCandidate.mutate();
                    }}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="cand-name">Namn</Label>
                      <Input
                        id="cand-name"
                        value={candName}
                        onChange={(e) => setCandName(e.target.value)}
                        placeholder="Anna Andersson"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cand-email">E-post</Label>
                      <Input
                        id="cand-email"
                        type="email"
                        value={candEmail}
                        onChange={(e) => setCandEmail(e.target.value)}
                        placeholder="anna@exempel.se"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cand-linkedin">LinkedIn-länk</Label>
                      <Input
                        id="cand-linkedin"
                        value={candLinkedin}
                        onChange={(e) => setCandLinkedin(e.target.value)}
                        placeholder="https://linkedin.com/in/…"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cand-notes">Anteckningar</Label>
                      <Textarea
                        id="cand-notes"
                        rows={4}
                        value={candNotes}
                        onChange={(e) => setCandNotes(e.target.value)}
                        placeholder="Kort om kandidaten…"
                      />
                    </div>

                    {!editingCandidateId && (
                      <div className="space-y-2">
                        <Label>Koppla till jobb</Label>
                        {(jobsQuery.data ?? []).length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Inga jobb att koppla till ännu.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {(jobsQuery.data ?? []).map((job) => (
                              <div key={job.id} className="flex items-center gap-2">
                                <Checkbox
                                  id={`job-${job.id}`}
                                  checked={candJobIds.includes(job.id)}
                                  onCheckedChange={(checked) =>
                                    setCandJobIds((prev) =>
                                      checked === true
                                        ? [...prev, job.id]
                                        : prev.filter((id) => id !== job.id),
                                    )
                                  }
                                />
                                <Label htmlFor={`job-${job.id}`} className="font-normal">
                                  {job.title}
                                  {job.status === "closed" ? " (stängt)" : ""}
                                </Label>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        disabled={candName.trim() === "" || saveCandidate.isPending}
                      >
                        {saveCandidate.isPending
                          ? "Sparar…"
                          : editingCandidateId
                            ? "Spara ändringar"
                            : "Lägg till kandidat"}
                      </Button>
                      <Button type="button" variant="ghost" onClick={resetCandidateForm}>
                        Avbryt
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Kandidater</CardTitle>
              </CardHeader>
              <CardContent>
                {profileQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Laddar…</p>
                ) : activeCustomerId === "" ? (
                  <p className="text-sm text-muted-foreground">{noCustomerMessage}</p>
                ) : candidatesQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Laddar kandidater…</p>
                ) : candidatesQuery.isError ? (
                  <p className="text-sm text-destructive">Kunde inte hämta kandidaterna.</p>
                ) : (candidatesQuery.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Inga kandidater ännu.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Namn</TableHead>
                        <TableHead>E-post</TableHead>
                        <TableHead>LinkedIn</TableHead>
                        <TableHead className="text-right">Åtgärder</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(candidatesQuery.data ?? []).map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>
                            <div className="font-medium">{c.name}</div>
                            {c.notes && (
                              <div className="line-clamp-2 text-sm text-muted-foreground">
                                {c.notes}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{c.email ?? "—"}</TableCell>
                          <TableCell>
                            {c.linkedin_url ? (
                              <a
                                href={c.linkedin_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary underline underline-offset-4"
                              >
                                Profil
                              </a>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => startEditCandidate(c)}
                            >
                              Redigera
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pipeline" className="space-y-4">
            {profileQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Laddar…</p>
            ) : activeCustomerId === "" ? (
              <p className="text-sm text-muted-foreground">{noCustomerMessage}</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={pipelineJobFilter} onValueChange={setPipelineJobFilter}>
                    <SelectTrigger className="w-56">
                      <SelectValue placeholder="Alla jobb" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alla jobb</SelectItem>
                      {(jobsQuery.data ?? []).map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="w-56"
                    placeholder="Sök kandidatnamn…"
                    value={pipelineNameFilter}
                    onChange={(e) => setPipelineNameFilter(e.target.value)}
                  />
                </div>

                {pipelineQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Laddar pipeline…</p>
                ) : pipelineQuery.isError ? (
                  <p className="text-sm text-destructive">Kunde inte hämta pipelinen.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                    {STAGES.map((stage) => {
                      const cards = (pipelineQuery.data ?? []).filter((row) => {
                        if (row.stage !== stage.value) return false;
                        if (pipelineJobFilter !== "all" && row.job_id !== pipelineJobFilter)
                          return false;
                        const name = row.candidates?.name?.toLowerCase() ?? "";
                        return name.includes(pipelineNameFilter.trim().toLowerCase());
                      });
                      return (
                        <div key={stage.value} className="rounded-md border bg-muted/40 p-2">
                          <div className="mb-2 flex items-center justify-between px-1">
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {stage.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {cards.length}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {cards.length === 0 ? (
                              <p className="px-1 py-2 text-xs text-muted-foreground">—</p>
                            ) : (
                              cards.map((row) => (
                                <div
                                  key={row.id}
                                  className="space-y-2 rounded-md border bg-card p-2 shadow-sm"
                                >
                                  <div className="text-sm font-medium leading-tight">
                                    {row.candidates?.name ?? "Okänd"}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {row.jobs?.title ?? "—"}
                                  </div>
                                  <Select
                                    value={row.stage}
                                    onValueChange={(next) =>
                                      moveStage.mutate({ id: row.id, stage: next })
                                    }
                                    disabled={moveStage.isPending}
                                  >
                                    <SelectTrigger
                                      className="h-7 text-xs"
                                      aria-label="Byt steg"
                                    >
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {STAGES.map((s) => (
                                        <SelectItem key={s.value} value={s.value}>
                                          {s.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
