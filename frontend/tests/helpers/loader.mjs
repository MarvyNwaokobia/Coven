// Module resolution for the tests: maps the app's "@/..." import alias to files under frontend/,
// and points "next/server" at the file (the package has no exports map, so Node's ESM resolver
// cannot find it on its own).
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

const ROOT = new URL("../../", import.meta.url).pathname;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "next/server") {
    return nextResolve(pathToFileURL(ROOT + "node_modules/next/server.js").href, context);
  }
  if (specifier.startsWith("@/")) {
    for (const suffix of [".ts", "/index.ts"]) {
      const candidate = ROOT + specifier.slice(2) + suffix;
      if (existsSync(candidate)) return nextResolve(pathToFileURL(candidate).href, context);
    }
  }
  return nextResolve(specifier, context);
}
