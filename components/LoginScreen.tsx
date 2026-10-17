"use client";

import { FormEvent, useState } from "react";

export function LoginScreen({ configured, onLogin }: { configured: boolean; onLogin: (email: string, password: string) => Promise<string | null> }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(await onLogin(email.trim(), password)); setBusy(false); }
  return <main className="login-page"><section className="login-card"><a className="brand"><i>π</i>Точка роста<small>ОГЭ · математика</small></a><h1>Войти в кабинет</h1><p>Уроки, задания и общая доска — в одном месте.</p>{configured ? <form onSubmit={submit}><label>Логин (e-mail)<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" required placeholder="name@example.com" /></label><label>Пароль<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required placeholder="Введите пароль" /></label>{error && <div className="login-error">{error}</div>}<button className="primary" disabled={busy}>{busy ? "Проверяем…" : "Войти"}</button></form> : <div className="setup-note"><b>Вход будет доступен после настройки Supabase.</b><p>Скопируйте <code>.env.example</code> в <code>.env.local</code> и добавьте URL и анонимный ключ проекта. Инструкция есть в README.</p></div>}<small className="privacy">Доступ возможен только по приглашению преподавателя.</small></section></main>;
}
