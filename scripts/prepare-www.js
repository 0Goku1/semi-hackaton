/**
 * 웹 자산만 www/ 로 복사 (android, server, node_modules 제외)
 * 사용: npm run prepare:www
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "www");

function rmDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dest, name);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else copyFile(s, d);
  }
}

rmDir(out);
fs.mkdirSync(out, { recursive: true });

const htmlFiles = fs.readdirSync(root).filter((f) => f.endsWith(".html"));
for (const f of htmlFiles) copyFile(path.join(root, f), path.join(out, f));

copyDir(path.join(root, "css"), path.join(out, "css"));
copyDir(path.join(root, "js"), path.join(out, "js"));
copyDir(path.join(root, "images"), path.join(out, "images"));

const logo = path.join(root, "koriyo-logo.jpg");
if (fs.existsSync(logo)) copyFile(logo, path.join(out, "koriyo-logo.jpg"));

const secrets = path.join(out, "js", "secrets.js");
if (!fs.existsSync(secrets)) {
  console.warn(
    "[prepare-www] WARNING: js/secrets.js 없음. 앱에서 API/카카오가 실패합니다. secrets.example.js 를 복사하세요."
  );
} else {
  console.log("[prepare-www] secrets.js 포함됨 (gitignore — APK 로컬 빌드용)");
}

console.log("[prepare-www] OK → www/ (" + htmlFiles.length + " html)");
