import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";

export function PageChrome({
  children,
  live = true,
}: {
  children: React.ReactNode;
  live?: boolean;
}) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", color: "var(--text-primary)" }}>
      <Header live={live} />
      {children}
      <Footer />
    </div>
  );
}
