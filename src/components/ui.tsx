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
    <p className="disclaimer">
      <Icon name="shield" size={16} />
      <span>
        {en
          ? "Legal information, not legal advice. Speak with a qualified legal professional."
          : "Impormasyong legal, hindi legal advice. Kumonsulta sa isang kwalipikadong abogado."}
      </span>
    </p>
  );
}
