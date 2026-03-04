// common.js (dùng chung toàn dự án frontend)
window.WEBGIS_API_BASE = window.WEBGIS_API_BASE || "http://localhost:3000";

const WEBGIS_STORAGE_KEYS = [
  "webgis_token",
  "webgis_roles",
  "webgis_permissions",
  "webgis_perms",
  "webgis_role",
  "webgis_user",
];

function readJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function getToken() {
  return localStorage.getItem("webgis_token") || "";
}

function clearAuth() {
  WEBGIS_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
}
function requireLogin(redirect = "login.html") {
  if (!getToken()) {
    window.location.href = redirect;
    return false;
  }
  return true;
}

function requireAdmin(redirect = "index.html") {
  if (!requireLogin()) return false;
  if (!isAdmin()) {
    window.location.href = redirect;
    return false;
  }
  return true;
}
function getRoles() {
  return (readJSON("webgis_roles", []) || []).map((x) =>
    String(x).toLowerCase(),
  );
}

function getPerms() {
  const p =
    readJSON("webgis_permissions", null) ?? readJSON("webgis_perms", []);
  return (p || []).map((x) => String(x).toLowerCase());
}

function hasPerm(perm) {
  if (!getToken()) return false;
  const p = String(perm || "").toLowerCase();
  return getPerms().includes(p);
}

function isAdmin() {
  const roles = getRoles();
  const perms = getPerms();
  return roles.includes("admin") || perms.includes("admin.users");
}

function getUserIdFromToken() {
  const token = getToken();
  if (!token) return null;
  try {
    const base64Url = token.split(".")[1] || "";
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "===".slice((base64.length + 3) % 4);
    const payload = JSON.parse(atob(padded));
    const sub = payload?.sub;
    return Number.isFinite(Number(sub)) ? Number(sub) : null;
  } catch {
    return null;
  }
}

async function apiJSON(path, opts = {}) {
  const base = window.WEBGIS_API_BASE || "http://localhost:3000";
  const token = getToken();

  const headers = { ...(opts.headers || {}) };

  // auto JSON body
  if (
    opts.body &&
    typeof opts.body === "object" &&
    !(opts.body instanceof FormData)
  ) {
    if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
    opts = { ...opts, body: JSON.stringify(opts.body) };
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(base + path, { ...opts, headers });
  const text = await res.text();

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    if (res.status === 401) {
      clearAuth();
      window.location.href = "login.html";
      return;
    }
    const msg = data && data.message ? data.message : text || "API error";
    throw new Error(msg);
  }
  return data;
}

function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
}

function fmt(dt) {
  if (!dt) return "";
  const d = new Date(dt);
  return isNaN(d.getTime()) ? "" : d.toLocaleString("vi-VN");
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// Dùng cho index.html (nếu có navAuth/navUser/navAdminUsers)
function initAuthNav() {
  const navAuth = document.getElementById("navAuth");
  const navUser = document.getElementById("navUser");
  const navAdmin = document.getElementById("navAdminUsers");
  if (!navAuth) return;

  const logged = !!getToken();

  if (navUser) {
    if (logged) {
      navUser.classList.remove("hidden");
      navUser.textContent = `👤 ${localStorage.getItem("webgis_user") || "User"}`;
    } else {
      navUser.classList.add("hidden");
      navUser.textContent = "";
    }
  }

  if (navAdmin) navAdmin.classList.toggle("hidden", !(logged && isAdmin()));

  if (logged) {
    navAuth.textContent = "Đăng xuất";
    navAuth.href = "#";
    navAuth.onclick = (e) => {
      e.preventDefault();
      clearAuth();
      window.location.href = "index.html";
    };
  } else {
    navAuth.textContent = "Đăng nhập";
    navAuth.href = "login.html";
    navAuth.onclick = null;
  }
}

// Dùng cho index.html (ẩn/hiện theo data-perm)
function applyPermUI() {
  document.querySelectorAll("[data-perm]").forEach((el) => {
    const p = el.getAttribute("data-perm");
    el.style.display = hasPerm(p) ? "" : "none";
  });

  if (!hasPerm("feature.insert")) {
    document.getElementById("danhSachTaiNguyen")?.classList.add("hidden");
  }
  if (!hasPerm("stats.view")) {
    document.getElementById("danhSachThongKe")?.classList.add("hidden");
    document.getElementById("panelThongKe")?.classList.add("hidden");
  }
}
