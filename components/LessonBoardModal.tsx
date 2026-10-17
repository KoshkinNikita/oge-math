"use client";

import { useState } from "react";
import { Board } from "./Board";

export function LessonBoardModal({ lessonId }: { lessonId: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button className="open-board-btn" onClick={() => setIsOpen(true)}>
        ✎ Открыть доску урока
      </button>

      {isOpen && (
        <div className="board-modal-overlay">
          <div className="board-modal-content">
            <div className="board-modal-header">
              <h2>Совместная доска</h2>
              <button className="board-close-btn" onClick={() => setIsOpen(false)}>
                ✕ Закрыть
              </button>
            </div>
            <div className="board-modal-body">
              <Board roomId={lessonId} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}