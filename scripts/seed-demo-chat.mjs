import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const envFilePath = path.join(projectRoot, ".env.local");
const bucketName = "chat-images";

const senders = {
  olga: {
    id: "11111111-1111-4111-8111-111111111111",
    email: "olga.demo@example.com",
  },
  pavel: {
    id: "22222222-2222-4222-8222-222222222222",
    email: "pavel.demo@example.com",
  },
};

const imageObjects = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    senderId: senders.olga.id,
    width: 320,
    height: 180,
    fileName: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png",
    path: `${senders.olga.id}/2026/03/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png`,
    background: [37, 99, 235],
    accent: [191, 219, 254],
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    senderId: senders.pavel.id,
    width: 280,
    height: 280,
    fileName: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png",
    path: `${senders.pavel.id}/2026/03/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png`,
    background: [16, 185, 129],
    accent: [209, 250, 229],
  },
];

const messages = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    sender: senders.olga,
    text: "Всем привет! Это тестовое сообщение для проверки списка чата.",
    createdAt: "2026-03-17T12:40:00.000Z",
    image: null,
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    sender: senders.pavel,
    text: "А это сообщение с тестовой картинкой и подписью.",
    createdAt: "2026-03-17T12:41:00.000Z",
    image: imageObjects[0],
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    sender: senders.olga,
    text: null,
    createdAt: "2026-03-17T12:42:00.000Z",
    image: imageObjects[1],
  },
  {
    id: "10000000-0000-4000-8000-000000000004",
    sender: senders.pavel,
    text: "Проверяем перенос строк.\nВторую строку тоже должно быть видно.",
    createdAt: "2026-03-17T12:43:00.000Z",
    image: null,
  },
];

function parseDotEnv(source) {
  const lines = source.split(/\r?\n/u);
  const values = {};

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");

    if (equalsIndex < 0) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim();
    values[key] = value;
  }

  return values;
}

function crc32(buffer) {
  let value = 0xffffffff;

  for (const byte of buffer) {
    value ^= byte;

    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(value & 1);
      value = (value >>> 1) ^ (0xedb88320 & mask);
    }
  }

  return (value ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);

  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function createPngBuffer({ width, height, background, accent }) {
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel + 1;
  const raw = Buffer.alloc(stride * height);

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * stride;
    raw[rowStart] = 0;

    for (let x = 0; x < width; x += 1) {
      const pixelOffset = rowStart + 1 + x * bytesPerPixel;
      const useAccent =
        x < 8 ||
        y < 8 ||
        x >= width - 8 ||
        y >= height - 8 ||
        Math.abs(x - y * 1.3) < 14 ||
        Math.abs(width - x - y * 0.9) < 14;

      const [red, green, blue] = useAccent ? accent : background;
      raw[pixelOffset] = red;
      raw[pixelOffset + 1] = green;
      raw[pixelOffset + 2] = blue;
      raw[pixelOffset + 3] = 255;
    }
  }

  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    header,
    createChunk("IHDR", ihdr),
    createChunk("IDAT", compressed),
    createChunk("IEND", Buffer.alloc(0)),
  ]);
}

async function loadEnv() {
  const envFile = await readFile(envFilePath, "utf8");
  const values = parseDotEnv(envFile);

  const supabaseUrl = values.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = values.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Не удалось прочитать NEXT_PUBLIC_SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY");
  }

  return { supabaseUrl, serviceRoleKey };
}

async function uploadDemoImages(supabase) {
  const uploaded = new Map();

  for (const image of imageObjects) {
    const buffer = createPngBuffer(image);

    const { error } = await supabase.storage.from(bucketName).upload(image.path, buffer, {
      contentType: "image/png",
      cacheControl: "3600",
      upsert: true,
    });

    if (error) {
      throw error;
    }

    uploaded.set(image.id, {
      path: image.path,
      mimeType: "image/png",
      sizeBytes: buffer.length,
      width: image.width,
      height: image.height,
    });
  }

  return uploaded;
}

async function upsertMessages(supabase, uploadedImages) {
  const rows = messages.map((message) => {
    const image = message.image ? uploadedImages.get(message.image.id) : null;

    return {
      id: message.id,
      sender_id: message.sender.id,
      sender_email: message.sender.email,
      text: message.text,
      image_path: image?.path ?? null,
      image_mime_type: image?.mimeType ?? null,
      image_size_bytes: image?.sizeBytes ?? null,
      image_width: image?.width ?? null,
      image_height: image?.height ?? null,
      created_at: message.createdAt,
    };
  });

  const { error } = await supabase.from("messages").upsert(rows, {
    onConflict: "id",
    ignoreDuplicates: false,
  });

  if (error) {
    throw error;
  }
}

async function main() {
  const { supabaseUrl, serviceRoleKey } = await loadEnv();
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const uploadedImages = await uploadDemoImages(supabase);
  await upsertMessages(supabase, uploadedImages);

  console.log(`Готово: добавлено ${messages.length} тестовых сообщений и ${uploadedImages.size} изображений.`);
}

main().catch((error) => {
  console.error("Не удалось засеять тестовые данные.");
  console.error(error);
  process.exitCode = 1;
});
