import { LucideIcon } from "lucide-react";
import { IconType } from "react-icons/lib";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SidebarButtonProps {
  icon: LucideIcon | IconType;
  label: string;
  isActive?: boolean;
  /** Unread count; anything above zero shows a dot on the icon. */
  badge?: number;
  onClick?: () => void;
};

export const SidebarButton = ({
  icon: Icon,
  label,
  isActive,
  badge = 0,
  onClick,
}: SidebarButtonProps) => {
  return (
    <div
      onClick={onClick}
      className="flex flex-col items-center jusify-center gap-y-0.5 cursor-pointer group"
    >
      <Button
        variant="transparent"
        className={cn(
          "size-9 p-2 group-hover:bg-accent/20 relative",
          isActive && "bg-accent/20"
        )}
      >
        <Icon className="size-5 text-white group-hover:scale-110 transition-all" />
        {badge > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </Button>
      <span className="text-[11px] text-white group-hover:text-accent">
        {label}
      </span>
    </div>
  );
};
