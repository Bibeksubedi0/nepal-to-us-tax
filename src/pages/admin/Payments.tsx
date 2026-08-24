import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Search, CheckCircle, XCircle, Eye, Trash2, ChevronDown, ChevronRight,
  AlertTriangle, FileText, Upload, Pencil,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  expectedTotal, expectedPerInstallment, FULL_TOTAL,
} from "@/lib/pricing";
import InvoiceDialog from "@/components/admin/InvoiceDialog";
import UploadPaymentDialog from "@/components/admin/UploadPaymentDialog";

interface PaymentWithStudent {
  id: string;
  amount: number;
  payment_method: string | null;
  transaction_reference: string | null;
  installment_number: number;
  status: string;
  payment_date: string | null;
  proof_url: string | null;
  rejection_reason: string | null;
  created_at: string;
  student_id: string;
  students: { full_name: string; email: string; phone: string | null; payment_plan: string | null; batch_id: string | null; custom_fee: number | null } | null;
}

interface StudentGroup {
  key: string;
  studentId: string;
  name: string;
  email: string;
  phone: string | null;
  payments: PaymentWithStudent[];
  plan: "full" | "installment";
  installmentCount: number;
  expected: number;
  expectedPer: number;
  totalPaid: number;
  pendingTotal: number;
  balance: number;
  overallStatus: "fully_paid" | "partially_paid" | "pending" | "rejected";
  batchId: string | null;
  customFee: number | null;
}

const statusBadge: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending_verification: { label: "Pending", variant: "outline" },
  verified: { label: "Approved", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
  overdue: { label: "Overdue", variant: "destructive" },
};

const overallBadge = (s: StudentGroup["overallStatus"]) => {
  switch (s) {
    case "fully_paid": return { label: "Fully Paid", className: "bg-emerald-600 hover:bg-emerald-600 text-white" };
    case "partially_paid": return { label: "Partially Paid", className: "bg-amber-500 hover:bg-amber-500 text-white" };
    case "rejected": return { label: "Rejected", className: "bg-destructive hover:bg-destructive text-destructive-foreground" };
    default: return { label: "Pending", className: "bg-muted text-foreground" };
  }
};

