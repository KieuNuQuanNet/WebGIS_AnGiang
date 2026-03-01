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
    .map((x) => {
      const text = x.label || x.layer; // ✅ hiển thị đẹp
      return `<option value="${esc(x.layer)}">${esc(text)}</option>`;
    })
    .join("");
}

// layer-manage.js (sau) — thay toàn bộ hàm load()

async function load() {
  const tbody = document.getElementById("tbody");
  const msg = document.getElementById("msg");

  msg.className = "msg";
  msg.textContent = "";
  tbody.innerHTML = "";

  try {
    const state = { page: 1, limit: 50, total: 0 };

    function getTotalPages() {
      return Math.max(1, Math.ceil(state.total / state.limit));
    }

    function buildPageList(totalPages, current) {
      if (totalPages <= 100) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
      }
      const pages = new Set([
        1,
        totalPages,
        current,
        current - 1,
        current + 1,
        current - 2,
        current + 2,
      ]);
      const arr = [...pages]
        .filter((p) => p >= 1 && p <= totalPages)
        .sort((a, b) => a - b);

      const out = [];
      for (let i = 0; i < arr.length; i++) {
        out.push(arr[i]);
        if (i < arr.length - 1 && arr[i + 1] - arr[i] > 1) out.push("...");
      }
      return out;
    }

    function renderPager(loadObjects) {
      const pager = document.getElementById("pager");
      if (!pager) return;

      const totalPages = getTotalPages();
      if (totalPages <= 1) {
        pager.innerHTML = "";
        return;
      }

      const pages = buildPageList(totalPages, state.page);
      const prevDisabled = state.page <= 1;
      const nextDisabled = state.page >= totalPages;

      pager.innerHTML = `
        <button ${prevDisabled ? "disabled" : ""} data-page="${state.page - 1}">‹</button>
        ${pages
          .map((p) =>
            p === "..."
              ? `<span class="dots">…</span>`
              : `<button class="${p === state.page ? "active" : ""}" data-page="${p}">${p}</button>`,
          )
          .join("")}
        <button ${nextDisabled ? "disabled" : ""} data-page="${state.page + 1}">›</button>
      `;

      pager.querySelectorAll("button[data-page]").forEach((btn) => {
        btn.onclick = () => {
          const p = Number(btn.getAttribute("data-page"));
          const totalPages2 = getTotalPages();
          state.page = Math.min(Math.max(1, p), totalPages2);
          loadObjects(); // ✅ gọi lại API đúng
        };
      });
    }

    async function loadObjects() {
      const layer = document.getElementById("layerSelect").value;
      const status = document.getElementById("statusFilter").value;
      const q = (document.getElementById("q").value || "").trim();

      msg.className = "msg";
      msg.textContent = "";

      const url =
        `/api/admin/layer-objects?layer=${encodeURIComponent(layer)}` +
        `&status=${encodeURIComponent(status)}` +
        `&q=${encodeURIComponent(q)}` +
        `&limit=${state.limit}&page=${state.page}`;

      const data = await api(url);
      state.total = Number(data.total || 0);

      renderTable(data.items || [], layer);
      renderPager(loadObjects);
    }

    function renderTable(items, layerName) {
      const tbody = document.getElementById("tbody");
      tbody.innerHTML = "";

      const startIndex = (state.page - 1) * state.limit;

      items.forEach((it, idx) => {
        const stt = startIndex + idx + 1;
        const tr = document.createElement("tr");

        tr.innerHTML = `
          <td style="text-align:center">${stt}</td>
          <td>${it.id}</td>
          <td>
            <b>${esc(it.ten || "(không có tên)")}</b>
            <div style="font-size:12px;color:#6b7280">${esc(layerName)}</div>
          </td>
          <td>
            <select class="input" data-id="${it.id}">
              ${Object.keys(statusLabel)
                .map(
                  (s) =>
                    `<option value="${s}" ${
                      String(it.trang_thai_du_lieu) === s ? "selected" : ""
                    }>${statusLabel[s]}</option>`,
                )
                .join("")}
            </select>
            ${
              it.trang_thai_du_lieu === "tu_choi" && it.ly_do_tu_choi
                ? `<div style="font-size:12px;color:#b45309">Lý do: ${esc(it.ly_do_tu_choi)}</div>`
                : ""
            }
          </td>
          <td>${esc(fmt(it.ngay_cong_bo || it.ngay_phe_duyet || it.ngay_cap_nhat || it.ngay_tao))}</td>
          <td><button class="btn" data-save="${it.id}">Lưu</button></td>
        `;
        tbody.appendChild(tr);
      });

      if (!items.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="color:#6b7280">Không có dữ liệu</td></tr>`;
        return;
      }

      // ✅ bind save SAU KHI render
      tbody.querySelectorAll("button[data-save]").forEach((btn) => {
        btn.onclick = async () => {
          const id = Number(btn.getAttribute("data-save"));
          const sel = tbody.querySelector(`select[data-id="${id}"]`);
          const stage = sel.value;

          let reason = null;
          if (stage === "tu_choi") {
            reason = prompt("Nhập lý do từ chối:", "") || "";
          }

          await api("/api/admin/layer-objects/stage", {
            method: "PATCH",
            body: JSON.stringify({
              layer: layerName,
              ids: [id],
              stage,
              reason,
            }),
          });

          await loadObjects(); // ✅ reload đúng trang hiện tại
        };
      });
    }

    await loadObjects(); // ✅ QUAN TRỌNG: gọi ngay để có dữ liệu
  } catch (e) {
    msg.className = "msg show";
    msg.textContent = "❌ " + e.message;
  }
}
