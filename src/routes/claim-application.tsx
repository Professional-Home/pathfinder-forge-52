import React, { useState, useEffect } from "react";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { supabase } from "@/utils/supabase";
import { claimGuestApplication } from "@/lib/course-applications-server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldCheck, AlertCircle, CheckCircle2, ArrowRight, UserPlus, LogIn } from "lucide-react";

export const Route = createFileRoute("/claim-application")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      token: (search.token as string) || "",
    };
  },
  component: ClaimApplicationPage,
});

export function ClaimApplicationPage() {
  const search: any = useSearch({ strict: false });
  const [rawToken, setRawToken] = useState<string>(
    typeof search?.token === "string" ? search.token : ""
  );
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState<{
    applicationNumber?: string;
    message?: string;
  } | null>(null);

  useEffect(() => {
    async function checkAuth() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUser(user);
      } catch (e) {
        // Not logged in
      } finally {
        setAuthChecking(false);
      }
    }
    checkAuth();
  }, []);

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setClaimError(null);

    if (!rawToken.trim()) {
      setClaimError("Please provide a valid claim token.");
      return;
    }

    if (!currentUser) {
      setClaimError("You must be logged in to claim a course application.");
      return;
    }

    setClaiming(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token;

      const res = await (claimGuestApplication as any)({
        data: {
          rawToken: rawToken.trim(),
          userToken: authToken,
        },
      });

      if (res.success) {
        setClaimSuccess({
          applicationNumber: res.applicationNumber,
          message: res.message || "Application successfully linked to your account!",
        });
      } else {
        setClaimError(res.error || "Failed to claim application. Token may be expired, used, or mismatched.");
      }
    } catch (err: any) {
      setClaimError(err.message || "An unexpected error occurred during claiming.");
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <Card className="border-slate-200 shadow-lg">
          <CardHeader className="text-center">
            <div className="w-12 h-12 bg-sky-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <ShieldCheck className="w-6 h-6 text-sky-600" />
            </div>
            <CardTitle className="text-2xl font-bold">Claim Course Application</CardTitle>
            <CardDescription>
              Link a guest application (DEC-02) to your verified student account.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {claimSuccess ? (
              <div className="text-center space-y-4 py-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <h3 className="text-lg font-bold text-slate-900">Application Claimed!</h3>
                <p className="text-sm text-slate-600">{claimSuccess.message}</p>
                <div className="pt-4 flex flex-col gap-2">
                  {claimSuccess.applicationNumber && (
                    <Button className="bg-sky-600 hover:bg-sky-700 text-white" asChild>
                      <Link
                        to="/application/$applicationNumber"
                        params={{ applicationNumber: claimSuccess.applicationNumber }}
                      >
                        View Application Status <ArrowRight className="w-4 h-4 ml-1.5" />
                      </Link>
                    </Button>
                  )}
                  <Button variant="outline" asChild>
                    <Link to="/dashboard">Go to Student Dashboard</Link>
                  </Button>
                </div>
              </div>
            ) : !authChecking && !currentUser ? (
              <div className="space-y-4">
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <AlertTitle className="text-amber-900 font-semibold">Account Sign-in Required</AlertTitle>
                  <AlertDescription className="text-amber-800 text-xs mt-1">
                    To claim your application, please sign in or register an account using the <strong>same email address</strong> you entered when applying.
                  </AlertDescription>
                </Alert>

                <div className="space-y-1.5">
                  <Label htmlFor="tokenPreview">Your Claim Token</Label>
                  <Input
                    id="tokenPreview"
                    value={rawToken}
                    onChange={(e) => setRawToken(e.target.value)}
                    placeholder="Enter claim token"
                    className="font-mono text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <Button variant="outline" className="w-full text-xs" asChild>
                    <Link to="/login">
                      <LogIn className="w-3.5 h-3.5 mr-1" /> Sign In
                    </Link>
                  </Button>
                  <Button className="w-full text-xs bg-sky-600 hover:bg-sky-700 text-white" asChild>
                    <Link to="/signup">
                      <UserPlus className="w-3.5 h-3.5 mr-1" /> Register
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleClaim} className="space-y-4">
                {currentUser && (
                  <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs text-slate-600">
                    Signed in as <strong>{currentUser.email}</strong>. This account will become the permanent owner of the application.
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="tokenInput">Claim Token (Single Use, 30-Day Expiry)</Label>
                  <Input
                    id="tokenInput"
                    required
                    value={rawToken}
                    onChange={(e) => setRawToken(e.target.value)}
                    placeholder="Paste your 64-character token"
                    className="font-mono text-xs"
                  />
                </div>

                {claimError && (
                  <Alert variant="destructive">
                    <AlertCircle className="w-4 h-4" />
                    <AlertTitle>Claim Error</AlertTitle>
                    <AlertDescription className="text-xs">{claimError}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  disabled={claiming}
                  className="w-full bg-sky-600 hover:bg-sky-700 text-white"
                >
                  {claiming ? "Verifying and Claiming..." : "Claim Application"}
                </Button>
              </form>
            )}
          </CardContent>

          <CardFooter className="justify-center border-t border-slate-100 pt-4">
            <Link to="/courses" className="text-xs text-slate-500 hover:text-slate-800">
              Return to Course Catalog
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
