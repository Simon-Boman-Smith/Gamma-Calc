import { createHash, pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  copyFile,
  mkdir,
  open,
  readFile,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const DATA_DIR = resolve(process.env.GAMMA_CALC_DATA_DIR || join(ROOT, "data"));
const DATA_FILE = join(DATA_DIR, "gamma-calc-data.json");
const BACKUP_DIR = join(DATA_DIR, "backups");
const LOCK_FILE = join(DATA_DIR, ".gamma-calc.lock");
const PORT = Number(process.env.PORT || process.env.GAMMA_CALC_PORT || 5174);
const HOST = process.env.GAMMA_CALC_HOST || "127.0.0.1";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const sessions = new Map();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon"
};

function nowIso() {
  return new Date().toISOString();
}

function jsonResponse(res, status, payload, headers = {}) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers
  });
  res.end(JSON.stringify(payload));
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return { salt, hash };
}

function verifyPassword(password, auth) {
  const candidate = hashPassword(password, auth.salt).hash;
  return timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(auth.hash, "hex"));
}

function createInitialData() {
  const password = process.env.GAMMA_CALC_ADMIN_PASSWORD || "ChangeMe123!";
  return {
    version: 1,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    auth: hashPassword(password),
    sources: [],
    auditLog: [
      {
        id: randomUUID(),
        at: nowIso(),
        actor: "system",
        action: "initialised",
        details: "Initial data file created."
      }
    ]
  };
}

async function ensureDataFile() {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(BACKUP_DIR, { recursive: true });
  try {
    await stat(DATA_FILE);
  } catch (_error) {
    await writeFile(DATA_FILE, JSON.stringify(createInitialData(), null, 2));
  }
}

async function readData() {
  await ensureDataFile();
  return JSON.parse(await readFile(DATA_FILE, "utf8"));
}

async function backupDataFile() {
  try {
    const stamp = nowIso().replace(/[:.]/g, "-");
    await copyFile(DATA_FILE, join(BACKUP_DIR, `gamma-calc-data-${stamp}.json`));
  } catch (_error) {
    // First write may not have anything to back up yet.
  }
}

async function withDataLock(work) {
  await ensureDataFile();
  const start = Date.now();
  let handle;
  while (!handle) {
    try {
      handle = await open(LOCK_FILE, "wx");
    } catch (error) {
      if (error.code !== "EEXIST" || Date.now() - start > 5000) {
        throw new Error("Data file is busy. Try again in a few seconds.");
      }
      await new Promise((resolveRetry) => setTimeout(resolveRetry, 150));
    }
  }

  try {
    await handle.writeFile(String(process.pid));
    const data = await readData();
    const nextData = await work(data);
    nextData.updatedAt = nowIso();
    await backupDataFile();
    const tempFile = `${DATA_FILE}.tmp-${process.pid}`;
    await writeFile(tempFile, JSON.stringify(nextData, null, 2));
    await rename(tempFile, DATA_FILE);
    return nextData;
  } finally {
    await handle.close();
    await rm(LOCK_FILE, { force: true });
  }
}

function publicData(data) {
  return {
    version: data.version,
    updatedAt: data.updatedAt,
    sources: data.sources,
    auditLog: data.auditLog.slice(-50)
  };
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([key, value]) => key && value)
  );
}

function currentSession(req) {
  const token = parseCookies(req).gamma_calc_session;
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

async function readBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1_000_000) throw new Error("Request body is too large.");
  }
  return body ? JSON.parse(body) : {};
}

function requireAdmin(req, res) {
  const session = currentSession(req);
  if (!session) {
    jsonResponse(res, 401, { error: "Admin login required." });
    return null;
  }
  return session;
}

function audit(data, actor, action, details) {
  data.auditLog.push({ id: randomUUID(), at: nowIso(), actor, action, details });
}

export function normalizeSource(input) {
  return {
    id: input.id || randomUUID(),
    isotope: input.isotope,
    serialNumber: String(input.serialNumber || "").trim(),
    containerNumber: String(input.containerNumber || "").trim(),
    startStrength: Number(input.startStrength),
    strengthDate: input.strengthDate,
    returnedDate: input.returnedDate || "",
    notes: String(input.notes || "").trim(),
    isActive: Boolean(input.isActive),
    updatedAt: nowIso()
  };
}

