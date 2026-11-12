"use client";
import Link from "next/link";
import { usePreferences } from "@/lib/preferences";
import { Icon, Disclaimer } from "./ui";
export function Landing() {
  const en = usePreferences((s) => s.language) === "en";
  return (
    <main id="main">
      <section className="hero">
        <h1>
          {en ? (
            <>
              Let’s make your legal
              <br className="desktop-break" /> notice{" "}
              <span className="hero-accent">clearer.</span>
            </>
          ) : (
            <>
              Palinawin natin ang
              <br className="desktop-break" />{" "}
              <span className="hero-accent">legal notice</span> mo.
            </>
          )}
        </h1>
        <p className="hero-description">
          {en
            ? "From confusing words to something you understand. Get a simple explanation and prepare for your next conversation."
            : "May hindi ka maintindihan sa notice mo? I-upload ito para makita ang simpleng paliwanag at kung saan puwedeng humingi ng tulong."}
        </p>
        <div className="hero-buttons">
          <Link className="button" href="/notice">
            {en ? "Understand my document" : "Unawain ang dokumento"}
            <Icon name="arrow" size={18} />
          </Link>
          <Link className="button button-secondary" href="/notice?sample=1">
            {en ? "Try an example" : "Subukan ang halimbawa"}
            <Icon name="arrowUp" size={18} />
          </Link>
        </div>
        <p className="hero-note">
          <Icon name="check" size={14} />
          {en ? "No account needed" : "Walang kailangang account"}
          <span>·</span>
          {en ? "Filipino & English" : "Filipino at English"}
        </p>
        <Disclaimer en={en} />
        <HeroPreview en={en} />
        <div className="hero-bottom">
          <span>
            01 /{" "}
            {en
              ? "UNDERSTAND, ONE STEP AT A TIME"
              : "ISANG HAKBANG, MAS MALINAW"}
          </span>
          <span className="down-arrow">↓</span>
        </div>
      </section>
      <section className="how-section" id="how-it-works">
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              {en ? "FROM CONFUSION TO CLARITY" : "PAANO ITO GUMAGANA"}
            </p>
            <h2>
              {en
                ? "You don’t have to figure\nit out alone."
                : "Hindi mo kailangang\nhulaan ang ibig sabihin."}
            </h2>
          </div>
          <p>
            {en
              ? "Take it one step at a time. You are always in control of what you read and review."
              : "Ikaw ang magche-check ng text. Kami ang tutulong magpaliwanag."}
          </p>
        </div>
        <div className="steps-grid">
          {[
            {
              icon: "upload" as const,
              title: en ? "Bring your document" : "I-upload ang dokumento",
              text: en
                ? "Start with a photo or PDF of your notice. We’ll help you read it."
                : "Pumili ng photo o PDF ng notice mo.",
            },
            {
              icon: "checks" as const,
              title: en ? "Check, then understand" : "Suriin at unawain",
              text: en
                ? "Check the extracted text, then explore plain-language explanations with their source."
                : "I-check ang text, tapos basahin ang paliwanag. Puwede mong tingnan kung saan ito galing.",
            },
            {
              icon: "chat" as const,
              title: en ? "Prepare your next step" : "Maghanda sa susunod",
              text: en
                ? "Organize questions and what to bring when you speak to a legal professional."
                : "Gumawa ng checklist at mga tanong para sa abogado.",
            },
          ].map((s, i) => (
            <article className="how-step" key={s.title}>
              <div className="step-top">
                <Icon name={s.icon} size={25} />
                <span>0{i + 1}</span>
              </div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="principles">
        <div>
          <Icon name="book" />
          <span>
            {en ? "Plain language, always" : "Simpleng salita, palagi"}
          </span>
        </div>
        <div>
          <Icon name="search" />
          <span>
            {en
              ? "See where explanations come from"
              : "Makikita kung saan galing ang paliwanag"}
          </span>
        </div>
        <div>
          <Icon name="shield" />
          <span>
            {en ? "You check. You stay in control." : "Ikaw ang magche-check."}
          </span>
        </div>
      </section>
      <section className="closing">
        <div className="eyebrow">
          {en
            ? "A LITTLE CLARITY GOES A LONG WAY"
            : "MALAKING BAGAY ANG KAUNTING LINAW"}
        </div>
        <h2>
          {en ? "Let’s take the first step." : "Simulan natin sa pag-unawa."}
        </h2>
        <Link href="/notice" className="button">
          {en ? "Understand my document" : "Unawain ang dokumento"}
          <Icon name="arrow" />
        </Link>
      </section>
    </main>
  );
}
function HeroPreview({ en }: { en: boolean }) {
  return (
    <div className="preview-stage" aria-hidden="true">
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <div className="preview-caption">
        <span className="small-cross">+</span>
        {en ? "A NOTICE, MADE CLEARER" : "ISANG NOTICE, MAS MALINAW"}
      </div>
      <div className="document-preview">
        <div className="paper-top">
          <span className="paper-emblem">
            <Icon name="scale" size={24} />
          </span>
          <span>
            BARANGAY MALINAW
            <br />
            <b>PAANYAYA SA PAG-UUSAP</b>
          </span>
          <span className="tiny-tag">HALIMBAWA</span>
        </div>
        <div className="paper-rule" />
        <p className="paper-recipient">Para kay: [PANGALAN]</p>
        <p className="paper-copy">
          Inaanyayahan kayong dumalo sa isang pag-uusap sa tanggapan ng
          barangay...
        </p>
        <div className="paper-highlight">
          sa ika-20 ng Nobyembre 2026,
          <br />
          alas-9:00 ng umaga
        </div>
        <div className="fake-line" />
        <div className="fake-line short" />
        <p className="paper-signature">Tanggapan ng Barangay Malinaw</p>
        <div className="paper-foot">
          KATHANG-ISIP NA DOKUMENTO <span>01</span>
        </div>
      </div>
      <div className="explanation-preview">
        <div className="preview-card-heading">
          <span className="icon-tile">
            <Icon name="sparkles" size={19} />
          </span>
          <span>
            {en ? "Let’s make it clear" : "Linawin natin"}
            <small>
              {en
                ? "An explanation in simple words"
                : "Paliwanag sa simpleng salita"}
            </small>
          </span>
          <span className="preview-menu">···</span>
        </div>
        <div className="preview-card-body">
          <span className="pill">
            <span className="status-dot" />
            {en ? "Barangay invitation" : "Paanyaya mula sa barangay"}
          </span>
          <h3>{en ? "What does this mean?" : "Ano ang ibig sabihin nito?"}</h3>
          <p>
            {en
              ? "You are invited to a conversation at the barangay about a matter involving your neighbor."
              : "Inaanyayahan kang makipag-usap sa barangay tungkol sa isang usapin sa inyong kapitbahay."}
          </p>
          <div className="mini-date">
            <Icon name="clock" size={18} />
            <div>
              <span>
                {en
                  ? "Date stated in the letter"
                  : "Petsa na nakasaad sa liham"}
              </span>
              <strong>20 Nobyembre 2026 · 9:00 AM</strong>
            </div>
          </div>
          <div className="source-mini">
            <Icon name="link" size={14} />
            {en
              ? "View passage in the document"
              : "Tingnan ang bahagi ng dokumento"}
            <Icon name="arrowUp" size={14} />
          </div>
        </div>
        <div className="preview-card-footer">
          <Icon name="shield" size={13} />
          {en
            ? "Information, not legal advice"
            : "Impormasyon, hindi legal advice"}
        </div>
      </div>
      <div className="floating-note">
        <span className="circle-check">
          <Icon name="check" size={15} />
        </span>
        {en
          ? "You can check every explanation."
          : "May pinagmulan. Puwedeng suriin."}
      </div>
      <span className="preview-example">
        {en
          ? "Illustration · fictional example"
          : "Ilustrasyon · kathang-isip na halimbawa"}
      </span>
    </div>
  );
}
