"use client";

import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { LoginScreen } from "../components/LoginScreen";
import { supabase } from "../lib/supabase";
import { lessonCatalog } from "../lib/lesson-catalog";

type Role = "student" | "teacher";
type Page =
  | "home"
  | "lessons"
  | "assignments"
  | "progress"
  | "diagnostic"
  | "board";

type Lesson = {
  id: string;
  title: string;
  starts_at: string;
  duration_minutes: number;
  room_id: string;
  notes: string | null;
  teacher_id: string;
  student_id: string;
  template_id?: string | null;
};

type Student = {
  id: string;
  full_name: string;
};

type LessonDraft = {
  id?: string;
  title: string;
  startsAt: string;
  duration: string;
  notes: string;
  studentId: string;
  templateId: string;
};



const menu: [Page, string, string][] = [
  ["home", "⌂", "Главная"],
  ["lessons", "◷", "Уроки"],
  ["assignments", "✓", "Задания"],
  ["progress", "↗", "Прогресс"],
  ["diagnostic", "◉", "Диагностика"],
  ["board", "✎", "Доска урока"],
];

const localDateTime = (value?: string) => {
  const date = value
    ? new Date(value)
    : new Date(Date.now() + 86400000);

  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());

  return date.toISOString().slice(0, 16);
};

const lessonDate = (value: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  })
    .format(new Date(value))
    .replace(".", "")
    .toUpperCase();

