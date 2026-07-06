export type Lane = "student" | "startup" | "researcher";

export interface User {
  id: string;
  name: string;
  avatar: string;
  email: string;
  lane: Lane;
  activeTrack: {
    name: string;
    progress: number;
    currentModule: number;
    totalModules: number;
    currentLessonId: string;
    moduleName: string;
  };
  skillRadar: {
    visual: number;
    interaction: number;
    research: number;
    prototyping: number;
  };
  bookmarks: string[];
  readHistory: string[];
  enrolledCourses: { courseId: string; progress: number }[];
  bookedMentors: { mentorId: string; date: string }[];
  certificates: { certId: string; issuedDate: string }[];
  paymentHistory: { txnId: string; amount: number; date: string; type: string }[];
}

export const mockUser: User = {
  id: "u_1",
  name: "Alex",
  avatar: "A",
  email: "alex@example.com",
  lane: "student",
  activeTrack: {
    name: "Product Design",
    progress: 62,
    currentModule: 4,
    totalModules: 7,
    currentLessonId: "l_104",
    moduleName: "Interaction patterns",
  },
  skillRadar: {
    visual: 55,
    interaction: 45,
    research: 70,
    prototyping: 30, // Prototyping is lowest, triggering specific guidance
  },
  bookmarks: ["g_1"],
  readHistory: ["g_2"],
  enrolledCourses: [
    { courseId: "c_1", progress: 62 },
  ],
  bookedMentors: [
    { mentorId: "m_1", date: "Thursday · 4:00 PM" },
  ],
  certificates: [],
  paymentHistory: [],
};
