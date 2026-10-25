import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { resolveNpmLauncher } from "../../lib/npm-launcher.js";

function npmInstall(root: string, launchers: string[] = []): string {
	const bin = join(root, "node_modules", "npm", "bin");
	mkdirSync(bin, { recursive: true });
	for (const name of ["npm", "npx"]) {
		writeFileSync(join(bin, `${name}-cli.js`), "");
	}
	for (const launcher of launchers) {
		writeFileSync(join(root, launcher), "");
	}
	return bin;
}

describe("resolveNpmLauncher", () => {
	it("runs npx through the CLI script beside npx.cmd on Windows", () => {
		const root = mkdtempSync(join(tmpdir(), "cf-npm-launcher-"));
		const nodejs = join(root, "nodejs");
		const bin = npmInstall(nodejs, ["npx.cmd"]);

		expect(
			resolveNpmLauncher(
				["npx", "astro", "dev"],
				{
					PATH: [join(root, "empty"), nodejs].join(delimiter),
				},
				"win32"
			)
		).toEqual([process.execPath, join(bin, "npx-cli.js"), "astro", "dev"]);
	});

	it("prefers an npm upgraded into the global prefix, like npm.cmd", () => {
		const root = mkdtempSync(join(tmpdir(), "cf-npm-launcher-"));
		const nodejs = join(root, "nodejs");
		const prefix = join(root, "prefix");
		const bundledBin = npmInstall(nodejs, ["npm.cmd"]);
		const prefixBin = npmInstall(prefix);
		writeFileSync(
			join(bundledBin, "npm-prefix.js"),
			`console.log(${JSON.stringify(prefix)});`
		);

		expect(
			resolveNpmLauncher(["npm.cmd", "run", "build"], { PATH: nodejs }, "win32")
		).toEqual([
			process.execPath,
			join(prefixBin, "npm-cli.js"),
			"run",
			"build",
		]);
	});

	it("leaves other commands and other platforms unchanged", () => {
		const nodejs = mkdtempSync(join(tmpdir(), "cf-npm-launcher-"));
		npmInstall(nodejs, ["npx.cmd", "pnpm.cmd"]);

		expect(
			resolveNpmLauncher(["pnpm", "dev"], { PATH: nodejs }, "win32")
		).toEqual(["pnpm", "dev"]);
		expect(
			resolveNpmLauncher(["npx", "astro"], { PATH: nodejs }, "linux")
		).toEqual(["npx", "astro"]);
	});
});
