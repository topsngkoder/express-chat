"use server";

import { revalidatePath } from "next/cache";

import { AppError } from "@/lib/errors";
import { saveDisplayName, uploadAvatar, removeAvatar } from "@/lib/profile/profile-service";

export type ProfileDisplayNameState = {
  success: boolean;
  error: string | null;
};

export type ProfileAvatarState = {
  success: boolean;
  error: string | null;
};

export async function saveDisplayNameFormAction(
  _previousState: ProfileDisplayNameState,
  formData: FormData,
): Promise<ProfileDisplayNameState> {
  const raw = formData.get("displayName");
  const displayName = typeof raw === "string" ? raw : "";

  try {
    await saveDisplayName(displayName.trim() === "" ? null : displayName);
    revalidatePath("/settings");
    revalidatePath("/chat");
    return { success: true, error: null };
  } catch (error) {
    const message =
      error instanceof AppError ? error.publicMessage : "Не удалось сохранить профиль. Попробуйте позже";
    return { success: false, error: message };
  }
}

function getAvatarFile(formData: FormData): File | null {
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return null;
  return file;
}

export async function uploadAvatarFormAction(
  _previousState: ProfileAvatarState,
  formData: FormData,
): Promise<ProfileAvatarState> {
  const file = getAvatarFile(formData);
  if (!file) {
    return { success: false, error: "Выберите изображение" };
  }

  try {
    await uploadAvatar(file);
    revalidatePath("/settings");
    revalidatePath("/chat");
    return { success: true, error: null };
  } catch (error) {
    const message =
      error instanceof AppError ? error.publicMessage : "Не удалось загрузить аватар. Попробуйте позже";
    return { success: false, error: message };
  }
}

export async function removeAvatarFormAction(
  _previousState: ProfileAvatarState,
  _formData: FormData,
): Promise<ProfileAvatarState> {
  try {
    await removeAvatar();
    revalidatePath("/settings");
    revalidatePath("/chat");
    return { success: true, error: null };
  } catch (error) {
    const message =
      error instanceof AppError ? error.publicMessage : "Не удалось удалить аватар. Попробуйте позже";
    return { success: false, error: message };
  }
}
