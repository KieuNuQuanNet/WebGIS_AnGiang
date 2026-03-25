function taoPopupThongTin(feature, tieuDe, layerName, layerObj) {
  const featureId = feature?.id;
  const props = feature?.properties || {};
  const taiNguyenId = layTaiNguyenIdThuan(layerName, props, featureId);
  const loaiTaiNguyenAnh = chuanHoaLoaiTaiNguyenAnh(layerName);
  const coTheLayAnh = !!(layerName && taiNguyenId);

  const block = document.createElement("div");
  block.className = "info-popup";

  let htmlInfo = `<h4>Thông tin ${tieuDe}</h4>`;

  for (const key in props) {
    if (
      key !== "bbox" &&
      key !== "geom" &&
      key !== "id" &&
      key !== "osm_id" &&
      !WF_SYSTEM_FIELDS.has(key) &&
      props[key] !== null &&
      props[key] !== ""
    ) {
      const tenHienThi = TU_DIEN_COT[key] || key;
      htmlInfo += `<p><b>${tenHienThi}:</b> <span class="val-display">${props[key]}</span></p>`;
    }
  }
  if (coTheLayAnh) {
    htmlInfo += `
    <div class="popup-actions">
      <button type="button" class="btn-popup btn-images">Hình ảnh</button>
    </div>
  `;
  }

  const coThaoTac = !!(layerName && layerObj && featureId);

  const canEdit =
    coThaoTac && (hasPerm("admin.users") || hasPerm("feature.update"));

  const canRequestDelete =
    coThaoTac &&
    !isAdmin() &&
    (hasPerm("admin.users") || hasPerm("feature.update"));

  if (canEdit || canRequestDelete) {
    htmlInfo += `<div class="popup-actions">`;
    if (canEdit) htmlInfo += `<button class="btn-popup btn-edit">Sửa</button>`;

    if (canRequestDelete) {
      htmlInfo += `<button class="btn-popup btn-request-delete bg-orange">YÊU CẦU XÓA</button>`;
    }
    htmlInfo += `</div>`;
  }

  block.innerHTML = htmlInfo;

  if (coTheLayAnh) {
    block
      .querySelector(".btn-images")
      ?.addEventListener("click", function (ev) {
        L.DomEvent.stop(ev);
        moGalleryAnhTaiNguyen({
          tieuDe,
          loaiTaiNguyen: loaiTaiNguyenAnh,
          taiNguyenId,
          choPhepUpload: false,
        });
      });
  }

  L.DomEvent.disableClickPropagation(block);
  L.DomEvent.disableScrollPropagation(block);

  if (canRequestDelete) {
    block
      .querySelector(".btn-request-delete")
      ?.addEventListener("click", async function (ev) {
        L.DomEvent.stop(ev);
        const lyDo = prompt(
          "Vui lòng nhập lý do bạn muốn yêu cầu xóa tài nguyên này:",
          "",
        );
        if (lyDo === null) return;
        if (lyDo.trim() === "") {
          showToast("Bạn phải nhập lý do để Admin phê duyệt!", "error");
          return;
        }
        try {
          await taoYeuCauDuyetTaiNguyen({
            layer: layerName,
            taiNguyenId,
            loaiYeuCau: "xoa_tai_nguyen",
            duLieuDeXuat: { action: "delete" },
            lyDo: lyDo.trim(),
          });
          showToast("Đã gửi yêu cầu xóa chờ duyệt!");
          AppGIS.map.closePopup();
        } catch (err) {
          console.error("CREATE_DELETE_REQUEST_FRONTEND_ERROR:", err);
          showToast(err.message || "Không gửi được yêu cầu xóa", "error");
        }
      });
  }

  if (canEdit) {
    block.querySelector(".btn-edit")?.addEventListener("click", function (ev) {
      L.DomEvent.stop(ev);
      moFormSuaDoi(block, layerName, featureId, props, layerObj);
    });
  }

  return block;
}
// Truy van ban do - lay doi tuong tai diem click
AppGIS.map.on("click", function (e) {
  const pxTol = 8;
  const p = AppGIS.map.latLngToContainerPoint(e.latlng);
  const p1 = L.point(p.x - pxTol, p.y - pxTol);
  const p2 = L.point(p.x + pxTol, p.y + pxTol);
  const ll1 = AppGIS.map.containerPointToLatLng(p1);
  const ll2 = AppGIS.map.containerPointToLatLng(p2);

  const minx = Math.min(ll1.lng, ll2.lng);
  const miny = Math.min(ll1.lat, ll2.lat);
  const maxx = Math.max(ll1.lng, ll2.lng);
  const maxy = Math.max(ll1.lat, ll2.lat);

  const promises = [];

  const urlWFSBase =
    `${API_BASE}/api/wfs` +
    `?bbox=${minx},${miny},${maxx},${maxy},EPSG:4326` +
    `&maxFeatures=5`;

  function fetch1(typeName, layerObj, tieuDe) {
    return fetch(urlWFSBase + `&typeName=${encodeURIComponent(typeName)}`)
      .then(async (res) => {
        const ct = (res.headers.get("content-type") || "").toLowerCase();
        const text = await res.text();
        if (!res.ok)
          throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
        if (!ct.includes("application/json")) {
          throw new Error(`Không phải JSON: ${text.slice(0, 200)}`);
        }
        return JSON.parse(text);
      })
      .then((data) => {
        if (data.features && data.features.length > 0) {
          return {
            feature: data.features[0],
            layerName: typeName,
            layerObj,
            tieuDe,
          };
        }
        return null;
      })
      .catch((err) => ({
        __error: true,
        typeName,
        tieuDe,
        message: err.message,
      }));
  }

  if (AppGIS.map.hasLayer(AppGIS.layers.khoangsan))
    promises.push(
      fetch1(
        "angiang:khoangsan_diem_mo",
        AppGIS.layers.khoangsan,
        "Khoáng sản",
      ),
    );
  if (AppGIS.map.hasLayer(AppGIS.layers.rung))
    promises.push(fetch1("angiang:rung", AppGIS.layers.rung, "Rừng"));
  if (AppGIS.map.hasLayer(AppGIS.layers.nuoc))
    promises.push(fetch1("angiang:waterways", AppGIS.layers.nuoc, "Nước"));
  if (AppGIS.map.hasLayer(AppGIS.layers.dat))
    promises.push(fetch1("angiang:dat", AppGIS.layers.dat, "Đất"));
  if (AppGIS.map.hasLayer(AppGIS.layers.dongvat))
    promises.push(fetch1("angiang:dongvat", AppGIS.layers.dongvat, "Động vật"));
  if (AppGIS.map.hasLayer(AppGIS.layers.thucvat))
    promises.push(fetch1("angiang:thucvat", AppGIS.layers.thucvat, "Thực vật"));

  Promise.all(promises).then((results) => {
    const validResults = results.filter((r) => r && !r.__error);

    if (validResults.length === 0) {
      AppGIS.map.closePopup();
      return;
    }

    const item = validResults[0];
    const feature = item.feature;
    const props = feature.properties || {};
    const featureId = feature.id;

    const block = taoPopupThongTin(
      feature,
      item.tieuDe,
      item.layerName,
      item.layerObj,
    );

    L.popup().setLatLng(e.latlng).setContent(block).openOn(AppGIS.map);
    L.DomEvent.disableClickPropagation(block);
    L.DomEvent.disableScrollPropagation(block);
  });
});

