import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-16 px-6", className)}>
      <div className="w-14 h-14 rounded-2xl bg-[#F05A28]/10 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-[#F05A28]" />
      </div>
      <h3 className="text-base font-semibold text-[#2D1252] mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-500 max-w-xs leading-relaxed mb-4">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
