import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Wordmark } from "@/components/brand";
import { supabase } from "@/utils/supabase";

const PRIMARY_LINKS = [
  { name: "For you", href: "#lanes" },
  { name: "How it works", href: "#how" },
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

function GridMenuIcon({ className = "bg-current" }: { className?: string }) {
  return (
    <span className="grid grid-cols-3 gap-[2.5px]" aria-hidden>
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} className={`h-1 w-1 rounded-full ${className}`} />
      ))}
    </span>
  );
}

export function SiteHeader() {
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

  const onNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setMenuOpen(false);
    scrollToHash(href);
  };

  const pill = isScrolled || menuOpen;
  const linkTone = pill
    ? "text-white/85 hover:text-white"
    : "text-foreground/75 hover:text-foreground";
  const menuDotTone = pill ? "bg-white" : "bg-foreground";

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 sm:px-4 sm:pt-4 md:pt-5">
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{
            opacity: 1,
            y: 0,
            width: pill ? "min(100%, 920px)" : "min(100%, 1120px)",
          }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-auto relative"
        >
          <motion.div
            layout
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className={`relative flex min-h-[52px] items-center justify-between px-4 py-2 transition-[background-color,box-shadow,backdrop-filter,border-radius] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] sm:min-h-[56px] sm:px-6 md:px-8 ${
              pill
                ? "rounded-full border border-white/10 bg-[#1a1a1a]/72 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.55)] backdrop-blur-xl"
                : "rounded-none border border-transparent bg-transparent shadow-none backdrop-blur-none"
            }`}
          >
            {/* Left links */}
            <div className="z-10 flex flex-1 items-center justify-start gap-5 md:gap-6">
              <nav className="hidden items-center gap-5 text-sm font-medium md:flex lg:gap-6">
                {PRIMARY_LINKS.map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    onClick={(e) => onNavClick(e, link.href)}
                    className={`transition-colors duration-300 ${linkTone}`}
                  >
                    {link.name}
                  </a>
                ))}
              </nav>
            </div>

            {/* Center logo */}
            <div className="pointer-events-auto absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
              <Wordmark
                compact
                inverted={pill}
                className="scale-[0.92] sm:scale-100"
              />
            </div>

            {/* Right actions */}
            <div className="z-10 flex flex-1 items-center justify-end gap-2 sm:gap-3 md:gap-4">
              {session ? (
                <>
                  <Link
                    to="/dashboard/$domain"
                    params={{ domain: "student" }}
                    className={`hidden text-sm font-medium transition-colors duration-300 sm:inline ${linkTone}`}
                  >
                    Dashboard
                  </Link>
                  <Link to="/dashboard/$domain" params={{ domain: "student" }}>
                    <div
                      className={`grid h-8 w-8 place-items-center overflow-hidden rounded-full border text-sm font-medium transition-transform hover:scale-105 ${
                        pill
                          ? "border-white/20 bg-white text-black"
                          : "border-border bg-foreground text-background"
                      }`}
                    >
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
                    className={`hidden text-sm font-medium transition-colors duration-300 md:inline ${linkTone}`}
                  >
                    Log in
                  </Link>
                  <Link
                    to="/signup"
                    className={`hidden items-center rounded-full px-4 py-2 text-xs font-medium transition-colors md:inline-flex md:text-sm ${
                      pill
                        ? "bg-white text-black hover:bg-white/90"
                        : "bg-foreground text-background hover:opacity-90"
                    }`}
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
                className={`rounded-full p-2.5 transition-opacity hover:opacity-75 ${
                  pill ? "text-white" : "text-foreground"
                }`}
              >
                <GridMenuIcon className={menuDotTone} />
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
            className="fixed inset-0 z-40"
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
                    className="rounded-full p-1"
                  >
                    <GridMenuIcon className="bg-foreground" />
                  </button>
                </div>
              </div>

              <div className="flex flex-1 flex-col overflow-y-auto px-6 py-8">
                <span className="mb-4 text-xs tracking-wide text-muted-foreground">Explore</span>
                <div className="mb-8 flex flex-col gap-4 text-[17px] font-medium text-foreground">
                  {EXPLORE_LINKS.map((link) => (
                    <a
                      key={link.name}
                      href={link.href}
                      onClick={(e) => onNavClick(e, link.href.replace("/", ""))}
                      className="transition-colors hover:text-muted-foreground"
                    >
                      {link.name}
                    </a>
                  ))}
                </div>

                <span className="mb-4 text-xs tracking-wide text-muted-foreground">Company</span>
                <div className="flex flex-col gap-3 text-sm font-medium text-muted-foreground">
                  {COMPANY_LINKS.map((link) => (
                    <Link
                      key={link.name}
                      to={link.to}
                      onClick={() => setMenuOpen(false)}
                      className="transition-colors hover:text-foreground"
                    >
                      {link.name}
                    </Link>
                  ))}
                </div>

                {session && (
                  <Link
                    to="/dashboard/$domain"
                    params={{ domain: "student" }}
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
