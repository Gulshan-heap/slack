"use client";

import { Loader, LogOut, Settings, UserRound } from "lucide-react";
import { useAuthActions } from "@convex-dev/auth/react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePanel } from "@/hooks/use-panel";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { useCurrentMember } from "@/features/members/api/use-current-member";

import { useCurrentUser } from "../api/use-current-user";
import { useProfileSettingsModal } from "../store/use-profile-settings-modal";

export const UserButton = () => {
  const { signOut } = useAuthActions();
  const { data, isLoading } = useCurrentUser();

  const workspaceId = useWorkspaceId();
  const { onOpenProfile } = usePanel();
  const { data: currentMember } = useCurrentMember({ workspaceId });
  const [, setProfileSettingsOpen] = useProfileSettingsModal();

  if (isLoading) {
    return <Loader className="size-4 animate-spin text-muted-foreground" />
  }

  if (!data) {
    return null;
  }

  const { image, name } = data;

  const avatarFallback = (name ?? "U").charAt(0).toUpperCase();

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger className="outline-none relative">
        <Avatar className="rounded-md size-10 hover:opacity-75 transition">
          <AvatarImage className="rounded-md object-cover" alt={name} src={image} />
          <AvatarFallback className="rounded-md bg-sky-500 text-white">
            {avatarFallback}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" side="right" className="w-60">
        <DropdownMenuLabel className="truncate">
          {name ?? "Your account"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {currentMember && (
          <DropdownMenuItem
            className="h-10"
            onClick={() => onOpenProfile(currentMember._id)}
          >
            <UserRound className="size-4 mr-2" />
            View profile
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="h-10"
          onClick={() => setProfileSettingsOpen(true)}
        >
          <Settings className="size-4 mr-2" />
          Edit profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()} className="h-10">
          <LogOut className="size-4 mr-2" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
