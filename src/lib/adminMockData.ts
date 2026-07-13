export type CourseStatus = "published" | "draft";
export type CourseDifficulty = "beginner" | "intermediate" | "advanced";
export type EnrollmentStatus = "active" | "completed" | "pending" | "cancelled";
export type MentorStatus = "active" | "inactive";
export type SessionStatus = "upcoming" | "completed" | "cancelled";

export type AdminCourse = {
  id: string;
  title: string;
  description: string;
  category: string;
  duration: string;
  difficulty: CourseDifficulty;
  status: CourseStatus;
  thumbnail: string;
  studentsEnrolled: number;
  createdAt: string;
};

export type AdminEnrollment = {
  id: string;
  studentName: string;
  studentEmail: string;
  courseName: string;
  courseId: string;
  status: EnrollmentStatus;
  enrollmentDate: string;
  progress: number;
};

export type AdminMentor = {
  id: string;
  name: string;
  email: string;
  expertise: string[];
  experience: string;
  coursesAssigned: string[];
  status: MentorStatus;
  avatar: string;
};

export type AdminGuidanceSession = {
  id: string;
  studentName: string;
  studentEmail: string;
  courseName: string;
  mentorName: string;
  mentorId: string;
  sessionDate: string;
  sessionTime: string;
  status: SessionStatus;
  notes: string;
};

export const INITIAL_COURSES: AdminCourse[] = [
  {
    id: "c1",
    title: "UX Foundations",
    description: "Learn the core principles of user experience design.",
    category: "Design",
    duration: "6 weeks",
    difficulty: "beginner",
    status: "published",
    thumbnail: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=240&fit=crop",
    studentsEnrolled: 142,
    createdAt: "2025-11-12",
  },
  {
    id: "c2",
    title: "Startup Growth Playbook",
    description: "Tactics for early-stage founders to find product-market fit.",
    category: "Business",
    duration: "4 weeks",
    difficulty: "intermediate",
    status: "published",
    thumbnail: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=240&fit=crop",
    studentsEnrolled: 89,
    createdAt: "2025-12-01",
  },
  {
    id: "c3",
    title: "Research Methods 101",
    description: "Introduction to qualitative and quantitative research methods.",
    category: "Research",
    duration: "8 weeks",
    difficulty: "beginner",
    status: "draft",
    thumbnail: "https://images.unsplash.com/photo-1503676260728-1c00da280a02?w=400&h=240&fit=crop",
    studentsEnrolled: 0,
    createdAt: "2026-01-15",
  },
  {
    id: "c4",
    title: "Advanced Prototyping",
    description: "High-fidelity prototyping with modern design tools.",
    category: "Design",
    duration: "5 weeks",
    difficulty: "advanced",
    status: "published",
    thumbnail: "https://images.unsplash.com/photo-1586717791821-3f44a563fa4c?w=400&h=240&fit=crop",
    studentsEnrolled: 56,
    createdAt: "2026-02-03",
  },
  {
    id: "c5",
    title: "Pitch Deck Mastery",
    description: "Craft compelling investor presentations.",
    category: "Business",
    duration: "3 weeks",
    difficulty: "intermediate",
    status: "draft",
    thumbnail: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=400&h=240&fit=crop",
    studentsEnrolled: 0,
    createdAt: "2026-02-20",
  },
  {
    id: "c6",
    title: "Data Visualization",
    description: "Communicate insights through effective data viz.",
    category: "Research",
    duration: "6 weeks",
    difficulty: "intermediate",
    status: "published",
    thumbnail: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=240&fit=crop",
    studentsEnrolled: 73,
    createdAt: "2026-03-01",
  },
];

export const INITIAL_ENROLLMENTS: AdminEnrollment[] = [
  {
    id: "e1",
    studentName: "Priya Sharma",
    studentEmail: "priya@email.com",
    courseName: "UX Foundations",
    courseId: "c1",
    status: "active",
    enrollmentDate: "2026-01-10",
    progress: 68,
  },
  {
    id: "e2",
    studentName: "James Chen",
    studentEmail: "james@email.com",
    courseName: "Startup Growth Playbook",
    courseId: "c2",
    status: "completed",
    enrollmentDate: "2025-12-15",
    progress: 100,
  },
  {
    id: "e3",
    studentName: "Aisha Patel",
    studentEmail: "aisha@email.com",
    courseName: "UX Foundations",
    courseId: "c1",
    status: "active",
    enrollmentDate: "2026-02-01",
    progress: 42,
  },
  {
    id: "e4",
    studentName: "Marcus Johnson",
    studentEmail: "marcus@email.com",
    courseName: "Advanced Prototyping",
    courseId: "c4",
    status: "pending",
    enrollmentDate: "2026-03-05",
    progress: 0,
  },
  {
    id: "e5",
    studentName: "Elena Torres",
    studentEmail: "elena@email.com",
    courseName: "Data Visualization",
    courseId: "c6",
    status: "active",
    enrollmentDate: "2026-02-18",
    progress: 25,
  },
  {
    id: "e6",
    studentName: "David Kim",
    studentEmail: "david@email.com",
    courseName: "Startup Growth Playbook",
    courseId: "c2",
    status: "cancelled",
    enrollmentDate: "2026-01-22",
    progress: 15,
  },
  {
    id: "e7",
    studentName: "Sofia Martinez",
    studentEmail: "sofia@email.com",
    courseName: "Advanced Prototyping",
    courseId: "c4",
    status: "active",
    enrollmentDate: "2026-02-28",
    progress: 55,
  },
  {
    id: "e8",
    studentName: "Ryan O'Brien",
    studentEmail: "ryan@email.com",
    courseName: "Data Visualization",
    courseId: "c6",
    status: "completed",
    enrollmentDate: "2025-11-30",
    progress: 100,
  },
];

