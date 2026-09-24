import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import { PageHeader, SectionHeading } from "@/components/ui/Primitives";

export default function AdminTeamsPage() {
  return (
    <AdminShell>
      <div className="content-wrap">
        <PageHeader
          eyebrow="NEXT · TOURNAMENT TEAMS"
          title="Teams"
          description="Teams will be created inside a specific tournament and competition. Men's and women's teams remain completely separate."
          action={<Link className="button button-outline" href="/admin/tournaments">Choose tournament</Link>}
        />
        <section className="panel">
          <SectionHeading title="Tournament context required" />
          <p>Select a tournament first. Team creation will be implemented in the next phase and will require a specific competition context.</p>
        </section>
      </div>
    </AdminShell>
  );
}