const lessonTime = (value: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

function Board() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  
  // Фиксированные размеры холста (чтобы координаты совпадали на любых экранах)
  const CANVAS_W = 1000;
  const CANVAS_H = 600;

  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState("#5e4bd9");
  const [size, setSize] = useState(3);
  const [connected, setConnected] = useState(false);

  // Ссылка на канал Supabase
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const canvasElement = canvas.current;
    if (!canvasElement) return;

    const context = canvasElement.getContext("2d");
    if (!context) return;

    // Настраиваем рисование
    context.lineCap = "round";
    context.lineJoin = "round";

    // === ПОДКЛЮЧАЕМ SUPABASE REALTIME ===
    // Используем фиксированное имя комнаты, так как это личный кабинет
    const channel = client.channel("oge-whiteboard", {
      config: { broadcast: { self: false } }, // не отправляем свои же рисунки обратно себе
    });

    channelRef.current = channel;

    channel
      .on("broadcast", { event: "draw" }, ({ payload }) => {
        // Пришел рисунок от другого пользователя
        drawLine(context, payload.x0, payload.y0, payload.x1, payload.y1, payload.color, payload.size, payload.tool);
      })
      .on("broadcast", { event: "clear" }, () => {
        // Другой пользователь очистил доску
        context.clearRect(0, 0, CANVAS_W, CANVAS_H);
      })
      .on("broadcast", { event: "request-sync" }, () => {
        // Кто-то только что зашел и просит текущее состояние
        const dataUrl = canvasElement.toDataURL();
        channel.send({ type: "broadcast", event: "sync-image", payload: { dataUrl } });
      })
      .on("broadcast", { event: "sync-image" }, ({ payload }) => {
        // Получили текущее состояние доски от другого пользователя
        const img = new Image();
        img.onload = () => {
          context.clearRect(0, 0, CANVAS_W, CANVAS_H);
          context.drawImage(img, 0, 0);
        };
        img.src = payload.dataUrl;
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnected(true);
          // Если мы зашли вторыми, просим доску у того, кто уже здесь
          channel.send({ type: "broadcast", event: "request-sync", payload: {} });
        }
      });

    return () => {
      client.removeChannel(channel);
    };
  }, []);

  // Вспомогательная функция для отрисовки линии (используется и локально, и удаленно)
  const drawLine = (
    ctx: CanvasRenderingContext2D, 
    x0: number, y0: number, x1: number, y1: number, 
    strokeColor: string, lineWidth: number, t: "pen" | "eraser"
  ) => {
    ctx.beginPath();
    ctx.strokeStyle = t === "eraser" ? "#ffffff" : strokeColor;
    ctx.lineWidth = t === "eraser" ? 24 : lineWidth;
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };

  const getPosition = (event: React.PointerEvent) => {
    const rect = canvas.current!.getBoundingClientRect();
    // Переводим координаты экрана в координаты фиксированного холста
    return {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_H,
    };
  };

  const startDrawing = (event: React.PointerEvent) => {
    drawing.current = true;
    last.current = getPosition(event);
    // Ставим точку при клике
    const ctx = canvas.current!.getContext("2d");
    if (ctx) drawLine(ctx, last.current.x, last.current.y, last.current.x, last.current.y, color, size, tool);
    
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast", event: "draw",
        payload: { x0: last.current.x, y0: last.current.y, x1: last.current.x, y1: last.current.y, color, size, tool }
      });
    }
  };

  const draw = (event: React.PointerEvent) => {
    if (!drawing.current) return;

    const canvasElement = canvas.current;
    const context = canvasElement?.getContext("2d");
    if (!canvasElement || !context) return;

    const position = getPosition(event);
    drawLine(context, last.current.x, last.current.y, position.x, position.y, color, size, tool);

    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast", event: "draw",
        payload: { x0: last.current.x, y0: last.current.y, x1: position.x, y1: position.y, color, size, tool }
      });
    }

    last.current = position;
  };

  const stopDrawing = () => {
    drawing.current = false;
  };

  const clearBoard = () => {
    const canvasElement = canvas.current;
    const context = canvasElement?.getContext("2d");
    if (!canvasElement || !context) return;

    context.clearRect(0, 0, CANVAS_W, CANVAS_H);
    if (channelRef.current) {
      channelRef.current.send({ type: "broadcast", event: "clear", payload: {} });
    }
  };

  const downloadBoard = () => {
    if (!canvas.current) return;
    const link = document.createElement("a");
    link.href = canvas.current.toDataURL();
    link.download = "oge-board.png";
    link.click();
  };

  return (
    <div className="board-layout">
      <section className="board">
        <div className="toolbar">
          <div style={{ marginRight: "10px", display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: connected ? "#10b981" : "#ef4444" }}></span>
            {connected ? "Онлайн" : "Подключение..."}
          </div>

          <button className={tool === "pen" ? "selected" : ""} onClick={() => setTool("pen")}>✎ Карандаш</button>
          <button className={tool === "eraser" ? "selected" : ""} onClick={() => setTool("eraser")}>⌫ Ластик</button>
          <input aria-label="Цвет" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          <input aria-label="Толщина" type="range" min="1" max="18" value={size} onChange={(e) => setSize(Number(e.target.value))} />
          
          <button onClick={clearBoard}>Очистить</button>
          <button onClick={downloadBoard}>↓ PNG</button>
        </div>

        <div className="canvas-wrapper">
          <canvas
            ref={canvas}
            width={CANVAS_W}
            height={CANVAS_H}
            onPointerDown={startDrawing}
            onPointerMove={draw}
            onPointerUp={stopDrawing}
            onPointerLeave={stopDrawing}
          />
        </div>
      </section>

      <aside className="aside-card">
        <h3>Совместная доска</h3>
        <p>Рисуйте вместе в реальном времени. Все, что вы напишете, сразу увидит ученик, и наоборот.</p>
        <div className="formula">S△ = ½ah</div>
        <small>Доска синхронизируется автоматически. Если вы оба перезагрузите страницу, доска очистится (если один из вас останется — рисунок сохранится).</small>
      </aside>
    </div>
  );
}

