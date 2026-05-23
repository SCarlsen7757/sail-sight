import { Sidebar, IconRail, BottomTabBar } from "@/components/layout/nav";
import { AuthGate, ModeBanner } from "@/components/layout/auth-gate";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="flex min-h-screen flex-col">
        <ModeBanner />
        <div className="flex flex-1">
          <Sidebar />
          <IconRail />
          <main className="flex-1 overflow-x-hidden pb-16 lg:pb-0">
            <div className="p-4 sm:p-6">{children}</div>
          </main>
          <BottomTabBar />
        </div>
      </div>
    </AuthGate>
  );
}
