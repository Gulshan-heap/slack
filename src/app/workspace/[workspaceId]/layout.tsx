"use client";
import { useEffect } from "react";
import { Loader } from "lucide-react";

import { Thread } from "@/features/messages/components/thread";
import { Profile } from "@/features/members/components/profile";
import { CallDock } from "@/features/calls/components/call-dock";

import { useEnsureBotMember } from "@/features/members/api/use-ensure-bot-member";
import { useCreateOrGetConversation } from "@/features/conversations/api/use-create-or-get-conversation";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { usePresenceHeartbeat } from "@/hooks/use-presence-heartbeat";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { usePanel } from "@/hooks/use-panel";

import { Sidebar } from "./sidebar";
import { Toolbar } from "./toolbar";
import { WorkspaceSidebar } from "./workspace-sidebar";

import { Id } from "../../../../convex/_generated/dataModel";

interface WorkspaceIdLayoutProps {
  children: React.ReactNode;
}

const WorkspaceIdLayout = ({ children }: WorkspaceIdLayoutProps) => {
  const { parentMessageId, profileMemberId, onClose } = usePanel();

  const workspaceId = useWorkspaceId();
  const ensureBotMember = useEnsureBotMember();
  const { mutate: createOrGetConversation } = useCreateOrGetConversation();

  usePresenceHeartbeat(workspaceId);

  const showPanel = !!parentMessageId || !!profileMemberId;

  useEffect(() => {
    if (!workspaceId) return;

    const setupSlackBot = async () => {
      try {
        const botMemberId = await ensureBotMember({ workspaceId });

        createOrGetConversation({
          memberId: botMemberId,
          workspaceId,
        });
      } catch (error) {
        console.error("SlackBot setup failed:", error);
      }
    };

    setupSlackBot();
    // ensureBotMember/createOrGetConversation are stable convex mutation
    // refs; only re-run this when the workspace actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  return (
    <div className="h-full">
      <Toolbar />
      <div className="flex h-[calc(100vh-40px)]">
        <Sidebar />
        <ResizablePanelGroup
          direction="horizontal"
          autoSaveId="ca-workspace-layout"
        >
          <ResizablePanel
            defaultSize={20}
            minSize={11}
            className="bg-[#5E2C5F]"
          >
            <WorkspaceSidebar />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel minSize={20} defaultSize={80}>
            {children}
          </ResizablePanel>
          {showPanel && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel minSize={20} defaultSize={29}>
                {parentMessageId ? (
                  <Thread
                    messageId={parentMessageId as Id<"messages">}
                    onClose={onClose}
                  />
                ) : profileMemberId ? (
                  <Profile
                    memberId={profileMemberId as Id<"members">}
                    onClose={onClose}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Loader className="size-5 animate-spin text-muted-foreground" />
                  </div>
                )}
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
      <CallDock />
    </div>
  );
};

export default WorkspaceIdLayout;
