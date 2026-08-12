import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, LegalSection } from "@/components/LegalLayout";

export const Route = createFileRoute("/privacy-policy")({
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="11 August 2026">
      <div className="space-y-4">
        <p className="text-lg font-medium text-foreground">Micrylis Biotech</p>
        <p>
          Micrylis Biotech (&quot;Micrylis Biotech&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) respects your privacy and is committed to protecting the personal information and project-related information shared with us.
        </p>
        <p>
          This Privacy Policy explains how Micrylis Biotech collects, uses, stores, protects, and manages information when students, researchers, participants, mentors, applicants, collaborators, or other users (&quot;you&quot; or &quot;your&quot;) participate in our projects, research programs, training programs, innovation initiatives, incubation activities, websites, forms, communication channels, or other services.
        </p>
        <p>
          By registering for or participating in a Micrylis Biotech program or project, you acknowledge that you have read and understood this Privacy Policy.
        </p>
      </div>

      <LegalSection title="1. About Micrylis Biotech">
        <p>
          Micrylis Biotech is an innovation and biotechnology-focused organization that works with students, researchers, and aspiring innovators to identify real-world problems and develop practical solutions.
        </p>
        <p>Our programs may involve:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Problem identification and validation</li>
          <li>Research and innovation</li>
          <li>Biotechnology and life-science projects</li>
          <li>Product and technology development</li>
          <li>Proof-of-Concept (POC) development</li>
          <li>Prototype and MVP development</li>
          <li>Business-model development</li>
          <li>Mentorship and technical guidance</li>
          <li>Industry-oriented project development</li>
          <li>Grant-readiness and funding guidance</li>
          <li>Incubation-readiness and startup development</li>
        </ul>
        <p>
          Participants may be provided with problem statements, project ideas, research directions, technical resources, mentorship, and development frameworks to help them understand how an idea can progress from a problem &rarr; research &rarr; solution &rarr; POC &rarr; prototype/MVP &rarr; potential business or startup.
        </p>
        <p>
          Where a participant successfully develops a promising Proof of Concept, Micrylis Biotech may, at its discretion, provide further guidance regarding grants, incubation opportunities, commercialization, partnerships, or startup development. Such support is not guaranteed and may depend on project quality, feasibility, ownership, funding availability, evaluation outcomes, and applicable terms.
        </p>
      </LegalSection>

      <LegalSection title="2. Information We May Collect">
        <p>Depending on your interaction with Micrylis Biotech, we may collect the following information:</p>

        <div className="mt-4 space-y-4">
          <div>
            <h3 className="font-semibold text-foreground mb-2">A. Personal Information</h3>
            <p className="mb-2">This may include:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Full name</li>
              <li>Email address</li>
              <li>Phone/mobile number</li>
              <li>Educational institution</li>
              <li>Course, degree, or academic background</li>
              <li>Year/semester of study</li>
              <li>Professional information</li>
              <li>City/country</li>
              <li>Registration and application information</li>
              <li>Communication preferences</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-2">B. Program and Project Information</h3>
            <p className="mb-2">When you participate in our projects or programs, we may collect information such as:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Project title</li>
              <li>Problem statement</li>
              <li>Research objectives</li>
              <li>Project progress</li>
              <li>POC/prototype information</li>
              <li>Technical documentation</li>
              <li>Research findings</li>
              <li>Project presentations</li>
              <li>Reports and submissions</li>
              <li>Feedback and evaluation records</li>
              <li>Mentorship and project discussions</li>
              <li>Project-related communication</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-2">C. Communication Information</h3>
            <p>
              We may retain communications exchanged through approved channels, including email, forms, online meetings, messaging platforms, or other project-management/communication systems, where reasonably necessary for program administration, support, documentation, or dispute resolution.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-2">D. Technical Information</h3>
            <p className="mb-2">When you use our website or digital platforms, certain technical information may be collected automatically, such as:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>IP address</li>
              <li>Browser/device information</li>
              <li>Website activity</li>
              <li>Access timestamps</li>
              <li>Cookies and similar technologies</li>
              <li>Technical logs</li>
            </ul>
            <p className="mt-2">
              We use such information primarily to maintain security, improve functionality, and understand how our services are used.
            </p>
          </div>
        </div>
      </LegalSection>

      <LegalSection title="3. How We Use Your Information">
        <p>
          Micrylis Biotech may use collected information for legitimate business, educational, research, operational, and program-related purposes, including:
        </p>
        <ol className="list-decimal pl-5 space-y-1.5 mt-2">
          <li>Processing registrations and applications.</li>
          <li>Managing participation in projects and programs.</li>
          <li>Communicating project instructions, updates, schedules, and important information.</li>
          <li>Providing mentorship, technical guidance, and project support.</li>
          <li>Evaluating project progress and performance.</li>
          <li>Maintaining project and participant records.</li>
          <li>Coordinating workshops, meetings, presentations, and research activities.</li>
          <li>Supporting POC, prototype, MVP, and business-development activities.</li>
          <li>Providing information about relevant grants, incubation opportunities, competitions, or partnerships.</li>
          <li>Improving our programs, processes, curriculum, and project-development frameworks.</li>
          <li>Preventing fraud, misuse, unauthorized access, or other security issues.</li>
          <li>Complying with applicable legal and regulatory requirements.</li>
          <li>Communicating important administrative or service-related information.</li>
        </ol>
        <p className="mt-3">
          We will not use personal information for purposes materially unrelated to the purpose for which it was collected without an appropriate legal basis or, where required, your consent.
        </p>
      </LegalSection>

      <LegalSection title="4. Project Ideas, Research Information and Intellectual Property">
        <p>
          Micrylis Biotech understands that project ideas and research outputs may have significant academic, technical, commercial, or intellectual-property value.
        </p>
        <p>
          Accordingly, participants should avoid sharing confidential information that they are not authorized to disclose.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <h3 className="font-semibold text-foreground mb-2">4.1 Participant-Generated Work</h3>
            <p className="mb-2">
              Subject to any separate project agreement, terms of participation, IP agreement, institutional requirements, or applicable law, project outputs created by participants may remain subject to the ownership rights of the relevant participant(s) or their institution.
            </p>
            <p>
              Participation in a Micrylis Biotech project does not automatically mean that Micrylis Biotech owns every idea, invention, research result, design, code, document, or project output created by a participant.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-2">4.2 Micrylis Biotech Materials</h3>
            <p className="mb-2">
              Materials, frameworks, methodologies, templates, educational resources, project-management systems, proprietary processes, branding, software, databases, documentation, and other materials provided by Micrylis Biotech remain the property of Micrylis Biotech or their respective owners unless otherwise agreed in writing.
            </p>
            <p>
              Participants may not reproduce, sell, distribute, publish, license, or commercially exploit proprietary Micrylis Biotech materials without appropriate authorization.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-2">4.3 Joint Development</h3>
            <p className="mb-2">
              If Micrylis Biotech and a participant jointly develop a technology, invention, product, software, research output, or commercial opportunity, ownership, licensing, commercialization, revenue-sharing, attribution, confidentiality, and other intellectual-property matters may be governed by a separate written agreement.
            </p>
            <p>
              Where required, such matters should be clarified before commercial exploitation, grant submission, patent filing, licensing, or external disclosure.
            </p>
          </div>
        </div>
      </LegalSection>

      <LegalSection title="5. Confidentiality">
        <p>Participants may receive access to confidential information relating to:</p>
        <ul className="list-disc pl-5 space-y-1 my-2">
          <li>Micrylis Biotech</li>
          <li>Internal processes</li>
          <li>Research projects</li>
          <li>Business strategies</li>
          <li>Product concepts</li>
          <li>Technical approaches</li>
          <li>Partner information</li>
          <li>Other participants&apos; projects</li>
          <li>Unpublished research</li>
          <li>Potential inventions</li>
          <li>Commercial opportunities</li>
        </ul>
        <p className="mb-2">
          Such information should not be disclosed, copied, distributed, published, or commercially exploited without authorization where it is reasonably understood to be confidential.
        </p>
        <p className="mb-2">
          Participants are also responsible for protecting confidential information belonging to their educational institutions, research organizations, employers, collaborators, or other third parties.
        </p>
        <p>
          Where a project requires stronger confidentiality protection, Micrylis Biotech may use a separate Non-Disclosure Agreement (NDA), Project Agreement, IP Agreement, or Collaboration Agreement.
        </p>
      </LegalSection>

      <LegalSection title="6. Grants and Incubation Support">
        <p>
          Micrylis Biotech may provide guidance to participants whose projects demonstrate potential for further development. Such guidance may include:
        </p>
        <ul className="list-disc pl-5 space-y-1 my-2">
          <li>Grant-readiness guidance</li>
          <li>Funding opportunities</li>
          <li>Incubation-readiness</li>
          <li>Startup-development guidance</li>
          <li>Business-model development</li>
          <li>Pitch-deck preparation</li>
          <li>POC-to-MVP guidance</li>
          <li>Industry connections</li>
          <li>Mentorship</li>
          <li>Commercialization strategy</li>
        </ul>
        <p className="mt-3 mb-2 font-medium text-foreground">
          However, participation in a Micrylis Biotech program or successful completion of a project does not guarantee:
        </p>
        <ul className="list-disc pl-5 space-y-1 mb-2">
          <li>Grant funding</li>
          <li>Incubation</li>
          <li>Investment</li>
          <li>Patent approval</li>
          <li>Commercial success</li>
          <li>Employment</li>
          <li>Startup formation</li>
          <li>Revenue</li>
          <li>Partnership</li>
          <li>Market adoption</li>
        </ul>
        <p>
          Any grant, incubation, investment, partnership, or commercial opportunity will be subject to separate eligibility requirements, evaluation, institutional policies, third-party decisions, and applicable agreements.
        </p>
      </LegalSection>

      <LegalSection title="7. Sharing of Information">
        <p className="font-medium text-foreground mb-2">Micrylis Biotech does not sell your personal information.</p>
        <p>We may share information when reasonably necessary with:</p>
        <ul className="list-disc pl-5 space-y-1 my-2">
          <li>Authorized Micrylis Biotech team members</li>
          <li>Mentors and project supervisors</li>
          <li>Technology/service providers</li>
          <li>Communication and collaboration platforms</li>
          <li>Academic or institutional partners</li>
          <li>Grant or incubation organizations</li>
          <li>Industry or research partners</li>
          <li>Professional advisors</li>
          <li>Government or regulatory authorities where legally required</li>
        </ul>
        <p className="mt-2 mb-2">
          We aim to limit information sharing to what is reasonably necessary for the relevant purpose.
        </p>
        <p>
          Where third-party service providers process information on our behalf, we expect them to maintain appropriate confidentiality and security measures.
        </p>
      </LegalSection>

      <LegalSection title="8. Student and Participant Data">
        <p>For students and other participants, information may be used to:</p>
        <ul className="list-disc pl-5 space-y-1 my-2">
          <li>Verify registration</li>
          <li>Manage project participation</li>
          <li>Track project progress</li>
          <li>Provide mentorship</li>
          <li>Maintain attendance or participation records</li>
          <li>Issue certificates or participation records where applicable</li>
          <li>Evaluate project performance</li>
          <li>Communicate opportunities</li>
          <li>Maintain institutional records</li>
        </ul>
        <p className="mt-2 mb-2">Participants should provide accurate and updated information.</p>
        <p>
          If a participant is a minor or otherwise requires parental/guardian authorization under applicable law or program requirements, appropriate authorization may be required before participation.
        </p>
      </LegalSection>

      <LegalSection title="9. Cookies and Website Technologies">
        <p>Our website may use cookies, analytics tools, or similar technologies to:</p>
        <ul className="list-disc pl-5 space-y-1 my-2">
          <li>Improve website functionality</li>
          <li>Understand website usage</li>
          <li>Maintain security</li>
          <li>Remember preferences</li>
          <li>Improve user experience</li>
          <li>Analyze website performance</li>
        </ul>
        <p className="mt-2">
          You may be able to manage cookies through your browser or device settings. Disabling certain cookies may affect some website functionality.
        </p>
      </LegalSection>

      <LegalSection title="10. Data Security">
        <p>
          Micrylis Biotech takes reasonable measures to protect personal and project-related information against unauthorized access, alteration, disclosure, misuse, loss, or destruction.
        </p>
        <p className="mt-2 mb-1">Security measures may include:</p>
        <ul className="list-disc pl-5 space-y-1 mb-2">
          <li>Access controls</li>
          <li>Password protection</li>
          <li>Restricted internal access</li>
          <li>Secure communication systems</li>
          <li>Data-management procedures</li>
          <li>Appropriate technical safeguards</li>
          <li>Confidentiality obligations for authorized personnel</li>
        </ul>
        <p className="mb-2">However, no electronic system or method of transmission can be guaranteed to be completely secure.</p>
        <p>
          You should therefore avoid submitting highly sensitive information through unsecured communication channels unless specifically requested through an appropriate secure process.
        </p>
      </LegalSection>

      <LegalSection title="11. Data Retention">
        <p>We may retain personal and project-related information for as long as reasonably necessary for:</p>
        <ul className="list-disc pl-5 space-y-1 my-2">
          <li>Program administration</li>
          <li>Project documentation</li>
          <li>Academic or participation records</li>
          <li>Grant/incubation support</li>
          <li>Business and operational requirements</li>
          <li>Legal and regulatory obligations</li>
          <li>Security and dispute resolution</li>
          <li>Legitimate organizational purposes</li>
        </ul>
        <p className="mt-2">
          When information is no longer reasonably required, we may delete, anonymize, or securely dispose of it, subject to applicable legal, contractual, and operational requirements.
        </p>
      </LegalSection>

      <LegalSection title="12. Your Rights and Choices">
        <p>
          Depending on applicable law and the circumstances of processing, you may have rights regarding your personal data, including rights relating to:
        </p>
        <ul className="list-disc pl-5 space-y-1 my-2">
          <li>Accessing information about your personal data</li>
          <li>Requesting correction of inaccurate information</li>
          <li>Requesting deletion where legally applicable</li>
          <li>Withdrawing consent where processing is based on consent</li>
          <li>Raising concerns about the processing of your personal data</li>
          <li>Making a complaint regarding privacy practices</li>
        </ul>
        <p className="mt-2">
          India&apos;s Digital Personal Data Protection framework provides a statutory framework for processing digital personal data and recognizes individuals&apos; rights in relation to their personal data.
        </p>
        <p className="mt-2">Requests may be submitted using the contact information provided below.</p>
      </LegalSection>

      <LegalSection title="13. Withdrawal of Consent">
        <p>
          Where we process personal information based on your consent, you may request withdrawal of that consent, subject to applicable law and legitimate requirements.
        </p>
        <p className="mt-2">
          Withdrawal of consent may affect our ability to provide certain services, manage your participation, or continue specific activities.
        </p>
        <p className="mt-2">
          Withdrawal will not necessarily affect processing that we are permitted or required to conduct under another lawful basis.
        </p>
      </LegalSection>

      <LegalSection title="14. Third-Party Links and Platforms">
        <p>
          Our programs may use or link to third-party services such as communication platforms, video-conferencing tools, cloud-storage services, payment platforms, educational tools, registration forms, or external websites.
        </p>
        <p className="mt-2">
          Micrylis Biotech is not responsible for the privacy practices of independent third-party platforms.
        </p>
        <p className="mt-2">
          We encourage users to review the privacy policies and terms of those platforms before providing information.
        </p>
      </LegalSection>

      <LegalSection title="15. Publicity, Project Showcases and Success Stories">
        <p>
          With appropriate permission or where otherwise legally permitted, Micrylis Biotech may showcase selected projects, achievements, prototypes, research outcomes, or participant success stories for educational, research, promotional, or organizational purposes.
        </p>
        <p className="mt-2">
          Where a project contains confidential information, patent-sensitive information, trade secrets, or other protected information, participants should notify Micrylis Biotech before public disclosure.
        </p>
        <p className="mt-2">
          Participants should not assume that a project will remain confidential if they voluntarily publish or publicly disclose the underlying information themselves.
        </p>
      </LegalSection>

      <LegalSection title="16. Children's Privacy">
        <p>
          Our programs may involve students. We take additional care when dealing with individuals who may be children or minors.
        </p>
        <p className="mt-2">
          Where applicable law or program requirements require parental or guardian consent, we will seek appropriate authorization before collecting or processing information.
        </p>
        <p className="mt-2">
          If you believe that a minor has provided personal information without appropriate authorization, please contact us so that we can review the matter.
        </p>
      </LegalSection>

      <LegalSection title="17. Changes to This Privacy Policy">
        <p>Micrylis Biotech may update this Privacy Policy from time to time to reflect changes in:</p>
        <ul className="list-disc pl-5 space-y-1 my-2">
          <li>Our services</li>
          <li>Our programs</li>
          <li>Technology</li>
          <li>Business practices</li>
          <li>Applicable laws</li>
          <li>Regulatory requirements</li>
        </ul>
        <p className="mt-2">
          The updated version will be published through our website or relevant communication channel with a revised &quot;Last Updated&quot; date.
        </p>
      </LegalSection>

      <LegalSection title="18. Contact Us">
        <p>
          If you have questions, concerns, requests, or complaints regarding this Privacy Policy or the handling of your personal information, please contact:
        </p>
        <div className="mt-3 p-4 rounded-lg bg-muted/40 border border-border/60 space-y-1 text-sm">
          <p className="font-semibold text-foreground">Micrylis Biotech</p>
          <p>Email: <a href="mailto:privacy@micrylis.com" className="text-primary hover:underline">privacy@micrylis.com</a></p>
          <p>Website: <a href="https://micrylis.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">https://micrylis.com</a></p>
          <p>Privacy Contact: Privacy & Data Protection Officer</p>
        </div>
        <p className="mt-3">
          We will make reasonable efforts to review and respond to privacy-related requests in accordance with applicable law and our internal procedures.
        </p>
      </LegalSection>

      <LegalSection title="19. Important Notice">
        <p>
          This Privacy Policy explains how Micrylis Biotech handles personal information and certain project-related information. It does not replace any separate:
        </p>
        <ul className="list-disc pl-5 space-y-1 my-2">
          <li>Project Agreement</li>
          <li>Terms &amp; Conditions</li>
          <li>NDA</li>
          <li>Intellectual Property Agreement</li>
          <li>Internship Agreement</li>
          <li>Collaboration Agreement</li>
          <li>Grant Agreement</li>
          <li>Incubation Agreement</li>
          <li>Employment Agreement</li>
        </ul>
        <p className="mt-2">
          Where a separate written agreement exists, that agreement may contain additional or specific provisions regarding confidentiality, intellectual property, ownership, commercialization, project deliverables, and participant responsibilities.
        </p>
        <p className="mt-3 font-medium text-foreground">
          By participating in Micrylis Biotech programs or projects, you acknowledge that you have read and understood this Privacy Policy and agree to the applicable processing of your information as described above.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}

