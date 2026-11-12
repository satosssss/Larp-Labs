import {
  ArrowUpRight,
  ArrowRight,
  Check,
  FileText,
  Upload,
  ShieldCheck,
  Languages,
  MessageCircle,
  ChevronRight,
  ArrowLeft,
  X,
  BookOpen,
  Clock3,
  MapPin,
  Volume2,
  Square,
  Plus,
  Trash2,
  Download,
  Link2,
  CircleHelp,
  RotateCcw,
  Search,
  ExternalLink,
  CheckCheck,
  Sparkles,
  Scale,
  Menu,
} from "lucide-react";
const icons = {
  arrow: ArrowRight,
  arrowUp: ArrowUpRight,
  check: Check,
  file: FileText,
  upload: Upload,
  shield: ShieldCheck,
  languages: Languages,
  chat: MessageCircle,
  chevron: ChevronRight,
  back: ArrowLeft,
  close: X,
  book: BookOpen,
  clock: Clock3,
  pin: MapPin,
  volume: Volume2,
  stop: Square,
  plus: Plus,
  trash: Trash2,
  download: Download,
  link: Link2,
  help: CircleHelp,
  reset: RotateCcw,
  search: Search,
  external: ExternalLink,
  checks: CheckCheck,
  sparkles: Sparkles,
  scale: Scale,
  menu: Menu,
};
export function Icon({
  name,
  size = 20,
  className = "",
}: {
  name: keyof typeof icons;
  size?: number;
  className?: string;
}) {
  const Component = icons[name];
  return (
    <Component
      size={size}
      strokeWidth={1.6}
      aria-hidden="true"
      className={className}
    />
  );
}
export function Disclaimer({ en = false }: { en?: boolean }) {
  return (
    <details className="legal-disclosure">
      <summary>
        <Icon name="help" size={17} />
        <span>{en ? "Not legal advice" : "Hindi ito legal advice"}</span>
        <Icon name="chevron" size={16} />
      </summary>
      <div className="legal-disclosure-body">
        <p>
          <strong>{en ? "We are not lawyers." : "Hindi kami abogado."}</strong>{" "}
          {en
            ? "LegaLinaw explains what your notice says and helps you prepare questions for a lawyer."
            : "Tinutulungan ka ng LegaLinaw na maintindihan ang notice mo at maghanda ng mga tanong para sa abogado."}
        </p>
        <ul>
          <li>
            {en
              ? "AI can make mistakes. Always check the original document."
              : "Puwedeng magkamali ang AI. I-check pa rin ang original na dokumento."}
          </li>
          <li>
            {en
              ? "We cannot tell you what legal decision to make or predict the outcome of a case."
              : "Hindi namin masasabi kung anong legal na desisyon ang dapat mong gawin o kung ano ang magiging resulta ng kaso."}
          </li>
          <li>
            {en
              ? "For advice about your situation, speak with a lawyer."
              : "Para sa payong akma sa sitwasyon mo, makipag-usap sa abogado."}
          </li>
        </ul>
        <a href="/help">
          {en ? "Find legal help" : "Saan puwedeng humingi ng tulong?"} ↗
        </a>
      </div>
    </details>
  );
}
