import { createServerFn } from "@tanstack/react-start";
import {
  submitCourseApplicationCore,
  claimGuestApplicationCore,
  createDocumentUploadTicketCore,
  confirmDocumentUploadCore,
  adminTransitionApplicationCore,
  adminUpdatePaymentStatusCore,
  getAdminApplicationsListCore,
  getAdminApplicationDetailCore,
  getStudentApplicationTrackingCore,
  SubmitApplicationInput,
  ClaimApplicationInput,
  CreateUploadTicketInput,
  ConfirmUploadInput,
  AdminTransitionInput,
  AdminUpdatePaymentInput,
  AdminApplicationsFilterInput,
} from "@/lib/server/course-applications";

// ─── 1. Submit Course Application (Guest & Authenticated) ───

export const submitCourseApplication = createServerFn({ method: "POST" })
  .validator((input: SubmitApplicationInput) => input)
  .handler(async ({ data }) => submitCourseApplicationCore(data));

// ─── 2. Claim Guest Application (DEC-02) ───

export const claimGuestApplication = createServerFn({ method: "POST" })
  .validator((input: ClaimApplicationInput) => input)
  .handler(async ({ data }) => claimGuestApplicationCore(data));

// ─── 3. Create Document Upload Ticket ───

export const createDocumentUploadTicket = createServerFn({ method: "POST" })
  .validator((input: CreateUploadTicketInput) => input)
  .handler(async ({ data }) => createDocumentUploadTicketCore(data));

// ─── 4. Confirm Document Upload ───

export const confirmDocumentUpload = createServerFn({ method: "POST" })
  .validator((input: ConfirmUploadInput) => input)
  .handler(async ({ data }) => confirmDocumentUploadCore(data));

// ─── 5. Admin Transition Application Status (DEC-03) ───

export const adminTransitionApplication = createServerFn({ method: "POST" })
  .validator((input: AdminTransitionInput) => input)
  .handler(async ({ data }) => adminTransitionApplicationCore(data));

// ─── 6. Admin Update Payment Status ───

export const adminUpdatePaymentStatus = createServerFn({ method: "POST" })
  .validator((input: AdminUpdatePaymentInput) => input)
  .handler(async ({ data }) => adminUpdatePaymentStatusCore(data));

// ─── 7. Admin Applications Queue List ───

export const getAdminApplicationsList = createServerFn({ method: "POST" })
  .validator((input?: AdminApplicationsFilterInput) => input || {})
  .handler(async ({ data }) => getAdminApplicationsListCore(data));

// ─── 8. Admin Application Dossier Detail ───

export const getAdminApplicationDetail = createServerFn({ method: "POST" })
  .validator((input: { applicationId: string; authToken?: string }) => input)
  .handler(async ({ data }) => getAdminApplicationDetailCore(data));

// ─── 9. Student Status Tracking Lookup ───

export const getStudentApplicationTracking = createServerFn({ method: "POST" })
  .validator((input: { applicationNumber: string; applicantEmail: string }) => input)
  .handler(async ({ data }) => getStudentApplicationTrackingCore(data));
