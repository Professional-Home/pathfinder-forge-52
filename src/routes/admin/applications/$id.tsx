import React, { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/utils/supabase";
import {
  getAdminApplicationDetail,
  adminTransitionApplication,
  adminReviewDocument,
  adminUpdatePaymentStatus,
  adminApproveGoogleFormsApplication,
  adminReconcileIdentityConflict,
} from "@/lib/course-applications-server";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText,
  User,
  GraduationCap,
  BookOpen,
  Download,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  ShieldCheck,
  CreditCard,
  ArrowLeft,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

export const Route = createFileRoute("/admin/applications/$id")({
  component: AdminApplicationDetailPage,
});

export function AdminApplicationDetailPage() {
  const params: any = Route.useParams();
  const id = params?.id || "";
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [appData, setAppData] = useState<any>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  // Dialog states for modal transitions
  const [dialogMode, setDialogMode] = useState<"resubmit" | "reject" | "revoke" | "payment" | "approve_google_forms" | "reconcile_identity" | null>(null);
  const [modalNotes, setModalNotes] = useState("");
  const [gfConfirmed, setGfConfirmed] = useState(false);
  const [paymentSelection, setPaymentSelection] = useState("verified");
  const [paymentReceiptRef, setPaymentReceiptRef] = useState("");
  const [reconcileEmailChoice, setReconcileEmailChoice] = useState("");
  const [customReconcileEmail, setCustomReconcileEmail] = useState("");
  const [reconcileNotes, setReconcileNotes] = useState("");

  const loadApplication = async () => {
    setLoading(true);
    setActionError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token;

      const res = await (getAdminApplicationDetail as any)({
        data: {
          authToken,
          applicationId: id,
        },
      });

      if (res.success && res.application) {
        setAppData(res.application);
      } else {
        setActionError(res.error || "Failed to load application details.");
      }
    } catch (e: any) {
      setActionError(e.message || "Failed to load application.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplication();
  }, [id]);

  const handleStatusTransition = async (targetStatus: string, notes?: string, rejectionReason?: string) => {
    setProcessing(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token;

      const res = await (adminTransitionApplication as any)({
        data: {
          authToken,
          applicationId: id,
          targetStatus,
          notes,
          rejectionReason,
        },
      });

      if (res.success) {
        setActionSuccess(`Application status successfully transitioned to "${targetStatus}".`);
        setDialogMode(null);
        setModalNotes("");
        await loadApplication();
      } else {
        setActionError(res.error || `Failed to transition application to ${targetStatus}.`);
      }
    } catch (err: any) {
      setActionError(err.message || "Transition request failed.");
    } finally {
      setProcessing(false);
    }
  };

  const handleReviewDocument = async (
    documentId: string,
    status: "verified" | "resubmission_requested" | "rejected",
    notes?: string
  ) => {
    setProcessing(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token;
      const res = await (adminReviewDocument as any)({
        data: {
          authToken,
          applicationId: id,
          documentId,
          status,
          notes,
        },
      });
      if (res.success) {
        setActionSuccess(res.message || `Document marked as '${status}'.`);
        await loadApplication();
      } else {
        setActionError(res.error || "Failed to update document status.");
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to submit document review.");
    } finally {
      setProcessing(false);
    }
  };

  const handleApproveGoogleForms = async () => {
    if (!gfConfirmed) return;
    setProcessing(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token;
      const res = await (adminApproveGoogleFormsApplication as any)({
        data: {
          authToken,
          applicationId: id,
          verificationNotes: modalNotes.trim(),
          confirmedSheetVerification: true,
        },
      });
      if (res.success) {
        setActionSuccess("Application approved and payment verified successfully via Google Forms workflow.");
        setDialogMode(null);
        setModalNotes("");
        setGfConfirmed(false);
        await loadApplication();
      } else {
        setActionError(res.error || "Failed to approve Google Forms application.");
      }
    } catch (err: any) {
      setActionError(err.message || "Approval request failed.");
    } finally {
      setProcessing(false);
    }
  };

  const handleReconcileIdentityConflict = async () => {
    if (!reconcileNotes.trim() || reconcileNotes.trim().length < 5) {
      setActionError("Detailed reconciliation notes explaining identity verification are mandatory (minimum 5 characters).");
      return;
    }
    const chosenEmail = reconcileEmailChoice === "custom" ? customReconcileEmail.trim() : reconcileEmailChoice.trim();
    if (!chosenEmail) {
      setActionError("A valid chosen student email address is required.");
      return;
    }

    setProcessing(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token;
      const res = await (adminReconcileIdentityConflict as any)({
        data: {
          authToken,
          applicationId: id,
          chosenEmail,
          notes: reconcileNotes.trim(),
        },
      });

      if (res.success) {
        setActionSuccess("Identity conflict reconciled successfully. Application released from quarantine.");
        setDialogMode(null);
        setReconcileNotes("");
        await loadApplication();
      } else {
        setActionError(res.error || "Failed to reconcile identity conflict.");
      }
    } catch (err: any) {
      setActionError(err.message || "Reconciliation request failed.");
    } finally {
      setProcessing(false);
    }
  };

  const handlePaymentUpdate = async () => {
    setProcessing(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token;

      const res = await (adminUpdatePaymentStatus as any)({
        data: {
          authToken,
          applicationId: id,
          paymentStatus: paymentSelection,
          receiptReference: paymentReceiptRef.trim() || undefined,
          notes: modalNotes.trim() || undefined,
        },
      });

      if (res.success) {
        setActionSuccess(`Payment status updated to "${paymentSelection}".`);
        setDialogMode(null);
        setModalNotes("");
        setPaymentReceiptRef("");
        await loadApplication();
      } else {
        setActionError(res.error || "Failed to update payment status.");
      }
    } catch (err: any) {
      setActionError(err.message || "Payment update request failed.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center space-y-4">
        <Clock className="w-8 h-8 animate-spin mx-auto text-sky-600" />
        <p className="text-sm text-muted-foreground">Loading applicant dossier...</p>
      </div>
    );
  }

  if (!appData) {
    return (
      <div className="py-12 space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle>Error Loading Dossier</AlertTitle>
          <AlertDescription>{actionError || "Application not found or access denied."}</AlertDescription>
        </Alert>
        <Button variant="outline" asChild>
          <Link to="/admin/applications">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Queue
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/applications">
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold font-mono text-foreground">
                {appData.application_number}
              </h1>
              <Badge variant="outline" className="text-xs font-semibold uppercase">
                {appData.status === "submitted" ? "Pending Verification" : appData.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Course: <strong>{appData.courses?.title || appData.course_id}</strong>
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadApplication}
          disabled={loading}
          className="flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {actionSuccess && (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription className="text-xs">{actionSuccess}</AlertDescription>
        </Alert>
      )}

      {actionError && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle>Action Error</AlertTitle>
          <AlertDescription className="text-xs">{actionError}</AlertDescription>
        </Alert>
      )}

      {/* Main Grid: Left Details & Right Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Dossier Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal & Academic Summary */}
          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4 text-sky-600" /> Applicant Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block">Full Legal Name</span>
                <span className="font-semibold text-foreground">{appData.applicant_name}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Email Address</span>
                <span className="font-semibold text-foreground">{appData.applicant_email}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Phone / WhatsApp</span>
                <span className="text-foreground">{appData.applicant_phone || "Not provided"}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Account Status</span>
                <span className="text-foreground">
                  {appData.user_id ? (
                    <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">Linked Student</Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-300 text-amber-800 text-[10px]">
                      Unclaimed Guest (DEC-02)
                    </Badge>
                  )}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Academic Background */}
          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-sky-600" /> Academic Qualifications
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block">Highest Qualification</span>
                <span className="font-semibold text-foreground">
                  {appData.highest_qualification || "Not specified"}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Major / Field</span>
                <span className="font-semibold text-foreground">{appData.field_of_study || "N/A"}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Institution / University</span>
                <span className="text-foreground">{appData.institution || "N/A"}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Graduation Year</span>
                <span className="text-foreground">{appData.graduation_year || "N/A"}</span>
              </div>
            </CardContent>
          </Card>

          {/* Statement of Purpose */}
          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-sky-600" /> Statement of Purpose & Motivation
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="bg-muted/40 p-4 rounded-md text-sm whitespace-pre-wrap text-foreground leading-relaxed border">
                {appData.statement_of_purpose || "No statement submitted."}
              </div>
            </CardContent>
          </Card>

          {/* Uploaded Documents */}
          <Card>
            <CardHeader className="border-b pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 text-sky-600" /> Supporting Documents (DEC-04)
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  Status: {appData.source === "google_forms" || appData.documents_status === "not_required" ? "Not Required" : (appData.documents_status || "pending")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {appData.source === "google_forms" ? (
                <div className="p-3 bg-muted/30 rounded border text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">External Intake via Google Forms</p>
                  <p>
                    Candidate responses, questionnaire answers, and payment receipts are managed directly in the linked Google Sheet and Google Drive.
                  </p>
                </div>
              ) : !appData.documents || appData.documents.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No documents attached.</p>
              ) : (
                <div className="space-y-3">
                  {appData.documents.map((doc: any) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-muted/20 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <span className="font-semibold text-xs text-foreground uppercase tracking-wider block">
                          {doc.document_type.replace(/_/g, " ")}
                        </span>
                        <div className="text-xs text-muted-foreground font-mono">
                          {doc.file_name} ({(doc.file_size / 1024 / 1024).toFixed(2)} MB)
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            doc.status === "verified"
                              ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                              : doc.status === "resubmission_requested"
                              ? "border-amber-500 bg-amber-50 text-amber-700"
                              : doc.status === "rejected"
                              ? "border-rose-500 bg-rose-50 text-rose-700"
                              : "border-slate-300 text-slate-600"
                          }`}
                        >
                          {doc.status}
                        </Badge>
                        {doc.signedDownloadUrl ? (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" asChild>
                            <a href={doc.signedDownloadUrl} target="_blank" rel="noopener noreferrer">
                              <Download className="w-3 h-3" /> View
                            </a>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No secure URL</span>
                        )}
                        {doc.status !== "verified" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                            disabled={processing}
                            onClick={() => handleReviewDocument(doc.id, "verified")}
                          >
                            <CheckCircle className="w-3 h-3 mr-1 text-emerald-600" /> Verify
                          </Button>
                        )}
                        {doc.status !== "resubmission_requested" && doc.status !== "rejected" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-50"
                            disabled={processing}
                            onClick={() =>
                              handleReviewDocument(doc.id, "resubmission_requested", "Please upload a clearer scan.")
                            }
                          >
                            <RefreshCw className="w-3 h-3 mr-1 text-amber-600" /> Request Re-upload
                          </Button>
                        )}
                        {doc.status !== "rejected" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-rose-300 text-rose-800 hover:bg-rose-50"
                            disabled={processing}
                            onClick={() =>
                              handleReviewDocument(doc.id, "rejected", "Document does not satisfy requirements.")
                            }
                          >
                            <XCircle className="w-3 h-3 mr-1 text-rose-600" /> Reject
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Compliance & Audit Logs */}
          {appData.auditLogs && appData.auditLogs.length > 0 && (
            <Card>
              <CardHeader className="border-b pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-sky-600" /> Compliance Audit Trail
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-2 text-xs">
                  {appData.auditLogs.map((log: any) => (
                    <div key={log.id} className="p-2.5 bg-muted/30 rounded border flex justify-between items-start">
                      <div>
                        <span className="font-semibold text-foreground uppercase">{log.action}</span>
                        {log.notes && <p className="text-muted-foreground mt-0.5">{log.notes}</p>}
                        {log.changed_fields && log.changed_fields.length > 0 && (
                          <span className="text-[10px] text-muted-foreground block mt-1">
                            Fields: {log.changed_fields.join(", ")}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString("en-IN")}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right 1 Column: Decision & Action Toolbar */}
        <div className="space-y-6">
          <Card className="border-sky-200 shadow-sm">
            <CardHeader className="bg-sky-50/50 border-b pb-4">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-sky-900">
                Admissions Decision Toolbar
              </CardTitle>
              <CardDescription className="text-xs text-sky-700">
                Strict adherence to DEC-03: Academic approval is decoupled from tuition verification.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              {/* Current Status Snapshot */}
              <div className="space-y-2 text-xs border-b pb-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Lifecycle State:</span>
                  <span className="font-bold uppercase text-foreground">
                    {appData.status === "submitted" ? "Pending Verification" : appData.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment State:</span>
                  <span className="font-bold uppercase text-foreground">
                    {appData.payment_status === "pending_verification" ? "Pending Verification" : appData.payment_status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Document State:</span>
                  <span className="font-bold uppercase text-foreground">
                    {appData.source === "google_forms" || appData.documents_status === "not_required"
                      ? "Not Required"
                      : appData.documents_status}
                  </span>
                </div>
              </div>

              {/* Identity Conflict Quarantine Banner & Actions */}
              {Boolean(appData.is_identity_conflict || appData.academic_background?.google_forms?.identity_conflict) && (
                <div className="space-y-2 p-3 rounded-lg border border-red-300 bg-red-50 text-red-900">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-red-800">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" /> Identity Conflict Quarantined
                  </div>
                  <div className="text-[11px] text-red-700 leading-tight space-y-1">
                    <p>
                      Google Account: <strong className="font-mono text-foreground">{appData.respondent_email || appData.academic_background?.google_forms?.respondent_email || "N/A"}</strong>
                    </p>
                    <p>
                      Entered Email: <strong className="font-mono text-foreground">{appData.student_email}</strong>
                    </p>
                    <p className="text-red-800 font-medium pt-0.5">
                      Approval and enrollment are locked. Verify candidate identity in Google Sheets before reconciling.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="w-full bg-red-700 hover:bg-red-800 text-white text-xs font-semibold mt-1"
                    disabled={processing}
                    onClick={() => {
                      setReconcileEmailChoice(appData.student_email);
                      setCustomReconcileEmail("");
                      setReconcileNotes("");
                      setDialogMode("reconcile_identity");
                    }}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> Reconcile Identity Conflict
                  </Button>
                </div>
              )}

              {/* Google Forms Dedicated Approval Workflow */}
              {appData.source === "google_forms" && ["submitted", "under_review", "resubmitted"].includes(appData.status) && (
                <div className="space-y-1.5">
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                    disabled={processing || Boolean(appData.is_identity_conflict || appData.academic_background?.google_forms?.identity_conflict)}
                    onClick={() => {
                      setGfConfirmed(false);
                      setModalNotes("");
                      setDialogMode("approve_google_forms");
                    }}
                  >
                    <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Approve Application (Google Sheets Verified)
                  </Button>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    Requires manual confirmation that applicant payment proof was checked in Google Sheets.
                  </p>
                </div>
              )}

              {/* Direct Portal Workflow (DEC-03) */}
              {appData.source !== "google_forms" && (appData.status === "submitted" || appData.status === "resubmitted") && (
                <Button
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs"
                  disabled={processing}
                  onClick={() => handleStatusTransition("under_review")}
                >
                  <Clock className="w-3.5 h-3.5 mr-1.5" /> Start Academic Review
                </Button>
              )}

              {/* Direct Portal Academic Approval (DEC-03) */}
              {appData.source !== "google_forms" && (appData.status === "under_review" || appData.status === "resubmitted") && (
                <div className="space-y-1.5">
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                    disabled={processing || appData.documents_status !== "verified"}
                    onClick={() => handleStatusTransition("approved")}
                  >
                    <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Grant Academic Approval (DEC-03)
                  </Button>
                  {appData.documents_status !== "verified" && (
                    <p className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded border border-amber-200">
                      Academic approval locked: Candidate documents must be individually verified first (current document state: <strong>{appData.documents_status}</strong>).
                    </p>
                  )}
                </div>
              )}

              {/* Action 3: Payment Verification */}
              <Button
                variant="outline"
                className="w-full border-blue-300 text-blue-800 hover:bg-blue-50 text-xs"
                disabled={processing}
                onClick={() => setDialogMode("payment")}
              >
                <CreditCard className="w-3.5 h-3.5 mr-1.5" /> Update Payment Status
              </Button>

              {/* Action 4: Activate Enrollment (DEC-03) */}
              {appData.status === "approved" && (
                <Button
                  className="w-full bg-green-700 hover:bg-green-800 text-white text-xs font-bold"
                  disabled={
                    processing ||
                    !["verified", "waived", "not_required"].includes(appData.payment_status)
                  }
                  onClick={() => handleStatusTransition("enrolled")}
                >
                  <GraduationCap className="w-3.5 h-3.5 mr-1.5" /> Activate Student Enrollment
                </Button>
              )}

              {/* Secondary Actions */}
              <div className="pt-2 border-t space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs text-orange-700 border-orange-300 hover:bg-orange-50"
                  disabled={processing}
                  onClick={() => setDialogMode("resubmit")}
                >
                  Request Document Resubmission
                </Button>

                {appData.status !== "rejected" && appData.status !== "enrolled" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs text-rose-700 border-rose-300 hover:bg-rose-50"
                    disabled={processing}
                    onClick={() => setDialogMode("reject")}
                  >
                    Reject Application
                  </Button>
                )}

                {appData.status === "enrolled" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs text-rose-800 border-rose-400 hover:bg-rose-100"
                    disabled={processing}
                    onClick={() => setDialogMode("revoke")}
                  >
                    Revoke Enrollment
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Events Timeline */}
          {appData.events && appData.events.length > 0 && (
            <Card>
              <CardHeader className="border-b pb-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Event Milestone Log
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {appData.events.map((evt: any) => (
                  <div key={evt.id} className="text-xs border-l-2 border-sky-500 pl-3 py-1 space-y-0.5">
                    <div className="flex justify-between items-baseline">
                      <span className="font-semibold text-foreground uppercase text-[11px]">
                        {evt.event_type.replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(evt.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                    {evt.notes && <p className="text-muted-foreground text-[11px]">{evt.notes}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Action Dialogs */}
      {/* Resubmit Dialog */}
      <Dialog open={dialogMode === "resubmit"} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Document Resubmission</DialogTitle>
            <DialogDescription>
              Provide specific instructions for the applicant regarding required document updates.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="resubmitNotes">Reviewer Feedback / Reason *</Label>
            <Textarea
              id="resubmitNotes"
              rows={4}
              required
              value={modalNotes}
              onChange={(e) => setModalNotes(e.target.value)}
              placeholder="e.g. Please provide a clear, high-resolution scan of your semester 6 transcript..."
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogMode(null)}>
              Cancel
            </Button>
            <Button
              className="bg-orange-600 hover:bg-orange-700 text-white"
              disabled={!modalNotes.trim() || processing}
              onClick={() => handleStatusTransition("resubmission_required", modalNotes.trim())}
            >
              Request Resubmission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={dialogMode === "reject"} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Course Application</DialogTitle>
            <DialogDescription>
              State the reason for non-admission. This reason will be recorded in the audit log and sent to the applicant.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="rejectReason">Rejection Rationale *</Label>
            <Textarea
              id="rejectReason"
              rows={4}
              required
              value={modalNotes}
              onChange={(e) => setModalNotes(e.target.value)}
              placeholder="e.g. Prerequisites in molecular biology were not met for this advanced research cohort..."
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogMode(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!modalNotes.trim() || processing}
              onClick={() => handleStatusTransition("rejected", undefined, modalNotes.trim())}
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Dialog */}
      <Dialog open={dialogMode === "revoke"} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Active Student Enrollment</DialogTitle>
            <DialogDescription>
              Revoking enrollment will deactivate student platform access and remove the active student seat.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="revokeReason">Mandatory Administrative Rationale *</Label>
            <Textarea
              id="revokeReason"
              rows={4}
              required
              value={modalNotes}
              onChange={(e) => setModalNotes(e.target.value)}
              placeholder="e.g. Student requested withdrawal, or fee payment reversal confirmed..."
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogMode(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!modalNotes.trim() || processing}
              onClick={() => handleStatusTransition("revoked", modalNotes.trim())}
            >
              Confirm Revocation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={dialogMode === "payment"} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Tuition Payment Status</DialogTitle>
            <DialogDescription>
              Record fee payment verification, scholarship waiver, or exemption.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Payment State</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={paymentSelection}
                onChange={(e) => setPaymentSelection(e.target.value)}
              >
                <option value="verified">Verified (Payment Received)</option>
                <option value="waived">Waived (Scholarship / Full Exemption)</option>
                <option value="pending_verification">Pending Verification (Receipt Provided)</option>
                <option value="unpaid">Unpaid (Awaiting Payment)</option>
                <option value="not_required">Not Required</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="receiptRef">Transaction / Receipt Reference (Optional)</Label>
              <Input
                id="receiptRef"
                value={paymentReceiptRef}
                onChange={(e) => setPaymentReceiptRef(e.target.value)}
                placeholder="e.g. RAZORPAY_pay_xxx or Bank Ref #..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payNotes">Internal Notes (Optional)</Label>
              <Textarea
                id="payNotes"
                rows={2}
                value={modalNotes}
                onChange={(e) => setModalNotes(e.target.value)}
                placeholder="e.g. Verified via accounts team on 15 Nov..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogMode(null)}>
              Cancel
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={processing}
              onClick={handlePaymentUpdate}
            >
              Save Payment Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Google Forms Dedicated Approval Dialog */}
      <Dialog open={dialogMode === "approve_google_forms"} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Google Forms Application</DialogTitle>
            <DialogDescription>
              Confirm that you have independently verified this student's payment proof and details in the linked Google Sheet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm">
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 space-y-1">
              <p className="font-semibold">Review Requirement:</p>
              <p>
                Open the linked Google Sheet for <strong>{appData?.courses?.title || appData?.course_id}</strong>, verify the student's name, email, and payment receipt (UTR/transaction screenshot).
              </p>
            </div>

            <div className="flex items-start gap-2.5 pt-1">
              <input
                type="checkbox"
                id="gfConfirmCheck"
                checked={gfConfirmed}
                onChange={(e) => setGfConfirmed(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <Label htmlFor="gfConfirmCheck" className="text-xs font-medium cursor-pointer leading-relaxed">
                I confirm that I have personally opened the linked Google Sheet, verified the candidate's payment proof and details, and found them valid.
              </Label>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gfVerificationNotes" className="text-xs">
                Transaction Reference / Verification Notes (Optional)
              </Label>
              <Textarea
                id="gfVerificationNotes"
                rows={3}
                value={modalNotes}
                onChange={(e) => setModalNotes(e.target.value)}
                placeholder="e.g. UTR/Ref: 123456789 verified in Google Sheet. Payment of INR 1500 confirmed."
                className="text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogMode(null)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
              disabled={!gfConfirmed || processing}
              onClick={handleApproveGoogleForms}
            >
              <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Confirm Approval & Verify Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reconcile Identity Conflict Dialog */}
      <Dialog open={dialogMode === "reconcile_identity"} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-900">
              <ShieldCheck className="w-5 h-5 text-red-600" /> Reconcile Identity Conflict
            </DialogTitle>
            <DialogDescription className="text-xs">
              Resolve the discrepancy between the student's authenticated Google account and entered contact email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5 bg-muted/60 p-2.5 rounded border text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Google Account (Authenticated):</span>
                <span className="font-mono font-medium">{appData?.respondent_email || appData?.academic_background?.google_forms?.respondent_email || "Not collected"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Form Entered Email:</span>
                <span className="font-mono font-medium">{appData?.student_email}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Select Authoritative Verified Email</Label>
              <div className="space-y-2 pl-0.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="reconcileChoice"
                    value="entered"
                    checked={reconcileEmailChoice === (appData?.academic_background?.google_forms?.entered_email || appData?.student_email)}
                    onChange={() => {
                      setReconcileEmailChoice(appData?.academic_background?.google_forms?.entered_email || appData?.student_email);
                    }}
                    className="h-3.5 w-3.5 text-red-600"
                  />
                  <span>Use Form Entered Email (<strong className="font-mono">{appData?.academic_background?.google_forms?.entered_email || appData?.student_email}</strong>)</span>
                </label>
                {(appData?.respondent_email || appData?.academic_background?.google_forms?.respondent_email) && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="reconcileChoice"
                      value="respondent"
                      checked={reconcileEmailChoice === (appData?.respondent_email || appData?.academic_background?.google_forms?.respondent_email)}
                      onChange={() => {
                        setReconcileEmailChoice(appData?.respondent_email || appData?.academic_background?.google_forms?.respondent_email);
                      }}
                      className="h-3.5 w-3.5 text-red-600"
                    />
                    <span>Use Google Account Email (<strong className="font-mono">{appData?.respondent_email || appData?.academic_background?.google_forms?.respondent_email}</strong>)</span>
                  </label>
                )}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="reconcileChoice"
                    value="custom"
                    checked={reconcileEmailChoice === "custom"}
                    onChange={() => setReconcileEmailChoice("custom")}
                    className="h-3.5 w-3.5 text-red-600"
                  />
                  <span>Specify Custom Verified Email</span>
                </label>
                {reconcileEmailChoice === "custom" && (
                  <Input
                    type="email"
                    placeholder="verified.student@example.com"
                    value={customReconcileEmail}
                    onChange={(e) => setCustomReconcileEmail(e.target.value)}
                    className="text-xs mt-1"
                  />
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reconcileNotes" className="text-xs font-semibold">
                Reconciliation Notes <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="reconcileNotes"
                placeholder="Document how identity was verified (e.g. verified student ownership in Google Sheet, checked payment proof UTR, or candidate phone confirmation)..."
                rows={3}
                value={reconcileNotes}
                onChange={(e) => setReconcileNotes(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setDialogMode(null)} disabled={processing}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-red-700 hover:bg-red-800 text-white text-xs font-semibold"
              onClick={handleReconcileIdentityConflict}
              disabled={processing || !reconcileNotes.trim() || reconcileNotes.trim().length < 5}
            >
              {processing ? "Reconciling..." : "Confirm & Release Quarantine"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
