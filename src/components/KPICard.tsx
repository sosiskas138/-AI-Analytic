import { motion } from "framer-motion";
import { LucideIcon, Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; positive: boolean };
  delay?: number;
  info?: string;
}

export function KPICard({ title, value, subtitle, icon: Icon, trend, delay = 0, info }: KPICardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="glass-card rounded-xl p-5 kpi-glow hover:shadow-md transition-shadow"
    >
      <div className="flex items-center gap-1 mb-3">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        {info && (
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                <Info className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" className="text-xs max-w-[220px] p-3">
              {info}
            </PopoverContent>
          </Popover>
        )}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold tracking-tight">{value}</span>
        {trend && (
          <span className={`text-xs font-medium mb-1 ${trend.positive ? "text-success" : "text-destructive"}`}>
            {trend.positive ? "+" : ""}{trend.value}%
          </span>
        )}
      </div>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </motion.div>
  );
}
