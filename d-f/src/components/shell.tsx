"use client";

import { CIVIC_LOCATIONS, CURRENT_RESIDENT, DEFAULT_LOCATION_ID, WARD, caseNumber, initials } from "@/lib/constants";
import {
  ClipboardList,
  CircleDot,
  CheckCircle2,
  Building2,
  FilePlus2,
  HandHeart,
  HelpCircle,
  Home,
  MapPin,
  Network,
  Search,
  ShieldCheck,
  Plus,
  User,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { LocationPicker } from "./LocationPicker";
import { RoleSwitcher } from "./RoleSwitcher";
import { useAuth } from "@/lib/auth-context";

type Item = { id: string; label: string; href: string; icon: LucideIcon };
const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Workspace",
    items: [
      { id: "home", label: "Home", href: "/", icon: Home },
      { id: "ask", label: "Ask for help", href: "/ask", icon: HelpCircle },
      { id: "services", label: "Area service links", href: "/services", icon: Building2 },
      { id: "report", label: "Report a problem", href: "/report", icon: FilePlus2 },
    ],
  },
  {
    title: "Case management",
    items: [
      { id: "cases", label: "All cases", href: "/cases", icon: ClipboardList },
      { id: "open", label: "Open cases", href: "/cases?status=open", icon: CircleDot },
      { id: "resolved", label: "Resolved cases", href: "/cases?status=resolved", icon: CheckCircle2 },
    ],
  },
  {
    title: "My community",
    items: [
      { id: "place", label: "Ward information", href: "/place", icon: MapPin },
      { id: "contrib", label: "My contributions", href: "/contributions", icon: HandHeart },
      { id: "profile", label: "Profile", href: "/profile", icon: User },
    ],
  },
];

function useActiveId() {
  const path = usePathname();
  const sp = useSearchParams();
  if (path === "/") return "home";
  if (path.startsWith("/ask")) return "ask";
  if (path.startsWith("/services")) return "services";
  if (path.startsWith("/report")) return "report";
  if (path.startsWith("/cases")) {
    if (path === "/cases") {
      const s = sp.get("status");
      if (s === "open") return "open";
      if (s === "resolved") return "resolved";
    }
    return "cases";
  }
  if (path.startsWith("/place")) return "place";
  if (path.startsWith("/contributions")) return "contrib";
  if (path.startsWith("/profile")) return "profile";
  return "";
}

function NavGroups() {
  const active = useActiveId();
  const { user, isAdmin, isPartner } = useAuth();

  const groups = [...GROUPS];
  if (isAdmin || isPartner) {
    groups.push({
      title: "Control & Verification",
      items: [
        ...(isAdmin ? [{ id: "admin", label: "Admin Console", href: "/admin", icon: ShieldCheck }] : []),
        { id: "partner_links", label: "Add Verified Link", href: "/services?action=add_link", icon: Building2 },
      ],
    });
  }

  return (
    <>
      {groups.map((g) => (
        <div className="nav-group" key={g.title}>
          <div className="nav-group-title">{g.title}</div>
          {g.items.map((it) => (
            <Link
              key={it.id}
              href={it.href}
              className="nav-link"
              aria-current={active === it.id ? "page" : undefined}
              aria-label={it.label}
              data-label={it.label}
            >
              <it.icon size={18} aria-hidden />
              <span className="nav-label">{it.label}</span>
            </Link>
          ))}
        </div>
      ))}
    </>
  );
}

export function BrandMark({ size = 20 }: { size?: number }) {
  return <Network size={size} aria-hidden />;
}

export function Sidebar() {
  const { user } = useAuth();
  return (
    <aside className="sidebar" aria-label="Application sidebar">
      <Link href="/" className="brand" aria-label="Civic Network home">
        <span className="brand-mark">
          <BrandMark />
        </span>
        <span className="brand-text">
          <span className="brand-name">Civic Network</span>
          <div className="brand-sub">Community platform</div>
        </span>
      </Link>

      <nav aria-label="Primary">
        <Suspense fallback={null}>
          <NavGroups />
        </Suspense>
      </nav>

      <div className="sidebar-foot">
        <div className="ward-chip">
          <strong>{WARD.name}</strong>
          <span>
            {WARD.locality}, {WARD.city}
          </span>
        </div>
        <ThemeToggle variant="row" />
        <RoleSwitcher variant="sidebar" />
        <Link href="/profile" className="resident-row" aria-label={`Profile: ${user.name}`} data-label={user.name}>
          <span className="avatar">{initials(user.name)}</span>
          <span className="resident-text">
            <b>{user.name}</b>
            <small>{user.partnerBadge || `${user.role.toUpperCase()} account`}</small>
          </span>
        </Link>
        <div className="demo-pill" title="All cases, residents and contacts are sample data" role="note">
          <ShieldCheck size={14} aria-hidden />
          <span className="demo-text">Demo mode active</span>
          <span className="sr-only">Demo mode active</span>
        </div>
      </div>
    </aside>
  );
}

