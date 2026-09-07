import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button"
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { useIsOnline } from "@/hooks/use-is-online";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { Id } from "../../../../convex/_generated/dataModel";

const userItemVariants = cva(
  "flex items-center gap-1.5 justify-start font-normal h-7 px-4 text-sm overflow-hidden",
  {
    variants: {
      variant: {
        default: "text-[#f9edffcc]",
        active: "text-[#481349] bg-white/90 hover:bg-white/90",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

interface UserItemProps {
  id: Id<"members">;
  label?: string;
  image?: string;
  lastSeen?: number;
  variant?: VariantProps<typeof userItemVariants>["variant"];
};

export const UserItem = ({
  id,
  label = "Member",
  image,
  lastSeen,
  variant,
}: UserItemProps) => {
  const workspaceId = useWorkspaceId();
  const avatarFallback = label.charAt(0).toUpperCase();
  const isOnline = useIsOnline(lastSeen);

  return (
    <Button
      variant="transparent"
      className={cn(userItemVariants({ variant: variant }))}
      size="sm"
      asChild
    >
      <Link href={`/workspace/${workspaceId}/member/${id}`}>
        <span className="relative mr-1 inline-flex shrink-0">
          <Avatar className="size-5 rounded-md">
            <AvatarImage className="rounded-md" src={image} />
            <AvatarFallback className="rounded-md bg-sky-500 text-white text-xs">
              {avatarFallback}
            </AvatarFallback>
          </Avatar>
          {isOnline && (
            <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-emerald-400 ring-2 ring-[#5E2C5F]" />
          )}
        </span>
        <span className="text-sm truncate">{label}</span>
      </Link>
    </Button>
  );
};
