import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, LegalSection } from "@/components/LegalLayout";

export const Route = createFileRoute("/refund-policy")({
  component: RefundPolicy,
});

function RefundPolicy() {
  return (
    <LegalLayout title="Refund Policy" lastUpdated="July 8, 2026">
      <p>
        At Micrylis, we want you to be completely satisfied with your learning and mentorship experience. Our refund policy outlines the conditions under which you may be eligible for a refund.
      </p>

      <LegalSection title="1. Mentorship Sessions">
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Cancellations:</strong> You may cancel a scheduled mentorship session up to 24 hours before the start time for a full refund.</li>
          <li><strong>No-Shows:</strong> If you fail to attend a scheduled session without prior notice, no refund will be issued.</li>
          <li><strong>Quality Guarantee:</strong> If you feel the mentorship session did not meet professional standards, you must contact our support team within 48 hours of the session. We will review the case and may, at our discretion, issue a partial or full refund.</li>
        </ul>
      </LegalSection>

      <LegalSection title="2. Course Subscriptions & Purchases">
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>7-Day Money-Back Guarantee:</strong> For most standalone course purchases, we offer a 7-day money-back guarantee. If you are not satisfied, you may request a refund within 7 days of purchase, provided you have completed less than 20% of the course material.</li>
          <li><strong>Subscriptions:</strong> Monthly or annual subscriptions can be canceled at any time. Cancellations apply to the next billing cycle; we do not prorate or refund partial months.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Processing Refunds">
        <p>
          Approved refunds will be processed within 5-10 business days and credited back to the original method of payment.
        </p>
      </LegalSection>

      <LegalSection title="4. Exceptions">
        <p>
          Micrylis reserves the right to deny refund requests if we detect abuse of our policy, such as repeatedly purchasing and requesting refunds for courses or sessions.
        </p>
      </LegalSection>
      
      <LegalSection title="Contact Information">
        <p>
          To request a refund or if you have any questions, please reach out to our billing team at billing@micrylis.com.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
