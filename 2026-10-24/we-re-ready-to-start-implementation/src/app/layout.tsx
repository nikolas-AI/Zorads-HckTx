import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "AI Friends — Better together", description: "Your people. Three new perspectives. One group chat." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
