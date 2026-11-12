"use client";
import { useEffect, useRef, useState } from "react";
import { gateway, safeExternalUrl, type Provider } from "@/lib/gateway";
import { Icon } from "./ui";
export function DirectoryFinder({ en }: { en: boolean }) {
  const [city, setCity] = useState("");
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function search() {
    if (!city.trim()) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setFailed(false);
    setProviders(null);
    try {
      const result = await gateway.providers(city.trim(), controller.signal);
      if (!controller.signal.aborted) setProviders(result);
    } catch {
      if (!controller.signal.aborted) setFailed(true);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <section className="panel" style={{ margin: "25px 0" }}>
      <div className="panel-content">
        <h2 style={{ fontSize: "1.3rem", marginBottom: 18 }}>
          {en
            ? "Look for help in your city"
            : "Humanap ng tulong sa iyong lungsod"}
        </h2>
        <form
          className="add-question"
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
        >
          <label htmlFor="help-city" className="sr-only">
            {en ? "City or municipality" : "Lungsod o munisipalidad"}
          </label>
          <input
            id="help-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            maxLength={100}
            placeholder={
              en ? "City or municipality" : "Lungsod o munisipalidad"
            }
          />
          <button className="button" disabled={busy || !city.trim()}>
            <Icon name="search" size={17} />
            {en ? "Search" : "Hanapin"}
          </button>
        </form>
        {busy && (
          <p role="status" className="field-hint">
            {en ? "Looking for providers…" : "Hinahanap ang mga provider…"}
          </p>
        )}
        {failed && (
          <div className="notice-alert" role="status">
            {en
              ? "The local directory is not connected or could not load. Use the official national links below."
              : "Hindi pa nakakonekta o hindi ma-load ang lokal na directory. Gamitin ang mga opisyal na pambansang link sa ibaba."}
            <button className="text-button" onClick={search}>
              {en ? "Retry" : "Subukan muli"}
            </button>
          </div>
        )}
        {providers?.length === 0 && (
          <p role="status" className="notice-alert">
            {en
              ? "No matching providers found. The national resources below may help."
              : "Walang nahanap na tugmang provider. Maaaring makatulong ang mga pambansang source sa ibaba."}
          </p>
        )}
        {!!providers?.length && (
          <div className="help-grid">
            {providers.map((p) => (
              <article className="resource-card" key={p.id}>
                <span className="pill">{p.type}</span>
                <h3 style={{ marginTop: 12 }}>{p.name}</h3>
                <p>{p.address}</p>
                <p>
                  {p.hours ||
                    (en ? "Hours not available" : "Walang available na oras")}
                </p>
                <p>
                  {en ? "Last verified" : "Huling sinuri"}: {p.lastVerified}
                </p>
                {safeExternalUrl(p.url) && (
                  <a
                    href={safeExternalUrl(p.url)!}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {en ? "Official details" : "Opisyal na detalye"} ↗
                  </a>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
