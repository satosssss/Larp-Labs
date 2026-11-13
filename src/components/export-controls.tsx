"use client";
import { useEffect, useState } from "react";
import { useFlow } from "@/lib/flow";
import {
  gateway,
  safeShareUrl,
  type ShareLink,
  type ReportInput,
} from "@/lib/gateway";
import { Icon } from "./ui";
export function ExportControls({ en }: { en: boolean }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [share, setShare] = useState<ShareLink | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!share) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [share]);
  const expired = !!share && Date.parse(share.expiresAt) <= now;
  function payload(): ReportInput {
    const s = useFlow.getState();
    return {
      analysis: s.analysis,
      sample: s.mode === "sample",
      questions: s.questions.filter((q) => q.trim()),
      checked: s.checked,
      language: s.language,
    };
  }
  async function run(kind: "report" | "share" | "revoke") {
    setBusy(true);
    setStatus("");
    try {
      if (kind === "report") {
        const blob = await gateway.report(payload());
        if (blob.type !== "application/pdf") throw new Error("Invalid report");
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "legalinaw-summary.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        setStatus(
          en
            ? "Your PDF download has started."
            : "Sinimulan ang pag-download ng PDF.",
        );
      } else if (kind === "share") {
        const result = await gateway.share(payload());
        const url = safeShareUrl(result.url, window.location.origin);
        if (!url || !Number.isFinite(Date.parse(result.expiresAt)))
          throw new Error("Invalid share");
        setShare({ ...result, url });
        setNow(Date.now());
      } else if (share) {
        await gateway.revoke(share.id);
        setShare(null);
        setStatus(en ? "Sharing has stopped." : "Itinigil ang pagbabahagi.");
      }
    } catch {
      setStatus(
        en
          ? kind === "report"
            ? "PDF download could not finish. Try again; your edits are still here."
            : kind === "share"
              ? "Sharing is unavailable. No usable public link was returned."
              : "Could not confirm that sharing stopped. Retry; the link may still be active."
          : kind === "report"
            ? "Hindi natapos ang PDF download. Subukan muli; nandito pa rin ang mga edit mo."
            : kind === "share"
              ? "Hindi available ang pagbabahagi. Walang naibalik na magagamit na pampublikong link."
              : "Hindi makumpirmang itinigil ang pagbabahagi. Subukan muli; maaaring aktibo pa ang link.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    if (!share || expired) return;
    try {
      await navigator.clipboard.writeText(share.url);
      setStatus(en ? "Link copied." : "Nakopya ang link.");
    } catch {
      setStatus(
        en
          ? "Could not copy. Select and copy the link below."
          : "Hindi makopya. Piliin at kopyahin ang link sa ibaba.",
      );
    }
  }
  return (
    <>
      <div className="export-buttons">
        <button
          className="button button-secondary"
          disabled={busy}
          onClick={() => run("report")}
        >
          <Icon name="download" size={16} />
          PDF
        </button>
        <button
          className="button button-secondary"
          disabled={busy}
          onClick={() => run("share")}
        >
          <Icon name="link" size={16} />
          {en ? "Share" : "Ibahagi"}
        </button>
      </div>
      {busy && (
        <p role="status" className="field-hint">
          {en ? "Please wait…" : "Sandali lang…"}
        </p>
      )}
      {share && (
        <div className="notice-alert">
          {expired ? (
            <p>
              {en
                ? "This link has expired. Create a new one to share again."
                : "Nag-expire na ang link. Gumawa ng bago para magbahagi muli."}
            </p>
          ) : (
            <>
              <label className="field-label" htmlFor="share-url">
                {en ? "Share link" : "Link sa pagbabahagi"}
              </label>
              <input
                id="share-url"
                className="search-input"
                value={share.url}
                readOnly
                onFocus={(e) => e.target.select()}
              />
              <p className="field-hint">
                {en
                  ? "Anyone with this link can view the shared questions. Links may stop working if the server restarts. A localhost link only works on this computer."
                  : "Makikita ng sinumang may link ang ibinahaging mga tanong. Maaaring mawala ang link kapag nag-restart ang server. Sa computer na ito lang gagana ang localhost link."}
              </p>
              <p className="field-hint">
                {en ? "Expires" : "Mag-e-expire"}:{" "}
                {new Date(share.expiresAt).toLocaleString(
                  en ? "en-PH" : "fil-PH",
                  { timeZone: "Asia/Manila" },
                )}{" "}
                · Philippine time
              </p>
              <div className="export-buttons">
                <button className="button button-secondary" onClick={copy}>
                  {en ? "Copy link" : "Kopyahin ang link"}
                </button>
                <button
                  className="button button-secondary"
                  disabled={busy}
                  onClick={() => run("revoke")}
                >
                  {en ? "Stop sharing" : "Itigil ang pagbabahagi"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {status && (
        <div className="notice-alert" role="status">
          {status}
        </div>
      )}
    </>
  );
}