export default function App() {
  const [role, setRole] = useState<Role>("student");
  const [name, setName] = useState("Вадим");
  const [userId, setUserId] = useState("");
  const [authState, setAuthState] = useState<
    "loading" | "signed-out" | "signed-in"
  >("loading");

  const [page, setPage] = useState<Page>("home");
  const [submitted, setSubmitted] = useState(false);
  const [answer, setAnswer] = useState("");
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [scheduleMessage, setScheduleMessage] = useState("");
  const [draft, setDraft] = useState<LessonDraft | null>(null);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [attempts, setAttempts] = useState<{ lesson_id: string; is_correct: boolean }[]>([]);

  const teacher = role === "teacher";

  useEffect(() => {
    const client = supabase;

    if (!client) {
      setAuthState("signed-out");
      return;
    }

    let alive = true;

    const applySession = async (session: Session | null) => {
      if (!session) {
        if (alive) setAuthState("signed-out");
        return;
      }

      const { data, error } = await client
        .from("profiles")
        .select("full_name, role")
        .eq("id", session.user.id)
        .maybeSingle();

      if (error || !data) {
        await client.auth.signOut();

        if (alive) setAuthState("signed-out");

        return;
      }

      if (alive) {
        setUserId(session.user.id);
        setRole(data.role as Role);
        setName(data.full_name);
        setAuthState("signed-in");
      }
    };

    client.auth.getSession().then(({ data }) => {
      applySession(data.session);
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshSchedule = async () => {
    if (!supabase || !userId) return;

    const { data, error } = await supabase
      .from("lessons")
      .select("*")
      .order("starts_at", { ascending: true });

    if (error) {
      setScheduleMessage("Не удалось загрузить расписание.");
      return;
    }

    setLessons((data ?? []) as Lesson[]);

    if (teacher) {
      const { data: studentData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("teacher_id", userId);

      setStudents((studentData ?? []) as Student[]);
    }
  };

  useEffect(() => {
    const client = supabase;

    if (authState !== "signed-in" || !userId || !client) return;

    refreshSchedule();

    const channel = client
      .channel(`schedule-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lessons",
        },
        refreshSchedule
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [authState, userId, role]);

  useEffect(() => {
  const client = supabase;
  if (authState !== "signed-in" || !client) return;

  let alive = true;

   const loadProgress = async () => {
    // 1. Загружаем пройденные уроки
    const { data: progressData, error: progressError } = await client
      .from("lesson_progress")
      .select("lesson_id");

    // 2. Загружаем все попытки решения задач
    const { data: attemptsData, error: attemptsError } = await client
      .from("lesson_attempts")
      .select("lesson_id, is_correct");

    if (!alive) return;

    if (progressError) console.error("[progress] load:", progressError);
    if (attemptsError) console.error("[attempts] load:", attemptsError);

    setCompletedLessons(new Set((progressData ?? []).map((row) => row.lesson_id)));
    setAttempts(attemptsData ?? []);
  };

  loadProgress();

  const channel = client
    .channel("progress-watch")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "lesson_progress" },
      loadProgress
    )
     .on( 
      "postgres_changes",
      { event: "*", schema: "public", table: "lesson_attempts" },
      loadProgress
    )
    .subscribe();

  return () => {
    alive = false;
    client.removeChannel(channel);
  };
}, [authState]);

  const startLesson = (lesson?: Lesson) => {
    if (lesson) {
      setDraft({
        id: lesson.id,
        title: lesson.title,
        startsAt: localDateTime(lesson.starts_at),
        duration: String(lesson.duration_minutes),
        notes: lesson.notes ?? "",
        studentId: lesson.student_id,
        templateId: lesson.template_id ?? "",
      });
    } else {
      setDraft({
        title: "",
        startsAt: localDateTime(),
        duration: "60",
        notes: "",
        studentId: students[0]?.id ?? "",
        templateId: "",
      });
    }

    setScheduleMessage("");
  };

  const saveLesson = async () => {
    if (!supabase || !draft) return;

    if (!draft.title.trim() || !draft.startsAt || !draft.studentId) {
      setScheduleMessage(
        "Заполните тему, дату, время и ученика."
      );
      return;
    }

    const payload = {
      title: draft.title.trim(),
      starts_at: new Date(draft.startsAt).toISOString(),
      duration_minutes: Number(draft.duration) || 60,
      notes: draft.notes.trim() || null,
      student_id: draft.studentId,
      teacher_id: userId,
      template_id: draft.templateId || null,
    };

    const request = draft.id
      ? supabase
          .from("lessons")
          .update(payload)
          .eq("id", draft.id)
      : supabase.from("lessons").insert({
          ...payload,
          room_id: crypto.randomUUID(),
        });

    try {
  const { error } = await request;
  if (error) {
    console.error("[saveLesson] Supabase error:", error);
    setScheduleMessage(`Ошибка: ${error.message}`);
    return;
  }

  setDraft(null);
  setScheduleMessage("Расписание обновлено — ученик увидит изменения сразу.");
  refreshSchedule();
} catch (e) {
  console.error("[saveLesson] Unexpected:", e);
  setScheduleMessage(`Ошибка: ${e instanceof Error ? e.message : String(e)}`);
}

    setDraft(null);
    setScheduleMessage(
      "Расписание обновлено — ученик увидит изменения сразу."
    );

    refreshSchedule();
  };

  const removeLesson = async (id: string) => {
    if (!supabase || !window.confirm("Отменить этот урок?")) return;

    const { error } = await supabase
      .from("lessons")
      .delete()
      .eq("id", id);

    if (error) {
      setScheduleMessage("Не удалось отменить урок.");
      return;
    }

    setScheduleMessage("Урок отменён.");
    refreshSchedule();
  };

  const login = async (email: string, password: string) => {
    if (!supabase) return "Supabase ещё не подключён.";

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return error
      ? "Не удалось войти. Проверьте логин и пароль."
      : null;
  };

  const logout = async () => {
    await supabase?.auth.signOut();
    setAuthState("signed-out");
  };

  if (authState === "loading") {
    return (
      <main className="login-page">
        <p className="loading">Загружаем кабинет…</p>
      </main>
    );
  }

  if (authState === "signed-out") {
    return (
      <LoginScreen
        configured={Boolean(supabase)}
        onLogin={login}
      />
    );
  }

  const nearest =
    lessons.find(
      (lesson) =>
        new Date(lesson.starts_at).getTime() >= Date.now()
    ) ?? lessons[0];

  const totalLessons = lessonCatalog.length;
const completedCount = completedLessons.size;
const overallPercent = totalLessons
  ? Math.round((completedCount / totalLessons) * 100)
  : 0;

const topicStats = (() => {
  const map = new Map<string, { total: number; done: number }>();

  for (const lesson of lessonCatalog) {
    const bucket = map.get(lesson.topic) ?? { total: 0, done: 0 };
    bucket.total += 1;
    if (completedLessons.has(lesson.id)) bucket.done += 1;
    map.set(lesson.topic, bucket);
  }

  return Array.from(map.entries()).map(([name, { total, done }]) => ({
    name,
    value: total ? Math.round((done / total) * 100) : 0,
    done,
    total,
  }));
})();

  // --- Аналитика по попыткам ---
  const totalAttempts = attempts.length;
  const correctAttempts = attempts.filter((a) => a.is_correct).length;
  const accuracy = totalAttempts ? Math.round((correctAttempts / totalAttempts) * 100) : 0;

  const weakTopics = (() => {
    const map = new Map<string, { correct: number; total: number }>();

    for (const attempt of attempts) {
      const lesson = lessonCatalog.find((l) => l.id === attempt.lesson_id);
      if (!lesson) continue;

      const bucket = map.get(lesson.topic) ?? { correct: 0, total: 0 };
      bucket.total += 1;
      if (attempt.is_correct) bucket.correct += 1;
      map.set(lesson.topic, bucket);
    }

    return Array.from(map.entries())
      .map(([topic, { correct, total }]) => ({
        topic,
        percent: Math.round((correct / total) * 100),
        total,
      }))
      .filter((t) => t.percent < 80) // Показываем только темы с точностью < 80%
      .sort((a, b) => a.percent - b.percent) // Сначала самые слабые
      .slice(0, 3); // Берем топ-3
  })();

    const getLessonStatus = (templateId: string | null | undefined) => {
    if (!templateId) return { label: "Без шаблона", className: "tag" };
    
    // Если отмечен как "Изучен"
    if (completedLessons.has(templateId)) {
      return { label: "Изучен", className: "tag done" };
    }
    
    // Если есть попытки решений
    const hasAttempts = attempts.some((a) => a.lesson_id === templateId);
    if (hasAttempts) {
      return { label: "В процессе", className: "tag progress" };
    }
    
    // Иначе не начат
    return { label: "Не начат", className: "tag soon" };
  };

  const openLesson = (lesson: Lesson) => {
    if (lesson.template_id) {
      window.location.assign(`/lesson/${lesson.template_id}`);
    } else {
      setPage("board");
    }
  };

  const Header = ({
    title,
    subtitle,
  }: {
    title: string;
    subtitle: string;
  }) => (
    <div className="topline">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      {page !== "board" && (
        <button
          className="primary"
          onClick={() => setPage("board")}
        >
          Открыть доску
        </button>
      )}
    </div>
  );

  const Home = () => (
    <>
      <Header
        title={
          teacher
            ? "Добрый вечер, преподаватель!"
            : "Привет, Вадим!"
        }
        subtitle={
          teacher
            ? "Проверьте работы и подготовьте урок."
            : "Продолжим уверенно готовиться к ОГЭ."
        }
      />

      <div className="stats">
        <Stat
  title={teacher ? "На проверке" : "Общий прогресс"}
  value={teacher ? "—" : `${overallPercent}%`}
  text={
    teacher
      ? "скоро: разбор работ"
      : `${completedCount} из ${totalLessons} уроков`
  }
/>

        <Stat
          title="Следующий урок"
          value={nearest ? lessonDate(nearest.starts_at) : "—"}
          text={
            nearest
              ? `${lessonTime(nearest.starts_at)} · онлайн`
              : "ещё не назначен"
          }
        />

         <Stat
          title="Попыток решений"
          value={String(totalAttempts)}
          text={totalAttempts ? `точность ${accuracy}%` : "пока нет"}
        />

        <Stat title="Ритм" value="4" text="дня подряд" />
      </div>

      <div className="columns">
        <div>
          <Panel title="Ближайший урок">
            {nearest ? (
              <div className="lesson">
                <b className="date">
                  {new Date(nearest.starts_at).getDate()}
                  <small>
                    {lessonDate(nearest.starts_at).split(" ")[1]}
                  </small>
                </b>

                <div>
                  <strong>{nearest.title}</strong>
                  <p>
                    {lessonTime(nearest.starts_at)} · онлайн ·{" "}
                    {nearest.duration_minutes} минут
                  </p>
                  <p>
                    {nearest.notes ||
                      "Материалы будут добавлены преподавателем."}
                  </p>
                </div>

                <button
                  className="primary"
                  onClick={() => openLesson(nearest)}
                >
                  {nearest.template_id
                    ? "Открыть урок"
                    : "Открыть доску"}
                </button>
              </div>
            ) : (
              <div className="empty">
                <b>Уроков пока нет</b>
                <p>
                  {teacher
                    ? "Назначьте первый урок для Вадима."
                    : "Преподаватель скоро добавит урок в расписание."}
                </p>

                {teacher && (
                  <button
                    className="primary"
                    onClick={() => {
                      setPage("lessons");
                      startLesson();
                    }}
                  >
                    Назначить урок
                  </button>
                )}
              </div>
            )}
          </Panel>

          <Panel title={teacher ? "На проверке" : "На этой неделе"}>
            <div className="row">
              <span className="orange-dot" />

              <div>
                <strong>Домашняя работа № 3</strong>
                <p>
                  {teacher
                    ? "Вадим · отправлено сегодня"
                    : "Квадратные уравнения · до пятницы"}
                </p>
              </div>

              <button
                className="soft"
                onClick={() => setPage("assignments")}
              >
                {teacher ? "Проверить" : "Открыть"}
              </button>
            </div>
          </Panel>
        </div>

        <Panel title="Темы и прогресс">
  {topicStats.map((topic) => (
    <TopicProgress
      key={topic.name}
      name={topic.name}
      value={topic.value}
    />
  ))}
</Panel>
      </div>
    </>
  );

  const Lessons = () => (
    <>
      <Header
        title="Уроки"
        subtitle={
          teacher
            ? "Назначайте занятия — изменения сразу появляются у Вадима."
            : "Ближайшие занятия, ссылки и материалы от преподавателя."
        }
      />

      {teacher && (
        <button
          className="primary create-lesson"
          onClick={() => startLesson()}
        >
          + Назначить урок
        </button>
      )}

      <Panel title={teacher ? "Расписание Вадима" : "Моё расписание"}>
        {lessons.length ? (
          lessons.map((lesson) => (
            <div className="row lesson-row" key={lesson.id}>
              <b className="date">
                {new Date(lesson.starts_at).getDate()}
                <small>
                  {lessonDate(lesson.starts_at).split(" ")[1]}
                </small>
              </b>

              <div>
                <strong>{lesson.title}</strong>
                <p>
                  {lessonTime(lesson.starts_at)} · онлайн ·{" "}
                  {lesson.duration_minutes} минут
                </p>
                {lesson.notes && <p>{lesson.notes}</p>}
              </div>

                  {(() => {
                const status = getLessonStatus(lesson.template_id);
                return (
                  <span className={status.className}>
                    {status.label}
                  </span>
                );
              })()}
              {teacher ? (
                <div className="lesson-actions">
                  <button
                    className="soft"
                    onClick={() => startLesson(lesson)}
                  >
                    Изменить
                  </button>

                  <button
                    className="danger"
                    onClick={() => removeLesson(lesson.id)}
                  >
                    Отменить
                  </button>
                </div>
              ) : (
                <button
                  className="soft"
                  onClick={() => openLesson(lesson)}
                >
                  {lesson.template_id
                    ? "Открыть урок"
                    : "Открыть доску"}
                </button>
              )}
            </div>
          ))
        ) : (
          <div className="empty">
            <b>Пока нет уроков</b>
            <p>
              {teacher
                ? "Создайте первый урок кнопкой выше."
                : "Преподаватель ещё не добавил занятие."}
            </p>
          </div>
        )}
      </Panel>

      {scheduleMessage && (
        <div className="schedule-message">{scheduleMessage}</div>
      )}
    </>
  );

  const Assignments = () => (
    <>
      <Header
        title="Задания"
        subtitle={
          teacher
            ? "Создавайте работу, проверяйте решения и оставляйте комментарии."
            : "Сдавайте решение — преподаватель увидит его и оставит обратную связь."
        }
      />

      <div className="cards">
        {[
          [
            "Домашняя работа № 3",
            "Квадратные уравнения",
            "№ 8, 13, 15, 19. Покажи ход решения.",
            "Сегодня",
          ],
          [
            "Мини-тест: формулы",
            "Формулы сокращённого умножения",
            "10 коротких вопросов на скорость.",
            "25 октября",
          ],
          [
            "Практика: площади",
            "Геометрия",
            "Задачи на площадь треугольника и параллелограмма.",
            "29 октября",
          ],
        ].map((item, index) => (
          <Panel
            key={item[0]}
            title={item[0]}
            className="task"
          >
            <span className={index === 0 ? "tag soon" : "tag"}>
              {submitted && index === 0
                ? "Отправлено"
                : index === 0
                  ? "Нужно сделать"
                  : "Запланировано"}
            </span>

            <h4>{item[1]}</h4>
            <p>{item[2]}</p>

            {submitted && index === 0 && (
              <div className="feedback">
                ✓ Ответ отправлен. Преподаватель скоро оставит комментарий.
              </div>
            )}

            <footer>
              <small>Срок: {item[3]}</small>

              <button
                className="primary"
                onClick={() => {
                  if (teacher) {
                    alert(
                      "В реальной версии комментарий сохранится в базе и придёт ученику."
                    );
                  } else if (index === 0) {
                    setSubmitted(true);
                    setAnswer("");
                  }
                }}
              >
                {teacher
                  ? "Проверить"
                  : submitted && index === 0
                    ? "Открыть"
                    : "Сдать"}
              </button>
            </footer>

            {!teacher && index === 0 && !submitted && (
              <textarea
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder="Напиши ход решения или вставь ссылку на фото тетради"
              />
            )}
          </Panel>
        ))}
      </div>
    </>
  );

  const Progress = () => (
    <>
      <Header
        title="Прогресс"
        subtitle="Закрепляем темы до уверенного решения, а не просто считаем задания."
      />

      <div className="columns">
        <Panel title="Навыки ОГЭ">
  {topicStats.map((topic) => (
    <TopicProgress
      key={topic.name}
      name={topic.name}
      value={topic.value}
    />
  ))}
</Panel>

         <Panel title="Аналитика решений">
          <div className="result" style={{ marginBottom: "20px" }}>
            <span>Общая точность</span>
            <b>{totalAttempts ? `${accuracy}%` : "—"}</b>
          </div>
          <div className="result" style={{ marginBottom: "20px" }}>
            <span>Всего попыток</span>
            <b>{totalAttempts}</b>
          </div>

          <h4 style={{ margin: "24px 0 12px", fontSize: "15px", color: "#475569" }}>
            Требуют внимания:
          </h4>
          
          {weakTopics.length === 0 ? (
            <p style={{ fontSize: "14px", color: "#64748b" }}>
              {totalAttempts === 0
                ? "Пока нет решенных задач. Начните с любого урока!"
                : "Отличная работа! Нет тем с точностью ниже 80%."}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {weakTopics.map((t) => (
                <div key={t.topic} style={{ fontSize: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span>{t.topic}</span>
                    <b style={{ color: t.percent < 50 ? "#dc2626" : "#d97706" }}>{t.percent}%</b>
                  </div>
                  <div style={{ height: "6px", background: "#e2e8f0", borderRadius: "999px" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${t.percent}%`,
                        background: t.percent < 50 ? "#ef4444" : "#f59e0b",
                        borderRadius: "999px",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  );

  const Diagnostic = () => (
    <>
      <Header
        title="Диагностика"
        subtitle="Стартовая точка и персональный маршрут подготовки."
      />

      <Panel title="Стартовая диагностика">
        <div className="diagnosis">
          <div className="score">
            12
            <small>из 19</small>
          </div>

          <div>
            <h2>Есть хорошая база — укрепим слабые места</h2>
            <p>
              В фокусе: формулы площадей, оформление ответа и задания
              7, 8, 13, 15, 19.
            </p>
            <span className="tag soon">
              Приоритет: геометрия и оформление
            </span>
          </div>
        </div>
      </Panel>

      <Panel title="Персональный план">
        <ol className="plan">
          <li>
            <b>Повторить формулы площадей</b>
            <span>Треугольник, параллелограмм, трапеция</span>
          </li>
          <li>
            <b>Научиться оформлять ответы</b>
            <span>Тренируем номера 7, 8 и 13</span>
          </li>
          <li>
            <b>Закрепить квадратные уравнения</b>
            <span>Домашняя работа № 3</span>
          </li>
          <li>
            <b>Мини-диагностика через 2 недели</b>
            <span>Проверяем результат</span>
          </li>
        </ol>
      </Panel>
    </>
  );

  const content = {
    home: <Home />,
    lessons: <Lessons />,
    assignments: <Assignments />,
    progress: <Progress />,
    diagnostic: <Diagnostic />,
    board: (
      <>
        <Header
          title="Доска урока"
          subtitle="Откройте её во время созвона и работайте над задачами вместе."
        />
        <Board />
      </>
    ),
  }[page];

  return (
    <>
      <div className="shell">
        <aside>
          <a className="brand">
            <i>67</i>
            school
            <small>ОГЭ · математика</small>
          </a>

          <nav>
            {menu.map(([id, icon, label]) => (
              <button
                key={id}
                className={page === id ? "active" : ""}
                onClick={() => setPage(id)}
              >
                <span>{icon}</span>
                {label}
              </button>
            ))}
          </nav>

          <div className="profile">
            <b>
              {name}
              <small>{teacher ? "преподаватель" : "ученик"}</small>
            </b>

            <button
              title="Выйти из аккаунта"
              onClick={logout}
            >
              ↪
            </button>
          </div>
        </aside>

        <main>
          <header>
            <span>{menu.find((item) => item[0] === page)?.[2]}</span>
            <em>🔥 4 дня подряд</em>
          </header>

          <article>{content}</article>
        </main>
      </div>

      {draft && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
        >
          <section className="lesson-modal">
            <button
              className="modal-close"
              onClick={() => setDraft(null)}
            >
              ×
            </button>

            <h2>
              {draft.id ? "Изменить урок" : "Назначить урок"}
            </h2>

            <label>
              Шаблон урока
              <select
                value={draft.templateId}
                onChange={(event) => {
                  const template = lessonCatalog.find(
                    (item) => item.id === event.target.value
                  );

                  setDraft({
                    ...draft,
                    templateId: event.target.value,
                    title: template?.title ?? draft.title,
                    duration: template
                      ? String(template.durationMinutes)
                      : draft.duration,
                    notes: template
                      ? `Тема: ${template.topic}. Цели: ${template.objectives.join(", ")}`
                      : draft.notes,
                  });
                }}
              >
                <option value="">Без шаблона</option>

                {lessonCatalog.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.title} · {template.durationMinutes} мин.
                  </option>
                ))}
              </select>
            </label>

            <label>
              Тема урока
              <input
                value={draft.title}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    title: event.target.value,
                  })
                }
                placeholder="Например, квадратные уравнения"
              />
            </label>

            <label>
              Дата и время
              <input
                type="datetime-local"
                value={draft.startsAt}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    startsAt: event.target.value,
                  })
                }
              />
            </label>

            <label>
              Длительность, минут
              <input
                type="number"
                min="15"
                step="15"
                value={draft.duration}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    duration: event.target.value,
                  })
                }
              />
            </label>

            <label>
              Ученик
              <select
                value={draft.studentId}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    studentId: event.target.value,
                  })
                }
              >
                <option value="">Выберите ученика</option>

                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.full_name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Комментарий или цель урока
              <textarea
                value={draft.notes}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    notes: event.target.value,
                  })
                }
                placeholder="Что подготовить к уроку"
              />
            </label>

            {scheduleMessage && (
              <p className="form-error">{scheduleMessage}</p>
            )}

            <div className="modal-footer">
              <button
                className="soft"
                onClick={() => setDraft(null)}
              >
                Отмена
              </button>

              <button
                className="primary"
                onClick={saveLesson}
              >
                Сохранить урок
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Stat({
  title,
  value,
  text,
}: {
  title: string;
  value: string;
  text: string;
}) {
  return (
    <section className="stat">
      <small>{title}</small>
      <b>{value}</b>
      <span>{text}</span>
    </section>
  );
}

function TopicProgress({
  name,
  value,
}: {
  name: string;
  value: number;
}) {
  return (
    <div className="progress">
      <div>
        <b>{name}</b>
        <span>{value}%</span>
      </div>

      <i>
        <u style={{ width: `${value}%` }} />
      </i>
    </div>
  );
}