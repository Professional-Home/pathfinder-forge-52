import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, LegalSection } from "@/components/LegalLayout";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/about")({
  component: About,
  head: () => ({
    meta: [
      { title: "About Us & Contact — Micrylis Biotech" },
      {
        name: "description",
        content:
          "Micrylis Biotech is dedicated to empowering students, researchers, and biotech enthusiasts through hands-on research projects and direct expert mentorship.",
      },
    ],
  }),
});

function About() {
  return (
    <>
      <SiteHeader />
      <div className="pt-12">
        <LegalLayout title="About Us & Contact" lastUpdated="August 2026" hideHeader>
          <div className="space-y-12">
            <section className="space-y-6">
              <p className="text-lg md:text-xl text-foreground font-medium leading-relaxed">
                Micrylis Biotech is dedicated to empowering students, researchers, and biotech enthusiasts through hands-on research projects, industry-relevant training, and direct expert mentorship.
              </p>
              <p>
                We bridge the gap between academic theory and practical innovation in Biotechnology, Drug Discovery, AI in Bio-computing, and Sustainable Sciences. Our goal is to equip the next generation of bioscientists with real-world project experience and expert-backed career guidance.
              </p>
            </section>

            <LegalSection title="Our Mission">
              <p>
                To democratize access to high-impact research, practical skill development, and top-tier mentorship in biotechnology and life sciences. We aim to inspire innovation, accelerate careers, and support groundbreaking scientific learning.
              </p>
            </LegalSection>

            <LegalSection title="Official Contact Information">
              <div className="grid gap-4 mt-6 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-surface-elevated p-6">
                  <h3 className="font-semibold text-foreground mb-2">General & Course Inquiries</h3>
                  <p className="text-sm">For questions about courses, enrollment, mentorship matching, or platform details.</p>
                  <a href="mailto:contact@micrylisbiotech.com" className="mt-4 inline-block text-sm font-mono text-foreground hover:underline">
                    contact@micrylisbiotech.com
                  </a>
                </div>
                
                <div className="rounded-xl border border-border bg-surface-elevated p-6">
                  <h3 className="font-semibold text-foreground mb-2">Phone & WhatsApp Support</h3>
                  <p className="text-sm">Reach out to our helpline directly for assistance with enrollments and queries.</p>
                  <a href="tel:+918849005635" className="mt-4 inline-block text-sm font-mono text-foreground hover:underline">
                    +91 88490 05635
                  </a>
                </div>
                
                <div className="rounded-xl border border-border bg-surface-elevated p-6">
                  <h3 className="font-semibold text-foreground mb-2">Mentor & Partner Relations</h3>
                  <p className="text-sm">Interested in mentoring or collaborating with Micrylis Biotech?</p>
                  <a href="mailto:contact@micrylisbiotech.com" className="mt-4 inline-block text-sm font-mono text-foreground hover:underline">
                    contact@micrylisbiotech.com
                  </a>
                </div>
                
                <div className="rounded-xl border border-border bg-surface-elevated p-6">
                  <h3 className="font-semibold text-foreground mb-2">Social Channels</h3>
                  <p className="text-sm">Follow our latest updates and scientific content on social platforms.</p>
                  <div className="mt-4 flex flex-col gap-1.5 text-sm font-mono">
                    <a href="https://www.youtube.com/@MicrylisBiotech" target="_blank" rel="noopener noreferrer" className="hover:underline text-foreground">
                      YouTube: @MicrylisBiotech
                    </a>
                    <a href="https://www.linkedin.com/in/micrylis-biotech-a4a4063aa/" target="_blank" rel="noopener noreferrer" className="hover:underline text-foreground">
                      LinkedIn: Micrylis Biotech
                    </a>
                    <a href="https://www.instagram.com/micrylis?igsh=cjR4ZGR1am1ubmI0" target="_blank" rel="noopener noreferrer" className="hover:underline text-foreground">
                      Instagram: @micrylis
                    </a>
                  </div>
                </div>
              </div>
            </LegalSection>
            
            <LegalSection title="Authentication & Trust">
              <p className="text-sm">
                All programs and mentorship sessions at Micrylis Biotech undergo careful curation. The contact channels provided above are our sole official points of communication. Micrylis Biotech will never ask for personal passwords or sensitive banking PINs.
              </p>
            </LegalSection>
          </div>
        </LegalLayout>
      </div>
    </>
  );
}


