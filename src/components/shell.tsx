"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { usePreferences } from "@/lib/preferences";
import { Icon, Disclaimer } from "./ui";
export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="LegaLinaw home">
      <Image
        className="brand-emblem"
        src="/brand/emblem.png"
        alt=""
        width={1211}
        height={958}
        priority
      />
      <span className="brand-wordmark">
        <Image
          src="/brand/wordmark.png"
          alt=""
          width={2003}
          height={653}
          priority
        />
      </span>
    </Link>
  );
}
export function Header() {
  const { language, setLanguage, scale, setScale } = usePreferences();
  const en = language === "en";
  const path = usePathname();
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.style.fontSize = `${16 * scale}px`;
  }, [language, scale]);
  return (
    <>
      <a href="#main" className="skip-link">
        {en ? "Skip to content" : "Dumiretso sa nilalaman"}
      </a>
      <header className="header">
        <Brand />
        <nav
          className="desktop-nav"
          aria-label={en ? "Main navigation" : "Pangunahing navigation"}
        >
          <Link href="/#how-it-works">
            {en ? "How it works" : "Paano gamitin"}
          </Link>
          <Link href="/help">{en ? "Find legal help" : "Legal na tulong"}</Link>
        </nav>
        <div className="header-actions">
          <Disclaimer en={en} />
          <button
            className="language-button"
            onClick={() => setLanguage(en ? "fil" : "en")}
            aria-label={en ? "Switch to Filipino" : "Switch to English"}
          >
            <Icon name="languages" size={17} />
            <span>{en ? "EN" : "FIL"}</span>
          </button>
          {path !== "/" ? (
            <select
              className="text-scale"
              aria-label={en ? "Text size" : "Laki ng teksto"}
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
            >
              <option value={1}>Aa</option>
              <option value={1.5}>150%</option>
              <option value={2}>200%</option>
            </select>
          ) : (
            <Link className="button button-small" href="/notice">
              {en ? "Get started" : "Magsimula"}
              <Icon name="arrowUp" size={16} />
            </Link>
          )}
        </div>
      </header>
    </>
  );
}
export function Footer() {
  const en = usePreferences((s) => s.language) === "en";
  return (
    <footer className="footer">
      <div className="footer-top">
        <div>
          <Image
            src="/brand/logo.png"
            width={120}
            height={120}
            alt="LegaLinaw — scales and laurel emblem"
            className="footer-logo"
          />
          <p>
            {en
              ? "A little clarity. A more confident next step."
              : "Kaunting linaw. Mas panatag na susunod na hakbang."}
          </p>
        </div>
        <div className="footer-links">
          <Link href="/help">{en ? "Legal help" : "Legal na tulong"}</Link>
          <Link href="/verify">
            {en ? "Check a sender" : "Suriin ang nagpadala"}
          </Link>
          <Link href="/notice?sample=1">
            {en ? "Try an example" : "Subukan ang halimbawa"}
          </Link>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 LegaLinaw · Larp Labs</span>
        <span>
          {en ? "Made with care, for clarity." : "Ginawa nang may malasakit."}
        </span>
      </div>
    </footer>
  );
}
