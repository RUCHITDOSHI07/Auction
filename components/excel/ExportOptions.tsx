export default function ExportOptions() {
  return (
    <section className="panel export-panel">
      <div className="section-heading">
        <h2>Export auction results</h2>
      </div>

      <div className="export-overview">
        <div className="mini-stat">
          <label>Auction</label>
          <strong>The Founders Cup 2026</strong>
        </div>
        <div className="mini-stat">
          <label>Teams</label>
          <strong>8</strong>
        </div>
        <div className="mini-stat">
          <label>Players sold</label>
          <strong>64</strong>
        </div>
        <div className="mini-stat">
          <label>Players unsold</label>
          <strong>56</strong>
        </div>
      </div>

      <div className="export-form">
        <label>
          Output format
          <select defaultValue="team-wise">
            <option value="team-wise">Team-wise squad list</option>
            <option value="detailed">Detailed auction report</option>
          </select>
        </label>
      </div>

      <div className="form-actions">
        <button className="button button-outline" type="button">
          Preview export
        </button>
        <button className="button button-dark" type="button">
          Export Excel
        </button>
      </div>
    </section>
  );
}
