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
              <h3 className="font-semibold text-foreground mb-2">Mentor Applications</h3>
              <p className="text-sm">Interested in becoming a mentor? Reach out to our partner team.</p>
              <a href="mailto:mentors@micrylis.com" className="mt-4 inline-block text-sm font-mono text-foreground hover:underline">mentors@micrylis.com</a>
            </div>
            
            <div className="rounded-xl border border-border bg-surface-elevated p-6">
              <h3 className="font-semibold text-foreground mb-2">Corporate Office</h3>
              <p className="text-sm">Micrylis Inc.<br />123 Innovation Drive, Suite 400<br />San Francisco, CA 94105</p>
              <p className="mt-4 text-sm font-mono text-foreground">+1 (555) 123-4567</p>
            </div>
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
