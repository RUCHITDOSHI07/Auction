import AdminShell from "@/components/admin/AdminShell";
import { PageHeader, SectionHeading, StatusBadge } from "@/components/ui/Primitives";

const steps = ["Identity", "Rules", "Player order", "Review"];

export default function AdminAuctionSetupPage() {
  return (
    <AdminShell>
      <div className="content-wrap narrow-content">
        <PageHeader
          eyebrow="AUCTION SETUP · DRAFT"
          title="Build an auction"
          description="Configure the tournament rules, player order, and team settings before the room goes live."
          action={<StatusBadge tone="warning">DRAFT</StatusBadge>}
        />

        <div className="stepper">
          {steps.map((step, index) => (
            <div className={index === 0 ? "step active" : "step"} key={step}>
              <span>0{index + 1}</span>
              {step}
            </div>
          ))}
        </div>

        <section className="form-panel">
          <SectionHeading title="Auction identity" />
          <div className="form-grid">
            <label>
              Auction name
              <input defaultValue={"Men's Premier Auction"} />
            </label>
            <label>
              Category
              <select defaultValue="men">
                <option value="men">{"Men's auction"}</option>
                <option value="women">{"Women's auction"}</option>
              </select>
            </label>
            <label>
              Starting purse
              <input defaultValue="100" type="number" />
              <small>Credits available per team</small>
            </label>
            <label>
              Squad size
              <input defaultValue="11" type="number" />
              <small>Players selected per team</small>
            </label>
            <label className="full-field">
              Bid increment
              <input defaultValue="1" type="number" />
              <small>Standard bid step in credits</small>
            </label>
          </div>
        </section>

        <section className="form-panel">
          <SectionHeading title="Included teams" action={<span className="muted-label">5 selected</span>} />
          {[
            "North Stars",
            "Coastal Strikers",
            "Redwood Royals",
            "City Lions",
            "Green Valley",
          ].map((team) => (
            <label className="check-row" key={team}>
              <input type="checkbox" defaultChecked />
              <span>{team}</span>
              <small>₹100L purse · 11 player squad</small>
            </label>
          ))}
        </section>

        <div className="form-actions">
          <button className="button button-quiet" type="button">
            Cancel
          </button>
          <button className="button button-dark" type="button">
            Save and continue <span>→</span>
          </button>
        </div>
      </div>
    </AdminShell>
  );
}
