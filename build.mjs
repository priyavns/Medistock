import { cp, mkdir, writeFile } from "node:fs/promises";

const output = new URL("./dist/", import.meta.url);
await mkdir(output, { recursive: true });
await cp(new URL("./frontend/", import.meta.url), output, { recursive: true });

const apiUrl = (
  process.env.MEDISTOCK_API_URL || "http://localhost:8080"
).replace(/\/$/, "");
await writeFile(
  new URL("runtime-config.js", output),
  `window.MEDISTOCK_API_URL = ${JSON.stringify(apiUrl)};\n`,
  "utf8",
);
