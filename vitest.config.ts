import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Why: tsconfig paths("@/*") 를 Vitest도 인식하도록 alias 매핑.
//      Vitest는 Next.js tsconfig를 자동으로 읽지 않음.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});
