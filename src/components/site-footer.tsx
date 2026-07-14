import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { FormEvent, useState } from "react";
import { Wordmark } from "@/components/brand";

const PLATFORM_LINKS = [
  { name: "How it works", href: "/#how" },
  { name: "Product", href: "/#preview" },
  { name: "Mentors", href: "/#loops" },
  { name: "For you", href: "/#lanes" },
] as const;

const COMPANY_LINKS = [
  { name: "About Us", to: "/about" as const },
  { name: "Privacy Policy", to: "/privacy-policy" as const },
  { name: "Return Policy", to: "/return-policy" as const },
  { name: "Refund Policy", to: "/refund-policy" as const },
  { name: "Disclaimer", to: "/disclaimer" as const },
] as const;

export function SiteFooter() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const onSubscribe = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubscribed(true);
    setEmail("");
  };

  return (
    <footer className="border-t border-border/70 bg-surface/40">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16 md:py-20">
        <div className="grid gap-12 md:grid-cols-12 md:gap-10">
          <div className="md:col-span-4">
            <Wordmark />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
              The premium operating system for personalized growth. Quantify your path,
              learn with mentors, and unlock peak outcomes.
            </p>
            <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Designed for proactive careers.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:col-span-8 md:gap-6">
            <div>
              <h3 className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Platform
              </h3>
              <ul className="space-y-3">
                {PLATFORM_LINKS.map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      className="text-sm text-foreground/85 transition-colors hover:text-foreground"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Company
              </h3>
              <ul className="space-y-3">
                {COMPANY_LINKS.map((link) => (
                  <li key={link.name}>
                    <Link
                      to={link.to}
                      className="text-sm text-foreground/85 transition-colors hover:text-foreground"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <h3 className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Stay Updated
              </h3>
              <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                Join our newsletter for the latest mentorship paths and growth playbooks.
              </p>
              {subscribed ? (
                <p className="text-sm font-medium text-foreground">You&apos;re on the list. Welcome.</p>
              ) : (
                <form onSubmit={onSubscribe} className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                  <label htmlFor="footer-email" className="sr-only">
                    Email address
                  </label>
                  <input
                    id="footer-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    className="h-11 min-w-0 flex-1 rounded-full border border-border bg-surface-elevated px-4 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <button
                    type="submit"
                    className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-foreground px-4 text-sm font-semibold text-background transition hover:opacity-90"
                  >
                    Subscribe
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-border/70 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Micrylis. All rights reserved.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <Link to="/privacy-policy" className="transition-colors hover:text-foreground">
              Privacy
            </Link>
            <Link to="/disclaimer" className="transition-colors hover:text-foreground">
              Terms
            </Link>
            <Link to="/about" className="transition-colors hover:text-foreground">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
