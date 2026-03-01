const API_BASE = "http://localhost:3000";

function getToken() {
  return localStorage.getItem("webgis_token") || "";
}

function getRoles() {
  try {
    return JSON.parse(localStorage.getItem("webgis_roles") || "[]");
  } catch {
    return [];
  }
}

function getPerms() {
  try {
    return JSON.parse(
      localStorage.getItem("webgis_permissions") ||
        localStorage.getItem("webgis_perms") ||
        "[]",
    );
  } catch {
    return [];
  }
}

function isAdmin() {
  const roles = getRoles().map((x) => String(x).toLowerCase());
  const perms = getPerms();
  return roles.includes("admin") || perms.includes("admin.users");
}

async function api(path) {
  const r = await fetch(API_BASE + path, {
    headers: { Authorization: "Bearer " + getToken() },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message || "API error");
  return data;
}

function fmt(dt) {
  if (!dt) return "";
  const d = new Date(dt);
  return isNaN(d.getTime()) ? "" : d.toLocaleString("vi-VN");
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

function statusBadge(st) {
  const s = String(st || "").toLowerCase();
  const map = {
    nhap: "Nhập",
    cho_duyet: "Chờ duyệt",
    da_duyet: "Đã duyệt",
    cong_bo: "Công bố",
    tu_choi: "Từ chối",
  };
  const label = map[s] || st || "-";
  return `<span class="badge">${esc(label)}</span>`;
}

function stepCell(time, who, emptyText) {
  if (!time) return `<div class="muted">${esc(emptyText)}</div>`;
  return `
    <div class="step">
      <div class="step-time">${esc(fmt(time))}</div>
      <div class="step-who">${esc(who || "-")}</div>
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", async () => {
  const token = getToken();
  if (!token) return (window.location.href = "login.html");
  if (!isAdmin()) return (window.location.href = "index.html");

  const helloUser = document.getElementById("helloUser");
  if (helloUser) {
    helloUser.textContent = `Xin chào, ${
      localStorage.getItem("webgis_user") || "Admin"
    }!`;
  }

  document.getElementById("btnLogout")?.addEventListener("click", () => {
    [
      "webgis_token",
      "webgis_roles",
      "webgis_permissions",
      "webgis_perms",
      "webgis_role",
      "webgis_user",
    ].forEach((k) => localStorage.removeItem(k));
    window.location.href = "login.html";
  });

  document.getElementById("btnReload")?.addEventListener("click", load);
  document.getElementById("q")?.addEventListener("input", debounce(load, 250));

  await load();
});

function debounce(fn, ms) {
  let t;
  return () => {
    clearTimeout(t);
    t = setTimeout(fn, ms);
  };
}

async function load() {
  const tbody = document.getElementById("tbody");
  const msg = document.getElementById("msg");

  if (msg) {
    msg.className = "msg";
    msg.textContent = "";
  }
  tbody.innerHTML = "";

  try {
    const q = (document.getElementById("q")?.value || "").trim();

    // ✅ API mới: lịch sử cập nhật tài nguyên
    const rows = await api(
      `/api/admin/resource-history?limit=300&q=${encodeURIComponent(q)}`,
    );

    rows.forEach((r, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="text-align:center;">${idx + 1}</td>
        <td><b>${esc(r.ten_tai_nguyen || "-")}</b><div class="muted">${esc(r.ma_lop || "")}</div></td>
        <td>${statusBadge(r.trang_thai_du_lieu)}</td>
        <td>${stepCell(r.ngay_tao, r.ten_nguoi_tao || r.nguoi_tao, "Chưa có")}</td>
        <td>${stepCell(r.ngay_cap_nhat, r.ten_nguoi_cap_nhat || r.nguoi_cap_nhat, "Chưa cập nhật")}</td>
        <td>${
          String(r.trang_thai_du_lieu).toLowerCase() === "tu_choi" &&
          r.ly_do_tu_choi
            ? `<div class="muted">Lý do: ${esc(r.ly_do_tu_choi)}</div>`
            : ""
        }
        ${stepCell(r.ngay_phe_duyet, r.ten_nguoi_phe_duyet || r.nguoi_phe_duyet, "Chưa duyệt")}</td>
        <td>${stepCell(r.ngay_cong_bo, r.ten_nguoi_cong_bo || r.nguoi_cong_bo, "Chưa công bố")}</td>
      `;
      tbody.appendChild(tr);
    });

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="muted">Chưa có dữ liệu lịch sử cập nhật</td></tr>`;
    }
  } catch (e) {
    if (msg) {
      msg.className = "msg show";
      msg.textContent = "❌ " + e.message;
    }
  }
}