async function handleApi(req, res, path) {
  if (path === "/api/status" && req.method === "GET") {
    const data = await readData();
    return jsonResponse(res, 200, {
      mode: currentSession(req) ? "admin" : "readonly",
      dataPath: DATA_FILE,
      updatedAt: data.updatedAt
    });
  }

  if (path === "/api/sources" && req.method === "GET") {
    return jsonResponse(res, 200, publicData(await readData()));
  }

  if (path === "/api/login" && req.method === "POST") {
    const body = await readBody(req);
    const data = await readData();
    if (!verifyPassword(String(body.password || ""), data.auth)) {
      return jsonResponse(res, 403, { error: "Incorrect admin password." });
    }
    const token = randomBytes(32).toString("hex");
    sessions.set(token, { actor: "admin", expiresAt: Date.now() + SESSION_TTL_MS });
    return jsonResponse(
      res,
      200,
      { mode: "admin" },
      { "set-cookie": `gamma_calc_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}` }
    );
  }

  if (path === "/api/logout" && req.method === "POST") {
    const token = parseCookies(req).gamma_calc_session;
    if (token) sessions.delete(token);
    return jsonResponse(res, 200, { mode: "readonly" }, { "set-cookie": "gamma_calc_session=; Path=/; Max-Age=0" });
  }

  if (path === "/api/password" && req.method === "POST") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = await readBody(req);
    const password = String(body.password || "");
    if (password.length < 8) {
      return jsonResponse(res, 400, { error: "Use at least 8 characters for the admin password." });
    }
    await withDataLock((current) => {
      current.auth = hashPassword(password);
      audit(current, session.actor, "password_changed", "Admin password changed.");
      return current;
    });
    return jsonResponse(res, 200, { ok: true });
  }

  if (path === "/api/sources" && req.method === "POST") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = await readBody(req);
    const source = normalizeSource(body.source);
    const data = await withDataLock((current) => {
      const index = current.sources.findIndex((item) => item.id === source.id);
      if (index >= 0) {
        current.sources[index] = source;
        audit(current, session.actor, "source_updated", `${source.isotope} ${source.serialNumber}`);
      } else {
        current.sources.push(source);
        audit(current, session.actor, "source_created", `${source.isotope} ${source.serialNumber}`);
      }
      return current;
    });
    return jsonResponse(res, 200, publicData(data));
  }

  if (path.startsWith("/api/sources/") && req.method === "PATCH") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const id = decodeURIComponent(path.slice("/api/sources/".length));
    const body = await readBody(req);
    const data = await withDataLock((current) => {
      current.sources = current.sources.map((source) => {
        if (source.id !== id) return source;
        audit(current, session.actor, "source_status_changed", `${source.serialNumber} active=${Boolean(body.isActive)}`);
        return { ...source, isActive: Boolean(body.isActive), updatedAt: nowIso() };
      });
      return current;
    });
    return jsonResponse(res, 200, publicData(data));
  }

  if (path.startsWith("/api/sources/") && req.method === "DELETE") {
    const session = requireAdmin(req, res);
    if (!session) return;
    const id = decodeURIComponent(path.slice("/api/sources/".length));
    const data = await withDataLock((current) => {
      const source = current.sources.find((item) => item.id === id);
      current.sources = current.sources.filter((item) => item.id !== id);
      audit(current, session.actor, "source_deleted", source ? `${source.isotope} ${source.serialNumber}` : id);
      return current;
    });
    return jsonResponse(res, 200, publicData(data));
  }

  return jsonResponse(res, 404, { error: "Not found." });
}

async function serveStatic(req, res, url) {
  const requestPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = normalize(resolve(ROOT, `.${requestPath}`));
  const relativePath = normalize(filePath.slice(ROOT.length)).replaceAll("\\", "/");
  if (!filePath.startsWith(ROOT) || relativePath === "data" || relativePath.startsWith("data/")) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  try {
    await stat(filePath);
    res.writeHead(200, {
      "content-type": MIME_TYPES[extname(filePath)] || "application/octet-stream"
    });
    createReadStream(filePath).pipe(res);
  } catch (_error) {
    res.writeHead(404);
    res.end("Not found");
  }
}

await ensureDataFile();

export function createGammaCalcServer() {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (url.pathname.startsWith("/api/")) {
        await handleApi(req, res, url.pathname);
      } else {
        await serveStatic(req, res, url);
      }
    } catch (error) {
      jsonResponse(res, 500, { error: error.message || "Server error." });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createGammaCalcServer().listen(PORT, HOST, () => {
    console.log(`Gamma Calc running at http://${HOST}:${PORT}/`);
    console.log(`Shared data file: ${DATA_FILE}`);
  });
}
