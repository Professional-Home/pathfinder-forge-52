import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, LegalSection } from "@/components/LegalLayout";

export const Route = createFileRoute("/privacy-policy")({
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="July 8, 2026">
      <p>
        Micrylis ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website or use our application.
      </p>

      <LegalSection title="1. Information We Collect">
        <p>We may collect information about you in a variety of ways. The information we may collect via the Application includes:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Personal Data:</strong> Personally identifiable information, such as your name, email address, and demographic information that you voluntarily give to us when you register.</li>
          <li><strong>Derivative Data:</strong> Information our servers automatically collect when you access the application, such as your IP address, your browser type, your operating system, and your access times.</li>
          <li><strong>Financial Data:</strong> Data related to your payment method (e.g., valid credit card number, card brand, expiration date) that we may collect when you purchase or order services.</li>
        </ul>
      </LegalSection>

      <LegalSection title="2. Use of Your Information">
        <p>Having accurate information about you permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you via the Application to:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Create and manage your account.</li>
          <li>Process your transactions and send related information, including confirmations and receipts.</li>
          <li>Match you with relevant mentors, courses, and personalized growth paths.</li>
          <li>Send you emails regarding your account or order.</li>
          <li>Fulfill and manage purchases, orders, payments, and other transactions.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Disclosure of Your Information">
        <p>We may share information we have collected about you in certain situations. Your information may be disclosed as follows:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>By Law or to Protect Rights:</strong> If we believe the release of information about you is necessary to respond to legal process or to investigate or remedy potential violations of our policies.</li>
          <li><strong>Third-Party Service Providers:</strong> We may share your information with third parties that perform services for us or on our behalf, including payment processing, data analysis, email delivery, hosting services, and customer service.</li>
          <li><strong>Mentors:</strong> With your consent, we may share relevant background information with mentors you choose to book, to facilitate a productive session.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Security of Your Information">
        <p>
          We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable.
        </p>
      </LegalSection>

      <LegalSection title="5. Contact Us">
        <p>
          If you have questions or comments about this Privacy Policy, please contact us at privacy@micrylis.com.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
