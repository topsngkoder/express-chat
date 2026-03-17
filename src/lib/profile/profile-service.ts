import "server-only";

import { cache } from "react";

import { requireConfirmedUser } from "@/lib/auth/require-confirmed-user";
import { AppError } from "@/lib/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { mapSupabaseError } from "@/lib/supabase/map-error";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const AVATARS_BUCKET = "avatars";
const AVATAR_SIGNED_URL_TTL_SECONDS = 60 * 60;

const PROFILE_SAVE_ERROR_MESSAGE = "Не удалось сохранить профиль. Попробуйте позже";
const AVATAR_UPLOAD_ERROR_MESSAGE = "Не удалось загрузить аватар. Попробуйте позже";
const AVATAR_REMOVE_ERROR_MESSAGE = "Не удалось удалить аватар. Попробуйте позже";
const AVATAR_SIGNED_URL_ERROR_MESSAGE = "Не удалось загрузить аватар. Попробуйте позже";

type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_path: string | null;
  updated_at: string;
};

export type Profile = {
  id: string;
  displayName: string | null;
  avatarPath: string | null;
  updatedAt: string;
};

function mapProfileRow(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarPath: row.avatar_path,
    updatedAt: row.updated_at,
  };
}

function normalizeNullableText(input: string | null | undefined): string | null {
  if (input == null) return null;
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function selectProfileById(userId: string): Promise<ProfileRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,display_name,avatar_path,updated_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw mapSupabaseError(error);
  }

  return (data as ProfileRow | null) ?? null;
}

export async function getOrCreateCurrentProfile(): Promise<Profile> {
  const user = await requireConfirmedUser();

  const existing = await selectProfileById(user.id);
  if (existing) return mapProfileRow(existing);

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        display_name: null,
        avatar_path: null,
      })
      .select("id,display_name,avatar_path,updated_at")
      .single();

    if (error) {
      throw mapSupabaseError(error);
    }

    return mapProfileRow(data as ProfileRow);
  } catch (error) {
    // Возможна гонка: запись могла быть создана параллельно. В этом случае просто перечитаем.
    const reread = await selectProfileById(user.id);
    if (reread) return mapProfileRow(reread);

    throw error;
  }
}

export async function saveDisplayName(displayName: string | null): Promise<Profile> {
  const user = await requireConfirmedUser();
  await getOrCreateCurrentProfile();

  const normalizedDisplayName = normalizeNullableText(displayName);

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("profiles")
      .update({
        display_name: normalizedDisplayName,
      })
      .eq("id", user.id)
      .select("id,display_name,avatar_path,updated_at")
      .single();

    if (error) {
      throw mapSupabaseError(error);
    }

    return mapProfileRow(data as ProfileRow);
  } catch (error) {
    if (error instanceof AppError) {
      throw new AppError({
        code: error.code,
        publicMessage: PROFILE_SAVE_ERROR_MESSAGE,
        cause: error,
      });
    }

    throw new AppError({
      code: "UPSTREAM",
      publicMessage: PROFILE_SAVE_ERROR_MESSAGE,
      cause: error,
    });
  }
}

function mapMimeTypeToAvatarExt(mimeType: string): "jpg" | "png" | "webp" | null {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized === "image/jpeg") return "jpg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  return null;
}

function buildAvatarPath(userId: string, ext: "jpg" | "png" | "webp"): string {
  return `${userId}/avatar.${ext}`;
}

export async function uploadAvatar(file: File): Promise<Profile> {
  const user = await requireConfirmedUser();
  await getOrCreateCurrentProfile();

  try {
    const ext = mapMimeTypeToAvatarExt(file.type) ?? "jpg";
    const path = buildAvatarPath(user.id, ext);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const admin = createSupabaseAdminClient();
    const { error: uploadError } = await admin.storage.from(AVATARS_BUCKET).upload(path, buffer, {
      contentType: file.type || undefined,
      upsert: true,
    });

    if (uploadError) {
      throw mapSupabaseError(uploadError);
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("profiles")
      .update({
        avatar_path: path,
      })
      .eq("id", user.id)
      .select("id,display_name,avatar_path,updated_at")
      .single();

    if (error) {
      throw mapSupabaseError(error);
    }

    return mapProfileRow(data as ProfileRow);
  } catch (error) {
    if (error instanceof AppError) {
      throw new AppError({
        code: error.code,
        publicMessage: AVATAR_UPLOAD_ERROR_MESSAGE,
        cause: error,
      });
    }

    throw new AppError({
      code: "UPSTREAM",
      publicMessage: AVATAR_UPLOAD_ERROR_MESSAGE,
      cause: error,
    });
  }
}

export async function removeAvatar(): Promise<Profile> {
  const user = await requireConfirmedUser();
  const profile = await getOrCreateCurrentProfile();

  const existingPath = normalizeNullableText(profile.avatarPath);
  if (!existingPath) return profile;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("profiles")
      .update({
        avatar_path: null,
      })
      .eq("id", user.id)
      .select("id,display_name,avatar_path,updated_at")
      .single();

    if (error) {
      throw mapSupabaseError(error);
    }

    // Удаление файла — best-effort, чтобы не оставить профиль "битым".
    try {
      const admin = createSupabaseAdminClient();
      await admin.storage.from(AVATARS_BUCKET).remove([existingPath]);
    } catch {
      // noop
    }

    return mapProfileRow(data as ProfileRow);
  } catch (error) {
    if (error instanceof AppError) {
      throw new AppError({
        code: error.code,
        publicMessage: AVATAR_REMOVE_ERROR_MESSAGE,
        cause: error,
      });
    }

    throw new AppError({
      code: "UPSTREAM",
      publicMessage: AVATAR_REMOVE_ERROR_MESSAGE,
      cause: error,
    });
  }
}

const UUID_PATTERN =
  "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const AVATAR_PATH_PATTERN = new RegExp(`^${UUID_PATTERN}/avatar\\.(jpg|png|webp)$`, "i");

function normalizeAvatarPath(avatarPath: string): string {
  const normalizedPath = avatarPath.trim();

  if (!AVATAR_PATH_PATTERN.test(normalizedPath)) {
    throw new AppError({
      code: "UPSTREAM",
      publicMessage: AVATAR_SIGNED_URL_ERROR_MESSAGE,
    });
  }

  return normalizedPath;
}

export const getAvatarSignedUrl = cache(async (avatarPath: string | null): Promise<string | null> => {
  await requireConfirmedUser();

  if (!avatarPath) return null;

  const normalizedPath = normalizeAvatarPath(avatarPath);

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.storage
      .from(AVATARS_BUCKET)
      .createSignedUrl(normalizedPath, AVATAR_SIGNED_URL_TTL_SECONDS);

    if (error) {
      throw mapSupabaseError(error);
    }

    if (!data?.signedUrl) {
      throw new AppError({
        code: "UPSTREAM",
        publicMessage: AVATAR_SIGNED_URL_ERROR_MESSAGE,
      });
    }

    return data.signedUrl;
  } catch (error) {
    if (error instanceof AppError) {
      throw new AppError({
        code: error.code,
        publicMessage: AVATAR_SIGNED_URL_ERROR_MESSAGE,
        cause: error,
      });
    }

    throw new AppError({
      code: "UPSTREAM",
      publicMessage: AVATAR_SIGNED_URL_ERROR_MESSAGE,
      cause: error,
    });
  }
});

