import { Disclaimer, Icon } from "./ui";
/** Presentational handoff for San Gaspar's /s/[id] route; server validates expiry. */
export function SharedSummary({
  summary,
  en = false,
}: {
  summary: null | { type: string; dates: string[]; nextSteps: string[] };
  en?: boolean;
}) {
  return (
    <main id="main" className="help-page">
      <div className="screen-heading">
        <p className="eyebrow">
          <Icon name="link" size={16} />
          LegaLinaw
        </p>
        <h1>
          {summary
            ? en
              ? "A shared preparation summary"
              : "Ibinahaging buod sa paghahanda"
            : en
              ? "This summary is no longer available."
              : "Hindi na available ang buod na ito."}
        </h1>
      </div>
      {summary && (
        <section className="panel">
          <div className="panel-content">
            <h2>{summary.type}</h2>
            <ul>
              {summary.dates.slice(0, 5).map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
            <h3>{en ? "Preparation" : "Paghahanda"}</h3>
            <ul>
              {summary.nextSteps.slice(0, 20).map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        </section>
      )}
      <Disclaimer en={en} />
    </main>
  );
}
