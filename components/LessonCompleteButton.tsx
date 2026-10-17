"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Props = {
  lessonId: string;
};

export function LessonCompleteButton({ lessonId }: Props) {
  const [state, setState] = useState<
    "loading" | "signed-out" | "not-done" | "done"
  >("loading");
  const [saving, setSaving] = useState(false);
  const [completedAt, setCompletedAt] = useState<string | null>(null);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setState("signed-out");
      return;
    }

    let alive = true;

    (async () => {
      const {
        data: { session },
      } = await client.auth.getSession();

      if (!session) {
        if (alive) setState("signed-out");
        return;
      }

      const { data, error } = await client
        .from("lesson_progress")
        .select("completed_at")
        .eq("student_id", session.user.id)
        .eq("lesson_id", lessonId)
        .maybeSingle();

      if (!alive) return;

      if (error) {
        console.error("[progress] load error:", error);
        setState("not-done");
        return;
      }

      if (data) {
        setCompletedAt(data.completed_at);
        setState("done");
      } else {
        setState("not-done");
      }
    })();

    return () => {
      alive = false;
    };
  }, [lessonId]);

  const markComplete = async () => {
    if (!supabase) return;
    setSaving(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("lesson_progress").upsert(
      { student_id: session.user.id, lesson_id: lessonId },
      { onConflict: "student_id,lesson_id" }
    );

    setSaving(false);

    if (error) {
      console.error("[progress] save error:", error);
      return;
    }

    setCompletedAt(new Date().toISOString());
    setState("done");
  };

  if (state === "loading" || state === "signed-out") return null;

  if (state === "done") {
    return (
      <div className="lesson-completed-badge">
        ✓ Урок изучен
        {completedAt && (
          <small>
            {" · "}
            {new Date(completedAt).toLocaleDateString("ru-RU")}
          </small>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="lesson-complete-btn"
      onClick={markComplete}
      disabled={saving}
    >
      {saving ? "Сохраняем…" : "Отметить: урок изучен"}
    </button>
  );
}