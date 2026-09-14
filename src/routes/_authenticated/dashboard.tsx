import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard | ATS" },
      { name: "description", content: "ATS-dashboard." },
      { property: "og:title", content: "Dashboard | ATS" },
      { property: "og:description", content: "ATS-dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user, signOut } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <Link to="/" className="text-xl font-bold tracking-tight text-foreground">
          ATS
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <Button variant="outline" size="sm" onClick={() => signOut()}>
            Logga ut
          </Button>
        </div>
      </header>
      <main className="flex-1 p-6">
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Välkommen till ATS. Här kommer rekryteringsöversikten att visas.
        </p>
      </main>
    </div>
  );
}