// Chinh sua tai nguyen - enum va form cap nhat
const ENUM_OPTIONS = {
  loai_rung: ["Rừng phòng hộ", "Rừng đặc dụng", "Rừng sản xuất"],
  tinh_trang: [
    "Chưa xác định",
    "Ổn định - Bảo vệ",
    "Cảnh báo cháy",
    "Đang cháy",
    "Bị suy thoái",
    "Đang tái sinh",
    "Đã quy hoạch",
    "Chưa khai thác",
    "Đang khai thác",
    "Tạm dừng khai thác",
    "Đóng cửa mỏ",
    "Khu vực cấm khai thác",
    "Khai thác trái phép",
  ],
  loai_dat_su_dung: [
    "Đất chuyên trồng lúa nước",
    "Đất trồng lúa nương",
    "Đất trồng cây hàng năm khác",
    "Đất trồng cây lâu năm",
    "Đất rừng sản xuất",
    "Đất nuôi trồng thủy sản",
    "Đất ở tại đô thị",
    "Đất ở tại nông thôn",
  ],
  nhom_su_dung: ["Đất nông nghiệp", "Đất phi nông nghiệp", "Đất chưa sử dụng"],
  loai: ["kênh", "rạch", "sông"],
  cap: ["chính", "nhánh"],
  loai_khoang_san: [
    "Chưa phân loại",
    "Đá xây dựng",
    "Sét gạch ngói",
    "Cát xây dựng",
    "Cát san lấp",
    "Đất đá san lấp",
    "Đá vôi",
    "Than bùn",
  ],
  muc_do_nguy_cap: [
    "Ít quan tâm (LC)",
    "Sắp nguy cấp (VU)",
    "Nguy cấp (EN)",
    "Cực kỳ nguy cấp (CR)",
  ],
};
const ENUMS_THEO_LOP = {
  "angiang:rung": {
    tinh_trang: [
      "Chưa xác định",
      "Ổn định - Bảo vệ",
      "Cảnh báo cháy",
      "Đang cháy",
      "Bị suy thoái",
      "Đang tái sinh",
    ],
  },
  "angiang:khoangsan_diem_mo": {
    tinh_trang: [
      "Chưa xác định",
      "Đã quy hoạch",
      "Chưa khai thác",
      "Đang khai thác",
      "Tạm dừng khai thác",
      "Đóng cửa mỏ",
      "Khu vực cấm khai thác",
      "Khai thác trái phép",
    ],
  },
};
const WF_AUTO_MEASURE_FIELDS = new Set([
  "dien_tich_ha",
  "dien_tich_m2",
  "chieu_dai_m",
  "chieu_dai_km",
]);

function moFormSuaDoi(blockElement, layerName, featureId, props, layerObj) {
  var formHtml = `<div class='wfs-form-container'><h4 class="wfs-form-header text-khoangsan">CẬP NHẬT DỮ LIỆU</h4>`;

  for (var key in props) {
    if (
      key !== "bbox" &&
      key !== "geom" &&
      key !== "id" &&
      key !== "osm_id" &&
      !WF_SYSTEM_FIELDS.has(key) &&
      !WF_AUTO_MEASURE_FIELDS.has(key)
    ) {
      var tenHienThi = TU_DIEN_COT[key] || key;
      var currentVal = props[key] || "";

      formHtml += `<div class="wfs-form-group"><label>${tenHienThi}:</label>`;

      let optionsCuaLop =
        ENUMS_THEO_LOP[layerName] && ENUMS_THEO_LOP[layerName][key]
          ? ENUMS_THEO_LOP[layerName][key]
          : ENUM_OPTIONS[key];

      if (optionsCuaLop) {
        formHtml += `<select class='wfs-input edit-input' data-key='${key}'>`;
        optionsCuaLop.forEach((opt) => {
          var selected = String(opt) === String(currentVal) ? "selected" : "";
          formHtml += `<option value="${opt}" ${selected}>${opt}</option>`;
        });
        formHtml += `</select>`;
      } else {
        formHtml += `<input type='text' class='wfs-input edit-input' data-key='${key}' value='${currentVal}'>`;
      }

      formHtml += `</div>`;
    }
  }
  formHtml += `
           <div class="wfs-form-group">
  <button type="button" class="wfs-btn wfs-btn-image" id="btnQuanLyAnh">
    Hình ảnh
  </button>
</div>


            <div class="wfs-button-group">
  <button type="button" class='wfs-btn wfs-btn-cancel' id='btnHuySua'>HỦY</button>
  <button type="button" class='wfs-btn wfs-btn-save bg-khoangsan' id='btnLuuSua'>Lưu lại</button>
</div>
        </div>`;

  blockElement.innerHTML = formHtml;
  const taiNguyenId = layTaiNguyenIdThuan(layerName, props, featureId);
  const loaiTaiNguyenAnh = chuanHoaLoaiTaiNguyenAnh(layerName);

  const tenTaiNguyen =
    props.ten_loai || props.ten || props.ten_don_vi || "Tai nguyen";
  blockElement
    .querySelector("#btnQuanLyAnh")
    ?.addEventListener("click", (e) => {
      e.preventDefault();
      L.DomEvent.stop(e);

      moGalleryAnhTaiNguyen({
        tieuDe: tenTaiNguyen,
        loaiTaiNguyen: loaiTaiNguyenAnh,
        taiNguyenId,
        choPhepUpload: true,
      });
    });

  blockElement.querySelector("#btnHuySua").addEventListener("click", (e) => {
    e.preventDefault();
    L.DomEvent.stop(e);
    AppGIS.map.closePopup();
  });

  blockElement
    .querySelector("#btnLuuSua")
    .addEventListener("click", async function (e) {
      e.preventDefault();
      L.DomEvent.stop(e);

      this.innerHTML = "Đang lưu...";
      this.disabled = true;

      try {
        var updatedProps = {};

        blockElement.querySelectorAll(".edit-input").forEach((input) => {
          const k = input.getAttribute("data-key");
          if (!k || WF_SYSTEM_FIELDS.has(k)) return;
          updatedProps[k] = input.value;
        });

        updatedProps["ngay_cap_nhat"] = nowIsoNoTZ();
        const uid = getUserIdFromToken();
        if (uid !== null) updatedProps["nguoi_cap_nhat"] = String(uid);

        delete updatedProps["trang_thai_du_lieu"];
        delete updatedProps["ngay_cap_nhat"];
        delete updatedProps["nguoi_cap_nhat"];

        await taoYeuCauDuyetTaiNguyen({
          layer: layerName,
          taiNguyenId: taiNguyenId,
          loaiYeuCau: "cap_nhat_tai_nguyen",
          duLieuDeXuat: updatedProps,
          lyDo: "Người dùng đề xuất cập nhật tài nguyên",
        });

        showToast("Đã gửi yêu cầu cập nhật chờ duyệt!");
        AppGIS.map.closePopup();
      } catch (err) {
        console.error("CREATE_APPROVAL_REQUEST_FRONTEND_ERROR:", err);
        showToast(err.message || "Lỗi khi lưu dữ liệu/ảnh", "error");
        this.innerHTML = "Lưu lại";
        this.disabled = false;
      }
    });
}
// Duyet va hinh anh - helper duyet va thu vien anh
function layTaiNguyenIdThuan(layerName, props, featureId) {
  const loai = chuanHoaLoaiTaiNguyenAnh(layerName);

  if (loai === "khoangsan_diem_mo") {
    if (props?.gid !== undefined && props.gid !== null && props.gid !== "") {
      return String(props.gid);
    }
  }

  if (props?.id !== undefined && props.id !== null && props.id !== "") {
    return String(props.id);
  }

  if (
    props?.objectid !== undefined &&
    props.objectid !== null &&
    props.objectid !== ""
  ) {
    return String(props.objectid);
  }

  if (props?.fid !== undefined && props.fid !== null && props.fid !== "") {
    return String(props.fid);
  }

  if (loai === "khoangsan_diem_mo") {
    if (props?.gid !== undefined && props.gid !== null && props.gid !== "") {
      return String(props.gid);
    }
  }

  const match = String(featureId || "").match(/\.([0-9]+)$/);
  return match ? match[1] : "";
}

