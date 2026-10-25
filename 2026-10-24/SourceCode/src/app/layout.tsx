import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "AImigos — Better together", description: "Your people and AI companions, together in one chat." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
