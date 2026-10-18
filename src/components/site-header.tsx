import { memo, useCallback, useEffect, useState, useRef } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import type { Session } from "@supabase/supabase-js";
import { Wordmark, GooglePlayIcon } from "@/components/brand";
import { PLAY_STORE_URL } from "@/lib/app-config";
import { supabase } from "@/utils/supabase";
import { toast } from "sonner";
import {
  COMMUNITY_DROPDOWN_ITEMS,
  OPPORTUNITIES_DROPDOWN_ITEMS,
  PUBLIC_NAV_LINKS,
} from "@/lib/nav-config";
import {
  X,
  ChevronDown,
  Video,
  Trophy,
  Calendar,
  Flame,
  GraduationCap,
  Users,
  Briefcase,
  FlaskConical,
  ArrowRight,
  Plus,
  Minus,
} from "lucide-react";

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

const COMMUNITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Webinars: Video,
  "National Bio Challenge": Trophy,
  Events: Calendar,
  Competitions: Flame,
  Workshops: GraduationCap,
  "Conferences / Meetups": Users,
};

const OPPORTUNITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Internships: Briefcase,
  "Research Opportunities": FlaskConical,
};

function SiteHeaderComponent() {
  const location = useLocation();
  const pathname = location.pathname;
  const isHome = pathname === "/";

  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  // Desktop Dropdown States
  const [activeDropdown, setActiveDropdown] = useState<"community" | "opportunities" | null>(null);
  const dropdownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navContainerRef = useRef<HTMLElement>(null);

  // Mobile Accordion States
  const [mobileCommunityOpen, setMobileCommunityOpen] = useState(false);
  const [mobileOpportunitiesOpen, setMobileOpportunitiesOpen] = useState(false);

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

  // Close dropdown on outside click or escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveDropdown(null);
        setMenuOpen(false);
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (navContainerRef.current && !navContainerRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
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

  const navigate = useNavigate();

  const handleOpportunityClick = useCallback(
    (e: React.MouseEvent, _targetHref: string = "/opportunities") => {
      if (!session) {
        e.preventDefault();
        toast.info("Please log in to access opportunities & internships.");
        navigate({ to: "/login" });
        setActiveDropdown(null);
        setMenuOpen(false);
      } else {
        setActiveDropdown(null);
        setMenuOpen(false);
      }
    },
    [session, navigate]
  );

  const handleMouseEnter = (menu: "community" | "opportunities") => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
      dropdownTimeoutRef.current = null;
    }
    setActiveDropdown(menu);
  };

  const handleMouseLeave = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 180);
  };

  return (
    <>
      <div
        className={`pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 sm:px-4 ${
          pill ? "pt-2 sm:pt-2.5" : "pt-3 sm:pt-4 md:pt-5"
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
            className={`grid items-center gap-3 transition-[background-color,box-shadow,backdrop-filter,border-radius,border-color,min-height,padding] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              pill
                ? "min-h-[48px] grid-cols-[auto_minmax(0,1fr)_auto] rounded-full border border-border/50 bg-background/85 px-4 py-1.5 shadow-[0_8px_28px_-14px_rgba(0,0,0,0.28)] backdrop-blur-md sm:min-h-[50px] sm:px-5"
                : "min-h-[52px] grid-cols-[auto_1fr_auto] rounded-none border border-transparent bg-transparent px-3 py-1.5 shadow-none backdrop-blur-none sm:min-h-[56px] sm:px-5 md:px-6"
            }`}
          >
            <Wordmark compact={pill} className="justify-self-start" onClick={onLogoClick} />

            {/* Desktop Navigation Links */}
            <nav
              ref={navContainerRef}
              className="hidden min-w-0 items-center justify-center gap-0.5 justify-self-center text-[12px] font-medium text-muted-foreground lg:flex"
            >
              {/* 1. Home */}
              <Link
                to="/"
                className={`relative shrink-0 rounded-full px-2.5 py-1.5 transition-colors ${
                  isLinkActive("/") ? "text-foreground" : "hover:text-foreground"
                }`}
              >
                <span className="relative z-10">Home</span>
                <NavPill active={isLinkActive("/")} />
              </Link>

              {/* 2. About */}
              <Link
                to="/about"
                className={`relative shrink-0 rounded-full px-2.5 py-1.5 transition-colors ${
                  isLinkActive("/about") ? "text-foreground" : "hover:text-foreground"
                }`}
              >
                <span className="relative z-10">About</span>
                <NavPill active={isLinkActive("/about")} />
              </Link>

              {/* 3. Projects */}
              <Link
                to="/projects"
                className={`relative shrink-0 rounded-full px-2.5 py-1.5 transition-colors ${
                  isLinkActive("/projects") ? "text-foreground" : "hover:text-foreground"
                }`}
              >
                <span className="relative z-10">Projects</span>
                <NavPill active={isLinkActive("/projects")} />
              </Link>

              {/* 4. Community ▾ (Dropdown) */}
              <div
                className="relative"
                onMouseEnter={() => handleMouseEnter("community")}
                onMouseLeave={handleMouseLeave}
              >
                <Link
                  to="/community"
                  aria-expanded={activeDropdown === "community"}
                  aria-haspopup="true"
                  className={`relative shrink-0 rounded-full px-2.5 py-1.5 transition-colors flex items-center gap-1 ${
                    isLinkActive("/community") || isLinkActive("/webinars") || isLinkActive("/events")
                      ? "text-foreground"
                      : "hover:text-foreground"
                  }`}
                >
                  <span className="relative z-10">Community</span>
                  <ChevronDown
                    className={`relative z-10 h-3 w-3 transition-transform duration-200 ${
                      activeDropdown === "community" ? "rotate-180" : ""
                    }`}
                  />
                  <NavPill
                    active={
                      isLinkActive("/community") ||
                      isLinkActive("/webinars") ||
                      isLinkActive("/events")
                    }
                  />
                </Link>

                <AnimatePresence>
                  {activeDropdown === "community" && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute left-1/2 top-full z-50 mt-2 w-80 -translate-x-1/2 rounded-2xl border border-border/80 bg-background/95 p-2 shadow-2xl backdrop-blur-xl"
                    >
                      <div className="mb-1.5 px-3 pt-1.5 flex items-center justify-between">
                        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                          Community Hub
                        </span>
                        <Link
                          to="/community"
                          onClick={() => setActiveDropdown(null)}
                          className="text-[10px] text-student hover:underline flex items-center gap-0.5"
                        >
                          Overview <ArrowRight className="h-2.5 w-2.5" />
                        </Link>
                      </div>

                      <div className="space-y-1">
                        {COMMUNITY_DROPDOWN_ITEMS.map((item) => {
                          const IconComp = COMMUNITY_ICONS[item.name] || Users;
                          return (
                            <Link
                              key={item.name}
                              to={item.href as any}
                              onClick={() => setActiveDropdown(null)}
                              className="group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-surface-elevated"
                            >
                              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-student/10 text-student transition-colors group-hover:bg-student/20">
                                <IconComp className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold text-foreground group-hover:text-student transition-colors">
                                    {item.name}
                                  </span>
                                  {item.badge && (
                                    <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 text-[9px] font-semibold text-amber-400">
                                      {item.badge}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-muted-foreground truncate">
                                  {item.description}
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 5. Opportunities ▾ (Dropdown) */}
              <div
                className="relative"
                onMouseEnter={() => handleMouseEnter("opportunities")}
                onMouseLeave={handleMouseLeave}
              >
                <Link
                  to={"/opportunities" as any}
                  onClick={(e) => handleOpportunityClick(e, "/opportunities")}
                  aria-expanded={activeDropdown === "opportunities"}
                  aria-haspopup="true"
                  className={`relative shrink-0 rounded-full px-2.5 py-1.5 transition-colors flex items-center gap-1 ${
                    isLinkActive("/opportunities") ? "text-foreground" : "hover:text-foreground"
                  }`}
                >
                  <span className="relative z-10">Opportunities</span>
                  <ChevronDown
                    className={`relative z-10 h-3 w-3 transition-transform duration-200 ${
                      activeDropdown === "opportunities" ? "rotate-180" : ""
                    }`}
                  />
                  <NavPill active={isLinkActive("/opportunities")} />
                </Link>

                <AnimatePresence>
                  {activeDropdown === "opportunities" && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute left-1/2 top-full z-50 mt-2 w-80 -translate-x-1/2 rounded-2xl border border-border/80 bg-background/95 p-2 shadow-2xl backdrop-blur-xl"
                    >
                      <div className="mb-1.5 px-3 pt-1.5 flex items-center justify-between">
                        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                          Opportunities
                        </span>
                        <Link
                          to={"/opportunities" as any}
                          onClick={(e) => handleOpportunityClick(e, "/opportunities")}
                          className="text-[10px] text-student hover:underline flex items-center gap-0.5"
                        >
                          All listings <ArrowRight className="h-2.5 w-2.5" />
                        </Link>
                      </div>

                      <div className="space-y-1">
                        {OPPORTUNITIES_DROPDOWN_ITEMS.map((item) => {
                          const IconComp = OPPORTUNITY_ICONS[item.name] || Briefcase;
                          return (
                            <Link
                              key={item.name}
                              to={item.href as any}
                              onClick={(e) => handleOpportunityClick(e, item.href)}
                              className="group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-surface-elevated"
                            >
                              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-student/10 text-student transition-colors group-hover:bg-student/20">
                                <IconComp className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-semibold text-foreground group-hover:text-student transition-colors">
                                  {item.name}
                                </div>
                                <div className="text-[10px] text-muted-foreground truncate">
                                  {item.description}
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 6. Blog */}
              <Link
                to="/blog"
                className={`relative shrink-0 rounded-full px-2.5 py-1.5 transition-colors ${
                  isLinkActive("/blog") ? "text-foreground" : "hover:text-foreground"
                }`}
              >
                <span className="relative z-10">Blog</span>
                <NavPill active={isLinkActive("/blog")} />
              </Link>
            </nav>

            {/* Right Action Buttons */}
            <div className="flex items-center justify-self-end gap-2 sm:gap-2.5">
              <a
                href={PLAY_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Get the App on Google Play"
                title="Get the App on Google Play"
                className="hidden shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-surface-elevated/70 px-2.5 py-1 text-[12px] font-medium text-foreground transition hover:border-foreground/30 hover:bg-accent md:inline-flex"
              >
                <GooglePlayIcon className="h-3.5 w-3.5 shrink-0" />
                <span>Get App</span>
              </a>

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

              {/* Mobile Menu Trigger */}
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

      {/* Mobile Drawer Menu (No hover dependency, accessible accordions) */}
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
              className="absolute right-0 top-0 flex h-full w-[88%] max-w-sm flex-col rounded-l-3xl bg-background shadow-2xl"
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

              <div className="flex flex-1 flex-col overflow-y-auto px-6 py-6">
                <span className="mb-3 text-xs tracking-wide text-muted-foreground uppercase font-mono">
                  Navigation
                </span>

                <div className="flex flex-col gap-1 text-[16px] font-medium text-foreground">
                  {/* Home */}
                  <Link
                    to="/"
                    onClick={() => setMenuOpen(false)}
                    className={`py-2 transition-colors ${
                      isLinkActive("/") ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Home
                  </Link>

                  {/* About */}
                  <Link
                    to="/about"
                    onClick={() => setMenuOpen(false)}
                    className={`py-2 transition-colors ${
                      isLinkActive("/about") ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    About
                  </Link>

                  {/* Projects */}
                  <Link
                    to="/projects"
                    onClick={() => setMenuOpen(false)}
                    className={`py-2 transition-colors ${
                      isLinkActive("/projects") ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Projects
                  </Link>

                  {/* Community + (Accordion) */}
                  <div className="border-y border-border/60 py-2">
                    <button
                      type="button"
                      aria-expanded={mobileCommunityOpen}
                      onClick={() => setMobileCommunityOpen((prev) => !prev)}
                      className="flex w-full items-center justify-between py-1.5 text-left text-[16px] font-medium text-foreground"
                    >
                      <span>Community</span>
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-surface-elevated text-xs">
                        {mobileCommunityOpen ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      </span>
                    </button>

                    <AnimatePresence>
                      {mobileCommunityOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden pl-3 pt-2 space-y-2 text-sm"
                        >
                          {COMMUNITY_DROPDOWN_ITEMS.map((item) => (
                            <Link
                              key={item.name}
                              to={item.href as any}
                              onClick={() => setMenuOpen(false)}
                              className="flex items-center justify-between py-1.5 text-muted-foreground hover:text-foreground"
                            >
                              <span>{item.name}</span>
                              {item.badge && (
                                <span className="rounded-full bg-amber-500/15 px-2 py-0.2 text-[9px] text-amber-400 font-semibold">
                                  {item.badge}
                                </span>
                              )}
                            </Link>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Opportunities + (Accordion) */}
                  <div className="border-b border-border/60 py-2">
                    <button
                      type="button"
                      aria-expanded={mobileOpportunitiesOpen}
                      onClick={(e) => {
                        if (!session) {
                          handleOpportunityClick(e, "/opportunities");
                          return;
                        }
                        setMobileOpportunitiesOpen((prev) => !prev);
                      }}
                      className="flex w-full items-center justify-between py-1.5 text-left text-[16px] font-medium text-foreground"
                    >
                      <span>Opportunities</span>
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-surface-elevated text-xs">
                        {mobileOpportunitiesOpen ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      </span>
                    </button>

                    <AnimatePresence>
                      {mobileOpportunitiesOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden pl-3 pt-2 space-y-1.5 text-sm"
                        >
                          <Link
                            to={"/opportunities" as any}
                            onClick={(e) => handleOpportunityClick(e, "/opportunities")}
                            className="block py-1 font-semibold text-student"
                          >
                            All Opportunities →
                          </Link>
                          {OPPORTUNITIES_DROPDOWN_ITEMS.map((item) => (
                            <Link
                              key={item.name}
                              to={item.href as any}
                              onClick={(e) => handleOpportunityClick(e, item.href)}
                              className="block py-1 text-muted-foreground hover:text-foreground"
                            >
                              {item.name}
                            </Link>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Blog */}
                  <Link
                    to="/blog"
                    onClick={() => setMenuOpen(false)}
                    className={`py-2 transition-colors ${
                      isLinkActive("/blog") ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Blog
                  </Link>
                </div>

                {session && (
                  <Link
                    to="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="mt-6 inline-flex items-center justify-center rounded-full bg-foreground px-4 py-3 text-sm font-medium text-background"
                  >
                    Open dashboard
                  </Link>
                )}

                <div className="mt-auto pt-6 border-t border-border">
                  <a
                    href={PLAY_STORE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMenuOpen(false)}
                    aria-label="Get the App on Google Play"
                    className="inline-flex w-full items-center justify-center gap-2.5 rounded-full border border-border-strong bg-surface-elevated px-4 py-3 text-sm font-semibold text-foreground shadow-sm transition hover:bg-accent"
                  >
                    <GooglePlayIcon className="h-4 w-4 shrink-0" />
                    <span>Get the App on Google Play</span>
                  </a>
                </div>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export const SiteHeader = memo(SiteHeaderComponent);
