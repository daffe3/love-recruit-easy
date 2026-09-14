import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ATS" },
      { name: "description", content: "Ett enkelt applicant tracking system för rekrytering." },
      { property: "og:title", content: "ATS" },
      { property: "og:description", content: "Ett enkelt applicant tracking system för rekrytering." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, isLoading } = useAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold tracking-tight text-foreground sm:text-7xl">ATS</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Applicant Tracking System för enkel rekrytering
        </p>
        <div className="mt-8">
          {isLoading ? (
            <Button disabled size="lg">
              Laddar…
            </Button>
          ) : user ? (
            <Button asChild size="lg">
              <Link to="/dashboard">Gå till dashboard</Link>
            </Button>
          ) : (
            <Button asChild size="lg">
              <Link to="/auth">Logga in</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
