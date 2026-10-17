"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type GuideData = {
  opening: string;
  plan: { minutes: number; activity: string }[];
  questions: string[];
  commonMistakes: string[];
  masteryCriteria: string[];
};

export function TeacherGuide({ guide }: { guide: GuideData }) {
  const [role, setRole] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    const client = supabase; // <-- сохраняем в локальную переменную
    if (!client) return;

    client.auth.getSession().then(({ data }) => {
      if (data.session) {
        client // <-- используем client вместо supabase
          .from("profiles")
          .select("role")
          .eq("id", data.session.user.id)
          .single()
          .then(({ data: profile }) => {
            if (profile) setRole(profile.role);
          });
      }
    });
  }, []);

  // Если это не учитель — вообще ничего не рендерим
  if (role !== "teacher") return null;

  return (
    <div className="teacher-guide-panel">
      <div className="teacher-guide-header" onClick={() => setIsOpen(!isOpen)}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "20px" }}>📘</span>
          <h2>Методические указания (для преподавателя)</h2>
        </div>
        <button className="teacher-toggle-btn">
          {isOpen ? "Свернуть" : "Развернуть"}
        </button>
      </div>

      {isOpen && (
        <div className="teacher-guide-body">
          <div className="tg-section">
            <h3>Вступительное слово</h3>
            <p className="tg-opening">"{guide.opening}"</p>
          </div>

          <div className="tg-grid">
            <div className="tg-section">
              <h3>План урока</h3>
              <ul className="tg-plan">
                {guide.plan.map((step, i) => (
                  <li key={i}>
                    <b>{step.minutes} мин:</b> {step.activity}
                  </li>
                ))}
              </ul>
            </div>

            <div className="tg-section">
              <h3>Вопросы ученику</h3>
              <ul className="tg-list">
                {guide.questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="tg-grid">
            <div className="tg-section">
              <h3>⚠️ Частые ошибки</h3>
              <ul className="tg-list tg-errors">
                {guide.commonMistakes.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>

            <div className="tg-section">
              <h3>✅ Критерии освоения</h3>
              <ul className="tg-list tg-success">
                {guide.masteryCriteria.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}