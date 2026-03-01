const API_BASE = "http://localhost:3000";

function token() {
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
  const r = getRoles().map((x) => String(x).toLowerCase());
  const p = getPerms();
  return r.includes("admin") || p.includes("admin.users");
}

async function api(path, opt = {}) {
  const r = await fetch(API_BASE + path, {
    ...opt,
    headers: {
      ...(opt.headers || {}),
      Authorization: "Bearer " + token(),
      "Content-Type": opt.body
        ? "application/json"
        : opt.headers?.["Content-Type"] || undefined,
    },
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
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

const statusLabel = {
  nhap: "Nhập",
  cho_duyet: "Chờ duyệt",
  da_duyet: "Đã duyệt",
  cong_bo: "Công bố",
  tu_choi: "Từ chối",
};

document.addEventListener("DOMContentLoaded", async () => {
  if (!token()) return (location.href = "login.html");
  if (!isAdmin()) return (location.href = "index.html");

  document.getElementById("helloUser").textContent =
    `Xin chào, ${localStorage.getItem("webgis_user") || "Admin"}!`;
  document.getElementById("btnLogout").onclick = () => {
    [
      "webgis_token",
      "webgis_roles",
      "webgis_permissions",
      "webgis_perms",
      "webgis_user",
    ].forEach((k) => localStorage.removeItem(k));
    location.href = "login.html";
  };

  document.getElementById("btnReload").onclick = load;
  document.getElementById("q").addEventListener("input", debounce(load, 250));
  document.getElementById("layerSelect").addEventListener("change", load);
  document.getElementById("statusFilter").addEventListener("change", load);

  await loadLayers();
  await load();
});

function debounce(fn, ms) {
  let t;
  return () => {
    clearTimeout(t);
    t = setTimeout(fn, ms);
  };
}

async function loadLayers() {
  const sel = document.getElementById("layerSelect");
  sel.innerHTML = `<option>Đang tải...</option>`;
  const layers = await api("/api/admin/layers");
  sel.innerHTML = layers
    .map((x) => `<option value="${esc(x.layer)}">${esc(x.layer)}</option>`)
    .join("");
}

async function load() {
  const tbody = document.getElementById("tbody");
  const msg = document.getElementById("msg");
  msg.className = "msg";
  msg.textContent = "";
  tbody.innerHTML = "";

  try {
    const layer = document.getElementById("layerSelect").value;
    const q = (document.getElementById("q").value || "").trim();
    const status = document.getElementById("statusFilter").value;

    const data = await api(
      `/api/admin/layer-objects?layer=${encodeURIComponent(layer)}&status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}&limit=80&page=1`,
    );
    const items = data.items || [];

    items.forEach((it, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="text-align:center">${idx + 1}</td>
        <td>${it.id}</td>
        <td><b>${esc(it.ten || "(không có tên)")}</b><div style="font-size:12px;color:#6b7280">${esc(data.layer)}</div></td>
        <td>
          <select class="input" data-id="${it.id}">
            ${Object.keys(statusLabel)
              .map(
                (s) =>
                  `<option value="${s}" ${String(it.trang_thai_du_lieu) === s ? "selected" : ""}>${statusLabel[s]}</option>`,
              )
              .join("")}
          </select>
          ${it.trang_thai_du_lieu === "tu_choi" && it.ly_do_tu_choi ? `<div style="font-size:12px;color:#b45309">Lý do: ${esc(it.ly_do_tu_choi)}</div>` : ""}
        </td>
        <td>${esc(fmt(it.ngay_cong_bo || it.ngay_phe_duyet || it.ngay_cap_nhat || it.ngay_tao))}</td>
        <td>
          <button class="btn" data-save="${it.id}">Lưu</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="color:#6b7280">Không có dữ liệu</td></tr>`;
    }

    // bind save
    tbody.querySelectorAll("button[data-save]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.getAttribute("data-save"));
        const sel = tbody.querySelector(`select[data-id="${id}"]`);
        const stage = sel.value;
        let reason = null;
        if (stage === "tu_choi") {
          reason = prompt("Nhập lý do từ chối:", "") || "";
        }
        await api("/api/admin/layer-objects/stage", {
          method: "PATCH",
          body: JSON.stringify({ layer, ids: [id], stage, reason }),
        });
        await load();
      });
    });
  } catch (e) {
    msg.className = "msg show";
    msg.textContent = "❌ " + e.message;
  }
}
