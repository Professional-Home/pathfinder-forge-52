import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, LegalSection } from "@/components/LegalLayout";

export const Route = createFileRoute("/about")({
  component: About,
});

function About() {
  return (
    <LegalLayout title="About & Contact" lastUpdated="July 8, 2026">
      <div className="space-y-12">
        <section className="space-y-6">
          <p className="text-lg md:text-xl text-foreground font-medium leading-relaxed">
            Micrylis is built on a simple premise: your growth path shouldn't look like anyone else's. We match you with experts, curate resources, and certify your progress, all tailored to whether you're a student, a startup founder, or a researcher.
          </p>
          <p>
            Founded by a team of operators and educators who felt the pain of generic advice, Micrylis aims to democratize access to world-class mentorship. We believe that with the right guidance at the right time, anyone can accelerate their trajectory.
          </p>
        </section>

        <LegalSection title="Our Mission">
          <p>
            To provide personalized, actionable, and affordable mentorship to ambitious individuals worldwide. We strive to create a platform where knowledge flows seamlessly from those who have built and researched, to those who are currently building and learning.
          </p>
        </LegalSection>

        <LegalSection title="Authenticated Contact Information">
          <div className="grid gap-4 mt-6 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface-elevated p-6">
              <h3 className="font-semibold text-foreground mb-2">General Inquiries</h3>
              <p className="text-sm">For general questions about the platform, mentor matching, or course content.</p>
              <a href="mailto:hello@micrylis.com" className="mt-4 inline-block text-sm font-mono text-foreground hover:underline">hello@micrylis.com</a>
            </div>
            
            <div className="rounded-xl border border-border bg-surface-elevated p-6">
              <h3 className="font-semibold text-foreground mb-2">Support & Billing</h3>
              <p className="text-sm">For account issues, refund requests, or payment troubleshooting.</p>
              <a href="mailto:support@micrylis.com" className="mt-4 inline-block text-sm font-mono text-foreground hover:underline">support@micrylis.com</a>
            </div>
            
            <div className="rounded-xl border border-border bg-surface-elevated p-6">
              <h3 className="font-semibold text-foreground mb-2">Mentor & Partner Relations</h3>
              <p className="text-sm">Interested in becoming a mentor? Reach out to our partner team.</p>
              <a href="mailto:micrylisbiotech@gmail.com" className="mt-4 inline-block text-sm font-mono text-foreground hover:underline">micrylisbiotech@gmail.com</a>
            </div>
            
            <div className="rounded-xl border border-border bg-surface-elevated p-6">
              <h3 className="font-semibold text-foreground mb-2">Corporate Office</h3>
              <p className="text-sm">Micrylis Inc.<br />123 Innovation Drive, Suite 400<br />San Francisco, CA 94105</p>
              <p className="mt-4 text-sm font-mono text-foreground">+1 (555) 123-4567</p>
            </div>
          </div>
        </LegalSection>

        <LegalSection title="Social Channels">
          <div className="grid gap-4 mt-6 sm:grid-cols-3">
            <a
              href="https://www.linkedin.com/in/micrylis-biotech-a4a4063aa/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl border border-border bg-surface-elevated p-5 transition-colors hover:border-foreground/30"
            >
              <svg className="h-5 w-5 shrink-0 text-foreground" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
              <span className="text-sm font-medium text-foreground">LinkedIn</span>
            </a>
            <a
              href="https://www.instagram.com/micrylis?igsh=cjR4ZGR1am1ubmI0"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl border border-border bg-surface-elevated p-5 transition-colors hover:border-foreground/30"
            >
              <svg className="h-5 w-5 shrink-0 text-foreground" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
              <span className="text-sm font-medium text-foreground">Instagram</span>
            </a>
            <a
              href="https://www.youtube.com/@micrylisbiotech"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl border border-border bg-surface-elevated p-5 transition-colors hover:border-foreground/30"
            >
              <svg className="h-5 w-5 shrink-0 text-foreground" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/></svg>
              <span className="text-sm font-medium text-foreground">YouTube</span>
            </a>
          </div>
        </LegalSection>
        
        <LegalSection title="Authentication & Trust">
          <p className="text-sm">
            All mentors on Micrylis undergo a rigorous vetting process, including identity verification and background checks on their professional experience. The contact information provided above is our sole official channel of communication. Micrylis will never ask for your password or sensitive financial information outside of our secure payment gateway.
          </p>
        </LegalSection>
      </div>
    </LegalLayout>
  );
}
