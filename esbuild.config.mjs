import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");
const production = process.argv.includes("--production");

const sharedOptions = {
  bundle: true,
  sourcemap: !production,
  minify: production,
};

const extensionCtx = await esbuild.context({
  ...sharedOptions,
  entryPoints: ["src/extension.ts"],
  outfile: "dist/extension.js",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  target: "node18",
});

const webviewCtx = await esbuild.context({
  ...sharedOptions,
  entryPoints: ["src/ui/webview/dashboard.ts"],
  outfile: "media/dashboard.js",
  format: "iife",
  platform: "browser",
  target: "es2022",
});

if (watch) {
  await Promise.all([extensionCtx.watch(), webviewCtx.watch()]);
  console.log("Watching for changes...");
} else {
  await Promise.all([extensionCtx.rebuild(), webviewCtx.rebuild()]);
  await Promise.all([extensionCtx.dispose(), webviewCtx.dispose()]);
}
