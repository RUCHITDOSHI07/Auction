import Link from "next/link";

export default function Home() {
  return <main className="landing"><div className="landing-brand"><span className="brand-mark">CA</span><span>CRICKET<br /><b>AUCTION</b></span></div><div className="landing-content"><span className="eyebrow">THE FOUNDERS CUP · 2026</span><h1>The room<br /><i>is ready.</i></h1><p>A composed control surface for the decisions that make tournament day.</p><div className="landing-actions"><Link className="button button-dark" href="/dashboard">Enter control room <span>→</span></Link><Link className="button button-quiet" href="/live">Open live display ↗</Link></div></div><div className="landing-foot"><span>01 / 02</span><span>Admin controlled · Read-only public viewing</span></div></main>;
}
