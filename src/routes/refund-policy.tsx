import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, LegalSection } from "@/components/LegalLayout";

export const Route = createFileRoute("/refund-policy")({
  component: RefundPolicy,
});

function RefundPolicy() {
  return (
    <LegalLayout title="Refund Policy" lastUpdated="August 15, 2026">
      <p>
        This Refund Policy explains the terms under which students enrolled in the Micrylis Biotech Student Research Project via paying fees of ₹1,499 for domestic students / $49.99 for international students may request and receive a refund. We want every student to have a fair, transparent path to raise concerns about their experience, while also protecting the integrity and resources of the program for all participants. Please read this policy carefully before enrolling.
      </p>

      <LegalSection title="1. Refund Eligibility">
        <p>Students may be eligible for a refund under either of the following conditions:</p>

        <h3 className="font-display text-base font-semibold text-foreground mt-4">1.1 Satisfaction-Based Eligibility</h3>
        <p>
          If a student is not satisfied with the outcomes or quality of the research project, they may request a refund within 7 days of the program start date, provided:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>The student has attended and actively participated in at least 5 scheduled sessions or milestones, and</li>
          <li>The student submits written feedback explaining the reason for dissatisfaction, which allows Micrylis Biotech to understand and, where possible, address the concern.</li>
        </ul>

        <h3 className="font-display text-base font-semibold text-foreground mt-4">1.2 Performance-Based Eligibility</h3>
        <p>
          The student has not completed or been credited for any major deliverable, project milestone, or certificate of completion.
        </p>
      </LegalSection>

      <LegalSection title="2. Refund Process">
        <p>To request a refund, students must:</p>
        <ol className="list-decimal pl-5 space-y-2">
          <li>Submit a written refund request via email to micrylisbiotech@gmail.com, including their full name, payment reference, and reason for the request.</li>
          <li>Allow the Micrylis Biotech team up to 5 business days to review the request.</li>
          <li>Respond promptly to any follow-up questions needed to process the request.</li>
        </ol>
        <p>
          Approved refunds will be processed to the original method of payment within 2 business days of approval. International payments (in USD) may take additional time to reflect, depending on the student's bank or payment provider.
        </p>
      </LegalSection>

      <LegalSection title="3. Refund Amount">
        <ul className="list-disc pl-5 space-y-2">
          <li>Refunds approved under this policy will be issued at 75% of the amount paid, less any non-refundable processing or transaction fees charged by the payment gateway.</li>
          <li>Micrylis Biotech reserves the right to prorate refunds based on the portion of the program already delivered or accessed by the student.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Conditions That Disqualify a Refund">
        <p>A refund request will not be approved under the following circumstances:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>The request is submitted after the eligibility window stated in Section 1 has closed.</li>
          <li>The student has completed the research project or received a certificate of completion.</li>
          <li>The student has accessed or downloaded a substantial portion of the program's proprietary materials, research templates, or datasets.</li>
          <li>The refund request is based on a change of personal preference or scheduling conflict unrelated to program quality or delivery, after the eligibility window has passed.</li>
          <li>There is evidence of a violation of the program's code of conduct, academic integrity policy, or terms of enrollment.</li>
          <li>The student was removed from the program for disciplinary reasons.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Appeals">
        <p>
          If a refund request is denied and the student believes there are extenuating circumstances, they may submit a written appeal to micrylisbiotech@gmail.com within 5 days of receiving the denial. Appeals will be reviewed by Karan Pachal, Founder of Micrylis Biotech and a final decision will be communicated within 2 business days. Decisions at the appeal stage are final.
        </p>
      </LegalSection>

      <LegalSection title="6. Changes to This Policy">
        <p>
          Micrylis Biotech reserves the right to update or modify this Refund Policy at any time. Any changes will apply to new enrollments from the date of publication and will not retroactively affect students who enrolled under a prior version of this policy, unless required by law.
        </p>
      </LegalSection>

      <LegalSection title="7. Contact Us">
        <p>For questions about this policy or to submit a refund request, please contact:</p>
        <div className="mt-2 space-y-1">
          <p className="font-medium text-foreground">Micrylis Biotech</p>
          <p>Email: micrylisbiotech@gmail.com</p>
          <p>Phone: +91 88490 05635</p>
        </div>
      </LegalSection>

      <div className="mt-8 border-t border-border/60 pt-6">
        <p className="text-xs text-muted-foreground">
          This policy is intended to provide a clear, fair framework for refund requests. It does not limit any statutory rights a student may have under applicable consumer protection laws in their jurisdiction.
        </p>
      </div>
    </LegalLayout>
  );
}
