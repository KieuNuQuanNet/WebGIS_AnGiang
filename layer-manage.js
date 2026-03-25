// trạng thái
const api = apiJSON;
const statusLabel = {
  nhap: "Nhập",
  cho_duyet: "Chờ duyệt",
  cho_xoa: "Chờ xóa",
  cong_bo: "Công bố (Hiện bản đồ)",
  da_xoa: "Đã xóa",
};

const state = { page: 1, limit: 50, total: 0 };
const requestTypeLabel = {
  them_tai_nguyen: "Tài nguyên - Thêm mới",
  cap_nhat_tai_nguyen: "Tài nguyên - Cập nhật",
  xoa_tai_nguyen: "Tài nguyên - Yêu cầu xóa",
  them_anh: "Ảnh - Thêm mới",
  xoa_anh: "Ảnh - Yêu cầu xóa",
  cap_nhat_anh: "Ảnh - Cập nhật",
};

// hỗ trợ hiển thị
function prettyFieldName(key) {
  return String(key || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function escHtml(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
let currentApprovalDetail = null;
let currentPendingMixedItems = [];

async function decideApprovalRequest(requestId, action, note = "") {
  return api(`/api/admin/approval-requests/${requestId}/decision`, {
    method: "PATCH",
    body: {
      action,
      note,
    },
  });
}

function renderApprovalObject(obj) {
  if (!obj || typeof obj !== "object") {
    return `<div class="muted">Không có dữ liệu</div>`;
  }

  const entries = Object.entries(obj).filter(
    ([k]) => !["geom", "bbox"].includes(k),
  );

  if (!entries.length) {
    return `<div class="muted">Không có dữ liệu</div>`;
  }

  return entries
    .map(
      ([k, v]) => `
        <div class="approval-field">
          <div class="approval-field-key">${escHtml(prettyFieldName(k))}</div>
          <div class="approval-field-value">${escHtml(
            typeof v === "object" ? JSON.stringify(v, null, 2) : v,
          )}</div>
        </div>
      `,
    )
    .join("");
}
function renderApprovalImageObject(obj, emptyText = "Không có dữ liệu") {
  if (!obj || typeof obj !== "object" || !Object.keys(obj).length) {
    return `<div class="muted">${emptyText}</div>`;
  }

  const src = obj.duong_dan_file
    ? `${window.WEBGIS_API_BASE || ""}${obj.duong_dan_file}`
    : "";
  const caption = obj.chu_thich || "Không có chú thích";
  const imageId = obj.image_id || "";
  const action = obj.action || "";

  let html = "";

  if (src) {
    html += `
      <div class="approval-image-preview">
        <img src="${escHtml(src)}" alt="Ảnh tài nguyên" />
      </div>
    `;
  }

  if (action === "delete") {
    html += `
      <div class="reason-alert-box">
        <strong>Thao tác đề xuất: Xóa ảnh</strong>
      </div>
    `;
  }

  if (imageId) {
    html += `
      <div class="approval-field">
        <div class="approval-field-key">Image ID</div>
        <div class="approval-field-value">${escHtml(imageId)}</div>
      </div>
    `;
  }

  html += `
    <div class="approval-field">
      <div class="approval-field-key">Chú thích</div>
      <div class="approval-field-value">${escHtml(caption)}</div>
    </div>
  `;

  return html;
}
function approvalRequestTagClass(type) {
  if (type === "them_anh") return "approval-tag-image-add";
  if (type === "xoa_anh") return "approval-tag-image-delete";
  if (type === "cap_nhat_anh") return "approval-tag-image-update";
  if (type === "them_tai_nguyen") return "approval-tag-resource-add";
  if (type === "cap_nhat_tai_nguyen") return "approval-tag-resource-update";
  if (type === "xoa_tai_nguyen") return "approval-tag-resource-delete";
  return "";
}
function getApprovalThumbnail(item) {
  const raw = item?.raw || {};
  const src =
    raw?.du_lieu_de_xuat?.duong_dan_file ||
    raw?.du_lieu_hien_tai?.duong_dan_file ||
    "";

  if (!src) return "";

  return `${window.WEBGIS_API_BASE || ""}${src}`;
}

function extractPendingNewData(row) {
  const data = { ...(row || {}) };

  [
    "geom",
    "bbox",
    "ten_nguoi_tao",
    "trang_thai_du_lieu",
    "ngay_tao",
    "ngay_cap_nhat",
    "ngay_phe_duyet",
    "ngay_cong_bo",
    "nguoi_tao",
    "nguoi_cap_nhat",
    "nguoi_phe_duyet",
    "nguoi_cong_bo",
  ].forEach((k) => delete data[k]);

  return data;
}
// khỏi tạo giao diện
document.addEventListener("DOMContentLoaded", async () => {
  if (!requireApprover()) return;
  const sideAdminUsers = document.getElementById("sideAdminUsers");
  if (sideAdminUsers) {
    sideAdminUsers.classList.toggle("hidden", !isAdmin());
  }

  const helloUser = document.getElementById("helloUser");
  if (helloUser)
    helloUser.textContent = `Xin chào, ${localStorage.getItem("webgis_user") || "Admin"}!`;

  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) {
    btnLogout.onclick = () => {
      clearAuth();
      location.href = "login.html";
    };
  }

  const btnReload = document.getElementById("btnReload");
  if (btnReload) {
    btnReload.onclick = () => {
      state.page = 1;
      load();
    };
  }
  const panelNhapFile = document.getElementById("panelNhapFile");
  const btnBulkImport = document.getElementById("btnBulkImport");
  const btnDongNhapFile = document.getElementById("btnDongNhapFile");

  if (btnBulkImport && panelNhapFile) {
    btnBulkImport.onclick = () => {
      panelNhapFile.classList.remove("hidden");
    };
  }

  if (btnDongNhapFile && panelNhapFile) {
    btnDongNhapFile.onclick = () => {
      panelNhapFile.classList.add("hidden");
    };
  }

  if (panelNhapFile) {
    panelNhapFile.addEventListener("click", (e) => {
      if (e.target === panelNhapFile) {
        panelNhapFile.classList.add("hidden");
      }
    });
  }

  const btnTrash = document.getElementById("btnTrash");
  if (btnTrash) {
    btnTrash.onclick = () => {
      const statusFilter = document.getElementById("statusFilter");
      if (statusFilter.value === "da_xoa") {
        statusFilter.value = "tat_ca";
        btnTrash.classList.remove("btn-trash-active");
        btnTrash.innerHTML = "Thùng rác";
      } else {
        statusFilter.value = "da_xoa";
        btnTrash.classList.add("btn-trash-active");
        btnTrash.innerHTML = "Đóng Thùng rác";
      }
      state.page = 1;
      load();
    };
  }

  const inpSearch = document.getElementById("q");
  if (inpSearch) {
    inpSearch.addEventListener(
      "input",
      debounce(() => {
        state.page = 1;
        load();
      }, 250),
    );
  }

  const layerSelect = document.getElementById("layerSelect");
  if (layerSelect) {
    layerSelect.addEventListener("change", () => {
      state.page = 1;
      load();
    });
  }

  const statusFilter = document.getElementById("statusFilter");
  const approvalDetailModal = document.getElementById("approvalDetailModal");
  const btnCloseApprovalDetail = document.getElementById(
    "btnCloseApprovalDetail",
  );
  const btnApproveApprovalDetail = document.getElementById(
    "btnApproveApprovalDetail",
  );
  const btnRejectApprovalDetail = document.getElementById(
    "btnRejectApprovalDetail",
  );
  if (btnApproveApprovalDetail) {
    btnApproveApprovalDetail.onclick = async () => {
      if (!currentApprovalDetail?.id) return;

      const note = prompt("Ghi chú phê duyệt (có thể bỏ trống):", "") ?? "";
      btnApproveApprovalDetail.disabled = true;

      try {
        if (currentApprovalDetail.__source === "pending_new") {
          await api("/api/admin/layer-objects/stage", {
            method: "PATCH",
            body: {
              layer: currentApprovalDetail.layer,
              ids: [currentApprovalDetail.id],
              stage: "cong_bo",
              reason: note || "Phê duyệt tài nguyên thêm mới",
            },
          });
        } else {
          await decideApprovalRequest(
            currentApprovalDetail.id,
            "approve",
            note,
          );
        }
        showToast("Đã phê duyệt yêu cầu thành công!");
        approvalDetailModal?.classList.add("hidden");
        currentApprovalDetail = null;
        load();
      } catch (e) {
        showToast("Lỗi: " + e.message, "error");
      } finally {
        btnApproveApprovalDetail.disabled = false;
      }
    };
  }

  if (btnRejectApprovalDetail) {
    btnRejectApprovalDetail.onclick = async () => {
      if (!currentApprovalDetail?.id) return;

      const note = prompt("Nhập lý do từ chối:", "");
      if (note === null) return;
      if (!note.trim()) {
        showToast("Bạn phải nhập lý do từ chối", "error");
        return;
      }

      btnRejectApprovalDetail.disabled = true;

      try {
        if (currentApprovalDetail.__source === "pending_new") {
          await api("/api/admin/layer-objects/stage", {
            method: "PATCH",
            body: {
              layer: currentApprovalDetail.layer,
              ids: [currentApprovalDetail.id],
              stage: "da_xoa",
              reason: note || "Từ chối tài nguyên thêm mới",
            },
          });
        } else {
          await decideApprovalRequest(currentApprovalDetail.id, "reject", note);
        }
        showToast("Đã từ chối yêu cầu!");
        approvalDetailModal?.classList.add("hidden");
        currentApprovalDetail = null;
        load();
      } catch (e) {
        showToast("Lỗi: " + e.message, "error");
      } finally {
        btnRejectApprovalDetail.disabled = false;
      }
    };
  }

  if (btnCloseApprovalDetail && approvalDetailModal) {
    btnCloseApprovalDetail.onclick = () => {
      approvalDetailModal.classList.add("hidden");
    };
  }

  if (approvalDetailModal) {
    approvalDetailModal.addEventListener("click", (e) => {
      if (e.target === approvalDetailModal) {
        approvalDetailModal.classList.add("hidden");
      }
    });
  }

  await loadLayers();
  await load();
});

// nạp dữ liệu
async function loadLayers() {
  const sel = document.getElementById("layerSelect");
  if (!sel) return;
  sel.innerHTML = `<option>Đang tải...</option>`;
  try {
    const layers = await api("/api/admin/layers");
    sel.innerHTML = layers
      .map(
        (x) =>
          `<option value="${esc(x.layer)}">${esc(x.label || x.layer)}</option>`,
      )
      .join("");
  } catch (e) {
    sel.innerHTML = `<option>Lỗi tải lớp</option>`;
  }
}

async function load() {
  const tbody = document.getElementById("tbody");
  const msg = document.getElementById("msg");
  if (!tbody || !msg) return;

  msg.className = "msg";
  msg.textContent = "";
  tbody.innerHTML = "";

  try {
    await loadObjects();
  } catch (e) {
    msg.className = "msg show";
    msg.textContent = "" + e.message;
  }
}

async function loadObjects() {
  const layerSelect = document.getElementById("layerSelect");
  const statusFilter = document.getElementById("statusFilter");
  const qInput = document.getElementById("q");

  if (!layerSelect || !statusFilter || !qInput) return;

  const layer = layerSelect.value;
  const status = statusFilter.value;
  const q = qInput.value.trim();

  let data = [];

  if (status === "cho_duyet") {
    const [pendingNewRows, approvalRows] = await Promise.all([
      api(
        `/api/admin/layer-objects?layer=${encodeURIComponent(layer)}&status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}`,
      ),
      api(
        `/api/admin/approval-requests?layer=${encodeURIComponent(layer)}&status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}`,
      ),
    ]);

    const normalizedPendingNew = (pendingNewRows || []).map((it) => {
      const objId = it.gid || it.id || it.fid || it.objectid;
      return {
        __source: "pending_new",
        __key: `new-${objId}`,
        id: String(objId),
        layer,
        loai_yeu_cau: "them_tai_nguyen",
        ten_tai_nguyen: it.ten || "Không tên",
        ten_nguoi_tao: it.ten_nguoi_tao || "-",
        ngay_tao: it.ngay_tao || it.ngay_cap_nhat,
        raw: it,
      };
    });

    const normalizedApproval = (approvalRows || []).map((it) => ({
      __source: "approval_request",
      __key: `req-${it.id}`,
      id: String(it.id),
      layer,
      loai_yeu_cau: it.loai_yeu_cau,
      ten_tai_nguyen: it.ten_tai_nguyen || "Không tên",
      ten_nguoi_tao: it.ten_nguoi_tao || "-",
      ngay_tao: it.ngay_tao,
      raw: it,
    }));

    data = [...normalizedPendingNew, ...normalizedApproval].sort((a, b) => {
      const da = new Date(a.ngay_tao || 0).getTime();
      const db = new Date(b.ngay_tao || 0).getTime();
      return db - da;
    });

    currentPendingMixedItems = data;
    state.total = data.length;

    const start = (state.page - 1) * state.limit;
    const pageItems = data.slice(start, start + state.limit);

    renderApprovalTable(pageItems, layer);
  } else {
    const url = `/api/admin/layer-objects?layer=${encodeURIComponent(layer)}&status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}`;
    data = await api(url);
    state.total = data.length;

    const start = (state.page - 1) * state.limit;
    const pageItems = data.slice(start, start + state.limit);

    renderTable(pageItems, layer);
  }

  const pagerDiv = document.getElementById("pager");
  if (pagerDiv) {
    renderPager(pagerDiv, {
      page: state.page,
      total: state.total,
      limit: state.limit,
      onChange: (p) => {
        state.page = p;
        loadObjects();
      },
    });
  }
}

// hiển thị dữ liệu bảng
function renderTable(items, layerName) {
  const tbody = document.getElementById("tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted text-center">Không có dữ liệu</td></tr>`;
    return;
  }

  const isTrash = document.getElementById("statusFilter")?.value === "da_xoa";

  items.forEach((it, idx) => {
    const tr = document.createElement("tr");
    const isChoXoa = it.trang_thai_du_lieu === "cho_xoa";
    const isChoDuyet = it.trang_thai_du_lieu === "cho_duyet";
    const stt = (state.page - 1) * state.limit + idx + 1;
    const objId = it.gid || it.id || it.fid || it.objectid;

    const cellClass = isChoDuyet ? "row-pending" : "";

    const statusOptions = Object.keys(statusLabel)
      .map(
        (k) =>
          `<option value="${k}" ${it.trang_thai_du_lieu === k ? "selected" : ""}>${statusLabel[k]}</option>`,
      )
      .join("");

    let actionButtons = "";
    if (isTrash) {
      actionButtons = `
            <button class="btn btn-small btn-success" data-restore-trash="${objId}">Khôi phục</button>
            <button class="btn btn-small btn-danger" data-delete-trash="${objId}">Xóa vĩnh viễn</button>

          `;
    } else if (isChoXoa) {
      actionButtons = `
            <button class="btn btn-small btn-danger" data-approve-delete="${objId}">Duyệt xóa</button>
            <button class="btn btn-small btn-ghost" data-reject-delete="${objId}">Từ chối</button>
          `;
    } else {
      actionButtons = `
            <button class="btn btn-small" data-save="${objId}">Lưu</button>
            <button class="btn btn-small btn-ghost" data-approve-delete="${objId}">Xóa</button>
          `;
    }

    tr.innerHTML = `
          <td class="text-center">${stt}</td>
          <td class="text-center">${objId}</td>
          <td class="${cellClass}">
              <b>${it.ten || "Không tên"}</b>
              ${isChoXoa ? `<div class="status-label-sub status-red">Yêu cầu xóa</div>` : ""}
              ${isChoDuyet ? `<div class="status-label-sub status-orange">Chờ duyệt</div>` : ""}
          </td>
          <td>
              ${
                isChoXoa
                  ? `<div class="reason-alert-box"><strong>Lý do: ${it.ly_do || "Không có lý do"}</strong></div>`
                  : `<select class="input" data-id="${objId}">${statusOptions}</select>`
              }
          </td>
          <td class="muted">${fmt(it.ngay_cap_nhat || it.ngay_tao)}</td>
          <td>
              <div class="row-actions">${actionButtons}</div>
          </td>
        `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("button[data-save]").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.getAttribute("data-save");
      const sel = tbody.querySelector(`select[data-id="${id}"]`);
      if (!sel) return;
      const stage = sel.value;
      btn.disabled = true;
      try {
        await api("/api/admin/layer-objects/stage", {
          method: "PATCH",
          body: { layer: layerName, ids: [id], stage },
        });
        showToast("Cập nhật trạng thái thành công!");
        loadObjects();
      } catch (e) {
        showToast("Lỗi: " + e.message, "error");
      } finally {
        btn.disabled = false;
      }
    };
  });

  tbody.querySelectorAll("button[data-restore-trash]").forEach((btn) => {
    btn.onclick = async () => {
      await adminKhoiPhucTuThungRac(
        layerName,
        btn.getAttribute("data-restore-trash"),
      );
    };
  });

  tbody.querySelectorAll("button[data-delete-trash]").forEach((btn) => {
    btn.onclick = async () => {
      await adminXoaVinhVienTuThungRac(
        layerName,
        btn.getAttribute("data-delete-trash"),
      );
    };
  });

  tbody.querySelectorAll("button[data-approve-delete]").forEach((btn) => {
    btn.onclick = async () => {
      await adminPheDuyetXoa(
        layerName,
        btn.getAttribute("data-approve-delete"),
      );
    };
  });

  tbody.querySelectorAll("button[data-reject-delete]").forEach((btn) => {
    btn.onclick = async () => {
      await adminTuChoiXoa(layerName, btn.getAttribute("data-reject-delete"));
    };
  });
}
// hiển thị bản chờ duyệt
function renderApprovalTable(items, layerName) {
  const tbody = document.getElementById("tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted text-center">Không có yêu cầu chờ duyệt</td></tr>`;
    return;
  }

  items.forEach((it, idx) => {
    const tr = document.createElement("tr");
    const stt = (state.page - 1) * state.limit + idx + 1;
    const requestType = requestTypeLabel[it.loai_yeu_cau] || it.loai_yeu_cau;
    const requestTagClass = approvalRequestTagClass(it.loai_yeu_cau);

    const ten = it.ten_tai_nguyen || "Không tên";
    const thumbSrc = getApprovalThumbnail(it);
    const thumbHtml = thumbSrc
      ? `<img class="approval-request-thumb" src="${escHtml(thumbSrc)}" alt="thumb" />`
      : "";

    tr.innerHTML = `
      <td class="text-center">${stt}</td>
      <td class="text-center">${it.id}</td>
      <td>
  <div class="approval-request-main">
    ${thumbHtml}
    <div class="approval-request-text">
      <b>${escHtml(ten)}</b>
      <div class="approval-request-tag ${requestTagClass}">${escHtml(requestType)}</div>
    </div>
  </div>
</td>

      <td>
        <div class="status-label-sub status-orange">Chờ duyệt</div>
      </td>
      <td class="muted">${fmt(it.ngay_tao)}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-small" data-view-request="${it.__key}">
  Xem chi tiết
</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("button[data-view-request]").forEach((btn) => {
    btn.onclick = async () => {
      const itemKey = btn.getAttribute("data-view-request");
      if (!itemKey) return;

      const item = currentPendingMixedItems.find((x) => x.__key === itemKey);
      if (!item) return;

      if (item.__source === "approval_request") {
        await openApprovalDetail(item.id);
      } else {
        openPendingNewDetail(item);
      }
    };
  });
}

// xem chi tiết yêu cầu duyệt
async function openApprovalDetail(requestId) {
  const modal = document.getElementById("approvalDetailModal");
  const titleEl = document.getElementById("approvalDetailTitle");
  const metaEl = document.getElementById("approvalDetailMeta");
  const currentEl = document.getElementById("approvalCurrentData");
  const proposedEl = document.getElementById("approvalProposedData");

  if (!modal || !titleEl || !metaEl || !currentEl || !proposedEl) return;

  currentEl.innerHTML = `<div class="muted">Đang tải...</div>`;
  proposedEl.innerHTML = `<div class="muted">Đang tải...</div>`;
  metaEl.innerHTML = "";
  titleEl.textContent = "Chi tiết yêu cầu duyệt";
  modal.classList.remove("hidden");

  try {
    const data = await api(`/api/admin/approval-requests/${requestId}`);
    currentApprovalDetail = data;
    titleEl.textContent = `Chi tiết yêu cầu #${data.id}`;
    metaEl.innerHTML = `
      <div><strong>Lớp:</strong> ${escHtml(data.loai_lop || "-")}</div>
      <div><strong>Loại yêu cầu:</strong> ${escHtml(
        requestTypeLabel[data.loai_yeu_cau] || data.loai_yeu_cau || "-",
      )}</div>
      <div><strong>Người gửi:</strong> ${escHtml(data.ten_nguoi_tao || "-")}</div>
      <div><strong>Ngày gửi:</strong> ${escHtml(fmt(data.ngay_tao))}</div>
          <div><strong>Lý do:</strong> ${escHtml(data.ly_do || "Không có")}</div>
      <div><strong>Trạng thái:</strong> ${escHtml(data.trang_thai || "-")}</div>

    `;

    if (["them_anh", "xoa_anh", "cap_nhat_anh"].includes(data.loai_yeu_cau)) {
      currentEl.innerHTML = renderApprovalImageObject(
        data.du_lieu_hien_tai,
        data.loai_yeu_cau === "them_anh"
          ? "Đây là ảnh mới, chưa có ảnh hiện tại."
          : "Không có dữ liệu hiện tại",
      );
      proposedEl.innerHTML = renderApprovalImageObject(
        data.du_lieu_de_xuat,
        "Không có dữ liệu đề xuất",
      );
    } else {
      currentEl.innerHTML = renderApprovalObject(data.du_lieu_hien_tai);
      proposedEl.innerHTML = renderApprovalObject(data.du_lieu_de_xuat);
    }
  } catch (e) {
    currentEl.innerHTML = `<div class="muted">Không tải được dữ liệu</div>`;
    proposedEl.innerHTML = `<div class="muted">Không tải được dữ liệu</div>`;
    metaEl.innerHTML = `<div class="muted">${escHtml(e.message)}</div>`;
  }
}
function openPendingNewDetail(item) {
  const modal = document.getElementById("approvalDetailModal");
  const titleEl = document.getElementById("approvalDetailTitle");
  const metaEl = document.getElementById("approvalDetailMeta");
  const currentEl = document.getElementById("approvalCurrentData");
  const proposedEl = document.getElementById("approvalProposedData");

  if (!modal || !titleEl || !metaEl || !currentEl || !proposedEl) return;

  currentApprovalDetail = {
    __source: "pending_new",
    id: item.id,
    layer: item.layer,
    raw: item.raw,
  };

  titleEl.textContent = `Chi tiết tài nguyên chờ duyệt #${item.id}`;
  metaEl.innerHTML = `
    <div><strong>Lớp:</strong> ${escHtml(item.layer || "-")}</div>
    <div><strong>Loại yêu cầu:</strong> ${escHtml(
      requestTypeLabel[item.loai_yeu_cau] || item.loai_yeu_cau || "-",
    )}</div>
    <div><strong>Người gửi:</strong> ${escHtml(item.ten_nguoi_tao || "-")}</div>
    <div><strong>Ngày gửi:</strong> ${escHtml(fmt(item.ngay_tao))}</div>
    <div><strong>Trạng thái:</strong> Chờ duyệt</div>
  `;

  currentEl.innerHTML = `<div class="muted">Đây là tài nguyên mới, chưa có dữ liệu hiện tại trên bản đồ.</div>`;
  proposedEl.innerHTML = renderApprovalObject(extractPendingNewData(item.raw));

  modal.classList.remove("hidden");
}
// các thao tác từ quản trị viên
window.adminPheDuyetXoa = async (layer, id) => {
  if (
    confirm(
      "Xác nhận XÓA tài nguyên này? (Bạn vẫn có thể khôi phục từ Thùng rác)",
    )
  ) {
    try {
      await api("/api/admin/layer-objects/stage", {
        method: "PATCH",
        body: {
          layer: layer,
          ids: [id],
          stage: "da_xoa",
          reason: "Admin xác nhận xóa",
        },
      });
      showToast("Đã chuyển vào Thùng rác.");
      load();
    } catch (e) {
      showToast("Lỗi: " + e.message, "error");
    }
  }
};

window.adminTuChoiXoa = async (layer, id) => {
  if (confirm("Khôi phục tài nguyên này về trạng thái 'Công bộ'?")) {
    try {
      await api("/api/admin/layer-objects/stage", {
        method: "PATCH",
        body: {
          layer,
          ids: [id],
          stage: "cong_bo",
          reason: "Admin từ chối yêu cầu xóa",
        },
      });
      showToast("Đã khôi phục tài nguyên.");
      load();
    } catch (e) {
      showToast("Lỗi: " + e.message, "error");
    }
  }
};

window.adminKhoiPhucTuThungRac = async (layer, id) => {
  if (
    confirm("Bạn có chắc chắn muốn KHÔI PHỤC tài nguyên này quay lại bản đồ?")
  ) {
    try {
      await api("/api/admin/layer-objects/stage", {
        method: "PATCH",
        body: {
          layer,
          ids: [id],
          stage: "cong_bo",
          reason: "Khôi phục từ thùng rác",
        },
      });
      showToast("Đã khôi phục tài nguyên!");
      load();
    } catch (e) {
      showToast("Lỗi: " + e.message, "error");
    }
  }
};
window.adminXoaVinhVienTuThungRac = async (layer, id) => {
  const confirmed = confirm(
    "CẢNH BÁO: Hành động này sẽ xóa VĨNH VIỄN tài nguyên khỏi hệ thống và không thể khôi phục lại được. Bạn có chắc chắn muốn tiếp tục không?",
  );
  if (!confirmed) return;

  const featureTypeName = layer.includes(":") ? layer.split(":")[1] : layer;
  const rawId = String(id || "").trim();

  const fid = rawId.includes(".") ? rawId : `${featureTypeName}.${rawId}`;

  const xml = `
                <wfs:Transaction service="WFS" version="1.0.0"
                    xmlns:wfs="http://www.opengis.net/wfs"
                    xmlns:ogc="http://www.opengis.net/ogc">
                    <wfs:Delete typeName="${layer}">
                        <ogc:Filter>
                            <ogc:FeatureId fid="${fid}"/>
                        </ogc:Filter>
                    </wfs:Delete>
                </wfs:Transaction>`;

  try {
    await api("/api/wfst", {
      method: "POST",
      headers: {
        "X-Action": "delete",
        "X-Layer": layer,
        "Content-Type": "application/xml",
      },
      body: xml,
    });

    showToast("Đã xóa vĩnh viễn tài nguyên khỏi hệ thống.");
    load();
  } catch (e) {
    showToast("Lỗi xóa vĩnh viễn: " + e.message, "error");
  }
};
