import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, LegalSection } from "@/components/LegalLayout";

export const Route = createFileRoute("/disclaimer")({
  component: Disclaimer,
});

function Disclaimer() {
  return (
    <LegalLayout title="Disclaimer" lastUpdated="July 8, 2026">
      <p>
        The information provided by Micrylis ("we," "us," or "our") on our website and application is for general informational and educational purposes only. All information on the site is provided in good faith, however, we make no representation or warranty of any kind, express or implied, regarding the accuracy, adequacy, validity, reliability, availability, or completeness of any information.
      </p>

      <LegalSection title="1. Professional Mentorship Disclaimer">
        <p>
          Micrylis connects users with independent mentors across various domains (e.g., student, startup, researcher). The advice, guidance, and opinions expressed by mentors during sessions are their own and do not necessarily reflect the views of Micrylis.
        </p>
        <p>
          Mentorship and guidance provided through our platform do not constitute formal professional advice (such as legal, financial, or medical advice). You should not act or refrain from acting on the basis of any content provided on this site or during mentorship sessions without seeking independent professional advice.
        </p>
      </LegalSection>

      <LegalSection title="2. Career and Success Guarantee">
        <p>
          While we strive to provide excellent educational resources and connect you with top-tier mentors, we cannot and do not guarantee any specific outcomes, career advancements, business successes, or academic results resulting from the use of our services.
        </p>
        <p>
          Your success depends primarily on your own effort, motivation, commitment, and follow-through. We do not make any guarantees about the results of the information applied.
        </p>
      </LegalSection>

      <LegalSection title="3. External Links Disclaimer">
        <p>
          Our platform may contain links to external websites that are not provided or maintained by or in any way affiliated with Micrylis. Please note that we do not guarantee the accuracy, relevance, timeliness, or completeness of any information on these external websites.
        </p>
      </LegalSection>

      <LegalSection title="4. Errors and Omissions">
        <p>
          While we have made every attempt to ensure that the information contained on this site has been obtained from reliable sources, Micrylis is not responsible for any errors or omissions, or for the results obtained from the use of this information.
        </p>
      </LegalSection>

      <LegalSection title="Contact Us">
        <p>
          If you require any more information or have any questions about our site's disclaimer, please feel free to contact us by email at legal@micrylis.com.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
