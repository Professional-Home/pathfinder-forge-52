import { Link } from "@tanstack/react-router";
import { ArrowRight, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Session } from "@supabase/supabase-js";
import { Wordmark } from "@/components/brand";
import { supabase } from "@/utils/supabase";

const NAV_LINKS = [
  { name: "For you", href: "#lanes" },
  { name: "How it works", href: "#how" },
  { name: "Product", href: "#preview" },
  { name: "Mentors", href: "#loops" },
] as const;

const EXPLORE_LINKS = [
  { name: "For you", href: "/#lanes" },
  { name: "How it works", href: "/#how" },
  { name: "Product", href: "/#preview" },
  { name: "Mentors", href: "/#loops" },
] as const;

const COMPANY_LINKS = [
  { name: "About & Contact", to: "/about" as const },
  { name: "Privacy Policy", to: "/privacy-policy" as const },
  { name: "Return Policy", to: "/return-policy" as const },
  { name: "Refund Policy", to: "/refund-policy" as const },
] as const;

function scrollToHash(hash: string) {
  const el = document.querySelector(hash);
  if (el) {
    el.scrollIntoView({ behavior: "smooth" });
    return;
  }
  window.location.href = `/${hash}`;
}

export function SiteHeader() {
  const [activeSection, setActiveSection] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

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
      setIsScrolled(window.scrollY > 24);
      const scrollPos = window.scrollY + 120;
      for (const link of NAV_LINKS) {
        const section = document.querySelector(link.href);
        if (!(section instanceof HTMLElement)) continue;
        if (
          section.offsetTop <= scrollPos &&
          section.offsetTop + section.offsetHeight > scrollPos
        ) {
          setActiveSection(link.href.slice(1));
        }
      }
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

  const onNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setMenuOpen(false);
    scrollToHash(href);
  };

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          isScrolled || menuOpen
            ? "border-b border-border/70 bg-background/85 backdrop-blur-xl"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:h-[4.25rem] sm:px-6">
          <Wordmark />

          <nav className="hidden items-center gap-1 text-[13px] font-medium text-muted-foreground lg:flex">
            {NAV_LINKS.map((link) => {
              const isActive = activeSection === link.href.slice(1);
              return (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={(e) => onNavClick(e, link.href)}
                  className={`relative rounded-full px-3.5 py-2 transition-colors ${
                    isActive ? "text-foreground" : "hover:text-foreground"
                  }`}
                >
                  <span className="relative z-10">{link.name}</span>
                  {isActive && (
                    <motion.span
                      layoutId="site-nav-pill"
                      className="absolute inset-0 rounded-full border border-border bg-surface-elevated"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                </a>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            {session ? (
              <>
                <Link
                  to="/dashboard/$domain"
                  params={{ domain: "student" }}
                  className="hidden text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline"
                >
                  Dashboard
                </Link>
                <Link to="/dashboard/$domain" params={{ domain: "student" }}>
                  <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-border bg-foreground/90 font-display text-sm text-background transition-transform hover:scale-105">
                    {session.user?.user_metadata?.avatar_url ? (
                      <img
                        src={session.user.user_metadata.avatar_url}
                        alt="Profile"
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
                  className="hidden text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline"
                >
                  Log in
                </Link>
                <Link
                  to="/signup"
                  className="hidden items-center gap-1.5 rounded-full bg-foreground px-3.5 py-2 text-[13px] font-semibold text-background shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.35)] transition hover:opacity-90 sm:inline-flex"
                >
                  Become a member
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </>
            )}

            <button
              type="button"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-surface-elevated px-3.5 text-[13px] font-semibold text-foreground transition hover:bg-surface lg:hidden"
            >
              {menuOpen ? (
                <>
                  <X className="h-4 w-4" />
                  Close
                </>
              ) : (
                <>
                  <Menu className="h-4 w-4" />
                  Menu
                </>
              )}
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-40 bg-background lg:hidden"
          >
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="flex h-full flex-col px-5 pb-8 pt-24"
            >
              <div className="mb-8 flex gap-3 sm:hidden">
                {session ? (
                  <Link
                    to="/dashboard/$domain"
                    params={{ domain: "student" }}
                    onClick={() => setMenuOpen(false)}
                    className="inline-flex flex-1 items-center justify-center rounded-full bg-foreground px-4 py-3 text-sm font-semibold text-background"
                  >
                    Open dashboard
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/login"
                      onClick={() => setMenuOpen(false)}
                      className="inline-flex flex-1 items-center justify-center rounded-full border border-border bg-surface-elevated px-4 py-3 text-sm font-semibold text-foreground"
                    >
                      Log in
                    </Link>
                    <Link
                      to="/signup"
                      onClick={() => setMenuOpen(false)}
                      className="inline-flex flex-1 items-center justify-center rounded-full bg-foreground px-4 py-3 text-sm font-semibold text-background"
                    >
                      Be a member
                    </Link>
                  </>
                )}
              </div>

              <div className="grid flex-1 gap-10 overflow-y-auto pb-6">
                <div>
                  <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                    Explore
                  </p>
                  <ul className="space-y-1">
                    {EXPLORE_LINKS.map((link, index) => (
                      <motion.li
                        key={link.name}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05 * index, duration: 0.35 }}
                      >
                        <a
                          href={link.href}
                          onClick={(e) => onNavClick(e, link.href.replace("/", ""))}
                          className="block py-2.5 font-display text-3xl tracking-tight text-foreground transition hover:text-muted-foreground sm:text-4xl"
                        >
                          {link.name}
                        </a>
                      </motion.li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                    Company
                  </p>
                  <ul className="space-y-1">
                    {COMPANY_LINKS.map((link, index) => (
                      <motion.li
                        key={link.name}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.08 + 0.05 * index, duration: 0.35 }}
                      >
                        <Link
                          to={link.to}
                          onClick={() => setMenuOpen(false)}
                          className="block py-2 text-lg font-medium text-muted-foreground transition hover:text-foreground"
                        >
                          {link.name}
                        </Link>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              </div>

              <p className="mt-auto pt-4 text-xs text-muted-foreground">
                Personalized mentorship paths for students, startups, and researchers.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