function chuanHoaLoaiTaiNguyenAnh(layerName) {
  const loai = String(layerName || "").split(":")[1] || "";

  if (loai === "dongvat") return "dongvat_ag";
  if (loai === "thucvat") return "thucvat_ag";

  return loai;
}
const API_BASE = window.WEBGIS_API_BASE || "";
async function taoYeuCauDuyetTaiNguyen({
  layer,
  taiNguyenId,
  loaiYeuCau,
  duLieuDeXuat,
  lyDo = "",
}) {
  const token = getToken();
  if (!token) throw new Error("Bạn chưa đăng nhập");

  const res = await fetch(`${API_BASE}/api/admin/approval-requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      layer,
      tai_nguyen_id: taiNguyenId,
      loai_yeu_cau: loaiYeuCau,
      du_lieu_de_xuat: duLieuDeXuat,
      ly_do: lyDo,
    }),
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!res.ok) {
    throw new Error(data.message || text || "Không tạo được yêu cầu chờ duyệt");
  }

  return data;
}
async function layDanhSachAnhTaiNguyen(loaiTaiNguyen, taiNguyenId) {
  const token = getToken();
  if (!token) throw new Error("Bạn chưa đăng nhập");

  const res = await fetch(
    `${API_BASE}/api/admin/resource-images?loai_tai_nguyen=${encodeURIComponent(loaiTaiNguyen)}&tai_nguyen_id=${encodeURIComponent(taiNguyenId)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : [];
  } catch {
    data = [];
  }

  if (!res.ok) {
    throw new Error(data.message || text || "Lỗi lấy danh sách ảnh");
  }

  return Array.isArray(data) ? data : [];
}

async function uploadAnhTaiNguyen({
  loaiTaiNguyen,
  taiNguyenId,
  tenTaiNguyen = "",
  file,
  chuThich = "",
  laAnhDaiDien = false,
}) {
  const token = getToken();
  if (!token) throw new Error("Bạn chưa đăng nhập");
  if (!file) throw new Error("Chưa chọn file ảnh");

  const mimeAllow = ["image/jpeg", "image/png", "image/webp"];
  if (!mimeAllow.includes(file.type)) {
    throw new Error("Chỉ hỗ trợ JPG, PNG, WEBP");
  }

  const dataBase64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Không đọc được file ảnh"));
    reader.readAsDataURL(file);
  });

  const res = await fetch(`${API_BASE}/api/admin/resource-images`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      loai_tai_nguyen: loaiTaiNguyen,
      tai_nguyen_id: taiNguyenId,
      ten_tai_nguyen: tenTaiNguyen,
      file_name: file.name,
      mime_type: file.type,
      data_base64: dataBase64,
      chu_thich: chuThich,
      la_anh_dai_dien: laAnhDaiDien,
    }),
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!res.ok) {
    throw new Error(data.message || text || "Upload ảnh thất bại");
  }

  return data.image || null;
}
async function xoaAnhTaiNguyen(imageId) {
  const token = getToken();
  if (!token) throw new Error("Bạn chưa đăng nhập");

  const res = await fetch(
    `${API_BASE}/api/admin/resource-images/${encodeURIComponent(imageId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!res.ok) {
    throw new Error(data.message || text || "Xóa ảnh thất bại");
  }

  return data;
}
function renderDanhSachAnhTaiNguyen(
  container,
  images,
  { choPhepXoa = false } = {},
) {
  if (!container) return;

  if (!images || !images.length) {
    container.innerHTML = `<div class="resource-image-empty">Chưa có ảnh</div>`;
    return;
  }

  container.innerHTML = images
    .map((img) => {
      const src = `${API_BASE}${img.duong_dan_file}`;
      const caption = img.chu_thich || "Không có chú thích";

      return `
        <div class="resource-image-item">
          <img src="${src}" alt="Ảnh tài nguyên" />
          <div class="resource-image-meta">
            <div class="resource-image-caption">${caption}</div>
            ${
              choPhepXoa
                ? `<button type="button" class="btn-delete-image" data-image-id="${img.id}">Yêu cầu xóa</button>`
                : ""
            }
          </div>
        </div>
      `;
    })
    .join("");
}

function damBaoModalAnhTaiNguyen() {
  let modal = document.getElementById("resourceImageModal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "resourceImageModal";
  modal.className = "resource-image-modal hidden";
  modal.innerHTML = `
    <div class="resource-image-modal-card">
      <div class="resource-image-modal-head">
        <h3 id="txtImageModalTitle">Hình ảnh tài nguyên</h3>
        <button type="button" class="btn-image-modal-close" aria-label="Đóng">
  ×
</button>
      </div>

      <div class="resource-image-modal-body">
        <div id="resourceImageModalList" class="resource-image-list">
          <div class="resource-image-empty">Đang tải ảnh...</div>
        </div>

        <div id="resourceImageModalUpload" class="resource-image-upload hidden">
          <div class="wfs-form-group">
            <label>Chọn ảnh mới:</label>
            <input
              type="file"
              id="inpModalResourceImage"
              class="wfs-input"
              accept="image/jpeg,image/png,image/webp"
            />
          </div>

          <div class="wfs-form-group">
            <label>Chú thích ảnh:</label>
            <input
              type="text"
              id="inpModalImageCaption"
              class="wfs-input"
              placeholder="Nhập chú thích ảnh..."
            />
          </div>

          <div class="wfs-button-group">
            <button
              type="button"
              class="wfs-btn wfs-btn-save btn-image-modal-upload"
            >
              Tải ảnh lên
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.add("hidden");
    }
  });

  modal
    .querySelector(".btn-image-modal-close")
    ?.addEventListener("click", () => {
      modal.classList.add("hidden");
    });

  return modal;
}

