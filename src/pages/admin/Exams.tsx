import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import BatchMultiSelect from "@/components/admin/BatchMultiSelect";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { extractPdfText } from "@/lib/pdfText";
import { Plus, Trash2, ListChecks, BarChart3, Pencil, ClipboardCheck, RotateCcw, FileUp, Loader2, Sparkles } from "lucide-react";

interface DraftQuestion {
  question_text: string;
  options: string[];
  correct_index: number;
  marks: number;
}

interface Exam {
  id: string;
  title: string;
  description: string | null;
  batch_id: string | null;
  duration_minutes: number;
  pass_percentage: number;
  is_published: boolean;
  allow_retakes: boolean;
  created_at: string;
}

interface Question {
  id: string;
  exam_id: string;
  question_text: string;
  options: string[];
  correct_index: number;
  marks: number;
  display_order: number;
}

const emptyExam = {
  title: "",
  description: "",
  batches: [] as string[],
  duration_minutes: 30,
  pass_percentage: 50,
  is_published: false,
};

const Exams = () => {
  const { user } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [batches, setBatches] = useState<{ id: string; name: string }[]>([]);
  const [examBatches, setExamBatches] = useState<Record<string, string[]>>({});
  const [examRetakes, setExamRetakes] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  const [examDialog, setExamDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyExam);
  const [drafts, setDrafts] = useState<DraftQuestion[]>([]);
  const [parsing, setParsing] = useState(false);
  const [pdfName, setPdfName] = useState<string | null>(null);



  const [qExam, setQExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);

  const [resultsExam, setResultsExam] = useState<Exam | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [resultQuestions, setResultQuestions] = useState<Question[]>([]);
  const [expandedAttempt, setExpandedAttempt] = useState<string | null>(null);


  const load = async () => {
    setLoading(true);
    const [{ data: ex }, { data: b }, { data: eb }] = await Promise.all([
      supabase.from("exams").select("*").order("created_at", { ascending: false }),
      supabase.from("batches").select("id, name").order("start_date", { ascending: false }),
      supabase.from("exam_batches").select("exam_id, batch_id, allow_retakes"),
    ]);
    const map: Record<string, string[]> = {};
    const retakeMap: Record<string, string[]> = {};
    ((eb as any) ?? []).forEach((r: any) => {
      map[r.exam_id] = [...(map[r.exam_id] ?? []), r.batch_id];
      if (r.allow_retakes) {
        retakeMap[r.exam_id] = [...(retakeMap[r.exam_id] ?? []), r.batch_id];
      }
    });
    setExams((ex as any) ?? []);
    setBatches((b as any) ?? []);
    setExamBatches(map);
    setExamRetakes(retakeMap);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resetDrafts = () => { setDrafts([]); setPdfName(null); setParsing(false); };

  const openNew = () => { setEditingId(null); setForm(emptyExam); resetDrafts(); setExamDialog(true); };
  const openEdit = (e: Exam) => {
    setEditingId(e.id);
    setForm({
      title: e.title,
      description: e.description ?? "",
      batches: examBatches[e.id] ?? [],
      duration_minutes: e.duration_minutes,
      pass_percentage: e.pass_percentage,
      is_published: e.is_published,
    });
    resetDrafts();
    setExamDialog(true);
  };

  const handlePdf = async (file: File | null) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) return toast.error("PDF must be under 15MB");
    setParsing(true);
    setPdfName(file.name);
    try {
      const text = await extractPdfText(file);
      if (text.trim().length < 40) {
        throw new Error("No readable text found — this PDF looks scanned. Upload a text-based PDF.");
      }
      const { data, error } = await supabase.functions.invoke("parse-exam-pdf", { body: { text } });
      if (error) {
        const msg = (data as any)?.error || error.message;
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      const qs = ((data as any)?.questions ?? []) as DraftQuestion[];
      if (!qs.length) throw new Error("No questions were extracted from this PDF.");
      setDrafts(qs);
      if (!form.title.trim()) {
        setForm((p: any) => ({ ...p, title: file.name.replace(/\.pdf$/i, "").slice(0, 120) }));
      }
      toast.success(`${qs.length} question(s) extracted — review before publishing`);
    } catch (e: any) {
      setPdfName(null);
      toast.error(e.message || "Could not read this PDF");
    } finally {
      setParsing(false);
    }
  };

  const patchDraft = (i: number, patch: Partial<DraftQuestion>) =>
    setDrafts(prev => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));

  const patchDraftOption = (i: number, oi: number, value: string) =>
    setDrafts(prev => prev.map((d, idx) =>
      idx === i ? { ...d, options: d.options.map((o, k) => (k === oi ? value : o)) } : d));

  const removeDraft = (i: number) => setDrafts(prev => prev.filter((_, idx) => idx !== i));


  const syncBatches = async (examId: string, selected: string[]) => {
    const keepRetakes = examRetakes[examId] ?? [];
    await supabase.from("exam_batches").delete().eq("exam_id", examId);
    if (selected.length) {
      await supabase.from("exam_batches").insert(
        selected.map((batch_id) => ({
          exam_id: examId,
          batch_id,
          allow_retakes: keepRetakes.includes(batch_id),
        }))
      );
    }
    setExamRetakes(prev => ({
      ...prev,
      [examId]: keepRetakes.filter(id => selected.includes(id)),
    }));
  };

  const toggleGlobalRetake = async (e: Exam) => {
    const next = !e.allow_retakes;
    setExams(prev => prev.map(x => (x.id === e.id ? { ...x, allow_retakes: next } : x)));
    const { error } = await supabase.from("exams").update({ allow_retakes: next }).eq("id", e.id);
    if (error) { toast.error(error.message); return load(); }
    toast.success(next ? "Retakes enabled for all students" : "Retakes closed");
  };

  const toggleBatchRetake = async (examId: string, batchId: string) => {
    const current = examRetakes[examId] ?? [];
    const next = current.includes(batchId)
      ? current.filter(id => id !== batchId)
      : [...current, batchId];
    setExamRetakes(prev => ({ ...prev, [examId]: next }));
    const { error } = await supabase.from("exam_batches")
      .update({ allow_retakes: next.includes(batchId) })
      .eq("exam_id", examId).eq("batch_id", batchId);
    if (error) { toast.error(error.message); return load(); }
    toast.success(
      next.includes(batchId) ? "Retake unlocked for this batch" : "Retake locked for this batch"
    );
  };

  const saveExam = async () => {
    if (!form.title.trim()) return toast.error("Title is required");
    const payload = {
      title: form.title.trim(),
      description: form.description?.trim() || null,
      batch_id: null,
      duration_minutes: Number(form.duration_minutes) || 30,
      pass_percentage: Number(form.pass_percentage) || 50,
      is_published: form.is_published,
    };
    let examId = editingId;
    if (editingId) {
      const { error } = await supabase.from("exams").update(payload).eq("id", editingId);
      if (error) return toast.error(error.message);
    } else {
      const { data, error } = await supabase.from("exams")
        .insert({ ...payload, created_by: user?.id }).select("id").single();
      if (error) return toast.error(error.message);
      examId = (data as any).id;
    }
    if (examId) await syncBatches(examId, form.batches);

    if (examId && drafts.length) {
      const { count } = await supabase.from("exam_questions")
        .select("id", { count: "exact", head: true }).eq("exam_id", examId);
      const offset = count ?? 0;
      const { error: qErr } = await supabase.from("exam_questions").insert(
        drafts.map((d, i) => ({
          exam_id: examId,
          question_text: d.question_text.trim(),
          options: d.options.map(o => o.trim()).filter(Boolean) as any,
          correct_index: d.correct_index,
          marks: d.marks > 0 ? d.marks : 1,
          display_order: offset + i,
        }))
      );
      if (qErr) return toast.error(qErr.message);
    }

    toast.success(
      drafts.length
        ? `${editingId ? "Exam updated" : "Exam created"} with ${drafts.length} question(s)`
        : editingId ? "Exam updated" : "Exam created"
    );
    setExamDialog(false);
    resetDrafts();
    load();
  };


  const saveExamBatches = async (examId: string, ids: string[]) => {
    setExamBatches(prev => ({ ...prev, [examId]: ids }));
    await syncBatches(examId, ids);
    toast.success(ids.length ? "Batch access updated" : "Unlocked for all batches");
  };



  const togglePublish = async (e: Exam) => {
    const { error } = await supabase.from("exams").update({ is_published: !e.is_published }).eq("id", e.id);
    if (error) return toast.error(error.message);
    load();
  };

  const deleteExam = async (e: Exam) => {
    if (!confirm(`Delete "${e.title}" and all its questions and results?`)) return;
    const { error } = await supabase.from("exams").delete().eq("id", e.id);
    if (error) return toast.error(error.message);
    toast.success("Exam deleted");
    load();
  };

  const openQuestions = async (e: Exam) => {
    setQExam(e);
    const { data } = await supabase.from("exam_questions").select("*")
      .eq("exam_id", e.id).order("display_order", { ascending: true });
    setQuestions(((data as any) ?? []).map((q: any) => ({
      ...q,
      options: Array.isArray(q.options) ? q.options : [],
    })));
  };

  const addQuestion = async () => {
    if (!qExam) return;
    const { error } = await supabase.from("exam_questions").insert({
      exam_id: qExam.id,
      question_text: "New question",
      options: ["Option A", "Option B", "Option C", "Option D"],
      correct_index: 0,
      marks: 1,
      display_order: questions.length,
    });
    if (error) return toast.error(error.message);
    openQuestions(qExam);
  };

  const updateQuestion = async (q: Question, patch: Partial<Question>) => {
    setQuestions(prev => prev.map(x => (x.id === q.id ? { ...x, ...patch } as Question : x)));
    const { error } = await supabase.from("exam_questions").update(patch as any).eq("id", q.id);
    if (error) toast.error(error.message);
  };

  const deleteQuestion = async (q: Question) => {
    const { error } = await supabase.from("exam_questions").delete().eq("id", q.id);
    if (error) return toast.error(error.message);
    setQuestions(prev => prev.filter(x => x.id !== q.id));
  };

  const openResults = async (e: Exam) => {
    setResultsExam(e);
    setExpandedAttempt(null);
    const [{ data: attempts }, { data: qs }] = await Promise.all([
      supabase.from("exam_attempts").select("*")
        .eq("exam_id", e.id).order("submitted_at", { ascending: false }),
      supabase.from("exam_questions").select("*").eq("exam_id", e.id)
        .order("display_order").order("created_at"),
    ]);
    setResultQuestions(((qs as any) ?? []).map((q: any) => ({
      ...q, options: Array.isArray(q.options) ? q.options : [],
    })));
    const ids = [...new Set(((attempts as any) ?? []).map((a: any) => a.user_id))];
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("user_id, full_name, email").in("user_id", ids as string[])
      : { data: [] as any };
    const byUser: Record<string, any> = {};
    ((profiles as any) ?? []).forEach((p: any) => { byUser[p.user_id] = p; });
    setResults(((attempts as any) ?? []).map((a: any) => ({ ...a, profile: byUser[a.user_id] })));
  };


  const unlockedLabel = (examId: string) => {
    const ids = examBatches[examId] ?? [];
    if (ids.length === 0) return "All batches";
    return ids.map(id => batches.find(b => b.id === id)?.name ?? "Unknown batch").join(", ");
  };


  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-primary" /> Exams
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create online exams, add multiple-choice questions and review student results.
          </p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> New exam</Button>
      </div>

      {loading ? (
        <div>Loading exams…</div>
      ) : exams.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          No exams yet. Create your first exam to get started.
        </Card>
      ) : (
        <div className="space-y-4">
          {exams.map((e) => (
            <Card key={e.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{e.title}</p>
                    <Badge variant={e.is_published ? "default" : "secondary"}>
                      {e.is_published ? "Published" : "Draft"}
                    </Badge>
                  </div>
                  {e.description && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap break-words">{e.description}</p>}
                  <p className="text-xs text-muted-foreground mt-2">
                    Unlocked for: {unlockedLabel(e.id)} · {e.duration_minutes} min · pass {e.pass_percentage}%
                  </p>
                  <div className="mt-4 max-w-md">
                    <BatchMultiSelect
                      label="Unlocked for batches"
                      helpText="Select none to unlock for every batch. Students only see this exam if their batch is selected."
                      value={examBatches[e.id] ?? []}
                      onChange={(ids) => saveExamBatches(e.id, ids)}
                    />
                  </div>

                  <div className="mt-4 max-w-md rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <RotateCcw className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">Allow retakes for all students</span>
                      </div>
                      <Switch
                        checked={e.allow_retakes}
                        onCheckedChange={() => toggleGlobalRetake(e)}
                      />
                    </div>

                    {(examBatches[e.id] ?? []).length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Or unlock a retake for specific batches
                        </p>
                        {(examBatches[e.id] ?? []).map((batchId) => (
                          <label
                            key={batchId}
                            className={`flex items-center gap-2 text-sm cursor-pointer ${
                              e.allow_retakes ? "opacity-50 pointer-events-none" : ""
                            }`}
                          >
                            <Checkbox
                              checked={(examRetakes[e.id] ?? []).includes(batchId)}
                              onCheckedChange={() => toggleBatchRetake(e.id, batchId)}
                            />
                            {batches.find(b => b.id === batchId)?.name ?? "Unknown batch"}
                          </label>
                        ))}
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground mt-3">
                      {e.allow_retakes
                        ? "Every student can retake this exam. Their new score replaces the old one."
                        : (examRetakes[e.id] ?? []).length > 0
                          ? "Only the ticked batches can retake this exam."
                          : "Retakes are closed — each student can submit once."}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 mr-2">
                    <Switch checked={e.is_published} onCheckedChange={() => togglePublish(e)} />
                    <span className="text-xs text-muted-foreground">Live</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => openQuestions(e)}>
                    <ListChecks className="w-4 h-4 mr-1" /> Questions
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openResults(e)}>
                    <BarChart3 className="w-4 h-4 mr-1" /> Results
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(e)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteExam(e)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Exam form */}
      <Dialog open={examDialog} onOpenChange={setExamDialog}>
        <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Edit exam" : "New exam"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={(ev) => setForm({ ...form, title: ev.target.value })} />
            </div>
            <div>
              <Label>Instructions (optional)</Label>
              <Textarea rows={8} className="font-mono text-sm whitespace-pre-wrap" placeholder={"Instructions — paste freely. Line breaks, numbered lists and bullets are preserved.\n\n1. Read each question carefully.\n2. Only one answer is correct.\n\n• Do not refresh the page."} value={form.description} onChange={(ev) => setForm({ ...form, description: ev.target.value })} />
            </div>
            <div>
              <BatchMultiSelect
                label="Unlocked for batches"
                helpText="Select none to make it available to every batch."
                value={form.batches as string[]}
                onChange={(ids) => setForm({ ...form, batches: ids })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Duration (minutes)</Label>
                <Input type="number" value={form.duration_minutes}
                  onChange={(ev) => setForm({ ...form, duration_minutes: ev.target.value })} />
              </div>
              <div>
                <Label>Pass percentage</Label>
                <Input type="number" value={form.pass_percentage}
                  onChange={(ev) => setForm({ ...form, pass_percentage: ev.target.value })} />
              </div>
            </div>

            {/* PDF import */}
            <div className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <FileUp className="w-4 h-4 text-primary" />
                <Label className="mb-0">Upload question PDF (optional)</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Upload a text-based PDF of questions (with the answer key if available). Questions are
                converted into MCQs automatically — review and edit them below before saving. Scoring,
                percentage and pass/fail results work exactly like manually added questions.
              </p>
              <Input type="file" accept="application/pdf" disabled={parsing}
                onChange={(ev) => handlePdf(ev.target.files?.[0] ?? null)} />
              {parsing && (
                <p className="text-xs flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> Reading {pdfName} and generating questions…
                </p>
              )}
              {!parsing && drafts.length > 0 && (
                <p className="text-xs flex items-center gap-2 text-primary">
                  <Sparkles className="w-3 h-3" /> {drafts.length} question(s) ready from {pdfName}
                </p>
              )}
            </div>

            {drafts.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Review generated questions</p>
                  <Button variant="ghost" size="sm" onClick={resetDrafts}>Discard all</Button>
                </div>
                {drafts.map((d, i) => (
                  <Card key={i} className="p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-sm font-medium mt-2">{i + 1}.</span>
                      <Textarea rows={2} value={d.question_text}
                        onChange={(ev) => patchDraft(i, { question_text: ev.target.value })} />
                      <Button variant="ghost" size="sm" onClick={() => removeDraft(i)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="space-y-2 pl-6">
                      {d.options.map((opt, oi) => (
                        <label key={oi} className="flex items-center gap-2">
                          <input type="radio" name={`draft-${i}`} checked={d.correct_index === oi}
                            onChange={() => patchDraft(i, { correct_index: oi })} />
                          <Input value={opt} onChange={(ev) => patchDraftOption(i, oi, ev.target.value)} />
                        </label>
                      ))}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Marks</span>
                        <Input type="number" min={1} className="w-20" value={d.marks}
                          onChange={(ev) => patchDraft(i, { marks: Number(ev.target.value) || 1 })} />
                        <span className="text-xs text-muted-foreground">
                          Correct answer: option {d.correct_index + 1}
                        </span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Switch checked={form.is_published} onCheckedChange={(v) => setForm({ ...form, is_published: v })} />
              <span className="text-sm">Publish to students</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExamDialog(false)}>Cancel</Button>
            <Button onClick={saveExam} disabled={parsing}>
              {editingId ? "Save" : "Create"}{drafts.length ? ` + ${drafts.length} questions` : ""}
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>

      {/* Questions */}
      <Dialog open={!!qExam} onOpenChange={(o) => !o && setQExam(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Questions — {qExam?.title}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {questions.length === 0 && (
              <p className="text-sm text-muted-foreground">No questions yet.</p>
            )}
            {questions.map((q, idx) => (
              <Card key={q.id} className="p-3 space-y-3">
                <div className="flex items-start gap-2">
                  <span className="text-sm font-semibold mt-2">{idx + 1}.</span>
                  <Textarea
                    value={q.question_text}
                    onChange={(ev) => setQuestions(prev => prev.map(x => x.id === q.id ? { ...x, question_text: ev.target.value } : x))}
                    onBlur={(ev) => updateQuestion(q, { question_text: ev.target.value })}
                  />
                  <Button variant="ghost" size="sm" onClick={() => deleteQuestion(q)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
                <div className="space-y-2 pl-6">
                  {q.options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={q.correct_index === i}
                        onChange={() => updateQuestion(q, { correct_index: i })}
                        aria-label={`Mark option ${i + 1} correct`}
                      />
                      <Input
                        value={opt}
                        onChange={(ev) => setQuestions(prev => prev.map(x => x.id === q.id
                          ? { ...x, options: x.options.map((o, j) => (j === i ? ev.target.value : o)) } : x))}
                        onBlur={(ev) => updateQuestion(q, {
                          options: q.options.map((o, j) => (j === i ? ev.target.value : o)),
                        })}
                      />
                      {q.options.length > 2 && (
                        <Button variant="ghost" size="sm"
                          onClick={() => updateQuestion(q, { options: q.options.filter((_, j) => j !== i) })}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm"
                      onClick={() => updateQuestion(q, { options: [...q.options, `Option ${q.options.length + 1}`] })}>
                      <Plus className="w-3 h-3 mr-1" /> Option
                    </Button>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Marks</Label>
                      <Input type="number" className="w-20" value={q.marks}
                        onChange={(ev) => setQuestions(prev => prev.map(x => x.id === q.id ? { ...x, marks: Number(ev.target.value) } : x))}
                        onBlur={(ev) => updateQuestion(q, { marks: Number(ev.target.value) || 1 })} />
                    </div>
                  </div>
                </div>
              </Card>
            ))}
            <Button onClick={addQuestion}><Plus className="w-4 h-4 mr-2" /> Add question</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Results */}
      <Dialog open={!!resultsExam} onOpenChange={(o) => !o && setResultsExam(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Results — {resultsExam?.title}</DialogTitle></DialogHeader>
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground">No submissions yet.</p>
          ) : (
            <div className="space-y-2">
              {results.map((r) => (
                <div key={r.id} className="border border-border rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{r.profile?.full_name || r.profile?.email || "Student"}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.profile?.email} · {new Date(r.submitted_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{r.score}/{r.total_marks}</span>
                      <Badge variant={r.passed ? "default" : "destructive"}>{r.passed ? "Passed" : "Failed"}</Badge>
                      <Button variant="outline" size="sm"
                        onClick={() => setExpandedAttempt(expandedAttempt === r.id ? null : r.id)}>
                        {expandedAttempt === r.id ? "Hide answers" : "View answers"}
                      </Button>
                    </div>
                  </div>
                  {expandedAttempt === r.id && (
                    <div className="space-y-2 pt-2 border-t border-border">
                      {resultQuestions.map((q, idx) => {
                        const chosen = (r.answers ?? {})[q.id];
                        const correct = chosen === q.correct_index;
                        return (
                          <div key={q.id} className="text-sm">
                            <p className="font-medium flex items-start gap-2">
                              <span>{idx + 1}. {q.question_text}</span>
                              {chosen === undefined
                                ? <Badge variant="secondary">Skipped</Badge>
                                : correct
                                  ? <Badge>Correct</Badge>
                                  : <Badge variant="destructive">Wrong</Badge>}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Marked: {chosen === undefined ? "—" : (q.options[chosen] ?? "—")}
                              {" · "}Correct: {q.options[q.correct_index] ?? "—"}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}

            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Exams;
