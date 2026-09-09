import AdminShell from "@/components/admin/AdminShell";
import { PageHeader, SectionHeading } from "@/components/ui/Primitives";

export default function AdminSettingsPage() {
  return (
    <AdminShell>
      <div className="content-wrap narrow-content">
        <PageHeader
          eyebrow="SETTINGS · ROOM CONFIGURATION"
          title="Settings"
          description="Operational defaults and public experience preferences for the live auction environment."
        />

        <section className="form-panel">
          <SectionHeading title="Display & behaviour" />
          <div className="check-list">
            <label className="check-row">
              <input type="checkbox" defaultChecked />
              <span>Public live display enabled</span>
              <small>Read-only spectators can view the room</small>
            </label>
            <label className="check-row">
              <input type="checkbox" defaultChecked />
              <span>Auto-refresh live status</span>
              <small>Refreshes on tournament state changes</small>
            </label>
            <label className="check-row">
              <input type="checkbox" defaultChecked />
              <span>Large-screen projector mode</span>
              <small>Optimized for teams, TVs, and projectors</small>
            </label>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