async function moGalleryAnhTaiNguyen({
  tieuDe = "Tài nguyên",
  loaiTaiNguyen,
  taiNguyenId,
  choPhepUpload = false,
}) {
  const modal = damBaoModalAnhTaiNguyen();
  const titleEl = modal.querySelector("#txtImageModalTitle");
  const listEl = modal.querySelector("#resourceImageModalList");
  const uploadWrap = modal.querySelector("#resourceImageModalUpload");
  const btnUpload = modal.querySelector(".btn-image-modal-upload");
  const fileInput = modal.querySelector("#inpModalResourceImage");
  const captionInput = modal.querySelector("#inpModalImageCaption");

  titleEl.textContent = "Hình ảnh";
  uploadWrap.classList.toggle("hidden", !choPhepUpload);
  listEl.innerHTML = `<div class="resource-image-empty">Đang tải ảnh...</div>`;
  modal.classList.remove("hidden");

  const taiNguyenIdText = String(taiNguyenId || "").trim();
  if (!taiNguyenIdText) {
    renderDanhSachAnhTaiNguyen(listEl, []);
    return;
  }

  const reloadImages = async () => {
    try {
      const images = await layDanhSachAnhTaiNguyen(
        loaiTaiNguyen,
        taiNguyenIdText,
      );
      renderDanhSachAnhTaiNguyen(listEl, images, {
        choPhepXoa: choPhepUpload,
      });

      if (choPhepUpload) {
        listEl.querySelectorAll(".btn-delete-image").forEach((btn) => {
          btn.onclick = async () => {
            const imageId = btn.getAttribute("data-image-id");
            if (!imageId) return;

            const ok = confirm("Bạn có chắc muốn gửi yêu cầu xóa ảnh này?");
            if (!ok) return;

            btn.disabled = true;
            btn.textContent = "Đang xóa...";

            try {
              await xoaAnhTaiNguyen(imageId);
              await reloadImages();
              showToast("Đã gửi yêu cầu xóa ảnh chờ duyệt!");
            } catch (err) {
              showToast(err.message || "Xóa ảnh thất bại", "error");
            }
          };
        });
      }
    } catch (err) {
      renderDanhSachAnhTaiNguyen(listEl, []);
      showToast(err.message || "Không tải được danh sách ảnh", "error");
    }
  };

  await reloadImages();

  if (btnUpload) {
    btnUpload.onclick = async () => {
      const selectedFile = fileInput?.files?.[0] || null;
      if (!selectedFile) {
        showToast("Chưa chọn file ảnh", "error");
        return;
      }

      if (selectedFile.size > 2 * 1024 * 1024) {
        showToast("Ảnh không được vượt quá 2MB", "error");
        return;
      }

      btnUpload.disabled = true;
      btnUpload.textContent = "Đang tải...";

      try {
        await uploadAnhTaiNguyen({
          loaiTaiNguyen,
          taiNguyenId: taiNguyenIdText,
          tenTaiNguyen: tieuDe || "",
          file: selectedFile,
          chuThich: captionInput?.value?.trim() || "",
          laAnhDaiDien: false,
        });

        if (fileInput) fileInput.value = "";
        if (captionInput) captionInput.value = "";

        await reloadImages();
        showToast("Đã gửi yêu cầu thêm ảnh chờ duyệt!");
      } catch (err) {
        showToast(err.message || "Upload ảnh thất bại", "error");
      } finally {
        btnUpload.disabled = false;
        btnUpload.textContent = "Tải ảnh lên";
      }
    };
  }
}

