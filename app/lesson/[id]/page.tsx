import Link from "next/link";
import { notFound } from "next/navigation";
import { lessonCatalog } from "../../../lib/lesson-catalog";
import { LessonCompleteButton } from "../../../components/LessonCompleteButton";
import { PracticeSection } from "../../../components/PracticeSection";
import { LessonBoardModal } from "../../../components/LessonBoardModal";
import { TeacherGuide } from "../../../components/TeacherGuide";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function LessonPage({ params }: Props) {
  const { id } = await params;
  const lesson = lessonCatalog.find((item) => item.id === id);

  if (!lesson) notFound();

  return (
    <main className="lesson-page">
      <Link href="/" className="lesson-back">
        ← Вернуться в личный кабинет
      </Link>

      <section className="lesson-hero">
        <div className="lesson-badges">
          <span className="lesson-badge">{lesson.topic}</span>
          <span className="lesson-badge">{lesson.level}</span>
        </div>

        <h1>{lesson.title}</h1>

        <p className="lesson-duration">
          Продолжительность: {lesson.durationMinutes} минут
        </p>

        <div style={{ marginBottom: "20px" }}>
          <LessonBoardModal lessonId={lesson.id} />
        </div>

        <div>
          <p className="lesson-goals-label">Цели занятия</p>
          <ul className="lesson-goals">
            {lesson.objectives.map((objective) => (
              <li key={objective}>
                <span>✓</span>
                <span>{objective}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {lesson.teacherGuide && <TeacherGuide guide={lesson.teacherGuide} />}

      <section className="lesson-card">
        <h2>Что нужно знать</h2>
        <ul className="lesson-prereq">
          {lesson.prerequisites.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <div className="lesson-card">
          <h2>Теория</h2>
          <p className="lesson-section-intro">
            Разбери правила и изучи примеры перед практикой.
          </p>
        </div>

        {lesson.theory.map((section, index) => (
          <article key={section.title} className="lesson-card">
            <h3>
              {index + 1}. {section.title}
            </h3>

            {section.image && (
              <img 
                src={section.image} 
                alt={section.title} 
                className="lesson-theory-img" 
              />
            )}

            <ul className="lesson-theory-list">
              {section.content.map((paragraph, paragraphIndex) => (
                <li key={paragraphIndex}>{paragraph}</li>
              ))}
            </ul>

            {section.examples?.map((example, exampleIndex) => (
              <div key={exampleIndex} className="lesson-example">
                <p className="lesson-example-label">Разобранный пример</p>
                <p className="lesson-example-problem">{example.problem}</p>

                <ol>
                  {example.solution.map((step, stepIndex) => (
                    <li key={stepIndex}>{step}</li>
                  ))}
                </ol>
              </div>
            ))}
          </article>
        ))}
      </section>

      <section>
        <div className="lesson-card">
          <h2>Практика</h2>
          <p className="lesson-section-intro">
            Реши задания самостоятельно в тетради.
          </p>
        </div>
        <PracticeSection
          tasks={lesson.practice}
          lessonId={lesson.id}
          taskType="practice"
        />

      </section>

      <section className="lesson-homework">
        <div className="lesson-card">
          <h2>Домашнее задание</h2>
          <p className="lesson-section-intro">
            Выполни задания после занятия и подготовь решения к проверке.
          </p>
        </div>

        <PracticeSection
          tasks={lesson.homework}
          lessonId={lesson.id}
          taskType="homework"
        />
      </section>

      <footer className="lesson-footer">
        <h2>Урок изучен?</h2>
        <p>
          Проверь, что понимаешь правила и можешь решить задания без подсказок.
        </p>

        <div className="lesson-footer-actions">
          <LessonCompleteButton lessonId={lesson.id} />
          <Link href="/" className="lesson-footer-btn">
            Вернуться в кабинет
          </Link>
        </div>
      </footer>
    </main>
  );
}