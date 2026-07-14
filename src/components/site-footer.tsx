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
  { name: "Instagram", href: "https://instagram.com/micrylis", icon: Instagram },
  { name: "LinkedIn", href: "https://linkedin.com/company/micrylis", icon: Linkedin },
  { name: "Email", href: "mailto:hello@micrylis.com", icon: Mail },
] as const;

export function SiteFooter() {
  return (
    <footer className="bg-[#0b0b0c] text-white">
      <div className="mx-auto max-w-6xl px-4 pt-8 pb-4 sm:px-6 sm:pt-10 sm:pb-5">
        <div className="grid gap-8 md:grid-cols-12 md:gap-6">
          <div className="md:col-span-4">
            <Wordmark theme="dark" />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/55">
              The premium operating system for personalized growth. Quantify your path,
              learn with mentors, and unlock peak outcomes.
            </p>

            <div className="mt-4 flex items-center gap-2.5">
              {SOCIAL_LINKS.map(({ name, href, icon: Icon }) => (
                <a
                  key={name}
                  href={href}
                  target={href.startsWith("mailto:") ? undefined : "_blank"}
                  rel={href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
                  aria-label={name}
                  title={name}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:col-span-8">
            <div>
              <h3 className="mb-3 text-sm font-semibold text-white">Platform</h3>
              <ul className="space-y-2.5">
                {PLATFORM_LINKS.map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      className="text-sm text-white/55 transition-colors hover:text-white"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-white">Company</h3>
              <ul className="space-y-2.5">
                {COMPANY_LINKS.map((link) => (
                  <li key={link.name}>
                    <Link
                      to={link.to}
                      className="text-sm text-white/55 transition-colors hover:text-white"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <h3 className="mb-3 text-sm font-semibold text-white">Contact</h3>
              <ul className="space-y-3 text-sm text-white/55">
                <li>
                  <a
                    href="mailto:hello@micrylis.com"
                    className="group flex items-start gap-2.5 transition-colors hover:text-white"
                  >
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-white/40 group-hover:text-white/70" strokeWidth={1.75} />
                    <span>
                      <span className="block font-medium text-white/90">hello@micrylis.com</span>
                      <span className="text-xs text-white/40">General inquiries</span>
                    </span>
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:support@micrylis.com"
                    className="group flex items-start gap-2.5 transition-colors hover:text-white"
                  >
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-white/40 group-hover:text-white/70" strokeWidth={1.75} />
                    <span>
                      <span className="block font-medium text-white/90">support@micrylis.com</span>
                      <span className="text-xs text-white/40">Support & billing</span>
                    </span>
                  </a>
                </li>
                <li>
                  <a
                    href="tel:+15551234567"
                    className="group flex items-start gap-2.5 transition-colors hover:text-white"
                  >
                    <Phone className="mt-0.5 h-4 w-4 shrink-0 text-white/40 group-hover:text-white/70" strokeWidth={1.75} />
                    <span className="font-medium text-white/90">+1 (555) 123-4567</span>
                  </a>
                </li>
                <li className="flex items-start gap-2.5">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white/40" strokeWidth={1.75} />
                  <span className="leading-relaxed">
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

        <div className="mt-6 flex flex-col gap-1 border-t border-white/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-white/40">
            © {new Date().getFullYear()} Micrylis. All rights reserved.
          </p>
          <p className="text-[11px] text-white/40">Designed for proactive careers.</p>
        </div>
      </div>
    </footer>
  );
}
