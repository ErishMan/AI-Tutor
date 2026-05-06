/**
 * SandboxExecutor — safely runs learner code.
 *
 * JavaScript: executed in a vm2 sandbox with CPU + memory caps.
 * Python:     spawns a child process with timeout (requires Python 3 on host).
 * Java:       compiles with javac then runs with java (requires JDK on host).
 *
 * NEVER expose filesystem, network, or process APIs to learner code.
 */
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, mkdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import { ExecutionResult, Language } from "../types/index.js";
import logger from "../utils/logger.js";

const execFileAsync = promisify(execFile);

const MAX_EXEC_MS   = Number(process.env.MAX_SANDBOX_EXECUTION_MS ?? 5000);
const MAX_OUT_CHARS = Number(process.env.MAX_OUTPUT_CHARS ?? 4000);

// ── JavaScript sandbox (vm2) ──────────────────────────────────────────────────

async function executeJavaScript(source: string): Promise<ExecutionResult> {
  const start = Date.now();
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { VM } = await import("vm2" as never) as {
      VM: new (opts: Record<string, unknown>) => { run: (code: string) => unknown };
    };

    const logs: string[] = [];
    const vm = new VM({
      timeout: MAX_EXEC_MS,
      sandbox: {
        console: {
          log:   (...a: unknown[]) => logs.push(a.map(String).join(" ")),
          warn:  (...a: unknown[]) => logs.push("[warn] "  + a.map(String).join(" ")),
          error: (...a: unknown[]) => logs.push("[error] " + a.map(String).join(" ")),
        },
        Math, JSON, parseInt, parseFloat, isNaN, isFinite,
        String, Number, Boolean, Array, Object,
        process:  undefined,
        require:  undefined,
        eval:     undefined,
        Function: undefined,
      },
    });

    vm.run(source);
    return {
      stdout:    logs.join("\n").slice(0, MAX_OUT_CHARS),
      stderr:    "",
      exitCode:  0,
      timedOut:  false,
      runtimeMs: Date.now() - start,
    };
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.message.toLowerCase().includes("timeout");
    return {
      stdout:    "",
      stderr:    err instanceof Error ? err.message.slice(0, MAX_OUT_CHARS) : String(err),
      exitCode:  1,
      timedOut:  isTimeout,
      runtimeMs: Date.now() - start,
    };
  }
}

// ── Python sandbox (subprocess) ───────────────────────────────────────────────

async function executePython(source: string): Promise<ExecutionResult> {
  const start   = Date.now();
  const tmpFile = join(tmpdir(), `tutor_${uuidv4()}.py`);

  try {
    await writeFile(tmpFile, source, "utf8");

    const { stdout, stderr } = await execFileAsync(
      "python3",
      ["-u", tmpFile],
      {
        timeout:   MAX_EXEC_MS,
        maxBuffer: MAX_OUT_CHARS * 2,
        env: {
          PATH:                    "/usr/local/bin:/usr/bin:/bin",
          PYTHONDONTWRITEBYTECODE: "1",
          PYTHONPATH:              "",
        },
      }
    );

    return {
      stdout:    stdout.slice(0, MAX_OUT_CHARS),
      stderr:    stderr.slice(0, MAX_OUT_CHARS),
      exitCode:  0,
      timedOut:  false,
      runtimeMs: Date.now() - start,
    };
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException & {
      code?: string; stdout?: string; stderr?: string; killed?: boolean;
    };
    const timedOut = e.killed === true || e.code === "ETIMEDOUT";
    return {
      stdout:    (e.stdout ?? "").slice(0, MAX_OUT_CHARS),
      stderr:    timedOut
        ? "Execution timed out."
        : (e.stderr ?? String(e)).slice(0, MAX_OUT_CHARS),
      exitCode:  1,
      timedOut,
      runtimeMs: Date.now() - start,
    };
  } finally {
    unlink(tmpFile).catch(() => {});
  }
}

