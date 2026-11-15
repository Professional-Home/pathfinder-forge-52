import React, { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/utils/supabase";
import {
  getStudentApplicationTracking,
  createDocumentUploadTicket,
  confirmDocumentUpload,
} from "@/lib/course-applications-server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  Upload,
  ArrowRight,
  ShieldAlert,
  GraduationCap,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/application/$applicationNumber")({
  component: ApplicationTrackingPage,
});

export function ApplicationTrackingPage() {
  const params: any = Route.useParams();
  const applicationNumber = params?.applicationNumber || "";

  const [emailInput, setEmailInput] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applicationData, setApplicationData] = useState<any>(null);

  // Resubmission state
  const [resubmitFile, setResubmitFile] = useState<File | null>(null);
  const [resubmitDocType, setResubmitDocType] = useState<string>("academic_transcript");
  const [resubmitting, setResubmitting] = useState(false);
  const [resubmitSuccess, setResubmitSuccess] = useState(false);

  // Auto-attempt fetch if user is logged in
  useEffect(() => {
    async function tryAuthUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          setEmailInput(user.email);
          setVerifiedEmail(user.email);
          fetchTracking(user.email);
        }
      } catch (e) {
        // Not logged in or error
      }
    }
    tryAuthUser();
  }, [applicationNumber]);

  const fetchTracking = async (email: string) => {
    if (!email) return;
    setLoading(true);
    setError(null);

    try {
      const res = await (getStudentApplicationTracking as any)({
        data: {
          applicationNumber,
          applicantEmail: email.trim().toLowerCase(),
        },
      });

      if (res.success && res.application) {
        setApplicationData(res.application);
        setVerifiedEmail(email);
      } else {
        setError(res.error || "No application found matching this reference and email address.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to retrieve application tracking details.");
    } finally {
      setLoading(false);
    }
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTracking(emailInput);
  };

  const handleResubmitUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resubmitFile || !applicationData) return;

    setResubmitting(true);
    setError(null);

    try {
      // 1. Get upload ticket
      const ticketRes = await (createDocumentUploadTicket as any)({
        data: {
          applicationId: applicationData.id,
          documentType: resubmitDocType,
          fileName: resubmitFile.name,
          fileSize: resubmitFile.size,
          mimeType: resubmitFile.type || "application/octet-stream",
        },
      });

      if (!ticketRes.success || !ticketRes.signedUploadUrl) {
        throw new Error(ticketRes.error || "Failed to generate upload ticket.");
      }

      // 2. Upload file via signed URL
      const uploadRes = await fetch(ticketRes.signedUploadUrl, {
        method: "PUT",
        headers: { "Content-Type": resubmitFile.type || "application/octet-stream" },
        body: resubmitFile,
      });

      if (!uploadRes.ok) {
        throw new Error("Direct storage upload failed. Please try again.");
      }

      // 3. Confirm document upload
      await (confirmDocumentUpload as any)({
        data: {
          documentId: ticketRes.documentId,
          storagePath: ticketRes.storagePath,
        },
      });

      setResubmitSuccess(true);
      setResubmitFile(null);
      // Refresh tracking info
      if (verifiedEmail) {
        fetchTracking(verifiedEmail);
      }
    } catch (err: any) {
      setError(err.message || "Document resubmission failed.");
    } finally {
      setResubmitting(false);
    }
  };

  // Helper for status badge styling
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "submitted":
        return <Badge className="bg-sky-500 text-white">Submitted</Badge>;
      case "under_review":
        return <Badge className="bg-amber-500 text-white">Under Review</Badge>;
      case "resubmission_required":
        return <Badge className="bg-orange-500 text-white">Action Required</Badge>;
      case "approved":
        return <Badge className="bg-emerald-600 text-white">Academically Approved</Badge>;
      case "rejected":
        return <Badge className="bg-slate-600 text-white">Not Accepted</Badge>;
      case "enrolled":
        return <Badge className="bg-green-700 text-white font-bold">Enrolled</Badge>;
      case "revoked":
        return <Badge className="bg-rose-700 text-white">Enrollment Revoked</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Application Status Tracker
          </h1>
          <p className="text-slate-600 text-sm">
            Track real-time evaluation milestones and upload requested documents.
          </p>
        </div>

        {/* Verification Form (if not loaded yet) */}
        {!applicationData && (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Verify Your Application</CardTitle>
              <CardDescription>
                Enter the email address used during submission to access reference <strong>{applicationNumber}</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleManualSearch} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="emailInput">Applicant Email Address</Label>
                  <Input
                    id="emailInput"
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="student@example.com"
                  />
                </div>
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-sky-600 hover:bg-sky-700 text-white"
                >
                  {loading ? "Verifying..." : "Track Application"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Application Details View */}
        {applicationData && (
          <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                      Reference Number
                    </span>
                    <h2 className="text-2xl font-bold font-mono text-slate-900">
                      {applicationData.application_number}
                    </h2>
                  </div>
                  <div>{getStatusBadge(applicationData.status)}</div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500 block">Course Program</span>
                    <span className="font-semibold text-slate-900">
                      {applicationData.courses?.title || applicationData.course_id}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Applicant</span>
                    <span className="font-semibold text-slate-900">
                      {applicationData.applicant_name} ({applicationData.applicant_email})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Payment Status</span>
                    <span className="font-semibold text-slate-900 capitalize">
                      {applicationData.payment_status || "Pending"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Submitted On</span>
                    <span className="font-semibold text-slate-900">
                      {new Date(applicationData.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>

                {/* Progress Stepper */}
                <div className="border-t border-slate-100 pt-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-4">Milestone Progress</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center text-xs">
                    <div className="space-y-1">
                      <div className="h-2 rounded bg-emerald-500"></div>
                      <span className="font-medium text-slate-800">1. Submitted</span>
                    </div>
                    <div className="space-y-1">
                      <div
                        className={`h-2 rounded ${
                          ["under_review", "resubmission_required", "approved", "enrolled"].includes(
                            applicationData.status
                          )
                            ? "bg-emerald-500"
                            : "bg-slate-200"
                        }`}
                      ></div>
                      <span className="font-medium text-slate-800">2. Review</span>
                    </div>
                    <div className="space-y-1">
                      <div
                        className={`h-2 rounded ${
                          ["approved", "enrolled"].includes(applicationData.status)
                            ? "bg-emerald-500"
                            : applicationData.status === "rejected"
                            ? "bg-rose-500"
                            : applicationData.status === "resubmission_required"
                            ? "bg-orange-500"
                            : "bg-slate-200"
                        }`}
                      ></div>
                      <span className="font-medium text-slate-800">3. Decision</span>
                    </div>
                    <div className="space-y-1">
                      <div
                        className={`h-2 rounded ${
                          ["verified", "waived"].includes(applicationData.payment_status) ||
                          applicationData.status === "enrolled"
                            ? "bg-emerald-500"
                            : "bg-slate-200"
                        }`}
                      ></div>
                      <span className="font-medium text-slate-800">4. Payment</span>
                    </div>
                    <div className="space-y-1">
                      <div
                        className={`h-2 rounded ${
                          applicationData.status === "enrolled" ? "bg-emerald-500" : "bg-slate-200"
                        }`}
                      ></div>
                      <span className="font-medium text-slate-800">5. Enrolled</span>
                    </div>
                  </div>
                </div>

                {/* Resubmission Section (if required) */}
                {applicationData.status === "resubmission_required" && (
                  <Alert className="border-orange-200 bg-orange-50">
                    <ShieldAlert className="w-5 h-5 text-orange-600" />
                    <AlertTitle className="text-orange-900 font-semibold">
                      Action Required: Additional Documents Requested
                    </AlertTitle>
                    <AlertDescription className="text-orange-800 text-sm mt-2 space-y-4">
                      {applicationData.notes && (
                        <div className="bg-white/80 p-3 rounded border border-orange-200">
                          <strong>Admissions Committee Note:</strong> {applicationData.notes}
                        </div>
                      )}

                      {resubmitSuccess ? (
                        <div className="bg-emerald-100 text-emerald-800 p-3 rounded flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Replacement document uploaded successfully. The review team has been notified.
                        </div>
                      ) : (
                        <form onSubmit={handleResubmitUpload} className="space-y-3 pt-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs text-orange-950">Document Type</Label>
                              <select
                                className="flex h-9 w-full rounded border border-orange-300 bg-white px-2 text-xs"
                                value={resubmitDocType}
                                onChange={(e) => setResubmitDocType(e.target.value)}
                              >
                                <option value="academic_transcript">Academic Transcript</option>
                                <option value="cv_resume">CV / Resume</option>
                                <option value="id_proof">Photo ID Proof</option>
                                <option value="statement_of_purpose">Statement of Purpose</option>
                              </select>
                            </div>
                            <div>
                              <Label className="text-xs text-orange-950">Select File (PDF/PNG/JPEG)</Label>
                              <Input
                                type="file"
                                className="h-9 text-xs"
                                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                                onChange={(e) => setResubmitFile(e.target.files?.[0] || null)}
                              />
                            </div>
                          </div>
                          <Button
                            type="submit"
                            size="sm"
                            disabled={!resubmitFile || resubmitting}
                            className="bg-orange-600 hover:bg-orange-700 text-white"
                          >
                            {resubmitting ? "Uploading..." : "Upload Replacement Document"}
                          </Button>
                        </form>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Events / Timeline */}
                {applicationData.events && applicationData.events.length > 0 && (
                  <div className="border-t border-slate-100 pt-6">
                    <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-sky-600" /> Milestone Timeline
                    </h3>
                    <div className="space-y-3">
                      {applicationData.events.map((evt: any) => (
                        <div
                          key={evt.id}
                          className="flex items-start gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100"
                        >
                          <div className="w-2 h-2 rounded-full bg-sky-500 mt-1.5 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="flex justify-between items-baseline">
                              <span className="font-semibold text-slate-900 capitalize">
                                {evt.event_type.replace(/_/g, " ")}
                              </span>
                              <span className="text-slate-400">
                                {new Date(evt.created_at).toLocaleString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            {evt.notes && <p className="text-slate-600 mt-1">{evt.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="text-center">
              <Button variant="ghost" asChild>
                <Link to="/courses">Return to Courses</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
