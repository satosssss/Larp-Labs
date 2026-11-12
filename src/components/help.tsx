"use client";
import Link from "next/link";
import { usePreferences } from "@/lib/preferences";
import { DirectoryFinder } from "./directory-finder";
import { Icon } from "./ui";
export function HelpPage() {
  const en = usePreferences((s) => s.language) === "en";
  return (
    <main id="main" className="help-page">
      <Link className="back-link" href="/notice">
        <Icon name="back" size={16} />
        {en ? "Back to your document" : "Bumalik sa dokumento"}
      </Link>
      <div className="screen-heading" style={{ marginTop: 24 }}>
        <p className="eyebrow">
          {en ? "YOU DON’T HAVE TO DO THIS ALONE" : "MAY MAKAKATULONG SA IYO"}
        </p>
        <h1>
          {en
            ? "Start a conversation with someone who can help."
            : "May makakausap ka tungkol dito."}
        </h1>
        <p>
          {en
            ? "Use official sources to find legal assistance. Ask the office about eligibility, schedules, and any costs before visiting."
            : "Gamitin ang opisyal na sources para humanap ng legal na tulong. Itanong muna ang kwalipikasyon, iskedyul, at anumang bayad bago bumisita."}
        </p>
      </div>
      <div className="notice-alert">
        {en
          ? "The local directory is still being prepared. These official national resources remain available; no location data is collected."
          : "Inihahanda pa ang lokal na directory. Maaari mong gamitin ang mga opisyal na pambansang source na ito; walang kinokolektang lokasyon."}
      </div>
      <DirectoryFinder en={en} />
      <div className="help-grid">
        <article className="resource-card">
          <span className="icon-tile">
            <Icon name="scale" />
          </span>
          <h2>Public Attorney’s Office</h2>
          <p>
            {en
              ? "Find PAO office contact details through its official directory. The office can explain its services and requirements."
              : "Hanapin ang contact details ng mga opisina ng PAO sa opisyal na directory. Maipapaliwanag ng opisina ang mga serbisyo at kinakailangan."}
          </p>
          <a
            href="https://pao.gov.ph/contact-us/"
            target="_blank"
            rel="noopener noreferrer"
          >
            {en ? "Official PAO directory" : "Opisyal na PAO directory"}
            <Icon name="external" size={16} />
            <span className="sr-only">
              {" "}
              ({en ? "opens a new tab" : "magbubukas sa bagong tab"})
            </span>
          </a>
          <p className="field-hint">
            {en ? "Source checked" : "Source na sinuri"}: 13 Nov 2026
          </p>
        </article>
        <article className="resource-card">
          <span className="icon-tile">
            <Icon name="chat" />
          </span>
          <h2>Integrated Bar of the Philippines</h2>
          <p>
            {en
              ? "Use the IBP’s official contact page to ask about legal aid and the appropriate chapter or office."
              : "Gamitin ang opisyal na contact page ng IBP para magtanong tungkol sa legal aid at angkop na chapter o opisina."}
          </p>
          <a
            href="https://www.ibp.ph/contacts"
            target="_blank"
            rel="noopener noreferrer"
          >
            {en ? "Official IBP contacts" : "Opisyal na IBP contacts"}
            <Icon name="external" size={16} />
            <span className="sr-only">
              {" "}
              ({en ? "opens a new tab" : "magbubukas sa bagong tab"})
            </span>
          </a>
          <p className="field-hint">
            {en ? "Source checked" : "Source na sinuri"}: 13 Nov 2026
          </p>
        </article>
      </div>
      <p className="field-hint" style={{ marginTop: 20 }}>
        {en
          ? "These are reference links, not partner endorsements or a guarantee of assistance."
          : "Mga reference link ang mga ito, hindi endorsement ng partner o garantiya ng tulong."}
      </p>
    </main>
  );
}
export function VerifyPage() {
  const en = usePreferences((s) => s.language) === "en";
  const items = en
    ? [
        [
          "Check the named sender.",
          "Look for the office, organization, and person named in the document. Missing details are a reason to check further, not proof that a notice is fake.",
        ],
        [
          "Find an independent contact.",
          "Locate the office’s official website or published directory yourself. Do not rely only on a phone number or link printed in the notice.",
        ],
        [
          "Ask the office to confirm.",
          "Use the independently found contact to ask whether the document and sender are known to the office.",
        ],
        [
          "Bring uncertainty to a professional.",
          "LegaLinaw cannot authenticate a document or confirm a lawyer’s current employment. A legal professional or the relevant office can help you check.",
        ],
      ]
    : [
        [
          "Tingnan kung sino ang nakasaad na nagpadala.",
          "Hanapin ang pangalan ng opisina, organisasyon, at tao sa dokumento. Ang kulang na detalye ay dahilan para magsuri, hindi patunay na peke ang notice.",
        ],
        [
          "Humanap ng hiwalay na contact.",
          "Hanapin mismo ang opisyal na website o directory ng opisina. Huwag umasa lang sa numero o link na nasa notice.",
        ],
        [
          "Magtanong sa mismong opisina.",
          "Gamitin ang contact na hiwalay mong nahanap upang itanong kung kilala ng opisina ang dokumento at nagpadala.",
        ],
        [
          "Ipaabot ang pag-aalinlangan sa propesyonal.",
          "Hindi kayang patunayan ng LegaLinaw ang pagiging tunay ng dokumento o kasalukuyang trabaho ng abogado. Makakatulong ang legal na propesyonal o kaugnay na opisina sa pagsuri.",
        ],
      ];
  return (
    <main id="main" className="help-page">
      <Link className="back-link" href="/notice">
        <Icon name="back" size={16} />
        {en ? "Back to your document" : "Bumalik sa dokumento"}
      </Link>
      <div className="screen-heading" style={{ marginTop: 24 }}>
        <p className="eyebrow">
          {en ? "PAUSE. CHECK. CLARIFY." : "HUMINTO. SURIIN. LINAWIN."}
        </p>
        <h1>
          {en ? "A guide to checking the sender." : "Kilalanin ang nagpadala."}
        </h1>
        <p>
          {en
            ? "A general checking guide. This is not an authenticity assessment of your notice."
            : "Pangkalahatang gabay sa pagsuri. Hindi ito pagsusuri kung tunay ang iyong notice."}
        </p>
      </div>
      <div className="verify-list">
        {items.map(([title, body], i) => (
          <section className="verify-item" key={title}>
            <span className="step-number">{i + 1}</span>
            <div>
              <h2>{title}</h2>
              <p>{body}</p>
            </div>
          </section>
        ))}
      </div>
      <div className="screen-actions">
        <Link className="button" href="/help">
          {en ? "Explore legal help" : "Tingnan ang legal na tulong"}
          <Icon name="arrowUp" />
        </Link>
      </div>
    </main>
  );
}
