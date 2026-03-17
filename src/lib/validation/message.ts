import { AppError } from "@/lib/errors";
import { z } from "zod";

export const MESSAGE_ERROR_MESSAGES = {
  empty: "Сообщение не может быть пустым",
  tooLong: "Сообщение слишком длинное",
} as const;

export type ImageMetadata = {
  path: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
};

const imageMetadataSchema = z.object({
  path: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const messageDraftSchema = z
  .object({
    text: z.string().optional().nullable(),
    image: imageMetadataSchema.optional().nullable(),
  })
  .transform((v) => {
    const text = typeof v.text === "string" ? v.text.trim() : null;
    return {
      text: text && text.length > 0 ? text : null,
      image: v.image ?? null,
    };
  })
  .superRefine((v, ctx) => {
    if (!v.text && !v.image) {
      ctx.addIssue({ code: "custom", message: MESSAGE_ERROR_MESSAGES.empty, path: ["text"] });
      return;
    }
    if (v.text && v.text.length > 1000) {
      ctx.addIssue({ code: "custom", message: MESSAGE_ERROR_MESSAGES.tooLong, path: ["text"] });
    }
  });

export type MessageDraft = z.infer<typeof messageDraftSchema>;

export function parseMessageDraft(input: unknown): MessageDraft {
  const res = messageDraftSchema.safeParse(input);
  if (!res.success) {
    const issue = res.error.issues[0];
    throw new AppError({
      code: "VALIDATION",
      publicMessage: issue?.message ?? MESSAGE_ERROR_MESSAGES.empty,
      cause: res.error,
    });
  }
  return res.data;
}

