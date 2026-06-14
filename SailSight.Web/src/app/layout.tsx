import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastContainer } from "@/components/ui/toast";
import { AuthProvider } from "@/lib/auth-context";
import NextTopLoader from "nextjs-toploader";

export const metadata: Metadata = {
  title: "SailSight",
  description: "SailSight sailing telemetry platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <NextTopLoader color="#FF4500" showSpinner={false} height={3} />
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <AuthProvider>
            {children}
            <ToastContainer />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
