import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Upload, Copy, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  COURSE_NAME, FULL_PRICE, INSTALLMENT_TOTAL, INSTALLMENT_AMOUNT,
  INSTALLMENT_SURCHARGE, type PaymentPlan,
} from "@/lib/pricing";
import fonepayQr from "@/assets/fonepay-qr.png";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  studentId: string | null;
  onSubmitted?: () => void;
}

const BANK_DETAILS = {
  name: "ELYSIAN CAPITAL PVT LTD",
  account: "55509351559",
  bank: "Siddhartha Bank Limited",
  branch: "OLDBANESHWOR",
};

const QR_PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'>
      <rect width='160' height='160' fill='white'/>
      <g fill='black'>
        ${Array.from({ length: 100 })
          .map(() => {
            const x = Math.floor(Math.random() * 16) * 10;
            const y = Math.floor(Math.random() * 16) * 10;
            return `<rect x='${x}' y='${y}' width='10' height='10'/>`;
          })
          .join("")}
        <rect x='0' y='0' width='40' height='40' fill='white' stroke='black' stroke-width='4'/>
        <rect x='10' y='10' width='20' height='20' fill='black'/>
        <rect x='120' y='0' width='40' height='40' fill='white' stroke='black' stroke-width='4'/>
        <rect x='130' y='10' width='20' height='20' fill='black'/>
        <rect x='0' y='120' width='40' height='40' fill='white' stroke='black' stroke-width='4'/>
        <rect x='10' y='130' width='20' height='20' fill='black'/>
      </g>
    </svg>`
  );

const generateRefId = () =>
  `FA-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 89999)}`;

const PaymentModal = ({ open, onOpenChange, studentId, onSubmitted }: Props) => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [plan, setPlan] = useState<PaymentPlan>("full");
  const [verifiedPayments, setVerifiedPayments] = useState<{ amount: number; installment_number: number }[]>([]);
  const [method, setMethod] = useState<"bank_transfer" | "fonepay" | "ips">("fonepay");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refId, setRefId] = useState("");

  // Determine which installment is due (1 or 2). Locked to plan stored on student.
  const installmentNumber =
    plan === "installment"
      ? (verifiedPayments.some(p => p.installment_number === 1) ? 2 : 1)
      : 0;

  const amountDue = plan === "full" ? FULL_PRICE : INSTALLMENT_AMOUNT;

  useEffect(() => {
    if (!open || !studentId) return;
    setStep(1);
    setProofFile(null);
    setRefId("");
    (async () => {
      const { data: s } = await supabase.from("students")
        .select("payment_plan").eq("id", studentId).maybeSingle();
      if (s?.payment_plan) setPlan(s.payment_plan as PaymentPlan);
      const { data: pays } = await supabase.from("payments")
        .select("amount, installment_number, status")
        .eq("student_id", studentId).eq("status", "verified");
      setVerifiedPayments(pays || []);
    })();
  }, [open, studentId]);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied` });
  };

  const handleSubmit = async () => {
    if (!studentId || !proofFile) return;
    setSubmitting(true);
    try {
      // Persist plan choice on student (so /payments page shows correct total)
      await supabase.from("students").update({ payment_plan: plan }).eq("id", studentId);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be signed in to submit payment.");
      const ext = proofFile.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("payment-proofs").upload(path, proofFile);
      if (upErr) throw upErr;
      const { data: urlData, error: urlError } = await supabase.storage.from("payment-proofs").createSignedUrl(path, 60 * 60); if (urlError) throw urlError; const proofUrl = urlData.signedUrl;

      const newRef = generateRefId();
      const installNum = plan === "full" ? 1 : installmentNumber;
      const { data: inserted, error } = await supabase.from("payments").insert({
        student_id: studentId,
        amount: amountDue,
        payment_method: method,
        transaction_reference: newRef,
        installment_number: installNum,
        proof_url: proofUrl,
        payment_date: new Date().toISOString(),
      }).select("id").single();
      if (error) throw error;

      // Lookup student details for emails
      const { data: student } = await supabase.from("students")
        .select("full_name, email, phone").eq("id", studentId).single();

      if (student) {
        const payload = {
          student: { full_name: student.full_name, email: student.email, phone: student.phone },
          payment: {
            id: inserted.id,
            reference: newRef,
            amount: amountDue,
            installment_number: installNum,
            is_full: plan === "full",
            date: new Date().toLocaleString(),
            payment_method: method,
            proof_url: proofUrl,
          },
        };
        // Fire both emails (don't block UI on errors)
        supabase.functions.invoke("payments-notify", {
          body: { ...payload, event: "submitted_student" },
        }).catch(e => console.error("student email", e));
        supabase.functions.invoke("payments-notify", {
          body: { ...payload, event: "submitted_admin" },
        }).catch(e => console.error("admin email", e));
      }

      setRefId(newRef);
      setStep(3);
      onSubmitted?.();
    } catch (err: unknown) {
      toast({
        title: "Submission failed",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const Stepper = () => (
    <div className="flex items-center justify-center gap-2 sm:gap-4 mb-6">
      {[1, 2, 3].map((n, i) => (
        <div key={n} className="flex items-center gap-2 sm:gap-4">
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                step >= n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground border border-border"
              )}
            >
              {step > n ? <CheckCircle2 className="w-4 h-4" /> : n}
            </div>
            <span className={cn("text-xs hidden sm:block", step >= n ? "text-foreground" : "text-muted-foreground")}>
              {["Booking", "Payment", "Confirm"][n - 1]}
            </span>
          </div>
          {i < 2 && <div className={cn("w-8 sm:w-12 h-0.5", step > n ? "bg-primary" : "bg-border")} />}
        </div>
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Make a payment</DialogTitle>
        </DialogHeader>
        <Stepper />

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-foreground">Step 1 — Book your course</h3>
              <p className="text-sm text-muted-foreground">Choose a payment plan</p>
            </div>
            <div className="space-y-3 rounded-lg border border-border p-4 bg-muted/30">
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select value={plan} onValueChange={(v) => setPlan(v as PaymentPlan)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full payment — Rs. {FULL_PRICE.toLocaleString()} (incl. 13% VAT)</SelectItem>
                    <SelectItem value="installment">2 installments — Rs. {INSTALLMENT_TOTAL.toLocaleString()} (incl. 13% VAT + Rs. {INSTALLMENT_SURCHARGE} surcharge)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">All prices are inclusive of 13% VAT.</p>
              </div>
              <div className="rounded-md bg-background border border-border p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount due now</span>
                  <span className="font-bold text-primary text-lg">Rs. {amountDue.toLocaleString()}</span>
                </div>
                {plan === "installment" && (
                  <p className="text-xs text-muted-foreground">
                    {installmentNumber === 1
                      ? `Half payment required to start. Remaining Rs. ${INSTALLMENT_AMOUNT.toLocaleString()} due later. Includes Rs. ${INSTALLMENT_SURCHARGE} installment fee.`
                      : `Final installment of 2.`}
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={() => setStep(2)}>Continue → Pay</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-foreground">Step 2 — Pay & upload proof</h3>
              <p className="text-sm text-muted-foreground">
                Scan the QR or transfer to bank, then upload screenshot.
              </p>
              <p className="text-lg font-bold text-primary mt-2">Rs. {amountDue.toLocaleString()}</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border p-4 flex flex-col items-center bg-card">
                <img src={fonepayQr} alt="FonePay QR code" className="w-40 h-40 object-contain" />
                <p className="text-xs text-muted-foreground mt-2 text-center">Scan with FonePay / eSewa / Khalti / Mobile Banking</p>
              </div>
              <div className="rounded-lg border border-border p-4 space-y-2 bg-card">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Or bank transfer</p>
                {[
                  { k: "A/C Holder", v: BANK_DETAILS.name },
                  { k: "Account No.", v: BANK_DETAILS.account, mono: true },
                  { k: "Bank", v: BANK_DETAILS.bank },
                  { k: "Branch", v: BANK_DETAILS.branch },
                ].map((row) => (
                  <div key={row.k} className="flex items-center justify-between text-sm gap-2">
                    <span className="text-muted-foreground">{row.k}</span>
                    <div className="flex items-center gap-1 min-w-0">
                      <span className={cn("font-medium truncate", row.mono && "font-mono")}>{row.v}</span>
                      <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => copy(row.v, row.k)}>
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Payment method used</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fonepay">QR — FonePay / eSewa / Khalti</SelectItem>
                  <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                  <SelectItem value="ips">IPS</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Upload payment screenshot</Label>
              <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <Upload className="w-6 h-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground mt-1">
                  {proofFile ? proofFile.name : "PNG, JPG up to 5 MB"}
                </span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button onClick={handleSubmit} disabled={!proofFile || submitting}>
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Submit for review
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 text-center py-2">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-green-600" />
            </div>
            <div>
              <h3 className="text-xl font-display font-bold text-foreground">Confirmation sent</h3>
              <p className="text-sm text-muted-foreground">Admin will verify your payment within 24 hours.</p>
            </div>
            <div className="rounded-lg border border-border p-4 text-left space-y-2 bg-muted/30">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Reference ID</span>
                <span className="font-mono font-medium">{refId}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-semibold">Rs. {amountDue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground">Status</span>
                <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Pending verification</Badge>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              You'll get an email once admin approves — usually within 24 hrs.
            </p>
            <Button className="w-full" onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PaymentModal;

