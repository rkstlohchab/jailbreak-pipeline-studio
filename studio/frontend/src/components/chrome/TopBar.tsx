"use client";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, ChevronRight, Command, Search, Menu } from "lucide-react";
import { NAVIGATION, NAV_SECTIONS, SETUP_LINK } from "./navigation";
import { HOSTED_COLLECTION } from "@/lib/api";
import { cn } from "@/lib/utils";

export function TopBar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const active = NAVIGATION.find((item) => item.href === pathname) ?? (pathname === SETUP_LINK.href ? { label: SETUP_LINK.label, section: null } : null);
  const openSearch = () => window.dispatchEvent(new CustomEvent("cmd-launcher:open"));
  const SetupIcon = SETUP_LINK.Icon;
  return (
    <>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <aside className="studio-sidebar" aria-label="Main navigation">
        <Link href="/learn" className="studio-brand" aria-label="Pipeline Studio — start learning">
          <span className="brand-mark"><Box size={23} strokeWidth={1.5} /></span>
          <span>Pipeline<span className="brand-subtitle">Research studio</span></span>
        </Link>
        <button className="sidebar-search" onClick={openSearch}>
          <Search size={15} /><span>Find anything</span><kbd>⌘ K</kbd>
        </button>
        <Link href={SETUP_LINK.href} className={cn("setup-cta", pathname === SETUP_LINK.href && "is-active")}>
          <SetupIcon size={17} strokeWidth={1.6} /><span>{SETUP_LINK.label}</span><ChevronRight size={14} />
        </Link>
        <nav className="sidebar-navigation">
          {NAV_SECTIONS.map((section) => (
            <div className="nav-section" key={section}>
              <p className="nav-section-title">{section}</p>
              {NAVIGATION.filter((item) => item.section === section).map(({ href, label, Icon }) => (
                <Link key={href} href={href} aria-label={label} title={label} aria-current={pathname === href ? "page" : undefined}
                  className={cn("sidebar-link", pathname === href && "is-active")}>
                  <Icon size={17} strokeWidth={1.6} /><span>{label}</span>
                  {pathname === href && <span className="active-dot" />}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-profile"><span className="profile-avatar">P</span><div><strong>Personal workspace</strong><span>Local research collection</span></div></div>
        </div>
      </aside>
      <nav className="mobile-navigation" aria-label="Mobile navigation">
        {NAVIGATION.filter((item) => ["/roadmap", "/attack", "/techniques", "/corpus"].includes(item.href)).map(({ href, label, Icon }) => (
          <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={cn(pathname === href && "is-active")}><Icon size={20} strokeWidth={1.6} /><span>{href === "/attack" ? "Attack" : href === "/roadmap" ? "Learn" : href === "/corpus" ? "Prompts" : label}</span></Link>
        ))}
        <button aria-label="More navigation" onClick={() => setMenuOpen(true)}><Menu size={20} /><span>More</span></button>
      </nav>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="bottom" className="mobile-menu">
          <SheetHeader><SheetTitle>Explore the studio</SheetTitle><SheetDescription>Learn, apply, test, and advance.</SheetDescription></SheetHeader>
          <nav>
            <Link href={SETUP_LINK.href} onClick={() => setMenuOpen(false)} className="sidebar-link"><SetupIcon size={18} /><span>{SETUP_LINK.label}</span></Link>
            {NAVIGATION.map(({ href, label, Icon }) => <Link key={href} href={href} onClick={() => setMenuOpen(false)} className="sidebar-link"><Icon size={18} /><span>{label}</span></Link>)}
          </nav>
        </SheetContent>
      </Sheet>
      <header className="studio-topbar">
        <div className="breadcrumb"><span>{active && "section" in active && active.section ? active.section : "Studio"}</span><ChevronRight size={14} /><strong>{active?.label ?? "Studio"}</strong></div>
        <div className="topbar-actions">
          <span className="local-badge"><span />{HOSTED_COLLECTION ? "Hosted workspace" : "Local workspace"}</span>
          <button className="icon-button" aria-label="Search workspace" onClick={openSearch}><Command size={17} /></button>
          <span className="profile-avatar small" aria-hidden="true">P</span>
        </div>
      </header>
    </>
  );
}
