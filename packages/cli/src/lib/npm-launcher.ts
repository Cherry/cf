import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

/**
 * Run `npm` / `npx` on Windows through the CLI script their `.cmd` launcher
 * would start. Node.js's bundled npm.cmd and npx.cmd keep a batch file active
 * while npm runs, so a console Ctrl+C ends at cmd's "Terminate batch job
 * (Y/N)?" prompt instead of exiting. Other commands are returned unchanged.
 */
export function resolveNpmLauncher(
	command: [string, ...string[]],
	env: NodeJS.ProcessEnv = process.env,
	platform: NodeJS.Platform = process.platform
): [string, ...string[]] {
	const [file, ...args] = command;
	const name = /^(npm|npx)(?:\.cmd)?$/i.exec(file)?.[1]?.toLowerCase();
	if (platform !== "win32" || name === undefined) {
		return command;
	}

	const directory = (env.PATH ?? "")
		.split(delimiter)
		.find((entry) => entry !== "" && existsSync(join(entry, `${name}.cmd`)));
	if (directory === undefined) {
		return command;
	}
	const bin = join(directory, "node_modules", "npm", "bin");
	const script = join(bin, `${name}-cli.js`);
	if (!existsSync(script)) {
		return command;
	}

	const bundledNode = join(directory, "node.exe");
	const node = existsSync(bundledNode) ? bundledNode : process.execPath;
	return [node, globalPrefixScript(node, bin, name) ?? script, ...args];
}

/** Like the launchers, prefer an npm installed into the global prefix. */
function globalPrefixScript(
	node: string,
	bin: string,
	name: string
): string | undefined {
	const prefixScript = join(bin, "npm-prefix.js");
	if (!existsSync(prefixScript)) {
		return undefined;
	}
	try {
		const prefix = execFileSync(node, [prefixScript], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
			windowsHide: true,
		}).trim();
		const script = join(prefix, "node_modules", "npm", "bin", `${name}-cli.js`);
		return prefix !== "" && existsSync(script) ? script : undefined;
	} catch {
		return undefined;
	}
}
