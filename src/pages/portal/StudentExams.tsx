import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ClipboardCheck, Clock, CheckCircle2, XCircle, RotateCcw } from "lucide-react";

interface Exam {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  pass_percentage: number;
}

interface Question {
  id: string;
  question_text: string;
  options: string[];
  marks: number;
  display_order: number;
}

interface Attempt {
  exam_id: string;
  score: number;
  total_marks: number;
  passed: boolean;
  submitted_at: string;
}

const StudentExams = () => {
  const { user } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [attempts, setAttempts] = useState<Record<string, Attempt>>({});
  const [retakeable, setRetakeable] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const [active, setActive] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [review, setReview] = useState<Exam | null>(null);
  const [reviewQuestions, setReviewQuestions] = useState<(Question & { correct_index: number })[]>([]);
  const [reviewAnswers, setReviewAnswers] = useState<Record<string, number>>({});


  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: ex }, { data: at }] = await Promise.all([
      supabase.from("exams").select("id, title, description, duration_minutes, pass_percentage")
        .eq("is_published", true).order("created_at", { ascending: false }),
      supabase.from("exam_attempts").select("exam_id, score, total_marks, passed, submitted_at")
        .eq("user_id", user.id),
    ]);
    const list = ((ex as any) ?? []) as Exam[];
    setExams(list);
    const map: Record<string, Attempt> = {};
    ((at as any) ?? []).forEach((a: Attempt) => { map[a.exam_id] = a; });
    setAttempts(map);

    // Only exams the student already attempted need a retake check
    const attemptedIds = list.filter(e => map[e.id]).map(e => e.id);
    if (attemptedIds.length) {
      const checks = await Promise.all(
        attemptedIds.map(id => supabase.rpc("can_retake_exam", { _exam_id: id }))
      );
      const rmap: Record<string, boolean> = {};
      attemptedIds.forEach((id, i) => { rmap[id] = checks[i].data === true; });
      setRetakeable(rmap);
    } else {
      setRetakeable({});
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  useEffect(() => {
    if (!active || !deadline) return;
    const tick = () => {
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) submit(true);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, deadline]);

  const start = async (exam: Exam) => {
    const { data, error } = await supabase.rpc("get_exam_questions", { _exam_id: exam.id });
    if (error) return toast.error(error.message);
    const qs = ((data as any) ?? []).map((q: any) => ({
      ...q, options: Array.isArray(q.options) ? q.options : [],
    }));
    if (qs.length === 0) return toast.error("This exam has no questions yet.");
    setQuestions(qs);
    setAnswers({});
    setActive(exam);
    setSecondsLeft(exam.duration_minutes * 60);
    setDeadline(Date.now() + exam.duration_minutes * 60 * 1000);
  };

  const openReview = async (exam: Exam) => {
    const [{ data: qs, error }, { data: at }] = await Promise.all([
      supabase.rpc("get_exam_review", { _exam_id: exam.id }),
      supabase.from("exam_attempts").select("answers, score, total_marks, passed, submitted_at")
        .eq("exam_id", exam.id).eq("user_id", user!.id).maybeSingle(),
    ]);
    if (error) return toast.error(error.message);
    setReviewQuestions(((qs as any) ?? []).map((q: any) => ({
      ...q, options: Array.isArray(q.options) ? q.options : [],
    })));
    setReviewAnswers(((at as any)?.answers ?? {}) as Record<string, number>);
    setReview(exam);
  };

  const submit = async (auto = false) => {
    if (!active || submitting) return;
    if (!auto) {
      const unanswered = questions.filter(q => answers[q.id] === undefined).length;
      if (unanswered > 0 && !confirm(`${unanswered} question(s) unanswered. Submit anyway?`)) return;
    }
    setSubmitting(true);
    const examJustDone = active;
    const { error } = await supabase.rpc("submit_exam_attempt", {
      _exam_id: active.id,
      _answers: answers as any,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(auto ? "Time is up — exam submitted" : "Exam submitted");
    setActive(null);
    setDeadline(null);
    setQuestions([]);
    await load();
    openReview(examJustDone);
  };

  const mmss = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  if (review) {
    const a = attempts[review.id];
    return (
      <div className="space-y-4 max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-display font-bold">{review.title} — Review</h1>
            {a && (
              <p className="text-sm text-muted-foreground mt-1">
                Score {a.score}/{a.total_marks} · {a.passed ? "Passed" : "Failed"}
              </p>
            )}
          </div>
          <Button variant="outline" onClick={() => setReview(null)}>Back to exams</Button>
        </div>
        {reviewQuestions.map((q, idx) => {
          const chosen = reviewAnswers[q.id];
          const correct = chosen === q.correct_index;
          return (
            <Card key={q.id} className="p-4 space-y-3">
              <p className="font-medium flex items-start gap-2">
                <span>{idx + 1}. {q.question_text}</span>
                {chosen === undefined ? (
                  <Badge variant="secondary">Skipped</Badge>
                ) : correct ? (
                  <Badge><CheckCircle2 className="w-3 h-3 mr-1" /> Correct</Badge>
                ) : (
                  <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Wrong</Badge>
                )}
              </p>
              <div className="space-y-2">
                {q.options.map((opt, i) => {
                  const isCorrect = i === q.correct_index;
                  const isChosen = i === chosen;
                  return (
                    <div
                      key={i}
                      className={`flex items-center justify-between gap-2 text-sm p-2 rounded border ${
                        isCorrect
                          ? "border-primary bg-primary/10"
                          : isChosen
                            ? "border-destructive bg-destructive/10"
                            : "border-border"
                      }`}
                    >
                      <span>{opt}</span>
                      <span className="text-xs text-muted-foreground">
                        {isCorrect && "Correct answer"}
                        {isChosen && !isCorrect && "Your answer"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    );
  }


  if (active) {
    return (
      <div className="space-y-4 max-w-3xl">
        <div className="flex items-center justify-between sticky top-0 bg-background py-2 z-10">
          <h1 className="text-xl font-display font-bold">{active.title}</h1>
          <Badge variant={secondsLeft < 60 ? "destructive" : "secondary"} className="text-sm">
            <Clock className="w-3 h-3 mr-1" /> {mmss(Math.max(secondsLeft, 0))}
          </Badge>
        </div>
        {active.description && (
          <Card className="p-4 bg-muted/40">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words leading-relaxed">{active.description}</p>
          </Card>
        )}
        {questions.map((q, idx) => (
          <Card key={q.id} className="p-4 space-y-3">
            <p className="font-medium">
              {idx + 1}. {q.question_text}
              <span className="text-xs text-muted-foreground ml-2">({q.marks} mark{q.marks > 1 ? "s" : ""})</span>
            </p>
            <div className="space-y-2">
              {q.options.map((opt, i) => (
                <label key={i} className="flex items-center gap-2 text-sm p-2 rounded hover:bg-accent cursor-pointer">
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === i}
                    onChange={() => setAnswers({ ...answers, [q.id]: i })}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </Card>
        ))}
        <div className="flex gap-2">
          <Button onClick={() => submit(false)} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit exam"}
          </Button>
          <Button variant="outline" onClick={() => { setActive(null); setDeadline(null); setQuestions([]); }}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <ClipboardCheck className="w-6 h-6 text-primary" /> Exams
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Take your course exams and view your results.
        </p>
      </div>

      {loading ? (
        <div>Loading exams…</div>
      ) : exams.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          No exams available right now.
        </Card>
      ) : (
        <div className="space-y-4">
          {exams.map((e) => {
            const a = attempts[e.id];
            return (
              <Card key={e.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{e.title}</p>
                  {e.description && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap break-words leading-relaxed">{e.description}</p>}
                  <p className="text-xs text-muted-foreground mt-2">
                    {e.duration_minutes} minutes · pass mark {e.pass_percentage}%
                  </p>
                </div>
                {a ? (
                  <div className="text-right">
                    <p className="text-sm font-semibold">{a.score}/{a.total_marks}</p>
                    <Badge variant={a.passed ? "default" : "destructive"} className="mt-1">
                      {a.passed
                        ? <><CheckCircle2 className="w-3 h-3 mr-1" /> Passed</>
                        : <><XCircle className="w-3 h-3 mr-1" /> Failed</>}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(a.submitted_at).toLocaleDateString()}
                    </p>
                    <div className="flex flex-wrap justify-end gap-2 mt-2">
                      <Button variant="outline" size="sm" onClick={() => openReview(e)}>
                        Review answers
                      </Button>
                      {retakeable[e.id] && (
                        <Button size="sm" onClick={() => start(e)}>
                          <RotateCcw className="w-3 h-3 mr-1" /> Retake exam
                        </Button>
                      )}
                    </div>
                    {retakeable[e.id] && (
                      <p className="text-xs text-muted-foreground mt-2 max-w-[16rem]">
                        A retake is open — your new score will replace this one.
                      </p>
                    )}
                  </div>

                ) : (
                  <Button onClick={() => start(e)}>Start exam</Button>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StudentExams;