const TITLES: Record<string, string> = {
  "/ask": "Ask for help",
  "/services": "Area service links",
  "/report": "Report a problem",
  "/cases": "Cases",
  "/place": "Ward information",
  "/contributions": "My contributions",
  "/profile": "Profile",
};

export function Header() {
  const { user } = useAuth();
  const path = usePathname();
  const searchParams = useSearchParams();
  const selectedLocationId = searchParams.get("location") || DEFAULT_LOCATION_ID;
  const crumbs: { label: string; href?: string }[] = [{ label: "Home", href: "/" }];
  const m = path.match(/^\/cases\/(\d+)/);
  if (path === "/") crumbs.splice(0, 1, { label: "Home" });
  else if (m) crumbs.push({ label: "Cases", href: `/cases?location=${selectedLocationId}` }, { label: `Case #${caseNumber(Number(m[1]))}` });
  else if (TITLES[path]) crumbs.push({ label: TITLES[path] });

  return (
    <header className="topbar">
      <Link href="/" className="mobile-brand" aria-label="Civic Network home">
        <span className="brand-mark" style={{ width: 32, height: 32 }}>
          <BrandMark size={18} />
        </span>
        <span>Civic Network</span>
      </Link>

      <div className="crumbs">
        <div className="crumb-context">
          <Suspense fallback={<span>{WARD.name} / {WARD.locality}, {WARD.city}</span>}>
            <LocationPicker locationId={selectedLocationId} compact />
          </Suspense>
        </div>
        <nav aria-label="Breadcrumb" className="crumb-trail">
          {crumbs.map((c, i) => (
            <span key={c.label} style={{ display: "inline-flex", gap: 6 }}>
              {i > 0 && <span aria-hidden>→</span>}
              {c.href ? (
                <Link href={c.href}>{c.label}</Link>
              ) : (
                <span aria-current="page">{c.label}</span>
              )}
            </span>
          ))}
        </nav>
      </div>

      <div className="top-actions">
        <form action="/cases" role="search" className="search">
          <input type="hidden" name="location" value={selectedLocationId} />
          <Search size={16} aria-hidden />
          <label htmlFor="global-search" className="sr-only">
            Search cases
          </label>
          <input id="global-search" name="q" type="search" placeholder="Search cases or case number" autoComplete="off" />
        </form>
        <Link href="/cases" className="icon-btn mobile-search-link" aria-label="Search cases">
          <Search size={18} aria-hidden />
        </Link>
        <ThemeToggle />
        <RoleSwitcher variant="header" />
        {path !== "/report" && (
          <Link href={`/report?location=${selectedLocationId}`} className="btn btn-primary top-report">
            <Plus size={16} aria-hidden />
            <span className="btn-label">Report</span>
          </Link>
        )}
        <Link href="/profile" className="avatar" aria-label={`Profile: ${user.name}`} title={user.name}>
          {initials(user.name)}
        </Link>
      </div>
    </header>
  );
}

const MOBILE: Item[] = [
  { id: "home", label: "Home", href: "/", icon: Home },
  { id: "ask", label: "Ask", href: "/ask", icon: HelpCircle },
  { id: "services", label: "Services", href: "/services", icon: Building2 },
  { id: "report", label: "Report", href: "/report", icon: FilePlus2 },
  { id: "cases", label: "Cases", href: "/cases", icon: ClipboardList },
  { id: "place", label: "Place", href: "/place", icon: MapPin },
];

function MobileLinks() {
  const active = useActiveId();
  const eff = active === "open" || active === "resolved" ? "cases" : active;
  return (
    <>
      {MOBILE.map((it) => (
        <Link key={it.id} href={it.href} aria-current={eff === it.id ? "page" : undefined}>
          <it.icon size={21} aria-hidden />
          {it.label}
        </Link>
      ))}
    </>
  );
}

export function MobileNav() {
  return (
    <nav className="mobile-nav" aria-label="Primary mobile">
      <Suspense fallback={null}>
        <MobileLinks />
      </Suspense>
    </nav>
  );
}
