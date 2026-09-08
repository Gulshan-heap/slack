"use client";

import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { Loader, Trash2, Upload } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useGenerateUploadUrl } from "@/features/upload/api/use-generate-upload-url";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useCurrentUser } from "../api/use-current-user";
import { useUpdateProfile } from "../api/use-update-profile";
import { useProfileSettingsModal } from "../store/use-profile-settings-modal";

import { Id } from "../../../../convex/_generated/dataModel";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const ProfileSettingsModal = () => {
  const [open, setOpen] = useProfileSettingsModal();

  const { data: user, isLoading } = useCurrentUser();
  const { mutate: updateProfile, isPending } = useUpdateProfile();
  const { mutate: generateUploadUrl } = useGenerateUploadUrl();

  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset the form to whatever is stored each time the dialog opens.
  useEffect(() => {
    if (!open) return;

    setName(user?.name ?? "");
    setPhoto(null);
    setRemovePhoto(false);
  }, [open, user?.name]);

  const [photoObjectUrl, setPhotoObjectUrl] = useState<string | undefined>();

  useEffect(() => {
    if (!photo) {
      setPhotoObjectUrl(undefined);
      return;
    }

    const objectUrl = URL.createObjectURL(photo);
    setPhotoObjectUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [photo]);

  const previewUrl = photoObjectUrl ?? (removePhoto ? undefined : user?.image);

  const handlePickPhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Photo must be smaller than 5MB");
      event.target.value = "";
      return;
    }

    setPhoto(file);
    setRemovePhoto(false);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = name.trim();

    if (trimmed.length < 2) {
      toast.error("Name must be at least 2 characters");
      return;
    }

    try {
      setIsUploading(true);

      let image: Id<"_storage"> | null | undefined;

      if (photo) {
        const url = await generateUploadUrl({}, { throwError: true });

        if (!url) {
          throw new Error("Url not found");
        }

        const result = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": photo.type },
          body: photo,
        });

        if (!result.ok) {
          throw new Error("Failed to upload photo");
        }

        const { storageId } = await result.json();
        image = storageId;
      } else if (removePhoto) {
        image = null;
      }

      await updateProfile(
        { name: trimmed, ...(image !== undefined ? { image } : {}) },
        { throwError: true },
      );

      toast.success("Profile updated");
      setOpen(false);
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setIsUploading(false);
    }
  };

  const isBusy = isPending || isUploading;
  const fallback = (name || user?.name || "U").charAt(0).toUpperCase();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Your name and photo are shown on every message you send.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handlePickPhoto}
              className="hidden"
            />
            <div className="flex items-center gap-4">
              <Avatar className="size-16 rounded-md">
                <AvatarImage className="rounded-md object-cover" src={previewUrl} />
                <AvatarFallback className="rounded-md bg-sky-500 text-xl text-white">
                  {fallback}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isBusy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-2 size-4" />
                  Change photo
                </Button>
                {previewUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isBusy}
                    className="text-rose-600 hover:text-rose-600"
                    onClick={() => {
                      setPhoto(null);
                      setRemovePhoto(true);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    <Trash2 className="mr-2 size-4" />
                    Remove photo
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="profile-name" className="text-sm font-medium">
                Username
              </label>
              <Input
                id="profile-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={isBusy}
                required
                minLength={2}
                maxLength={60}
                autoFocus
                placeholder="e.g. Ada Lovelace"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isBusy}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isBusy}>
                {isBusy && <Loader className="mr-2 size-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
