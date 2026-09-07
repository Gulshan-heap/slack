import { toast } from "sonner";
import { useRouter, usePathname } from "next/navigation";
import { Bell, Home, MessagesSquare, MoreHorizontal } from "lucide-react";

import { UserButton } from "@/features/auth/components/user-button";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { useCurrentMember } from "@/features/members/api/use-current-member";
import { useCommandPalette } from "@/features/workspaces/store/use-command-palette";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

import { SidebarButton } from "./sidebar-button";
import { WorkspaceSwitcher } from "./workspace-switcher";

export const Sidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const workspaceId = useWorkspaceId();

  const { data: currentMember } = useCurrentMember({ workspaceId });
  const { data: members } = useGetMembers({ workspaceId });
  const [, setPaletteOpen] = useCommandPalette();

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

  const onNotImplemented = (label: string) => {
    toast.info(`${label} isn't available yet`);
  };

  return (
    <aside className="w-[70px] h-full bg-[#481349] flex flex-col gap-y-4 items-center pt-[9px] pb-4">
      <WorkspaceSwitcher />
      <SidebarButton
        icon={Home}
        label="Home"
        isActive={pathname.includes("/workspace")}
        onClick={onHomeClick}
      />
      <SidebarButton icon={MessagesSquare} label="DMs" onClick={onDmsClick} />
      <SidebarButton
        icon={Bell}
        label="Activity"
        onClick={() => onNotImplemented("Activity")}
      />
      <SidebarButton
        icon={MoreHorizontal}
        label="More"
        onClick={() => onNotImplemented("More")}
      />
      <div className="flex flex-col items-center justify-center gap-y-1 mt-auto">
        <UserButton />
      </div>
    </aside>
  );
};
