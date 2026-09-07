import { toast } from "sonner";
import { AlertTriangle, HashIcon, Loader, MessageSquareText, SendHorizontal } from "lucide-react";

import { useGetMembers } from "@/features/members/api/use-get-members";
import { useGetChannels } from "@/features/channels/api/use-get-channels";
import { useCurrentMember } from "@/features/members/api/use-current-member";
import { useGetWorkspace } from "@/features/workspaces/api/use-get-workspace";
import { useCreateChannelModal } from "@/features/channels/store/use-create-channel-modal";

import { useMemberId } from "@/hooks/use-member-id";
import { useChannelId } from "@/hooks/use-channel-id";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

import { UserItem } from "./user-item";
import { SidebarItem } from "./sidebar-item";
import { WorkspaceHeader } from "./workspace-header";
import { WorkspaceSection } from "./workspace-section";

export const WorkspaceSidebar = () => {
  const memberId = useMemberId();
  const channelId = useChannelId();
  const workspaceId = useWorkspaceId();

  const [_open, setOpen] = useCreateChannelModal();

  const { data: member, isLoading: memberLoading } = useCurrentMember({ workspaceId });
  const { data: workspace, isLoading: workspaceLoading } = useGetWorkspace({ id: workspaceId });
  const { data: channels, isLoading: channelsLoading } = useGetChannels({ workspaceId });
  const { data: members, isLoading: membersLoading } = useGetMembers({ workspaceId });

  const botMember = members?.find((m) => m.user.isBot);
  const normalMembers = members?.filter((m) => !m.user.isBot);


  if (workspaceLoading || memberLoading) {
    return (
      <div className="flex flex-col bg-[#5E2C5F] h-full items-center justify-center">
        <Loader className="size-5 animate-spin text-white" />
      </div>
    );
  }

  if (!workspace || !member) {
    return (
      <div className="flex flex-col gap-y-2 bg-[#5E2C5F] h-full items-center justify-center">
        <AlertTriangle className="size-5 text-white" />
        <p className="text-white text-sm">
          Workspace not found
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-[#5E2C5F] h-full">
      <WorkspaceHeader workspace={workspace} isAdmin={member.role === "admin"} />
      <div className="flex flex-col px-2 mt-3">
        <button
          onClick={() => toast.info("Threads view isn't available yet")}
          className="flex items-center gap-1.5 justify-start font-normal h-7 px-[18px] text-sm overflow-hidden text-[#f9edffcc] hover:bg-white/10 rounded-md w-full"
        >
          <MessageSquareText className="size-3.5 mr-1 shrink-0" />
          <span className="text-sm truncate">Threads</span>
        </button>
        <button
          onClick={() => toast.info("Drafts & Sent isn't available yet")}
          className="flex items-center gap-1.5 justify-start font-normal h-7 px-[18px] text-sm overflow-hidden text-[#f9edffcc] hover:bg-white/10 rounded-md w-full"
        >
          <SendHorizontal className="size-3.5 mr-1 shrink-0" />
          <span className="text-sm truncate">Drafts & Sent</span>
        </button>
      </div>
      <WorkspaceSection
        label="Channels"
        hint="New channel"
        onNew={member.role === "admin" ? () => setOpen(true) : undefined}
      >
        {channels?.map((item) => (
          <SidebarItem
            key={item._id}
            icon={HashIcon}
            label={item.name}
            id={item._id}
            variant={channelId === item._id ? "active" : "default"}
          />
        ))}
      </WorkspaceSection>
      <WorkspaceSection
        label="Direct Messages"
        hint="New direct message"
        // onNew={() => {}}
      >
        {/* 🤖 SlackBot */}
    {botMember && (
      <UserItem
        id={botMember._id}
        label="SlackBot 🤖"
        image={botMember.user.image}
        variant={botMember._id === memberId ? "active" : "default"}
      />
    )}

    {/* 👥 Normal users */}
    {normalMembers?.map((item) => (
      <UserItem
        key={item._id}
        id={item._id}
        label={item.user.name}
        image={item.user.image}
        lastSeen={item.lastSeen}
        variant={item._id === memberId ? "active" : "default"}
      />
    ))}

      </WorkspaceSection>
    </div>
  )
};