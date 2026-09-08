import { useRouter, usePathname } from "next/navigation";
import {
  Activity as ActivityIcon,
  Bell,
  Home,
  MessagesSquare,
  MoreHorizontal,
  SendHorizontal,
  Settings,
  MessageSquareText,
  UserPlus,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserButton } from "@/features/auth/components/user-button";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { useCurrentMember } from "@/features/members/api/use-current-member";
import { useActivityUnreadCount } from "@/features/activity/api/use-activity-unread-count";
import { useCommandPalette } from "@/features/workspaces/store/use-command-palette";
import { useInviteModal } from "@/features/workspaces/store/use-invite-modal";
import { usePreferencesModal } from "@/features/workspaces/store/use-preferences-modal";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

import { SidebarButton } from "./sidebar-button";
import { WorkspaceSwitcher } from "./workspace-switcher";

export const Sidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const workspaceId = useWorkspaceId();

  const { data: currentMember } = useCurrentMember({ workspaceId });
  const { data: members } = useGetMembers({ workspaceId });
  const { count: unreadActivity } = useActivityUnreadCount({ workspaceId });

  const [, setPaletteOpen] = useCommandPalette();
  const [, setInviteOpen] = useInviteModal();
  const [, setPreferencesOpen] = usePreferencesModal();

  const isAdmin = currentMember?.role === "admin";

  const onHomeClick = () => {
    router.push(`/workspace/${workspaceId}`);
  };

  const onDmsClick = () => {
    const otherMembers = members?.filter((m) => m._id !== currentMember?._id);
    if (otherMembers && otherMembers.length > 0) {
      router.push(`/workspace/${workspaceId}/member/${otherMembers[0]._id}`);
    } else {
      setPaletteOpen(true);
    }
  };

  return (
    <aside className="w-[70px] h-full bg-[#481349] flex flex-col gap-y-4 items-center pt-[9px] pb-4">
      <WorkspaceSwitcher />
      <SidebarButton
        icon={Home}
        label="Home"
        isActive={
          pathname.includes("/workspace") &&
          !pathname.includes("/activity") &&
          !pathname.includes("/threads") &&
          !pathname.includes("/drafts") &&
          !pathname.includes("/pulse")
        }
        onClick={onHomeClick}
      />
      <SidebarButton icon={MessagesSquare} label="DMs" onClick={onDmsClick} />
      <SidebarButton
        icon={Bell}
        label="Activity"
        badge={unreadActivity}
        isActive={pathname.includes("/activity")}
        onClick={() => router.push(`/workspace/${workspaceId}/activity`)}
      />

      {/* In Slack "More" is an overflow menu, not a destination. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div>
            <SidebarButton
              icon={MoreHorizontal}
              label="More"
              isActive={
                pathname.includes("/threads") ||
                pathname.includes("/drafts") ||
                pathname.includes("/pulse")
              }
            />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="end" className="w-56">
          <DropdownMenuItem
            className="cursor-pointer py-2"
            onClick={() => router.push(`/workspace/${workspaceId}/threads`)}
          >
            <MessageSquareText className="size-4 mr-2" />
            Threads
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer py-2"
            onClick={() => router.push(`/workspace/${workspaceId}/drafts`)}
          >
            <SendHorizontal className="size-4 mr-2" />
            Drafts
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer py-2"
            onClick={() => router.push(`/workspace/${workspaceId}/pulse`)}
          >
            <ActivityIcon className="size-4 mr-2" />
            Team Pulse
          </DropdownMenuItem>
          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer py-2"
                onClick={() => setInviteOpen(true)}
              >
                <UserPlus className="size-4 mr-2" />
                Invite people
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer py-2"
                onClick={() => setPreferencesOpen(true)}
              >
                <Settings className="size-4 mr-2" />
                Preferences
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex flex-col items-center justify-center gap-y-1 mt-auto">
        <UserButton />
      </div>
    </aside>
  );
};
