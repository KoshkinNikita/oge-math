"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";

type Task = {
  question: string;
  answer: string;
  explanation: string;
  difficulty: 1 | 2 | 3;
};

// ---------- Нормализация ----------

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[−–—]/g, "-")
    .replace(/,/g, ".")
    .replace(/^x=/i, "")
    .replace(/^y=/i, "")
    .replace(/\.$/, "");
}

function toNumber(s: string): number | null {
  const n = normalize(s);
  if (n.includes("/")) {
    const parts = n.split("/");
    if (parts.length !== 2) return null;
    const a = Number(parts[0]);
    const b = Number(parts[1]);
    if (isNaN(a) || isNaN(b) || b === 0) return null;
    return a / b;
  }
  const num = Number(n);
  return isNaN(num) ? null : num;
}

function splitMany(s: string): string[] {
  return s
    .split(/[;]|,\s*|\s+и\s+/)
    .map((x) => normalize(x))
    .filter(Boolean)
    .sort();
}

export function checkAnswer(input: string, correct: string): boolean {
  if (normalize(input) === normalize(correct)) return true;

  const inpMany = splitMany(input);
  const corMany = splitMany(correct);
  if (
    corMany.length > 1 &&
    inpMany.length === corMany.length &&
    inpMany.every((v, i) => v === corMany[i])
  ) {
    return true;
  }

  const ni = toNumber(input);
  const nc = toNumber(correct);
  if (ni !== null && nc !== null && Math.abs(ni - nc) < 1e-6) return true;

  return false;
}

// ---------- Сохранение попытки ----------

async function saveAttempt(
  lessonId: string,
  taskType: "practice" | "homework",
  taskIndex: number,
  answer: string,
  isCorrect: boolean
) {
  if (!supabase) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const { error } = await supabase.from("lesson_attempts").insert({
    student_id: session.user.id,
    lesson_id: lessonId,
    task_type: taskType,
    task_index: taskIndex,
    answer: answer.slice(0, 500),
    is_correct: isCorrect,
  });

  if (error) console.error("[attempts] save:", error);
}

// ---------- Карточка ----------

type CardProps = {
  task: Task;
  index: number;
  lessonId: string;
  taskType: "practice" | "homework";
  onCorrect: (index: number) => void;
};

function TaskCard({ task, index, lessonId, taskType, onCorrect }: CardProps) {
  const [value, setValue] = useState("");
  const [state, setState] = useState<"idle" | "correct" | "wrong">("idle");
  const [showSolution, setShowSolution] = useState(false);

  const check = () => {
    if (!value.trim()) return;
    const ok = checkAnswer(value, task.answer);
    setState(ok ? "correct" : "wrong");
    saveAttempt(lessonId, taskType, index, value, ok);
    if (ok) onCorrect(index);
  };

  const reset = () => {
    setValue("");
    setState("idle");
    setShowSolution(false);
  };

  return (
    <article className={`lesson-task task-state-${state}`}>
      <div className="lesson-task-head">
        <strong>Задание {index + 1}</strong>
        <span className="lesson-task-difficulty">
          Сложность: {task.difficulty}/3
        </span>
      </div>

      <p className="lesson-task-question">{task.question}</p>

      <div className="task-answer-row">
        <input
          type="text"
          className="task-input"
          placeholder="Твой ответ"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") check(); }}
        />
        <button type="button" className="task-check-btn" onClick={check}>
          Проверить
        </button>
      </div>

      {state === "correct" && (
        <div className="task-feedback task-feedback-correct">
          <b>✓ Верно!</b> {task.explanation}
        </div>
      )}

      {state === "wrong" && (
        <div className="task-feedback task-feedback-wrong">
          <b>✗ Пока неверно.</b> Попробуй ещё раз или посмотри решение.

          <div className="task-actions">
            <button type="button" className="task-reset-btn" onClick={reset}>
              Сбросить
            </button>
            <button
              type="button"
              className="task-show-btn"
              onClick={() => setShowSolution((v) => !v)}
            >
              {showSolution ? "Скрыть решение" : "Показать решение"}
            </button>
          </div>

          {showSolution && (
            <div className="task-solution">
              <p><b>Правильный ответ:</b> {task.answer}</p>
              <p>{task.explanation}</p>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// ---------- Секция ----------

type Props = {
  tasks: Task[];
  lessonId: string;
  taskType: "practice" | "homework";
  onProgressChange?: (solved: number, total: number) => void;
};

export function PracticeSection({ tasks, lessonId, taskType, onProgressChange }: Props) {
  const [solved, setSolved] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<"all" | "basic" | "advanced">("all");

  const handleCorrect = (index: number) => {
    setSolved((prev) => {
      if (prev.has(index)) return prev;
      const next = new Set(prev);
      next.add(index);
      onProgressChange?.(next.size, tasks.length);
      return next;
    });
  };

  // Фильтруем задачи для отображения, сохраняя их оригинальный индекс
  const displayTasks = tasks
    .map((task, index) => ({ task, originalIndex: index }))
    .filter(({ task }) => {
      if (filter === "basic") return task.difficulty <= 2;
      if (filter === "advanced") return task.difficulty === 3;
      return true;
    });

  return (
    <>
      <div className="practice-header-panel">
        <div className="practice-tabs">
          <button
            className={filter === "all" ? "practice-tab active" : "practice-tab"}
            onClick={() => setFilter("all")}
          >
            Все задачи
          </button>
          <button
            className={filter === "basic" ? "practice-tab active" : "practice-tab"}
            onClick={() => setFilter("basic")}
          >
            Базовые
          </button>
          <button
            className={filter === "advanced" ? "practice-tab active" : "practice-tab"}
            onClick={() => setFilter("advanced")}
          >
            Повышенные (Часть 2)
          </button>
        </div>

        <div className="practice-counter-text">
          Решено: <b>{solved.size}</b> из {tasks.length}
        </div>
        <div className="practice-counter-bar">
          <div
            className="practice-counter-fill"
            style={{ width: `${tasks.length ? (solved.size / tasks.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {displayTasks.length === 0 ? (
        <p style={{ color: "#64748b", fontSize: "14px", marginTop: "10px" }}>
          В этой категории задач пока нет.
        </p>
      ) : (
        displayTasks.map(({ task, originalIndex }) => (
          <TaskCard
            key={originalIndex}
            task={task}
            index={originalIndex}
            lessonId={lessonId}
            taskType={taskType}
            onCorrect={handleCorrect}
          />
        ))
      )}
    </>
  );
}
