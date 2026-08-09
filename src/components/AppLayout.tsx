import { Outlet, Link, useLocation } from "react-router-dom";
import { FileText, Clock, Printer, ChevronRight, Type } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: FileText, label: "Templates", desc: "Gerencie modelos" },
  { to: "/fonts", icon: Type, label: "Fontes", desc: "Subir arquivos .ttf" },
  { to: "/production", icon: Printer, label: "Produção", desc: "Gerar PDFs" },
  { to: "/history", icon: Clock, label: "Histórico", desc: "Gerações anteriores" },
];



const AppLayout = () => {
  const location = useLocation();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col">
        <div className="p-5 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl capricha-gradient flex items-center justify-center shadow-md">
              <Printer className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-base text-sidebar-primary-foreground">CaprichaPam</h1>
              <p className="text-[11px] text-sidebar-foreground/50">Personalização</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.to ||
              (item.to !== "/" && location.pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary font-medium"
                    : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="block leading-tight">{item.label}</span>
                  <span className="block text-[10px] opacity-60 leading-tight">{item.desc}</span>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-40" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <p className="text-[11px] text-sidebar-foreground/30">v1.0 — Sistema Interno</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-background">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
