import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { Header, Footer } from "@/components/shell";
import "./globals.css";
export const metadata: Metadata = {
  title: "LegaLinaw — Palinawin natin ang legal notice mo.",
  description:
    "Unawain ang iyong legal notice sa simpleng Filipino o English. Suriin ang teksto, alamin ang nakasaad, at maghanda para sa legal na tulong.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fil" className={GeistSans.variable}>
      <body>
        <div className="site-frame">
          <Header />
          {children}
          <Footer />
        </div>
      </body>
    </html>
  );
}
