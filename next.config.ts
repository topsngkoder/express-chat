import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverActions: {
    // Лимит увеличен: пользователь отправляет любое фото, сервер сжимает до ≤1 МБ
    bodySizeLimit: "20mb",
  },
};

export default nextConfig;
