import { memo, useCallback, useEffect, useState, useRef } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import type { Session } from "@supabase/supabase-js";
import { Wordmark } from "@/components/brand";
import { supabase } from "@/utils/supabase";
import {
  PUBLIC_EXPLORE_LINKS,
  PUBLIC_NAV_LINKS,
} from "@/lib/nav-config";
import { X, ChevronDown, Radio, Clock, Archive } from "lucide-react";

const GridMenuIcon = memo(function GridMenuIcon({ className = "bg-current" }: { className?: string }) {
  return (
    <span className="grid grid-cols-3 gap-[2.5px]" aria-hidden>
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} className={`h-1 w-1 rounded-full ${className}`} />
      ))}
    </span>
  );
});

const NavPill = memo(function NavPill({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <motion.span
      layoutId="site-nav-pill"
      className="absolute inset-0 rounded-full border border-border bg-surface-elevated/80"
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
    />
  );
});

function SiteHeaderComponent() {
  const location = useLocation();
  const pathname = location.pathname;
  const isHome = pathname === "/";

  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [webinarDropdownOpen, setWebinarDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 28);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024 && menuOpen) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [menuOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setWebinarDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const onLogoClick = useCallback(
    (e: React.MouseEvent) => {
      if (isHome) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
        setMenuOpen(false);
      }
    },
    [isHome],
  );

  const pill = isScrolled;

  const isLinkActive = useCallback(
    (matchPath: string) => {
      if (matchPath === "/") return pathname === "/";
      return pathname === matchPath || pathname.startsWith(matchPath + "/");
    },
    [pathname],
  );

  const handleDropdownEnter = () => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
      dropdownTimeoutRef.current = null;
    }
    setWebinarDropdownOpen(true);
  };

  const handleDropdownLeave = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setWebinarDropdownOpen(false);
    }, 200);
  };

  const webinarSections = [
    { name: "Upcoming Webinars", hash: "#upcoming", icon: Clock, desc: "Scheduled sessions" },
    { name: "Live Webinars", hash: "#live", icon: Radio, desc: "Happening now" },
    { name: "Past Webinars", hash: "#past", icon: Archive, desc: "Recordings & replays" },
  ];

  const renderNavItem = (link: (typeof PUBLIC_NAV_LINKS)[number]) => {
    const active = isLinkActive(link.matchPath);

    // Render Webinar item with dropdown
    if (link.name === "Webinar") {
      return (
        <div
          key={link.name}
          ref={dropdownRef}
          className="relative"
          onMouseEnter={handleDropdownEnter}
          onMouseLeave={handleDropdownLeave}
        >
          <Link
            to={link.href}
            className={`relative shrink-0 rounded-full px-2.5 py-1.5 transition-colors flex items-center gap-1 ${
              active ? "text-foreground" : "hover:text-foreground"
            }`}
          >
            <span className="relative z-10">{link.name}</span>
            <ChevronDown
              className={`relative z-10 h-3 w-3 transition-transform duration-200 ${
                webinarDropdownOpen ? "rotate-180" : ""
              }`}
            />
            <NavPill active={active} />
          </Link>

          <AnimatePresence>
            {webinarDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-xl border border-border/80 bg-background/95 p-2 shadow-xl backdrop-blur-lg"
              >
                <div className="mb-1.5 px-3 pt-1">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                    Webinar Sections
                  </span>
                </div>
                {webinarSections.map((section) => (
                  <Link
                    key={section.hash}
                    to={`/webinars${section.hash}` as any}
                    onClick={() => setWebinarDropdownOpen(false)}
                    className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-surface-elevated"
                  >
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-student/10 text-student transition-colors group-hover:bg-student/20">
                      <section.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-foreground">{section.name}</div>
                      <div className="text-[10px] text-muted-foreground">{section.desc}</div>
                    </div>
                  </Link>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    // Default nav item rendering
    return (
      <Link
        key={link.name}
        to={link.href}
        className={`relative shrink-0 rounded-full px-2.5 py-1.5 transition-colors ${active ? "text-foreground" : "hover:text-foreground"
          }`}
      >
        <span className="relative z-10">{link.name}</span>
        <NavPill active={active} />
      </Link>
    );
  };

  return (
    <>
      <div
        className={`pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 sm:px-4 ${pill ? "pt-2 sm:pt-2.5" : "pt-3 sm:pt-4 md:pt-5"
          }`}
      >
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{
            opacity: 1,
            y: 0,
            width: pill ? "min(100%, 880px)" : "min(100%, 1040px)",
          }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-auto relative"
        >
          <motion.div
            layout
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className={`grid items-center gap-3 transition-[background-color,box-shadow,backdrop-filter,border-radius,border-color,min-height,padding] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${pill
                ? "min-h-[48px] grid-cols-[auto_minmax(0,1fr)_auto] rounded-full border border-border/50 bg-background/85 px-4 py-1.5 shadow-[0_8px_28px_-14px_rgba(0,0,0,0.28)] backdrop-blur-md sm:min-h-[50px] sm:px-5"
                : "min-h-[52px] grid-cols-[auto_1fr_auto] rounded-none border border-transparent bg-transparent px-3 py-1.5 shadow-none backdrop-blur-none sm:min-h-[56px] sm:px-5 md:px-6"
              }`}
          >
            <Wordmark compact={pill} className="justify-self-start" onClick={onLogoClick} />

            <nav className="hidden min-w-0 items-center justify-center gap-0.5 justify-self-center text-[12px] font-medium text-muted-foreground lg:flex">
              {PUBLIC_NAV_LINKS.map(renderNavItem)}
            </nav>

            <div className="flex items-center justify-self-end gap-2 sm:gap-2.5">
              {session ? (
                <>
                  <Link
                    to="/dashboard"
                    className="hidden text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline"
                  >
                    Dashboard
                  </Link>
                  <Link to="/dashboard">
                    <div className="grid h-7 w-7 place-items-center overflow-hidden rounded-full border border-border bg-foreground/90 text-xs font-medium text-background transition-transform hover:scale-105 sm:h-8 sm:w-8 sm:text-sm">
                      {session.user?.user_metadata?.avatar_url ? (
                        <img
                          src={session.user.user_metadata.avatar_url}
                          alt="Profile"
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      ) : session.user?.user_metadata?.full_name ? (
                        session.user.user_metadata.full_name.charAt(0).toUpperCase()
                      ) : (
                        session.user?.email?.charAt(0).toUpperCase() || "U"
                      )}
                    </div>
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="hidden shrink-0 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground md:inline"
                  >
                    Log in
                  </Link>
                  <Link
                    to="/signup"
                    className="hidden shrink-0 items-center rounded-full bg-foreground px-3 py-1.5 text-[12px] font-semibold text-background transition hover:opacity-90 md:inline-flex"
                  >
                    Become a member
                  </Link>
                </>
              )}

              <button
                type="button"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
                className="rounded-full p-2 text-foreground transition-opacity hover:opacity-70 lg:hidden"
              >
                <GridMenuIcon className="bg-foreground" />
              </button>
            </div>
          </motion.div>
        </motion.header>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
            className="fixed inset-0 z-[60] lg:hidden"
          >
            <button
              type="button"
              aria-label="Close menu overlay"
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setMenuOpen(false)}
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="absolute right-0 top-0 flex h-full w-[85%] max-w-sm flex-col rounded-l-3xl bg-background shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-border px-6 py-6">
                <span className="text-2xl font-medium tracking-tight text-foreground">Menu</span>
                <div className="flex items-center gap-3">
                  {!session && (
                    <>
                      <Link
                        to="/login"
                        onClick={() => setMenuOpen(false)}
                        className="text-sm font-medium text-muted-foreground hover:text-foreground"
                      >
                        Log in
                      </Link>
                      <Link
                        to="/signup"
                        onClick={() => setMenuOpen(false)}
                        className="rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background"
                      >
                        Be a member
                      </Link>
                    </>
                  )}
                  <button
                    type="button"
                    aria-label="Close menu"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="flex flex-1 flex-col overflow-y-auto px-6 py-8">
                <span className="mb-4 text-xs tracking-wide text-muted-foreground">Navigate</span>
                <div className="mb-8 flex flex-col gap-4 text-[17px] font-medium text-foreground">
                  {PUBLIC_EXPLORE_LINKS.map((link) => (
                    <Link
                      key={link.name}
                      to={link.href}
                      onClick={() => setMenuOpen(false)}
                      className={`transition-colors ${isLinkActive(link.matchPath) ? "text-foreground" : "hover:text-muted-foreground"
                        }`}
                    >
                      {link.name}
                    </Link>
                  ))}
                </div>

                {session && (
                  <Link
                    to="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="mt-10 inline-flex items-center justify-center rounded-full bg-foreground px-4 py-3 text-sm font-medium text-background"
                  >
                    Open dashboard
                  </Link>
                )}
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export const SiteHeader = memo(SiteHeaderComponent);
