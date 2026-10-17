import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "67 school — ОГЭ математика", description: "Личный кабинет для занятий математикой" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