// ── TypeScript sandbox (strip types → execute as JS) ──────────────────────────

async function executeTypeScript(source: string): Promise<ExecutionResult> {
  const stripped = source
    .replace(/:\s*\w+(\[\])?(\s*\|?\s*\w+(\[\])?)*(?=\s*[=,);{])/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/^export\s+(default\s+)?/gm, "");
  return executeJavaScript(stripped);
}

// ── Java sandbox (javac + java subprocess) ────────────────────────────────────

async function executeJava(source: string): Promise<ExecutionResult> {
  const start   = Date.now();

  // Extract public class name from source — javac requires filename to match class name
  const classMatch = source.match(/public\s+class\s+(\w+)/);
  const className  = classMatch?.[1] ?? "Main";

  const tmpDir  = join(tmpdir(), `tutor_java_${uuidv4()}`);
  const srcFile = join(tmpDir, `${className}.java`);

  try {
    await mkdir(tmpDir, { recursive: true });
    await writeFile(srcFile, source, "utf8");

    // Step 1 — compile
    try {
      await execFileAsync("javac", [srcFile], {
        timeout:   MAX_EXEC_MS,
        maxBuffer: MAX_OUT_CHARS * 2,
        env: { PATH: "/usr/local/bin:/usr/bin:/bin:/usr/lib/jvm/default/bin" },
      });
    } catch (compileErr: unknown) {
      const e = compileErr as { stderr?: string; stdout?: string };
      return {
        stdout:    "",
        stderr:    (e.stderr ?? String(compileErr)).slice(0, MAX_OUT_CHARS),
        exitCode:  1,
        timedOut:  false,
        runtimeMs: Date.now() - start,
      };
    }

    // Step 2 — run
    const { stdout, stderr } = await execFileAsync(
      "java",
      ["-cp", tmpDir, className],
      {
        timeout:   MAX_EXEC_MS,
        maxBuffer: MAX_OUT_CHARS * 2,
        env: { PATH: "/usr/local/bin:/usr/bin:/bin:/usr/lib/jvm/default/bin" },
      }
    );

    return {
      stdout:    stdout.slice(0, MAX_OUT_CHARS),
      stderr:    stderr.slice(0, MAX_OUT_CHARS),
      exitCode:  0,
      timedOut:  false,
      runtimeMs: Date.now() - start,
    };
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException & {
      code?: string; stdout?: string; stderr?: string; killed?: boolean;
    };
    const timedOut = e.killed === true || e.code === "ETIMEDOUT";
    return {
      stdout:    (e.stdout ?? "").slice(0, MAX_OUT_CHARS),
      stderr:    timedOut
        ? "Execution timed out."
        : (e.stderr ?? String(e)).slice(0, MAX_OUT_CHARS),
      exitCode:  1,
      timedOut,
      runtimeMs: Date.now() - start,
    };
  } finally {
    // Clean up temp dir
    import("fs/promises").then(fs =>
      fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    );
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function execute(
  source:   string,
  language: Language,
): Promise<ExecutionResult> {
  if (!process.env.ENABLE_CODE_EXECUTION || process.env.ENABLE_CODE_EXECUTION === "false") {
    return {
      stdout:    "",
      stderr:    "Code execution is disabled. Set ENABLE_CODE_EXECUTION=true in your .env file.",
      exitCode:  1,
      timedOut:  false,
      runtimeMs: 0,
    };
  }

  logger.info(`Executing ${language} code (${source.split("\n").length} lines)`);

  switch (language) {
    case "javascript": return executeJavaScript(source);
    case "typescript": return executeTypeScript(source);
    case "python":     return executePython(source);
    case "java":       return executeJava(source);
    default:
      return {
        stdout:    "",
        stderr:    `Language "${language}" is not supported.`,
        exitCode:  1,
        timedOut:  false,
        runtimeMs: 0,
      };
  }
}