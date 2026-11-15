import React, { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/utils/supabase";
import { fetchCourseBySlug } from "@/lib/courses/store";
import {
  submitCourseApplication,
  createDocumentUploadTicket,
  confirmDocumentUpload,
} from "@/lib/course-applications-server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  CheckCircle2,
  AlertCircle,
  Upload,
  FileText,
  User,
  GraduationCap,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Clock,
  Copy,
  Check,
} from "lucide-react";

export const Route = createFileRoute("/apply/$courseSlug")({
  component: CourseApplicationPage,
  loader: async ({ params }: { params: any }) => {
    const slug = params?.courseSlug || "";
    const course = await fetchCourseBySlug(slug);
    return { course, courseSlug: slug };
  },
});

interface UploadedFileState {
  file: File;
  docType: "academic_transcript" | "cv_resume" | "id_proof" | "statement_of_purpose";
  status: "pending" | "uploading" | "uploaded" | "error";
  error?: string;
  ticketId?: string;
}

export function CourseApplicationPage() {
  const loaderData: any = Route.useLoaderData();
  const course = loaderData?.course;
  const courseSlug = loaderData?.courseSlug || "";
  const navigate = useNavigate();

  // Authentication & Applicant Profile
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Form State
  const [applicantName, setApplicantName] = useState("");
  const [applicantEmail, setApplicantEmail] = useState("");
  const [applicantPhone, setApplicantPhone] = useState("");
  const [highestQualification, setHighestQualification] = useState("Undergraduate");
  const [fieldOfStudy, setFieldOfStudy] = useState("");
  const [institution, setInstitution] = useState("");
  const [graduationYear, setGraduationYear] = useState(new Date().getFullYear().toString());
  const [statementOfPurpose, setStatementOfPurpose] = useState("");

  // Uploaded documents state
  const [documents, setDocuments] = useState<Record<string, UploadedFileState>>({});

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<{
    applicationNumber: string;
    isGuest: boolean;
    claimToken?: string | null;
  } | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUser(user);
          setApplicantEmail(user.email || "");
          const metaName = user.user_metadata?.full_name || user.user_metadata?.name;
          if (metaName) setApplicantName(metaName);
        }
      } catch (err) {
        console.warn("Auth check error:", err);
      } finally {
        setAuthChecked(true);
      }
    }
    checkAuth();
  }, []);

  // Validate file signature (magic bytes) and size (10 MB DEC-04)
  const validateFile = async (file: File): Promise<{ valid: boolean; error?: string }> => {
    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_SIZE) {
      return { valid: false, error: "File exceeds maximum size of 10 MB (DEC-04)." };
    }

    const slice = file.slice(0, 8);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

    if (!isPdf && !isPng && !isJpg) {
      return {
        valid: false,
        error: "Invalid file type. Only authentic PDF, PNG, and JPEG documents are permitted (DEC-04).",
      };
    }

    return { valid: true };
  };

  const handleFileChange = async (
    docType: "academic_transcript" | "cv_resume" | "id_proof" | "statement_of_purpose",
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = await validateFile(file);
    if (!validation.valid) {
      setDocuments((prev) => ({
        ...prev,
        [docType]: { file, docType, status: "error", error: validation.error },
      }));
      return;
    }

    setDocuments((prev) => ({
      ...prev,
      [docType]: { file, docType, status: "pending" },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!applicantName.trim() || !applicantEmail.trim()) {
      setFormError("Applicant full name and email address are required.");
      return;
    }

    if (!statementOfPurpose.trim() || statementOfPurpose.trim().length < 50) {
      setFormError("Statement of purpose must be at least 50 characters detailing your interest.");
      return;
    }

    if (!documents["academic_transcript"] || documents["academic_transcript"].status === "error") {
      setFormError("An Academic Transcript or marksheet document is required.");
      return;
    }

    setSubmitting(true);

    try {
      // 1. Submit Core Application
      const appRes = await (submitCourseApplication as any)({
        data: {
          courseSlug,
          applicantName: applicantName.trim(),
          applicantEmail: applicantEmail.trim().toLowerCase(),
          applicantPhone: applicantPhone.trim() || undefined,
          highestQualification,
          fieldOfStudy: fieldOfStudy.trim(),
          institution: institution.trim(),
          graduationYear: parseInt(graduationYear, 10) || undefined,
          statementOfPurpose: statementOfPurpose.trim(),
          guestMode: !currentUser,
        },
      });

      if (!appRes.success) {
        setFormError(appRes.error || "Failed to submit course application.");
        setSubmitting(false);
        return;
      }

      const applicationId = appRes.applicationId;
      const applicationNumber = appRes.applicationNumber;

      // 2. Upload Document Files
      for (const [docKey, docState] of Object.entries(documents)) {
        if (docState.status === "error" || !docState.file) continue;

        try {
          // Request upload ticket with signed URL
          const ticketRes = await (createDocumentUploadTicket as any)({
            data: {
              applicationId,
              documentType: docState.docType,
              fileName: docState.file.name,
              fileSize: docState.file.size,
              mimeType: docState.file.type || "application/octet-stream",
            },
          });

          if (ticketRes.success && ticketRes.signedUploadUrl) {
            // Upload to Supabase Storage via PUT/Signed URL
            const uploadRes = await fetch(ticketRes.signedUploadUrl, {
              method: "PUT",
              headers: {
                "Content-Type": docState.file.type || "application/octet-stream",
              },
              body: docState.file,
            });

            if (uploadRes.ok) {
              await (confirmDocumentUpload as any)({
                data: {
                  documentId: ticketRes.documentId,
                  storagePath: ticketRes.storagePath,
                },
              });
            }
          }
        } catch (uploadErr) {
          console.error(`Document upload error for ${docKey}:`, uploadErr);
        }
      }

      setSubmissionResult({
        applicationNumber,
        isGuest: !currentUser,
        claimToken: appRes.claimToken || null,
      });
    } catch (err: any) {
      console.error("Submission failed:", err);
      setFormError(err.message || "An unexpected error occurred during submission.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyClaimToken = () => {
    if (submissionResult?.claimToken) {
      navigator.clipboard.writeText(submissionResult.claimToken);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2500);
    }
  };

  if (submissionResult) {
    return (
      <div className="min-h-screen bg-slate-50 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <Card className="border-emerald-200 shadow-xl overflow-hidden">
            <div className="bg-emerald-600 px-6 py-8 text-white text-center">
              <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-emerald-100" />
              <h1 className="text-2xl font-bold">Application Successfully Submitted!</h1>
              <p className="text-emerald-100 mt-2">
                Thank you for applying to {course?.name || courseSlug}.
              </p>
            </div>
            <CardContent className="p-6 sm:p-8 space-y-6">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 text-center">
                <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                  Application Reference Number
                </span>
                <div className="text-3xl font-extrabold text-slate-900 mt-1 tracking-tight font-mono">
                  {submissionResult.applicationNumber}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  A confirmation email has been dispatched with this reference.
                </p>
              </div>

              {submissionResult.isGuest && submissionResult.claimToken && (
                <Alert className="border-amber-200 bg-amber-50">
                  <ShieldCheck className="w-5 h-5 text-amber-600" />
                  <AlertTitle className="text-amber-900 font-semibold">
                    Guest Application — Secure Claim Token (DEC-02)
                  </AlertTitle>
                  <AlertDescription className="text-amber-800 text-sm mt-1">
                    You applied as a guest. To link this application to your student account, copy this single-use claim token or use the link below:
                    <div className="mt-3 flex items-center gap-2">
                      <code className="bg-white px-3 py-1.5 border border-amber-300 rounded font-mono text-xs flex-1 truncate text-slate-800">
                        {submissionResult.claimToken}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-amber-300 hover:bg-amber-100 text-amber-900 text-xs"
                        onClick={copyClaimToken}
                      >
                        {copiedToken ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        <span className="ml-1">{copiedToken ? "Copied" : "Copy"}</span>
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div className="border-t border-slate-200 pt-6 space-y-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-600" /> What Happens Next?
                </h3>
                <ul className="text-sm text-slate-600 space-y-2 list-disc pl-5">
                  <li>
                    <strong>Academic Evaluation:</strong> Our admissions committee will review your qualifications and transcripts (DEC-03).
                  </li>
                  <li>
                    <strong>Email Notifications:</strong> You will receive real-time updates as your review progresses.
                  </li>
                  <li>
                    <strong>Payment & Enrollment:</strong> Once academic approval is granted, you will be invited to complete tuition verification to activate enrollment.
                  </li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button
                  className="flex-1 bg-sky-600 hover:bg-sky-700 text-white"
                  asChild
                >
                  <Link to="/application/$applicationNumber" params={{ applicationNumber: submissionResult.applicationNumber }}>
                    Track Application Status <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Link>
                </Button>
                {submissionResult.isGuest && (
                  <Button
                    variant="outline"
                    className="border-slate-300"
                    asChild
                  >
                    <Link to="/claim-application" search={{ token: submissionResult.claimToken || "" }}>
                      Claim to Student Account
                    </Link>
                  </Button>
                )}
                <Button variant="ghost" asChild>
                  <Link to="/courses">Browse More Courses</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header Banner */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-sky-600 font-semibold mb-1">
                <GraduationCap className="w-4 h-4" /> Course Application Form
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {course?.name || courseSlug.replace(/-/g, " ").toUpperCase()}
              </h1>
              <p className="text-slate-600 mt-1 text-sm sm:text-base">
                {course?.shortDescription || "Submit your application for academic review and program admission."}
              </p>
            </div>
            {course?.programFee && (
              <div className="text-right bg-slate-50 border border-slate-100 rounded-lg p-3">
                <span className="text-xs text-slate-500 font-medium block">Program Tuition</span>
                <span className="text-lg font-bold text-slate-900">{course.programFee}</span>
              </div>
            )}
          </div>

          <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={currentUser ? "default" : "secondary"} className="text-xs">
                {currentUser ? "Authenticated Student" : "Guest Mode (DEC-02)"}
              </Badge>
              {currentUser && (
                <span className="text-xs text-slate-500">
                  Signed in as <strong>{currentUser.email}</strong>
                </span>
              )}
            </div>
            {!currentUser && (
              <span className="text-xs text-slate-500">
                Have an account?{" "}
                <Link to="/login" className="text-sky-600 font-semibold hover:underline">
                  Sign in
                </Link>
              </span>
            )}
          </div>
        </div>

        {formError && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertTitle>Submission Error</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        {/* Application Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Personal Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-5 h-5 text-sky-600" /> 1. Personal Information
              </CardTitle>
              <CardDescription>
                Provide your legal full name and verified contact details for registration.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="applicantName">Full Name *</Label>
                  <Input
                    id="applicantName"
                    required
                    value={applicantName}
                    onChange={(e) => setApplicantName(e.target.value)}
                    placeholder="e.g. Dr. Jane Doe"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="applicantEmail">Email Address *</Label>
                  <Input
                    id="applicantEmail"
                    type="email"
                    required
                    value={applicantEmail}
                    onChange={(e) => setApplicantEmail(e.target.value)}
                    placeholder="jane.doe@university.edu"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="applicantPhone">Phone / WhatsApp (Optional)</Label>
                <Input
                  id="applicantPhone"
                  type="tel"
                  value={applicantPhone}
                  onChange={(e) => setApplicantPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Academic Background */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-sky-600" /> 2. Academic Background
              </CardTitle>
              <CardDescription>
                Your academic credentials evaluate eligibility for research lab cohorts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="highestQualification">Highest Qualification</Label>
                  <select
                    id="highestQualification"
                    className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    value={highestQualification}
                    onChange={(e) => setHighestQualification(e.target.value)}
                  >
                    <option value="High School">High School / Secondary</option>
                    <option value="Undergraduate">Undergraduate (B.Tech / B.Sc / MBBS)</option>
                    <option value="Postgraduate">Postgraduate (M.Tech / M.Sc / MS)</option>
                    <option value="Doctorate">Doctorate / Ph.D.</option>
                    <option value="Working Professional">Industry Professional</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="graduationYear">Graduation Year</Label>
                  <Input
                    id="graduationYear"
                    type="number"
                    min="1980"
                    max="2035"
                    value={graduationYear}
                    onChange={(e) => setGraduationYear(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fieldOfStudy">Major / Field of Study</Label>
                  <Input
                    id="fieldOfStudy"
                    value={fieldOfStudy}
                    onChange={(e) => setFieldOfStudy(e.target.value)}
                    placeholder="e.g. Biotechnology, Computer Science, Biochemistry"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="institution">Institution / University</Label>
                  <Input
                    id="institution"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="e.g. Indian Institute of Technology"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Statement of Purpose */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-sky-600" /> 3. Statement of Purpose & Motivation
              </CardTitle>
              <CardDescription>
                Explain your interest in this research course and your career aspirations (min 50 chars).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                rows={5}
                required
                value={statementOfPurpose}
                onChange={(e) => setStatementOfPurpose(e.target.value)}
                placeholder="Describe your research interests, relevant background coursework or computational skills, and what you aim to achieve through this project cohort..."
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>Minimum 50 characters</span>
                <span>{statementOfPurpose.length} characters</span>
              </div>
            </CardContent>
          </Card>

          {/* Section 4: Document Uploads (DEC-04) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-sky-600" /> 4. Document Uploads (DEC-04)
              </CardTitle>
              <CardDescription>
                Max 10 MB per file. Supported formats: PDF, JPEG, PNG. Binary signature verified.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Transcript */}
              <div className="border border-dashed border-slate-300 rounded-lg p-4 hover:border-sky-400 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-semibold text-slate-900 block">
                      Academic Transcript / Marksheet *
                    </Label>
                    <span className="text-xs text-slate-500">
                      Official or provisional university transcript or high school certificate.
                    </span>
                  </div>
                  <Input
                    type="file"
                    className="max-w-[220px] text-xs"
                    accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                    onChange={(e) => handleFileChange("academic_transcript", e)}
                  />
                </div>
                {documents["academic_transcript"]?.error && (
                  <p className="text-xs text-rose-600 font-medium mt-2">
                    {documents["academic_transcript"].error}
                  </p>
                )}
                {documents["academic_transcript"]?.status === "pending" && (
                  <p className="text-xs text-emerald-600 font-medium mt-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ready for secure upload:{" "}
                    {documents["academic_transcript"].file.name} (
                    {(documents["academic_transcript"].file.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>

              {/* CV / Resume */}
              <div className="border border-dashed border-slate-300 rounded-lg p-4 hover:border-sky-400 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-semibold text-slate-900 block">
                      Curriculum Vitae / Resume (Optional)
                    </Label>
                    <span className="text-xs text-slate-500">
                      Highlights past projects, internships, publications, or lab experience.
                    </span>
                  </div>
                  <Input
                    type="file"
                    className="max-w-[220px] text-xs"
                    accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                    onChange={(e) => handleFileChange("cv_resume", e)}
                  />
                </div>
                {documents["cv_resume"]?.error && (
                  <p className="text-xs text-rose-600 font-medium mt-2">
                    {documents["cv_resume"].error}
                  </p>
                )}
                {documents["cv_resume"]?.status === "pending" && (
                  <p className="text-xs text-emerald-600 font-medium mt-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ready:{" "}
                    {documents["cv_resume"].file.name}
                  </p>
                )}
              </div>

              {/* ID Proof */}
              <div className="border border-dashed border-slate-300 rounded-lg p-4 hover:border-sky-400 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-semibold text-slate-900 block">
                      Government / Student Photo ID (Optional)
                    </Label>
                    <span className="text-xs text-slate-500">
                      Aadhaar, Passport, or University ID card (retained 180 days per DEC-05).
                    </span>
                  </div>
                  <Input
                    type="file"
                    className="max-w-[220px] text-xs"
                    accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                    onChange={(e) => handleFileChange("id_proof", e)}
                  />
                </div>
                {documents["id_proof"]?.error && (
                  <p className="text-xs text-rose-600 font-medium mt-2">
                    {documents["id_proof"].error}
                  </p>
                )}
                {documents["id_proof"]?.status === "pending" && (
                  <p className="text-xs text-emerald-600 font-medium mt-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ready:{" "}
                    {documents["id_proof"].file.name}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Submit Action Button */}
          <div className="flex items-center justify-between pt-4">
            <Button variant="ghost" asChild>
              <Link to="/courses">Cancel and Back</Link>
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-sky-600 hover:bg-sky-700 text-white min-w-[200px]"
            >
              {submitting ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" /> Submitting Application...
                </>
              ) : (
                <>
                  Submit Application <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
