"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

export function Board({ roomId }: { roomId: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  
  const CANVAS_W = 1000;
  const CANVAS_H = 600;

  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState("#5e4bd9");
  const [size, setSize] = useState(3);
  const [connected, setConnected] = useState(false);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const canvasElement = canvas.current;
    if (!canvasElement) return;

    const context = canvasElement.getContext("2d");
    if (!context) return;

    context.lineCap = "round";
    context.lineJoin = "round";

    // Уникальная комната для каждого урока
    const channel = client.channel(`board-${roomId}`, {
      config: { broadcast: { self: false } },
    });

    channelRef.current = channel;

    channel
      .on("broadcast", { event: "draw" }, ({ payload }) => {
        drawLine(context, payload.x0, payload.y0, payload.x1, payload.y1, payload.color, payload.size, payload.tool);
      })
      .on("broadcast", { event: "clear" }, () => {
        context.clearRect(0, 0, CANVAS_W, CANVAS_H);
      })
      .on("broadcast", { event: "request-sync" }, () => {
        const dataUrl = canvasElement.toDataURL();
        channel.send({ type: "broadcast", event: "sync-image", payload: { dataUrl } });
      })
      .on("broadcast", { event: "sync-image" }, ({ payload }) => {
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
          channel.send({ type: "broadcast", event: "request-sync", payload: {} });
        }
      });

    return () => {
      client.removeChannel(channel);
    };
  }, [roomId]);

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
    return {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_H,
    };
  };

  const startDrawing = (event: React.PointerEvent) => {
    drawing.current = true;
    last.current = getPosition(event);
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

  const stopDrawing = () => { drawing.current = false; };

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
    <div className="board-layout" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="toolbar" style={{ flexShrink: 0 }}>
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
      <div className="canvas-wrapper" style={{ flexGrow: 1, marginTop: "10px" }}>
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
    </div>
  );
}