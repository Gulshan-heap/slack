import { FaChevronDown } from "react-icons/fa";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useIsOnline } from "@/hooks/use-is-online";

interface HeaderProps {
  memberName?: string;
  memberImage?: string;
  lastSeen?: number;
  onClick?: () => void;
};

export const Header = ({
  memberName = "Member",
  memberImage,
  lastSeen,
  onClick,
}: HeaderProps) => {
  const avatarFallback = memberName.charAt(0).toUpperCase();
  const isOnline = useIsOnline(lastSeen);

  return (
    <div className="bg-white border-b h-[49px] flex items-center px-4 overflow-hidden">
      <Button
        variant="ghost"
        className="text-lg font-semibold px-2 overflow-hidden w-auto"
        size="sm"
        onClick={onClick}
      >
        <span className="relative mr-2 inline-flex shrink-0">
          <Avatar className="size-6">
            <AvatarImage src={memberImage} />
            <AvatarFallback>
              {avatarFallback}
            </AvatarFallback>
          </Avatar>
          {isOnline && (
            <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-emerald-400 ring-2 ring-white" />
          )}
        </span>
        <span className="truncate">{memberName}</span>
        <FaChevronDown className="size-2.5 ml-2" />
      </Button>
      {lastSeen ? (
        <span className="ml-2 text-xs text-muted-foreground">
          {isOnline ? "Online" : "Offline"}
        </span>
      ) : null}
    </div>
  );
};
