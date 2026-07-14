import { Link } from "@tanstack/react-router";
import { Instagram, Linkedin, Mail, MapPin, Phone } from "lucide-react";
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

const SOCIAL_LINKS = [
  {
    name: "Instagram",
    href: "https://instagram.com/micrylis",
    icon: Instagram,
  },
  {
    name: "LinkedIn",
    href: "https://linkedin.com/company/micrylis",
    icon: Linkedin,
  },
  {
    name: "Email",
    href: "mailto:hello@micrylis.com",
    icon: Mail,
  },
] as const;

export function SiteFooter() {
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

            <div className="mt-8 flex items-center gap-3">
              {SOCIAL_LINKS.map(({ name, href, icon: Icon }) => (
                <a
                  key={name}
                  href={href}
                  target={href.startsWith("mailto:") ? undefined : "_blank"}
                  rel={href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
                  aria-label={name}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-elevated text-foreground transition hover:bg-foreground hover:text-background"
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:col-span-8 md:gap-6">
            <div>
              <h3 className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
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
              <h3 className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
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
              <h3 className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Contact
              </h3>
              <ul className="space-y-4 text-sm text-muted-foreground">
                <li>
                  <a
                    href="mailto:hello@micrylis.com"
                    className="inline-flex items-start gap-2.5 transition-colors hover:text-foreground"
                  >
                    <Mail className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
                    <span>
                      <span className="block font-medium text-foreground">hello@micrylis.com</span>
                      <span className="text-xs">General inquiries</span>
                    </span>
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:support@micrylis.com"
                    className="inline-flex items-start gap-2.5 transition-colors hover:text-foreground"
                  >
                    <Mail className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
                    <span>
                      <span className="block font-medium text-foreground">support@micrylis.com</span>
                      <span className="text-xs">Support & billing</span>
                    </span>
                  </a>
                </li>
                <li>
                  <a
                    href="tel:+15551234567"
                    className="inline-flex items-start gap-2.5 transition-colors hover:text-foreground"
                  >
                    <Phone className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
                    <span className="font-medium text-foreground">+1 (555) 123-4567</span>
                  </a>
                </li>
                <li className="inline-flex items-start gap-2.5">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
                  <span>
                    Micrylis Inc.
                    <br />
                    123 Innovation Drive, Suite 400
                    <br />
                    San Francisco, CA 94105
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-border/70 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Micrylis. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <a
              href="https://instagram.com/micrylis"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              Instagram
            </a>
            <a
              href="https://linkedin.com/company/micrylis"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              LinkedIn
            </a>
            <a href="mailto:hello@micrylis.com" className="transition-colors hover:text-foreground">
              Email
            </a>
            <Link to="/privacy-policy" className="transition-colors hover:text-foreground">
              Privacy
            </Link>
            <Link to="/disclaimer" className="transition-colors hover:text-foreground">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
