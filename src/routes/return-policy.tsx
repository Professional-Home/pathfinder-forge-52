import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, LegalSection } from "@/components/LegalLayout";

export const Route = createFileRoute("/return-policy")({
  component: ReturnPolicy,
});

function ReturnPolicy() {
  return (
    <LegalLayout title="Return Policy" lastUpdated="July 8, 2026">
      <p>
        Thank you for choosing Micrylis. We strive to provide the best possible experience and high-quality digital services. Please read our Return Policy carefully before making any purchases or bookings.
      </p>

      <LegalSection title="1. Digital Products and Services">
        <p>
          Given the nature of our platform, the services provided—including but not limited to personalized dashboards, digital course content, and one-on-one mentorship sessions—are entirely digital. As such, once a service has been rendered or a digital product accessed, we generally cannot accept "returns" in the traditional sense.
        </p>
      </LegalSection>

      <LegalSection title="2. Mentorship Sessions">
        <p>
          Mentorship sessions are considered rendered once the session is completed. If you are unsatisfied with a session, you cannot "return" the session time, but you may be eligible for a refund according to our Refund Policy.
        </p>
        <p>
          If you need to cancel or reschedule a mentorship session, please do so at least 24 hours in advance to avoid any cancellation fees.
        </p>
      </LegalSection>

      <LegalSection title="3. Course Enrollments">
        <p>
          For digital courses and curriculum paths, your enrollment is considered final once you access the course material. We do not accept returns on digital course access, but please refer to our Refund Policy for specific guarantees or trial periods.
        </p>
      </LegalSection>

      <LegalSection title="4. Contact Us">
        <p>
          If you have any questions about this Return Policy or need assistance with a specific transaction, please contact us at support@micrylis.com.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