export const INITIAL_MENTORS: AdminMentor[] = [
  {
    id: "m1",
    name: "Elena Torres",
    email: "elena.t@micrylis.com",
    expertise: ["UX Design", "Portfolio Review", "Career Coaching"],
    experience: "12 years · Design Lead at Figma",
    coursesAssigned: ["UX Foundations", "Advanced Prototyping"],
    status: "active",
    avatar: "E",
  },
  {
    id: "m2",
    name: "Jonas Weber",
    email: "jonas.w@micrylis.com",
    expertise: ["Engineering", "System Design", "Interview Prep"],
    experience: "10 years · Sr. Engineer at Stripe",
    coursesAssigned: ["Startup Growth Playbook"],
    status: "active",
    avatar: "J",
  },
  {
    id: "m3",
    name: "Dr. Amara Okafor",
    email: "amara.o@micrylis.com",
    expertise: ["Research Methods", "Academic Writing", "Data Analysis"],
    experience: "15 years · Professor at MIT",
    coursesAssigned: ["Research Methods 101", "Data Visualization"],
    status: "active",
    avatar: "A",
  },
  {
    id: "m4",
    name: "Kwame Osei",
    email: "kwame.o@micrylis.com",
    expertise: ["Recruiting", "Resume Review", "Networking"],
    experience: "8 years · Talent Lead at Google",
    coursesAssigned: [],
    status: "inactive",
    avatar: "K",
  },
];

export const INITIAL_SESSIONS: AdminGuidanceSession[] = [
  {
    id: "s1",
    studentName: "Priya Sharma",
    studentEmail: "priya@email.com",
    courseName: "UX Foundations",
    mentorName: "Elena Torres",
    mentorId: "m1",
    sessionDate: "2026-03-15",
    sessionTime: "10:00 AM",
    status: "upcoming",
    notes: "Portfolio review session — bring 3 case studies.",
  },
  {
    id: "s2",
    studentName: "James Chen",
    studentEmail: "james@email.com",
    courseName: "Startup Growth Playbook",
    mentorName: "Jonas Weber",
    mentorId: "m2",
    sessionDate: "2026-03-18",
    sessionTime: "2:00 PM",
    status: "upcoming",
    notes: "Pitch deck feedback and go-to-market strategy.",
  },
  {
    id: "s3",
    studentName: "Aisha Patel",
    studentEmail: "aisha@email.com",
    courseName: "UX Foundations",
    mentorName: "Elena Torres",
    mentorId: "m1",
    sessionDate: "2026-02-28",
    sessionTime: "4:00 PM",
    status: "completed",
    notes: "Completed initial design critique. Follow-up scheduled.",
  },
  {
    id: "s4",
    studentName: "Elena Torres",
    studentEmail: "elena@email.com",
    courseName: "Data Visualization",
    mentorName: "Dr. Amara Okafor",
    mentorId: "m3",
    sessionDate: "2026-02-20",
    sessionTime: "11:00 AM",
    status: "completed",
    notes: "Reviewed chart selection and narrative structure.",
  },
  {
    id: "s5",
    studentName: "Marcus Johnson",
    studentEmail: "marcus@email.com",
    courseName: "Advanced Prototyping",
    mentorName: "Elena Torres",
    mentorId: "m1",
    sessionDate: "2026-03-22",
    sessionTime: "9:00 AM",
    status: "upcoming",
    notes: "Figma advanced components walkthrough.",
  },
  {
    id: "s6",
    studentName: "David Kim",
    studentEmail: "david@email.com",
    courseName: "Startup Growth Playbook",
    mentorName: "Jonas Weber",
    mentorId: "m2",
    sessionDate: "2026-01-30",
    sessionTime: "3:00 PM",
    status: "cancelled",
    notes: "Student requested cancellation.",
  },
];

export const DASHBOARD_STATS = {
  totalCourses: 6,
  publishedCourses: 4,
  draftCourses: 2,
  totalStudents: 1248,
  totalMentors: 4,
  upcomingSessions: 3,
};

export const ENROLLMENT_CHART_DATA = [
  { month: "Oct", enrollments: 45 },
  { month: "Nov", enrollments: 62 },
  { month: "Dec", enrollments: 78 },
  { month: "Jan", enrollments: 95 },
  { month: "Feb", enrollments: 112 },
  { month: "Mar", enrollments: 88 },
];

export const COURSE_CATEGORY_DATA = [
  { category: "Design", count: 2 },
  { category: "Business", count: 2 },
  { category: "Research", count: 2 },
];
