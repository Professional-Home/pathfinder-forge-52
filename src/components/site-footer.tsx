import { Link } from "@tanstack/react-router";

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
  return (
    <footer className="bg-[#0b0b0c] text-white">
      <div className="mx-auto max-w-6xl px-4 pt-12 pb-6 sm:px-6 sm:pt-14 sm:pb-7 md:pt-16 md:pb-8">
        <div className="grid gap-10 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-4">
            <Link to="/" className="inline-block text-xl font-semibold tracking-tight text-white">
              micrylis
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/55">
              The premium operating system for personalized growth. Quantify your path,
              learn with mentors, and unlock peak outcomes.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:col-span-8">
            <div>
              <h3 className="mb-4 text-sm font-semibold text-white">Platform</h3>
              <ul className="space-y-3">
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
              <h3 className="mb-4 text-sm font-semibold text-white">Company</h3>
              <ul className="space-y-3">
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
              <h3 className="mb-4 text-sm font-semibold text-white">Contact</h3>
              <ul className="space-y-3 text-sm text-white/55">
                <li>
                  <a href="mailto:hello@micrylis.com" className="transition-colors hover:text-white">
                    hello@micrylis.com
                  </a>
                  <span className="mt-0.5 block text-xs text-white/35">General inquiries</span>
                </li>
                <li>
                  <a href="mailto:support@micrylis.com" className="transition-colors hover:text-white">
                    support@micrylis.com
                  </a>
                  <span className="mt-0.5 block text-xs text-white/35">Support & billing</span>
                </li>
                <li>
                  <a href="tel:+15551234567" className="transition-colors hover:text-white">
                    +1 (555) 123-4567
                  </a>
                </li>
                <li className="leading-relaxed">
                  Micrylis Inc.
                  <br />
                  123 Innovation Drive, Suite 400
                  <br />
                  San Francisco, CA 94105
                </li>
              </ul>

              <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-white/55">
                <a
                  href="https://instagram.com/micrylis"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-white"
                >
                  Instagram
                </a>
                <a
                  href="https://linkedin.com/company/micrylis"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-white"
                >
                  LinkedIn
                </a>
                <a
                  href="mailto:hello@micrylis.com"
                  className="transition-colors hover:text-white"
                >
                  Email
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-5 sm:mt-12 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} Micrylis. All rights reserved.
          </p>
          <p className="text-xs text-white/40">Designed for proactive careers.</p>
        </div>
      </div>
    </footer>
  );
}