const fmt = (n: number) => `NPR ${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
// Fees are VAT-inclusive: VAT is extracted out of the total (13/113), never added on top.
const vatOf = (total: number) => Math.round(total * (13 / 113) * 100) / 100;
const exVatOf = (total: number) => Math.round((total - vatOf(total)) * 100) / 100;

const Payments = () => {
  const [payments, setPayments] = useState<PaymentWithStudent[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending_verification" | "verified" | "rejected">("all");
  const [batchFilter, setBatchFilter] = useState<string>("all");
  const [batches, setBatches] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<PaymentWithStudent | null>(null);
  const [rejectingPayment, setRejectingPayment] = useState<PaymentWithStudent | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [deletingPayment, setDeletingPayment] = useState<PaymentWithStudent | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [invoiceGroup, setInvoiceGroup] = useState<StudentGroup | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadStudentId, setUploadStudentId] = useState<string | null>(null);
  const [feeGroup, setFeeGroup] = useState<StudentGroup | null>(null);
  const [feeValue, setFeeValue] = useState("");
  const [savingFee, setSavingFee] = useState(false);

  const openFeeDialog = (g: StudentGroup) => {
    setFeeGroup(g);
    setFeeValue(g.customFee !== null ? String(g.customFee) : String(g.expected));
  };

  const saveFee = async (reset = false) => {
    if (!feeGroup) return;
    const value = reset ? null : Number(feeValue);
    if (!reset && (!Number.isFinite(value as number) || (value as number) < 0)) {
      toast.error("Enter a valid amount"); return;
    }
    setSavingFee(true);
    const { error } = await supabase.from("students")
      .update({ custom_fee: value })
      .eq("id", feeGroup.studentId);
    setSavingFee(false);
    if (error) { toast.error("Failed to update fee"); return; }
    toast.success(reset ? "Fee reset to standard" : "Fee updated");
    setFeeGroup(null);
    fetchPayments();
  };

  const resolveProofUrl = async (rawUrl: string | null): Promise<string | null> => {
    if (!rawUrl) return null;
    let path = rawUrl;
    const marker = "/payment-proofs/";
    const idx = rawUrl.indexOf(marker);
    if (idx !== -1) path = rawUrl.substring(idx + marker.length);
    const { data, error } = await supabase.storage
      .from("payment-proofs")
      .createSignedUrl(path, 60 * 60);
    if (error) { console.error("signed url error", error); return null; }
    return data.signedUrl;
  };

  const fetchPayments = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("payments")
      .select("*, students(full_name, email, phone, payment_plan, batch_id, custom_fee)")
      .order("created_at", { ascending: false });
    const rows = (data as unknown as PaymentWithStudent[]) || [];
    const resolved = await Promise.all(
      rows.map(async (p) => ({ ...p, proof_url: await resolveProofUrl(p.proof_url) }))
    );
    setPayments(resolved);
    setLoading(false);
  };

  useEffect(() => {
    fetchPayments();
    supabase.from("batches").select("id, name").order("start_date", { ascending: false })
      .then(({ data }) => setBatches(data || []));
  }, []);

  // Group by student email (fallback student_id)
  const groups = useMemo<StudentGroup[]>(() => {
    const map = new Map<string, PaymentWithStudent[]>();
    for (const p of payments) {
      const key = (p.students?.email || p.student_id || "").toLowerCase();
      if (!key) continue;
      const arr = map.get(key) || [];
      arr.push(p);
      map.set(key, arr);
    }
    const out: StudentGroup[] = [];
    for (const [key, rows] of map.entries()) {
      const sorted = rows.slice().sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const first = sorted[0];
      // Plan source of truth: students.payment_plan. Fallback to derivation from rows for legacy data.
      const studentPlan = (first.students?.payment_plan || "").toLowerCase();
      const maxInstallment = Math.max(...sorted.map(p => p.installment_number || 1));
      const plan: "full" | "installment" =
        studentPlan === "installment" ? "installment" :
        studentPlan === "full" ? "full" :
        (sorted.length > 1 || maxInstallment > 1 ? "installment" : "full");
      const installmentCount = plan === "installment" ? Math.max(2, maxInstallment) : 1;
      const rawCustomFee = first.students?.custom_fee;
      const customFee = rawCustomFee === null || rawCustomFee === undefined ? null : Number(rawCustomFee);
      const expected = customFee !== null ? customFee : expectedTotal(plan);
      const expectedPer = customFee !== null
        ? Math.round((customFee / Math.max(1, installmentCount)) * 100) / 100
        : expectedPerInstallment(plan, installmentCount);
      const totalPaid = sorted
        .filter(p => p.status === "verified")
        .reduce((s, p) => s + Number(p.amount), 0);
      const pendingTotal = sorted
        .filter(p => p.status === "pending_verification")
        .reduce((s, p) => s + Number(p.amount), 0);
      const balance = Math.max(0, expected - totalPaid);
      let overallStatus: StudentGroup["overallStatus"];
      if (totalPaid >= expected) overallStatus = "fully_paid";
      else if (totalPaid > 0) overallStatus = "partially_paid";
      else if (sorted.length > 0 && sorted.every(p => p.status === "rejected")) overallStatus = "rejected";
      else overallStatus = "pending";

      out.push({
        key,
        studentId: first.student_id,
        name: first.students?.full_name || "—",
        email: first.students?.email || key,
        phone: first.students?.phone || null,
        payments: sorted,
        plan, installmentCount, expected, expectedPer,
        totalPaid, pendingTotal, balance, overallStatus,
        batchId: first.students?.batch_id || null,
        customFee,
      });
    }
    // Most-recently-active groups first
    out.sort((a, b) => {
      const ax = Math.max(...a.payments.map(p => new Date(p.created_at).getTime()));
      const bx = Math.max(...b.payments.map(p => new Date(p.created_at).getTime()));
      return bx - ax;
    });
    return out;
  }, [payments]);

  // Filter groups by status + search
  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups.filter(g => {
      if (batchFilter !== "all") {
        if (batchFilter === "none" ? g.batchId !== null : g.batchId !== batchFilter) return false;
      }
      // Status filter: group has at least one matching payment
      if (statusFilter !== "all") {
        const hasMatch = g.payments.some(p => p.status === statusFilter);
        if (!hasMatch) return false;
      }
      if (!q) return true;
      if (g.name.toLowerCase().includes(q)) return true;
      if (g.email.toLowerCase().includes(q)) return true;
      if (g.payments.some(p => (p.transaction_reference || "").toLowerCase().includes(q))) return true;
      return false;
    });
  }, [groups, search, statusFilter, batchFilter]);

  // Status counts: number of students with ≥1 matching payment
  const statusCounts = useMemo(() => {
    const c = { all: groups.length, pending_verification: 0, verified: 0, rejected: 0 };
    for (const g of groups) {
      if (g.payments.some(p => p.status === "pending_verification")) c.pending_verification++;
      if (g.payments.some(p => p.status === "verified")) c.verified++;
      if (g.payments.some(p => p.status === "rejected")) c.rejected++;
    }
    return c;
  }, [groups]);

  const sendStatusEmail = async (payment: PaymentWithStudent, event: "approved" | "rejected", reason?: string) => {
    if (!payment.students) return;
    await supabase.functions.invoke("payments-notify", {
      body: {
        event,
        student: {
          full_name: payment.students.full_name,
          email: payment.students.email,
          phone: payment.students.phone,
        },
        payment: {
          id: payment.id,
          reference: payment.transaction_reference || "",
          amount: Number(payment.amount),
          installment_number: payment.installment_number,
          is_full: payment.installment_number === 1 && Number(payment.amount) === 20000,
          payment_method: payment.payment_method,
          rejection_reason: reason,
        },
      },
    }).catch(e => console.error("status email", e));
  };

  const approvePayment = async (payment: PaymentWithStudent) => {
    const { error } = await supabase.from("payments").update({ status: "verified" }).eq("id", payment.id);
    if (error) { toast.error("Failed to update"); return; }
    toast.success("Payment approved");
    sendStatusEmail(payment, "approved");
    fetchPayments();
    setSelectedPayment(null);
  };

  const confirmReject = async () => {
    if (!rejectingPayment) return;
    if (!rejectReason.trim()) { toast.error("Please enter a reason"); return; }
    const { error } = await supabase.from("payments").update({
      status: "rejected", rejection_reason: rejectReason.trim(),
    }).eq("id", rejectingPayment.id);
    if (error) { toast.error("Failed to update"); return; }
    toast.success("Payment rejected");
    sendStatusEmail(rejectingPayment, "rejected", rejectReason.trim());
    setRejectingPayment(null);
    setRejectReason("");
    setSelectedPayment(null);
    fetchPayments();
  };

  const confirmDelete = async () => {
    if (!deletingPayment) return;
    const { error } = await supabase.from("payments").delete().eq("id", deletingPayment.id);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success("Payment deleted");
    setDeletingPayment(null);
    setSelectedPayment(null);
    fetchPayments();
  };

  const statusTabs: Array<{ key: typeof statusFilter; label: string; count: number; cls: string }> = [
    { key: "all", label: "All", count: statusCounts.all, cls: "bg-muted text-foreground" },
    { key: "pending_verification", label: "Pending", count: statusCounts.pending_verification, cls: "bg-amber-100 text-amber-900" },
    { key: "verified", label: "Approved", count: statusCounts.verified, cls: "bg-emerald-100 text-emerald-900" },
    { key: "rejected", label: "Rejected", count: statusCounts.rejected, cls: "bg-red-100 text-red-900" },
  ];

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Payments</h1>
            <p className="text-muted-foreground">Grouped by student — review, approve and invoice in one place.</p>
          </div>
          <Button onClick={() => { setUploadStudentId(null); setUploadOpen(true); }}>
            <Upload className="w-4 h-4 mr-2" /> Upload Payment
          </Button>
        </div>

        <Card className="border border-border">
          <CardContent className="p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search by name, email, or reference..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground shrink-0">Batch:</span>
              <Select value={batchFilter} onValueChange={setBatchFilter}>
                <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All batches</SelectItem>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {batches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              {statusTabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => setStatusFilter(t.key)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm font-medium transition border",
                    statusFilter === t.key ? "border-primary ring-2 ring-primary/30" : "border-transparent",
                    t.cls,
                  )}
                >
                  {t.label} <span className="ml-1 opacity-70">({t.count})</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {loading ? (
            <Card className="border border-border"><CardContent className="py-10 text-center text-muted-foreground">Loading...</CardContent></Card>
          ) : filteredGroups.length === 0 ? (
            <Card className="border border-border"><CardContent className="py-10 text-center text-muted-foreground">No payments found</CardContent></Card>
          ) : filteredGroups.map(group => {
            const isOpen = !!expanded[group.key];
            const oBadge = overallBadge(group.overallStatus);
            const progress = group.expected > 0 ? Math.min(100, (group.totalPaid / group.expected) * 100) : 0;
            return (
              <Card key={group.key} className="border border-border">
                <Collapsible open={isOpen} onOpenChange={(o) => setExpanded(s => ({ ...s, [group.key]: o }))}>
                  <CollapsibleTrigger asChild>
                    <button className="w-full text-left p-4 hover:bg-muted/40 transition rounded-t-lg">
                      <div className="flex items-start gap-3">
                        <div className="mt-1">{isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-semibold truncate">{group.name}</div>
                            <Badge className={cn("border-0", oBadge.className)}>{oBadge.label}</Badge>
                            <Badge variant="outline" className="text-xs">{group.plan === "installment" ? `Installment · ${group.installmentCount}x` : "Full Payment"}</Badge>
                            {group.customFee !== null && <Badge variant="outline" className="text-xs">Custom fee</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{group.email}</div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                            <span className="text-muted-foreground">Expected: <span className="font-semibold text-foreground">{fmt(group.expected)}</span></span>
                            <span className="text-muted-foreground">Paid: <span className="font-semibold text-emerald-600">{fmt(group.totalPaid)}</span></span>
                            <span className="text-muted-foreground">Pending: <span className="font-semibold text-amber-600">{fmt(group.pendingTotal)}</span></span>
                            <span className="text-muted-foreground">Balance: <span className={cn("font-semibold", group.balance > 0 ? "text-destructive" : "text-emerald-600")}>{fmt(group.balance)}</span></span>
                          </div>
                          <Progress value={progress} className="h-1.5 mt-2" />
                        </div>
                        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end" onClick={e => e.stopPropagation()}>
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openFeeDialog(group); }}>
                            <Pencil className="w-4 h-4 mr-1.5" /> Adjust Fee
                          </Button>
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setUploadStudentId(group.studentId); setUploadOpen(true); }}>
                            <Upload className="w-4 h-4 mr-1.5" /> Upload
                          </Button>
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setInvoiceGroup(group); }}>
                            <FileText className="w-4 h-4 mr-1.5" /> Invoice
                          </Button>
                        </div>
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4">
                      <div className="rounded-md border border-border bg-muted/20 p-3 mb-3 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                        <div><div className="text-xs text-muted-foreground">Plan</div><div className="font-medium">{group.plan === "installment" ? `Installment · ${group.installmentCount}` : "Full"}</div></div>
                        <div><div className="text-xs text-muted-foreground">Expected/installment</div><div className="font-medium">{fmt(group.expectedPer)}</div></div>
                        <div><div className="text-xs text-muted-foreground">Paid (approved)</div><div className="font-medium text-emerald-600">{fmt(group.totalPaid)}</div></div>
                        <div><div className="text-xs text-muted-foreground">Pending</div><div className="font-medium text-amber-600">{fmt(group.pendingTotal)}</div></div>
                        <div><div className="text-xs text-muted-foreground">Balance</div><div className={cn("font-medium", group.balance > 0 ? "text-destructive" : "text-emerald-600")}>{fmt(group.balance)}</div></div>
                      </div>

                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Proof</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead className="hidden md:table-cell">Method</TableHead>
                            <TableHead className="hidden lg:table-cell">Reference</TableHead>
                            <TableHead className="hidden md:table-cell">Installment</TableHead>
                            <TableHead className="hidden md:table-cell">Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.payments.map(payment => {
                            const status = statusBadge[payment.status] || { label: payment.status, variant: "outline" as const };
                            const expectedForRow = group.plan === "installment" ? group.expectedPer : FULL_TOTAL;
                            const mismatch = Math.abs(Number(payment.amount) - expectedForRow) > 0.5;
                            return (
                              <TableRow key={payment.id}>
                                <TableCell>
                                  {payment.proof_url ? (
                                    <a href={payment.proof_url} target="_blank" rel="noopener noreferrer">
                                      <img src={payment.proof_url} alt="proof" className="w-12 h-12 object-cover rounded border hover:ring-2 hover:ring-primary cursor-zoom-in" />
                                    </a>
                                  ) : "—"}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1.5">
                                    {fmt(Number(payment.amount))}
                                    {mismatch && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          Amount doesn't match expected installment of {fmt(expectedForRow)}
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="hidden md:table-cell capitalize">{payment.payment_method?.replace("_", " ") || "—"}</TableCell>
                                <TableCell className="hidden lg:table-cell font-mono text-xs">{payment.transaction_reference || "—"}</TableCell>
                                <TableCell className="hidden md:table-cell">#{payment.installment_number} of {group.installmentCount}</TableCell>
                                <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                                  {new Date(payment.payment_date || payment.created_at).toLocaleDateString()}
                                </TableCell>
                                <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedPayment(payment)}>
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                    {payment.status === "pending_verification" && (
                                      <>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600" onClick={() => approvePayment(payment)}>
                                          <CheckCircle className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setRejectingPayment(payment); setRejectReason(""); }}>
                                          <XCircle className="w-4 h-4" />
                                        </Button>
                                      </>
                                    )}
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeletingPayment(payment)}>
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>

        {/* Payment Detail Dialog */}
        <Dialog open={!!selectedPayment} onOpenChange={(open) => !open && setSelectedPayment(null)}>
          <DialogContent>
            {selectedPayment && (
              <>
                <DialogHeader><DialogTitle>Payment Details</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-muted-foreground">Student:</span><p className="font-medium">{selectedPayment.students?.full_name}</p></div>
                    <div><span className="text-muted-foreground">Email:</span><p className="font-medium">{selectedPayment.students?.email}</p></div>
                    <div><span className="text-muted-foreground">Phone:</span><p className="font-medium">{selectedPayment.students?.phone || "—"}</p></div>
                    <div><span className="text-muted-foreground">Amount:</span><p className="font-medium">{fmt(Number(selectedPayment.amount))}</p></div>
                    <div><span className="text-muted-foreground">Method:</span><p className="font-medium capitalize">{selectedPayment.payment_method?.replace("_", " ") || "—"}</p></div>
                    <div><span className="text-muted-foreground">Reference:</span><p className="font-medium font-mono">{selectedPayment.transaction_reference || "—"}</p></div>
                    <div><span className="text-muted-foreground">Installment:</span><p className="font-medium">#{selectedPayment.installment_number}</p></div>
                    <div><span className="text-muted-foreground">Date:</span><p className="font-medium">{selectedPayment.payment_date ? new Date(selectedPayment.payment_date).toLocaleDateString() : "—"}</p></div>
                  </div>
                  {selectedPayment.rejection_reason && (
                    <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm">
                      <p className="text-destructive font-medium">Rejection reason</p>
                      <p>{selectedPayment.rejection_reason}</p>
                    </div>
                  )}
                  {selectedPayment.proof_url && (
                    <div>
                      <span className="text-muted-foreground text-sm">Payment Proof:</span>
                      <img src={selectedPayment.proof_url} alt="Payment proof" className="mt-2 rounded-lg border max-h-64 object-contain" />
                    </div>
                  )}
                  {selectedPayment.status === "pending_verification" && (
                    <div className="flex gap-2">
                      <Button className="flex-1" onClick={() => approvePayment(selectedPayment)}>
                        <CheckCircle className="w-4 h-4 mr-2" /> Approve
                      </Button>
                      <Button variant="destructive" className="flex-1" onClick={() => { setRejectingPayment(selectedPayment); setRejectReason(""); }}>
                        <XCircle className="w-4 h-4 mr-2" /> Reject
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Reject Reason Dialog */}
        <Dialog open={!!rejectingPayment} onOpenChange={(open) => { if (!open) { setRejectingPayment(null); setRejectReason(""); } }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Reject payment</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">The student will be emailed this reason and asked to try again.</p>
              <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="e.g. Screenshot is unclear, amount doesn't match..." rows={4} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setRejectingPayment(null); setRejectReason(""); }}>Cancel</Button>
              <Button variant="destructive" onClick={confirmReject}>Confirm rejection</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deletingPayment} onOpenChange={(open) => !open && setDeletingPayment(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this payment?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the payment record
                {deletingPayment?.students?.full_name ? ` for ${deletingPayment.students.full_name}` : ""}
                {" "}({fmt(Number(deletingPayment?.amount || 0))}). This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Invoice Dialog */}
        <InvoiceDialog
          open={!!invoiceGroup}
          onOpenChange={(o) => !o && setInvoiceGroup(null)}
          student={invoiceGroup ? {
            id: invoiceGroup.studentId,
            full_name: invoiceGroup.name,
            email: invoiceGroup.email,
            phone: invoiceGroup.phone,
          } : null}
          plan={invoiceGroup?.plan || "full"}
          payments={invoiceGroup?.payments || []}
          totalPaid={invoiceGroup?.totalPaid || 0}
          expected={invoiceGroup?.expected}
        />

        {/* Adjust Fee Dialog */}
        <Dialog open={!!feeGroup} onOpenChange={(o) => !o && setFeeGroup(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Adjust fee</DialogTitle>
              <DialogDescription>{feeGroup?.name} — {feeGroup?.email}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Total fee, VAT inclusive (NPR)</label>
                <Input
                  type="number" min={0} step={100}
                  value={feeValue}
                  onChange={e => setFeeValue(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Standard fee is {fmt(FULL_TOTAL)}. A custom amount applies to this student only.
                </p>
              </div>
              {Number.isFinite(Number(feeValue)) && Number(feeValue) > 0 && (
                <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Amount excl. VAT</span><span className="font-medium tabular-nums">{fmt(exVatOf(Number(feeValue)))}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">VAT 13% (included)</span><span className="font-medium tabular-nums">{fmt(vatOf(Number(feeValue)))}</span></div>
                  <div className="flex justify-between border-t border-border pt-1.5"><span className="font-medium">Total payable</span><span className="font-semibold tabular-nums">{fmt(Number(feeValue))}</span></div>
                </div>
              )}
            </div>
            <DialogFooter className="gap-2">
              {feeGroup?.customFee !== null && (
                <Button variant="outline" disabled={savingFee} onClick={() => saveFee(true)}>Reset to standard</Button>
              )}
              <Button disabled={savingFee} onClick={() => saveFee(false)}>Save fee</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Upload Payment Dialog */}
        <UploadPaymentDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          defaultStudentId={uploadStudentId}
          onSaved={fetchPayments}
        />
      </div>
    </TooltipProvider>
  );
};

export default Payments;