// WFS-T - helper tao XML va gui giao dich
applyPermUI?.();
initAuthNav?.();
function xmlEscape(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
function nowIsoNoTZ() {
  return new Date().toISOString();
}
function wfInsertMetaXml(nsPrefix) {
  const now = new Date().toISOString();
  const uid = getUserIdFromToken();

  return `
             <${nsPrefix}:trang_thai_du_lieu>cho_duyet</${nsPrefix}:trang_thai_du_lieu>
            <${nsPrefix}:ngay_tao>${now}</${nsPrefix}:ngay_tao>
            <${nsPrefix}:nguoi_tao>${uid || ""}</${nsPrefix}:nguoi_tao>
            <${nsPrefix}:ngay_cap_nhat>${now}</${nsPrefix}:ngay_cap_nhat>
            <${nsPrefix}:nguoi_cap_nhat>${uid || ""}</${nsPrefix}:nguoi_cap_nhat>
          `;
}

function wfstHasError(respText) {
  return /ExceptionReport|ServiceExceptionReport|<wfs:Status>\s*FAILED/i.test(
    respText,
  );
}

function wfstTotalInserted(respText) {
  const m = String(respText || "").match(
    /<wfs:totalInserted>\s*(\d+)\s*<\/wfs:totalInserted>/i,
  );
  return m ? Number(m[1]) : null;
}

async function postWFST(action, layer, xml) {
  const token = getToken();
  if (!token) throw new Error("Bạn chưa đăng nhập!");

  const res = await fetch(`${API_BASE}/api/wfst`, {
    method: "POST",
    headers: {
      "Content-Type": "application/xml",
      Authorization: `Bearer ${token}`,
      "X-Action": action,
      "X-Layer": layer,
    },
    body: xml,
  });

  const text = await res.text();
  if (!res.ok) throw new Error(text);
  return text;
}

function suaDuLieuWFS(layerName, featureId, updatedProps, layerObj) {
  const workspace = layerName.split(":")[0];
  const WORKSPACE_URI = "http://angiang.vn";

  let propXml = "";
  for (const key in updatedProps) {
    propXml += `
      <wfs:Property>
        <wfs:Name>${key}</wfs:Name>
        <wfs:Value>${xmlEscape(updatedProps[key])}</wfs:Value>
      </wfs:Property>
    `;
  }

  const wfsTx = `
    <wfs:Transaction service="WFS" version="1.0.0"
      xmlns:wfs="http://www.opengis.net/wfs"
      xmlns:ogc="http://www.opengis.net/ogc"
      xmlns:${workspace}="${WORKSPACE_URI}">
      <wfs:Update typeName="${layerName}">
        ${propXml}
        <ogc:Filter>
          <ogc:FeatureId fid="${featureId}"/>
        </ogc:Filter>
      </wfs:Update>
    </wfs:Transaction>
  `;

  postWFST("update", layerName, wfsTx)
    .then((data) => {
      if (
        String(data).includes("Exception") ||
        String(data).includes("Error")
      ) {
        showToast("Lỗi khi sửa dữ liệu!", "error");
        console.log(data);
      } else {
        showToast("Cập nhật dữ liệu thành công!");
        AppGIS.map.closePopup();
        layerObj.setParams({ fake: Date.now() }, false);
      }
    })
    .catch((e) => {
      showToast("Update thất bại: " + e.message);

      console.error(e);
    });
}

function insertFeatureToGeoServer(layerName, geometryType, coords, props) {
  const WORKSPACE = "angiang";
  const WORKSPACE_URI = "http://angiang.vn";
  const nsPrefix = WORKSPACE;

  let geomXml = "";
  if (geometryType === "Point") {
    geomXml = `
          <${nsPrefix}:geom>
            <gml:Point srsName="EPSG:4326">
              <gml:coordinates>${coords.lng},${coords.lat}</gml:coordinates>
           </gml:Point>
        </${nsPrefix}:geom>`;
  } else if (geometryType === "LineString") {
    geomXml = `
        <${nsPrefix}:geom>
          <gml:MultiLineString srsName="EPSG:4326">
            <gml:lineStringMember><gml:LineString>
              <gml:coordinates>${String(coords).trim()}</gml:coordinates>
                  </gml:LineString></gml:lineStringMember>
         </gml:MultiLineString>
        </${nsPrefix}:geom>`;
  } else if (geometryType === "Polygon") {
    geomXml = `
         <${nsPrefix}:geom>
         <gml:MultiPolygon srsName="EPSG:4326">
            <gml:polygonMember><gml:Polygon><gml:outerBoundaryIs><gml:LinearRing>
             <gml:coordinates>${String(coords).trim()}</gml:coordinates>
             </gml:LinearRing></gml:outerBoundaryIs></gml:Polygon></gml:polygonMember>
          </gml:MultiPolygon>
        </${nsPrefix}:geom>`;
  }

  let propsXml = "";
  for (const key in props) {
    if (props[key] !== undefined && props[key] !== null) {
      const safeKey = String(key).replace(/[^a-z0-9_]/gi, "");
      propsXml += `<${nsPrefix}:${safeKey}>${esc(props[key])}</${nsPrefix}:${safeKey}>`;
    }
  }

  propsXml += wfInsertMetaXml(nsPrefix);

  const wfsTransaction = `
       <wfs:Transaction service="WFS" version="1.0.0"
         xmlns:wfs="http://www.opengis.net/wfs"
         xmlns:gml="http://www.opengis.net/gml"
         xmlns:${nsPrefix}="${WORKSPACE_URI}">
       <wfs:Insert>
         <${nsPrefix}:${layerName}>
           ${geomXml}
           ${propsXml}
            </${nsPrefix}:${layerName}>
        </wfs:Insert>
       </wfs:Transaction>`;

  console.log(`WFST INSERT [${layerName}] XML:`, wfsTransaction);

  postWFST("insert", `${nsPrefix}:${layerName}`, wfsTransaction)
    .then((data) => {
      console.log(`WFST INSERT [${layerName}] RESPONSE:`, data);
      if (wfstHasError(data)) {
        showToast(`Lỗi từ GeoServer khi lưu lớp ${layerName}. Mở F12 để xem.`);
        return;
      }
      if (wfstTotalInserted(data) === 0) {
        showToast("Không có dữ liệu nào được lưu (totalInserted=0).");
        return;
      }
      showToast(`Đã lưu dữ liệu vào lớp ${layerName} thành công!`);
      if (window.drawnItems) drawnItems.clearLayers();
    })
    .catch((e) => {
      showToast("Lỗi kết nối hoặc phân quyền: " + e.message);
      console.error(e);
    });
}
// Them moi tai nguyen - chon lop, mo form va luu WFS
const btnThemTaiNguyen = document.getElementById("btnThemTaiNguyen");
const danhSachTaiNguyen = document.getElementById("danhSachTaiNguyen");

var taiNguyenDangChon = "";
var cheDoVe = "";
function renderOptionList(options, selectedValue = "") {
  return options
    .map((opt) => {
      const value = typeof opt === "string" ? opt : opt.value;
      const label = typeof opt === "string" ? opt : opt.label;
      const selected = value === selectedValue ? " selected" : "";
      return `<option value="${value}"${selected}>${label}</option>`;
    })
    .join("");
}

const FORM_OPTIONS = {
  khoangSanLoai: [
    "Chưa phân loại",
    "Đá xây dựng",
    "Sét gạch ngói",
    "Cát xây dựng",
    "Cát san lấp",
    "Đất đá san lấp",
    "Đá vôi",
    "Than bùn",
  ],
  khoangSanTinhTrang: [
    "Chưa xác định",
    "Đã quy hoạch",
    "Chưa khai thác",
    "Đang khai thác",
    "Tạm dừng khai thác",
    "Đóng cửa mỏ",
    "Khu vực cấm khai thác",
    "Khai thác trái phép",
  ],
  nguyCap: [
    "Ít quan tâm (LC)",
    "Sắp nguy cấp (VU)",
    "Nguy cấp (EN)",
    "Cực kỳ nguy cấp (CR)",
  ],
  loaiRung: ["Rừng phòng hộ", "Rừng đặc dụng", "Rừng sản xuất"],
  tinhTrangRung: [
    "Chưa xác định",
    "Ổn định - Bảo vệ",
    "Cảnh báo cháy",
    "Đang cháy",
    "Bị suy thoái",
    "Đang tái sinh",
  ],
  loaiDatSuDung: [
    "Đất chuyên trồng lúa nước",
    "Đất trồng lúa nương",
    "Đất trồng cây hàng năm khác",
    "Đất trồng cây lâu năm",
    "Đất rừng sản xuất",
    "Đất nuôi trồng thủy sản",
    "Đất ở tại đô thị",
    "Đất ở tại nông thôn",
  ],
  nhomSuDungDat: ["Đất nông nghiệp", "Đất phi nông nghiệp", "Đất chưa sử dụng"],
  loaiNuoc: ["kênh", "rạch", "sông"],
  capNuoc: ["chính", "nhánh"],
};

const cacLoaiTaiNguyen = document.querySelectorAll(".resource-item");
const menuTaiNguyen = document.getElementById("danhSachTaiNguyen");

cacLoaiTaiNguyen.forEach(function (item) {
  item.addEventListener("click", function () {
    const loaiHinh = this.getAttribute("data-loai");
    taiNguyenDangChon = this.getAttribute("data-ten");
    cheDoVe = "resource";
    menuTaiNguyen.classList.add("hidden");

    if (loaiHinh === "polygon") {
      new L.Draw.Polygon(AppGIS.map).enable();
    } else if (loaiHinh === "polyline") {
      new L.Draw.Polyline(AppGIS.map).enable();
    } else if (loaiHinh === "point") {
      new L.Draw.Marker(AppGIS.map).enable();
    }
    showToast(
      "Chọn vị trí trên bản đồ để vẽ/chấm điểm cho: " + taiNguyenDangChon,
    );
  });
});

var drawnItems = new L.FeatureGroup();
AppGIS.map.addLayer(drawnItems);

let kieuDoDat = "distance";

var measureItems = new L.FeatureGroup();
AppGIS.map.addLayer(measureItems);

function tinhDoDaiPolyline(latlngs) {
  let sum = 0;
  for (let i = 1; i < latlngs.length; i++) {
    sum += AppGIS.map.distance(latlngs[i - 1], latlngs[i]);
  }
  return sum;
}
function dinhDangDoDai(m) {
  if (m >= 1000) return (m / 1000).toFixed(2) + " km";
  return m.toFixed(2) + " m";
}
function geodesicArea(latlngs) {
  const d2r = Math.PI / 180;
  let area = 0.0;
  const n = latlngs.length;
  if (n < 3) return 0;

  for (let i = 0; i < n; i++) {
    const p1 = latlngs[i];
    const p2 = latlngs[(i + 1) % n];
    area +=
      (p2.lng - p1.lng) *
      d2r *
      (2 + Math.sin(p1.lat * d2r) + Math.sin(p2.lat * d2r));
  }
  area = (area * 6378137.0 * 6378137.0) / 2.0;
  return Math.abs(area);
}
function dinhDangDienTich(m2) {
  const ha = m2 / 10000;
  if (ha >= 1)
    return `${ha.toFixed(2)} ha (${Math.round(m2).toLocaleString("vi-VN")} m²)`;
  return `${Math.round(m2).toLocaleString("vi-VN")} m²`;
}

// Do dac va ve hinh - xu ly ket qua sau khi ve
AppGIS.map.on("draw:created", function (e) {
  var type = e.layerType;
  var layer = e.layer;

  if (cheDoVe === "measure") {
    measureItems.addLayer(layer);

    let html = `<h4 class="measure-title">Kết quả đo</h4>`;

    if (type === "polyline") {
      const latlngs = layer.getLatLngs();
      const m = tinhDoDaiPolyline(latlngs);
      html += `<p><b>Độ dài:</b> ${dinhDangDoDai(m)}</p>`;
    } else if (type === "polygon") {
      const rings = layer.getLatLngs();
      const latlngs = Array.isArray(rings[0]) ? rings[0] : rings;
      const m2 = geodesicArea(latlngs);
      html += `<p><b>Diện tích:</b> ${dinhDangDienTich(m2)}</p>`;
    }

    html += `<div class="popup-actions">
            <button class="btn-popup btn-delete">🧹 XÓA ĐO</button>
          </div>`;

    const box = document.createElement("div");
    box.className = "info-popup";
    box.innerHTML = html;

    box.querySelector(".btn-delete")?.addEventListener("click", (ev) => {
      L.DomEvent.stop(ev);
      measureItems.removeLayer(layer);
      AppGIS.map.closePopup();
    });

    layer.bindPopup(box).openPopup();
    return;
  }

  drawnItems.addLayer(layer);

  if (type === "marker") {
    var toaDo = layer.getLatLng();

    if (taiNguyenDangChon === "Mỏ khoáng sản") {
      var formDiv = document.createElement("div");
      formDiv.className = "wfs-form-container";
      formDiv.innerHTML = `
        <h4 class="wfs-form-header">THÊM MỎ KHOÁNG SẢN</h4>
        <div class="wfs-form-group"><label>Tên đơn vị:</label><input type="text" id="inpTen" class="wfs-input" placeholder="Nhập tên mỏ..."></div>
        <div class="wfs-form-group"><label>Loại khoáng sản:</label>
          <select id="inpLoai" class="wfs-input">
  ${renderOptionList(FORM_OPTIONS.khoangSanLoai, "Chưa phân loại")}
</select>

        </div>
        <div class="wfs-form-group"><label>Tình trạng:</label>
          <select id="inpTinhTrang" class="wfs-input">
  ${renderOptionList(FORM_OPTIONS.khoangSanTinhTrang, "Đang khai thác")}
</select>

        </div>
        <div class="wfs-flex-row">
          <div class="wfs-flex-col"><label>Trữ lượng:</label><input type="number" id="inpTruLuong" class="wfs-input" value="0"></div>
          <div class="wfs-flex-col"><label>Diện tích (ha):</label><input type="number" id="inpDienTich" class="wfs-input" value="0"></div>
        </div>
        <div class="wfs-form-group"><label>Địa chỉ:</label><input type="text" id="inpDiaChi" class="wfs-input" placeholder="Nhập địa chỉ..."></div>
        <div class="wfs-form-group"><label>Đối tượng bảo vệ:</label><input type="text" id="inpDoiTuong" class="wfs-input" placeholder="Nhập đối tượng bảo vệ..."></div>
        <div class="wfs-button-group">
          <button id="btnHuyForm" class="wfs-btn wfs-btn-cancel">Hủy</button>
          <button id="btnLuuForm" class="wfs-btn wfs-btn-save">Lưu</button>
        </div>
      `;

      layer.bindPopup(formDiv).openPopup();

      formDiv
        .querySelector("#btnHuyForm")
        .addEventListener("click", function () {
          AppGIS.map.closePopup();
          drawnItems.removeLayer(layer);
        });

      formDiv
        .querySelector("#btnLuuForm")
        .addEventListener("click", function () {
          var ten = formDiv.querySelector("#inpTen").value;
          var loai = formDiv.querySelector("#inpLoai").value;
          var tinhTrang = formDiv.querySelector("#inpTinhTrang").value;
          var truLuong = formDiv.querySelector("#inpTruLuong").value;
          var dienTich = formDiv.querySelector("#inpDienTich").value;
          var diaChi = formDiv.querySelector("#inpDiaChi").value;
          var doiTuong = formDiv.querySelector("#inpDoiTuong").value;

          if (!ten) {
            showToast("Kiếp nạn! Không được để trống Tên đơn vị!");
            return;
          }

          insertFeatureToGeoServer("khoangsan_diem_mo", "Point", toaDo, {
            ten_don_vi: ten,
            loai_khoang_san: loai,
            tinh_trang: tinhTrang,
            tru_luong: truLuong,
            dien_tich: dienTich,
            dia_chi: diaChi,
            doi_tuong_bao_ve: doiTuong,
            nguon_du_lieu: "WebGIS An Giang",
          });
          AppGIS.map.closePopup();
        });
    } else if (
      taiNguyenDangChon === "Tài nguyên Động vật" ||
      taiNguyenDangChon === "Tài nguyên Thực vật"
    ) {
      var isDongVat = taiNguyenDangChon === "Tài nguyên Động vật";
      var tieuDe = isDongVat ? "THÊM ĐỘNG VẬT" : "THÊM THỰC VẬT";
      var mauNen = isDongVat ? "#e65100" : "#33691e";
      var tenLayerWFS = isDongVat ? "dongvat" : "thucvat";

      var formDivSinhVat = document.createElement("div");
      formDivSinhVat.className = "wfs-form-container";
      formDivSinhVat.innerHTML = `
        <h4 class="wfs-form-header ${sinhVatClass}">${tieuDe}</h4>
        <div class="wfs-form-group"><label>Tên sinh vật:</label><input type="text" id="inpTenSV" class="wfs-input" placeholder="Nhập tên..."></div>
        <div class="wfs-form-group"><label>Phân loại:</label><input type="text" id="inpPhanLoai" class="wfs-input" placeholder="VD: Lưỡng cư, Bò sát, Cây gỗ..."></div>
        <div class="wfs-form-group"><label>Nhóm:</label><input type="text" id="inpNhom" class="wfs-input" placeholder="VD: Nhóm IB, IIB..."></div>
        <div class="wfs-form-group"><label>Vị trí phân bố:</label><input type="text" id="inpViTri" class="wfs-input" placeholder="Nhập vị trí..."></div>
        <div class="wfs-form-group"><label>Mức độ nguy cấp:</label>
          <select id="inpNguyCap" class="wfs-input">
  ${renderOptionList(FORM_OPTIONS.nguyCap, "Ít quan tâm (LC)")}
</select>

        </div>
        <div class="wfs-button-group">
          <button id="btnHuySV" class="wfs-btn wfs-btn-cancel">Hủy</button>
          <button id="btnLuuSV" class="wfs-btn wfs-btn-save ${sinhVatClass}">Lưu</button>
        </div>
      `;

      layer.bindPopup(formDivSinhVat).openPopup();

      formDivSinhVat
        .querySelector("#btnHuySV")
        .addEventListener("click", function () {
          AppGIS.map.closePopup();
          drawnItems.removeLayer(layer);
        });

      formDivSinhVat
        .querySelector("#btnLuuSV")
        .addEventListener("click", function () {
          var ten = formDivSinhVat.querySelector("#inpTenSV").value.trim();
          var phanLoai =
            formDivSinhVat.querySelector("#inpPhanLoai").value.trim() ||
            "Chưa xác định";
          var nhom =
            formDivSinhVat.querySelector("#inpNhom").value.trim() ||
            "Chưa xác định";
          var viTri =
            formDivSinhVat.querySelector("#inpViTri").value.trim() ||
            "Chưa xác định";
          var nguyCap = formDivSinhVat.querySelector("#inpNguyCap").value;

          if (!ten) {
            showToast("Kiếp nạn! Tên sinh vật không được để trống!");
            return;
          }

          insertFeatureToGeoServer(tenLayerWFS, "Point", toaDo, {
            ten_loai: ten,
            phan_loai: phanLoai,
            nhom: nhom,
            vi_tri_phan_bo: viTri,
            muc_do_nguy_cap: nguyCap,
          });

          AppGIS.map.closePopup();
        });
    }
  } else if (type === "polygon") {
    if (taiNguyenDangChon === "Tài nguyên Rừng") {
      var latlngs = layer.getLatLngs()[0];
      var chuoiToaDo = "";
      for (var i = 0; i < latlngs.length; i++) {
        chuoiToaDo += latlngs[i].lng + "," + latlngs[i].lat + " ";
      }
      chuoiToaDo += latlngs[0].lng + "," + latlngs[0].lat;

      var formDivRung = document.createElement("div");
      formDivRung.className = "wfs-form-container";
      formDivRung.innerHTML = `<h4 class="wfs-form-header rung">THÊM TÀI NGUYÊN RỪNG</h4>
        <div class="wfs-form-group"><label>Tên rừng:</label><input type="text" id="inpTenRung" class="wfs-input" placeholder="Nhập tên rừng..."></div>
        <div class="wfs-form-group"><input type="hidden" id="inpNhomRung" class="wfs-input" value="rừng">
        <div class="wfs-form-group"><label>Loại rừng:</label>
          <select id="inpLoaiRung" class="wfs-input">
  ${renderOptionList(FORM_OPTIONS.loaiRung, "Rừng phòng hộ")}
</select>

        </div>
        <div class="wfs-form-group"><label>Tình trạng:</label>
          <select id="inpTinhTrangRung" class="wfs-input">
  ${renderOptionList(FORM_OPTIONS.tinhTrangRung, "Đang cháy")}
</select>

        </div>
                <div class="wfs-button-group">
          <button id="btnHuyRung" class="wfs-btn wfs-btn-cancel">Hủy</button>
          <button id="btnLuuRung" class="wfs-btn wfs-btn-save bg-rung">Lưu rừng</button>
        </div>
      `;

      layer.bindPopup(formDivRung).openPopup();

      formDivRung
        .querySelector("#btnHuyRung")
        .addEventListener("click", function () {
          AppGIS.map.closePopup();
          drawnItems.removeLayer(layer);
        });

      formDivRung
        .querySelector("#btnLuuRung")
        .addEventListener("click", function () {
          var ten = formDivRung.querySelector("#inpTenRung").value.trim();
          var nhom = formDivRung.querySelector("#inpNhomRung").value.trim();
          var loai = formDivRung.querySelector("#inpLoaiRung").value;
          var tinhTrang = formDivRung.querySelector("#inpTinhTrangRung").value;

          if (!ten) {
            showToast("Kiếp nạn! Tên rừng không được để trống!");
            return;
          }
          if (!nhom) nhom = "Chưa xác định";

          insertFeatureToGeoServer("rung", "Polygon", chuoiToaDo, {
            ten: ten,
            nhom: nhom,
            loai_rung: loai,
            tinh_trang: tinhTrang,
            nguon_du_lieu: "WebGIS An Giang",
          });
          AppGIS.map.closePopup();
        });
    } else if (taiNguyenDangChon === "Tài nguyên Đất") {
      var latlngs = layer.getLatLngs()[0];
      var chuoiToaDo = "";
      for (var i = 0; i < latlngs.length; i++) {
        chuoiToaDo += latlngs[i].lng + "," + latlngs[i].lat + " ";
      }
      chuoiToaDo += latlngs[0].lng + "," + latlngs[0].lat;

      var formDivDat = document.createElement("div");
      formDivDat.className = "wfs-form-container";
      formDivDat.innerHTML = `
         <h4 class="wfs-form-header text-dat">THÊM TÀI NGUYÊN ĐẤT</h4>
        <div class="wfs-form-group"><label>Tên đất / Chủ sử dụng:</label><input type="text" id="TenDat" class="wfs-input" placeholder="Nhập tên đất..."></div>
        <div class="wfs-form-group"><label>Loại đất sử dụng:</label>
          <select id="loadatsudung" class="wfs-input">
  ${renderOptionList(FORM_OPTIONS.loaiDatSuDung, "Đất chuyên trồng lúa nước")}
</select>

        </div>
        <div class="wfs-form-group"><label>Nhóm sử dụng:</label>
          <select id="nhomsudung" class="wfs-input">
  ${renderOptionList(FORM_OPTIONS.nhomSuDungDat, "Đất nông nghiệp")}
</select>

        </div>
        <div class="wfs-button-group">
          <button id="btnHuyDat" class="wfs-btn wfs-btn-cancel">Hủy</button>
          <button id="btnLuuDat" class="wfs-btn wfs-btn-save bg-dat">Lưu đất</button>
        </div>
      `;

      layer.bindPopup(formDivDat).openPopup();

      formDivDat
        .querySelector("#btnHuyDat")
        .addEventListener("click", function () {
          AppGIS.map.closePopup();
          drawnItems.removeLayer(layer);
        });

      formDivDat
        .querySelector("#btnLuuDat")
        .addEventListener("click", function () {
          var ten = formDivDat.querySelector("#TenDat").value;
          var loai = formDivDat.querySelector("#loadatsudung").value;
          var nhomsudung = formDivDat.querySelector("#nhomsudung").value;

          if (!ten) {
            showToast("Kiếp nạn! Tên đất không được để trống!");
            return;
          }

          insertFeatureToGeoServer("dat", "Polygon", chuoiToaDo, {
            ten: ten,
            loai_dat_su_dung: loai,
            nhom_su_dung: nhomsudung,
            nguon_du_lieu: "WebGIS An Giang",
          });
          AppGIS.map.closePopup();
        });
    }
  } else if (type === "polyline") {
    if (taiNguyenDangChon === "Tài nguyên Nước") {
      var latlngs = layer.getLatLngs();
      var chuoiToaDo = "";
      for (var i = 0; i < latlngs.length; i++) {
        chuoiToaDo += latlngs[i].lng + "," + latlngs[i].lat + " ";
      }
      chuoiToaDo = chuoiToaDo.trim();

      var formDivNuoc = document.createElement("div");
      formDivNuoc.className = "wfs-form-container";
      formDivNuoc.innerHTML = `
         <h4 class="wfs-form-header text-nuoc">THÊM TÀI NGUYÊN NƯỚC</h4>
        <div class="wfs-form-group"><label>Tên sông/kênh:</label><input type="text" id="inpTenNuoc" class="wfs-input" placeholder="Nhập tên..."></div>
        <div class="wfs-form-group"><label>Loại:</label>
          <select id="inpLoaiNuoc" class="wfs-input">
  ${renderOptionList(FORM_OPTIONS.loaiNuoc, "kênh")}
</select>

        </div>
        <div class="wfs-form-group"><label>Cấp:</label>
          <select id="inpCapNuoc" class="wfs-input">
  ${renderOptionList(FORM_OPTIONS.capNuoc, "chính")}
</select>

        </div>
        <div class="wfs-button-group">
          <button id="btnHuyNuoc" class="wfs-btn wfs-btn-cancel">Hủy</button>
          <button id="btnLuuNuoc" class="wfs-btn wfs-btn-save bg-nuoc">Lưu nước</button>
        </div>
      `;

      layer.bindPopup(formDivNuoc).openPopup();

      formDivNuoc
        .querySelector("#btnHuyNuoc")
        .addEventListener("click", function () {
          AppGIS.map.closePopup();
          drawnItems.removeLayer(layer);
        });

      formDivNuoc
        .querySelector("#btnLuuNuoc")
        .addEventListener("click", function () {
          var ten = formDivNuoc.querySelector("#inpTenNuoc").value.trim();
          var loai = formDivNuoc.querySelector("#inpLoaiNuoc").value;
          var cap = formDivNuoc.querySelector("#inpCapNuoc").value;

          if (!ten) {
            showToast("Kiếp nạn! Tên sông/kênh không được để trống!");
            return;
          }

          insertFeatureToGeoServer("waterways", "LineString", chuoiToaDo, {
            ten: ten,
            loai: loai,
            cap: cap,
            nguon: "WebGIS An Giang",
          });
          AppGIS.map.closePopup();
        });
    }
  }
});
