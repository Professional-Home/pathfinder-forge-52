/**
 * Configuration for Webinars and Google Form Registration link.
 */

export const WEBINAR_REGISTRATION_URL = "https://forms.gle/7DjWS9Wsh2b2J4YbA";

export interface WebinarDetails {
  id: string;
  title: string;
  subtitle: string;
  shortDescription: string;
  fullDescription: string[];
  date: string;
  time: string;
  timezone: string;
  status: "open" | "upcoming" | "live" | "closed";
  statusText: string;
  mode: string;
  price: string;
  speaker: {
    name: string;
    role: string;
    organization: string;
    bio: string;
  };
  topics: string[];
  whoCanAttend: string[];
  prerequisites: string;
  highlights: {
    iconName: "Sparkles" | "Award" | "Compass" | "Users";
    title: string;
    description: string;
  }[];
  faqs: {
    question: string;
    answer: string;
  }[];
}

export const FEATURED_WEBINAR: WebinarDetails = {
  id: "bioinformatics-intro-2026",
  title: "Bioinformatics & Computational Biology",
  subtitle: "Bridging Biological Science and Computational Intelligence",
  shortDescription:
    "Explore the fascinating world of Bioinformatics and discover how biological data, Next-Gen Sequencing, and AI come together to solve modern scientific challenges.",
  fullDescription: [
    "This general introductory webinar is designed for anyone interested in understanding what Bioinformatics is, why it matters, where it is used, and how it is shaping the future of biological research and biotechnology.",
    "The session will provide a comprehensive overview of key concepts, real-world applications, cutting-edge technologies, and career opportunities in the field.",
    "Participants will gain a broad understanding of genomics, biological data analysis, computational tools, AI models in bio-computing, and modern research workflows.",
  ],
  date: "Saturday, August 29, 2026",
  time: "6:00 PM – 7:30 PM",
  timezone: "IST (GMT+5:30)",
  status: "open",
  statusText: "Registration Open",
  mode: "Live Online (Interactive)",
  price: "Free Registration",
  speaker: {
    name: "Dr. Micrylis Research Team",
    role: "Biotech & Bio-computing Specialists",
    organization: "Micrylis Biotech Research Labs",
    bio: "Lead bioinformaticians and researchers at Micrylis Biotech specializing in AI-driven drug discovery, Next-Generation Sequencing data analysis, and translational computational biology.",
  },
  topics: [
    "What is Bioinformatics & why it is transforming modern life sciences",
    "Major applications in Genomics, Drug Discovery, and Personalised Medicine",
    "Introduction to Next-Generation Sequencing (NGS) data pipelines",
    "How computational algorithms & databases decode biological complexity",
    "Role of Artificial Intelligence & Machine Learning in biological data",
    "Academic, industry research, and global career pathways in Bioinformatics",
    "Step-by-step roadmap to start your journey in Computational Biology",
  ],
  whoCanAttend: [
    "Undergraduate & Postgraduate students in Biotechnology, Life Sciences, Computer Science, and Data Science.",
    "Researchers, academicians, and lab professionals looking to expand into computational workflows.",
    "Biotech enthusiasts and career switchers curious about the intersection of biology and tech.",
    "No prior Bioinformatics or coding experience is required!",
  ],
  prerequisites: "Basic interest in biology or technology. No coding background needed.",
  highlights: [
    {
      iconName: "Sparkles",
      title: "Interactive Live Session",
      description: "Direct live interaction with domain experts and interactive Q&A session.",
    },
    {
      iconName: "Award",
      title: "Certificate of Participation",
      description: "Receive an official Micrylis Biotech Certificate of Attendance.",
    },
    {
      iconName: "Compass",
      title: "Career Roadmap",
      description: "Get curated learning resources and career paths in computational biology.",
    },
    {
      iconName: "Users",
      title: "Network & Collaborate",
      description: "Connect with like-minded students, researchers, and scientific mentors.",
    },
  ],
  faqs: [
    {
      question: "Is there any registration fee for this webinar?",
      answer: "No, this introductory webinar is 100% free to attend upon registration.",
    },
    {
      question: "How will I receive the joining link?",
      answer: "Once you register via the Google Form, the webinar access link and calendar invitation will be sent to your registered email address.",
    },
    {
      question: "Will I get a certificate of participation?",
      answer: "Yes, all registered participants who attend the live session will receive an official e-Certificate of Participation.",
    },
    {
      question: "Do I need programming knowledge to attend?",
      answer: "Not at all. The webinar is designed to be accessible to beginners with no prior coding or Bioinformatics experience.",
    },
  ],
};
