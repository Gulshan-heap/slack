"use client";

import { useEffect, useState } from "react";

import { ProfileSettingsModal } from "@/features/auth/components/profile-settings-modal";
import { CreateChannelModal } from "@/features/channels/components/create-channel-modal";
import { CreateWorkspaceModal } from "@/features/workspaces/components/create-workspace-modal";
import { JoinWorkspaceModal } from "@/features/workspaces/components/join-workspace-modal";

export const Modals = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null; 

  return (
    <>
      <CreateChannelModal />
      <CreateWorkspaceModal />
      <JoinWorkspaceModal />
      <ProfileSettingsModal />
    </>
  );
};
