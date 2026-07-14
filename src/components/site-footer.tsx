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
    <footer className="relative overflow-hidden bg-[#0b0b0c] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#2dd4bf]/40 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-0 h-64 w-64 rounded-full bg-[#14b8a6]/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-6xl px-4 pt-12 pb-6 sm:px-6 sm:pt-14 sm:pb-8">
        <div className="grid gap-10 md:grid-cols-12 md:gap-8 lg:gap-10">
          <div className="md:col-span-4">
            <Wordmark theme="dark" />
            <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-white/65">
              The premium operating system for personalized growth. Quantify your path,
              learn with mentors, and unlock peak outcomes.
            </p>

            <div className="mt-6 flex items-center gap-3">
              {SOCIAL_LINKS.map(({ name, href, icon: Icon }) => (
                <a
                  key={name}
                  href={href}
                  target={href.startsWith("mailto:") ? undefined : "_blank"}
                  rel={href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
                  aria-label={name}
                  title={name}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:border-[#2dd4bf]/50 hover:bg-[#2dd4bf]/15 hover:text-[#5eead4]"
                >
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:col-span-8 md:gap-6">
            <div>
              <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.14em] text-white/90">
                Platform
              </h3>
              <ul className="space-y-3">
                {PLATFORM_LINKS.map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      className="text-sm text-white/60 transition-colors hover:text-white"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.14em] text-white/90">
                Company
              </h3>
              <ul className="space-y-3">
                {COMPANY_LINKS.map((link) => (
                  <li key={link.name}>
                    <Link
                      to={link.to}
                      className="text-sm text-white/60 transition-colors hover:text-white"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.14em] text-white/90">
                Contact
              </h3>
              <ul className="space-y-4 text-sm text-white/60">
                <li>
                  <a
                    href="mailto:hello@micrylis.com"
                    className="group flex items-start gap-3 transition-colors hover:text-white"
                  >
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-white/80 group-hover:bg-[#2dd4bf]/15 group-hover:text-[#5eead4]">
                      <Mail className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                    <span>
                      <span className="block font-medium text-white/90">hello@micrylis.com</span>
                      <span className="text-xs text-white/45">General inquiries</span>
                    </span>
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:support@micrylis.com"
                    className="group flex items-start gap-3 transition-colors hover:text-white"
                  >
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-white/80 group-hover:bg-[#2dd4bf]/15 group-hover:text-[#5eead4]">
                      <Mail className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                    <span>
                      <span className="block font-medium text-white/90">support@micrylis.com</span>
                      <span className="text-xs text-white/45">Support & billing</span>
                    </span>
                  </a>
                </li>
                <li>
                  <a
                    href="tel:+15551234567"
                    className="group flex items-start gap-3 transition-colors hover:text-white"
                  >
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-white/80 group-hover:bg-[#2dd4bf]/15 group-hover:text-[#5eead4]">
                      <Phone className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                    <span className="font-medium text-white/90">+1 (555) 123-4567</span>
                  </a>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-white/80">
                    <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
                  </span>
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

        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-white/45">
            © {new Date().getFullYear()} Micrylis. All rights reserved.
          </p>
          <p className="text-xs text-white/45">Designed for proactive careers.</p>
        </div>
      </div>
    </footer>
  );
}
