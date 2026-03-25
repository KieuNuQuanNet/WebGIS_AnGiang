<<<<<<< HEAD
// kết quả và panel truy vấn
AppGIS.resultLayer = new L.FeatureGroup().addTo(AppGIS.map);

=======
// =========================================================
// 7. LOGIC TRUY VẤN NÂNG CAO (GIAO TIẾP VỚI GEOSERVER)
// =========================================================
AppGIS.resultLayer = new L.FeatureGroup().addTo(AppGIS.map);

// 1. Quản lý bảng Truy vấn
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
const bangTruyVan = document.getElementById("bangTruyVan");
const btnDongTruyVan = document.getElementById("btnDongTruyVan");

if (window.L && bangTruyVan) {
  L.DomEvent.disableClickPropagation(bangTruyVan);
  L.DomEvent.disableScrollPropagation(bangTruyVan);
}

btnDongTruyVan.addEventListener("click", () => {
  bangTruyVan.classList.add("hidden");

<<<<<<< HEAD
=======
  // 2. QUAN TRỌNG: Quét sạch các vùng/điểm kết quả trên bản đồ
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
  AppGIS.resultLayer.clearLayers();

  const lstKetQua = document.getElementById("lstKetQua");
  if (lstKetQua) {
    lstKetQua.innerHTML = `
      <div class='empty-result'>Chưa có dữ liệu. Vui lòng thực hiện truy vấn!</div>
    `;
  }

  const txtCount = document.getElementById("txtCount");
  if (txtCount) {
    txtCount.innerText = "0";
  }

  const tabBtns = bangTruyVan.querySelectorAll(".tab-btn");
  if (tabBtns.length > 0) {
    tabBtns[0].click();
  }
});

const tabBtns = bangTruyVan.querySelectorAll(".tab-btn");
const tabContents = bangTruyVan.querySelectorAll(".tab-content");

tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabBtns.forEach((b) => b.classList.remove("active"));
    tabContents.forEach((c) => c.classList.remove("active"));

    btn.classList.add("active");
    const targetId = btn.getAttribute("data-target");
    const targetContent = bangTruyVan.querySelector("#" + targetId);
    if (targetContent) {
      targetContent.classList.add("active");
    }
  });
});

// lọc theo lớp
const CAU_HINH_LOC_DONG = {
  "angiang:khoangsan_diem_mo": {
    tieuDe: "LỌC THEO TÌNH TRẠNG",
    cotDB: "tinh_trang",
    danhSach: [
      "Đang khai thác",
      "Chưa khai thác",
      "Tạm dừng khai thác",
      "Đóng cửa mỏ",
    ],
  },
  "angiang:rung": {
    tieuDe: "LỌC THEO TÌNH TRẠNG",
    cotDB: "tinh_trang",
    danhSach: [
      "Ổn định - Bảo vệ",
      "Cảnh báo cháy",
      "Đang cháy",
      "Bị suy thoái",
      "Đang tái sinh",
    ],
  },
  "angiang:dongvat": {
    tieuDe: "MỨC ĐỘ NGUY CẤP",
    cotDB: "muc_do_nguy_cap",
    danhSach: [
      "Ít quan tâm (LC)",
      "Sắp nguy cấp (VU)",
      "Nguy cấp (EN)",
      "Cực kỳ nguy cấp (CR)",
    ],
  },
  "angiang:thucvat": {
    tieuDe: "MỨC ĐỘ NGUY CẤP",
    cotDB: "muc_do_nguy_cap",
    danhSach: [
      "Ít quan tâm (LC)",
      "Sắp nguy cấp (VU)",
      "Nguy cấp (EN)",
      "Cực kỳ nguy cấp (CR)",
    ],
  },
  "angiang:dat": {
    tieuDe: "NHÓM SỬ DỤNG ĐẤT",
    cotDB: "nhom_su_dung",
    danhSach: ["Đất nông nghiệp", "Đất phi nông nghiệp", "Đất chưa sử dụng"],
  },
  "angiang:waterways": {
    tieuDe: "CẤP ĐỘ SÔNG/KÊNH",
    cotDB: "cap",
    danhSach: ["chính", "nhánh"],
  },
};

const cboLopDuLieu = document.getElementById("cboLopDuLieu");
const cboTinhTrang = document.getElementById("cboTinhTrang");
const khungLocTinhTrang = document.getElementById("khungLocTinhTrang");
const lblTinhTrang = document.getElementById("lblTinhTrang");

// hỗ trợ lọc theo lớp
function capNhatOChonTinhTrang() {
  let lopDangChon = cboLopDuLieu.value;
  let cauHinh = CAU_HINH_LOC_DONG[lopDangChon];
  cboTinhTrang.innerHTML = '<option value="all">-- Tất cả --</option>';

  if (cauHinh) {
    khungLocTinhTrang.classList.remove("hidden");
    lblTinhTrang.innerText = cauHinh.tieuDe;
    cauHinh.danhSach.forEach((tt) => {
      let opt = document.createElement("option");
      opt.value = tt;
      opt.innerText = tt;
      cboTinhTrang.appendChild(opt);
    });
  } else {
    khungLocTinhTrang.classList.add("hidden");
  }
}
cboLopDuLieu.addEventListener("change", capNhatOChonTinhTrang);
<<<<<<< HEAD
capNhatOChonTinhTrang();
=======
capNhatOChonTinhTrang(); // Chạy lần đầu

// --- LỆNH TRUY VẤN LÊN MÁY CHỦ ---
// --- LỆNH TRUY VẤN LÊN MÁY CHỦ (DÒNG 144) ---
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
const btnApDung = document.getElementById("btnApDung");

// lọc và gọi wfs
btnApDung?.addEventListener("click", (e) => {
  if (window.L) L.DomEvent.stop(e);
  else {
    e.preventDefault?.();
    e.stopPropagation?.();
  }

  const chonLop = cboLopDuLieu.value;
  const chonTinhTrang = cboTinhTrang.value;
  const tuKhoaRaw = document.getElementById("txtTuKhoa").value.trim();
  const tuKhoa = tuKhoaRaw.replace(/'/g, "''");

<<<<<<< HEAD
  let cqlArray = [];
=======
  let cqlArray = [CQL_CONG_BO];
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
  const cauHinhDong = CAU_HINH_LOC_DONG[chonLop];

  if (chonTinhTrang !== "all" && cauHinhDong) {
    cqlArray.push(`${cauHinhDong.cotDB} = '${chonTinhTrang}'`);
  }

  if (tuKhoa !== "") {
    let col = "ten";
    if (chonLop === "angiang:khoangsan_diem_mo") col = "ten_don_vi";
    else if (chonLop === "angiang:dongvat" || chonLop === "angiang:thucvat")
      col = "ten_loai";

<<<<<<< HEAD
    cqlArray.push(`strToLowerCase(${col}) LIKE '%${tuKhoa.toLowerCase()}%'`);
  }

  const cqlString =
    cqlArray.length > 0
      ? `&cql_filter=${encodeURIComponent(cqlArray.join(" AND "))}`
      : "";

  const API_BASE = window.WEBGIS_API_BASE || "";
=======
    // Dùng LIKE + strToLowerCase để an toàn tuyệt đối, không lo lỗi mạng
    cqlArray.push(`strToLowerCase(${col}) LIKE '%${tuKhoa.toLowerCase()}%'`);
  }

  const cqlString = `&CQL_FILTER=${encodeURIComponent(cqlArray.join(" AND "))}`;

  // CHUYỂN VỀ VERSION 1.0.0 ĐỂ ĐỒNG BỘ VỚI TÌM KIẾM
  const urlWFSQuery =
    `/myproxy/angiang/ows?service=WFS&version=1.0.0&request=GetFeature` +
    `&typeName=${chonLop}&outputFormat=application/json${cqlString}`;
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091

  const urlWFSQuery =
    `${API_BASE}/api/wfs?typeName=${encodeURIComponent(chonLop)}` +
    `&maxFeatures=500${cqlString}`;

  btnApDung.innerHTML = "ĐANG LẤY DỮ LIỆU...";

  fetch(urlWFSQuery)
    .then((res) => res.text())
    .then((text) => {
      btnApDung.innerHTML = "ÁP DỤNG LỌC DỮ LIỆU";
      if (text.startsWith("<") || text.includes("Exception")) {
        showToast(
          "Lớp dữ liệu này tạm thời không hỗ trợ truy vấn nhanh!",
          "error",
        );
        return;
      }
      const data = JSON.parse(text);
      HienThiKetQuaTruyVan(data.features, chonLop);
      bangTruyVan?.querySelector('.tab-btn[data-target="tabKetQua"]')?.click();
    })
    .catch((err) => {
      console.error(err);
      btnApDung.innerHTML = "ÁP DỤNG LỌC DỮ LIỆU";
      showToast("Lỗi kết nối máy chủ bản đồ!");
    });
});

<<<<<<< HEAD
// hiển thị kết quả và danh sách
=======
// --- VẼ UI KẾT QUẢ VÀ XỬ LÝ CLICK (GIỐNG HỆT TÌM KIẾM) ---
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
function HienThiKetQuaTruyVan(features, lop) {
  const lstKetQua = document.getElementById("lstKetQua");
  document.getElementById("txtCount").innerText = features
    ? features.length
    : 0;
  lstKetQua.innerHTML = "";
  AppGIS.resultLayer.clearLayers();

  if (!features || features.length === 0) {
    lstKetQua.innerHTML =
      "<div class='empty-result'>Không tìm thấy dữ liệu!</div>";
    return;
  }

  let nhanLop = "Tài nguyên";
  if (lop.includes("khoangsan")) {
    nhanLop = "Khoáng sản";
  } else if (lop.includes("rung")) {
    nhanLop = "Rừng";
  } else if (lop.includes("dongvat")) {
    nhanLop = "Động vật";
  } else if (lop.includes("dat")) {
    nhanLop = "Đất";
  } else if (lop.includes("waterways")) {
    nhanLop = "Nước";
  } else if (lop.includes("thucvat")) {
    nhanLop = "Thực vật";
  }

  features.forEach((f) => {
    let props = f.properties;
    let ten =
      props.ten || props.ten_don_vi || props.ten_loai || "Không xác định";

    let div = document.createElement("div");
    div.className = "result-item";
    div.innerHTML = `
<<<<<<< HEAD
     <div class="res-item-container">
         <div class="res-info-body">
             <h4 class="res-title">${ten}</h4>
             <span class="res-badge">${nhanLop}</span>
         </div>
     </div>
`;
=======
         <div class="res-item-container">
             <div class="res-icon-box">${icon}</div>
             <div class="res-info-body">
                 <h4 class="res-title">${ten}</h4>
                <span class="res-badge">${nhanLop}</span>
            </div>
        </div>
    `;
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091

    let geojsonLayer = L.geoJSON(f);
    AppGIS.resultLayer.addLayer(geojsonLayer);

    // CLICK VÀO KẾT QUẢ: GIỐNG HỆT TÌM KIẾM
    div.addEventListener("click", () => {
      const bounds = geojsonLayer.getBounds();
      const tamDiem = bounds.getCenter();
      const meta = damBaoLopWmsDangBat(lop);
      const tieuDe = meta?.tieuDe || nhanLop || "Tài nguyên";

      AppGIS.map.flyToBounds(bounds, { padding: [50, 50], duration: 1.2 });

      const block = taoPopupThongTin(f, tieuDe, lop, meta?.layerObj);
      L.popup().setLatLng(tamDiem).setContent(block).openOn(AppGIS.map);
    });

    lstKetQua.appendChild(div);
  });

<<<<<<< HEAD
=======
  // Tự động thu phóng để thấy toàn bộ danh sách kết quả (Dòng 314 cũ)
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
  if (AppGIS.resultLayer.getLayers().length > 0) {
    AppGIS.map.flyToBounds(AppGIS.resultLayer.getBounds(), {
      padding: [50, 50],
      duration: 1.2,
    });
  }
}

// giao diện
let chartHienTai = null;
let currentReportFeatures = [];
let currentReportLayerName = "";
const btnThongKe = document.getElementById("btnThongKe");
const danhSachThongKe = document.getElementById("danhSachThongKe");
const panelThongKe = document.getElementById("panelThongKe");
const btnDongThongKe = document.getElementById("btnDongThongKe");

const uiBtnThem = document.getElementById("btnThemTaiNguyen");
const uiPanelThem = document.getElementById("danhSachTaiNguyen");

const uiBtnTruyVan = document.getElementById("btnMoTruyVan");
const uiPanelTruyVan = document.getElementById("bangTruyVan");

const uiBtnThongKe = document.getElementById("btnThongKe");
const uiListThongKe = document.getElementById("danhSachThongKe");
const uiDashThongKe = document.getElementById("panelThongKe");

const uiBtnDoDat = document.getElementById("btnDoDat");
const uiPanelDoDat = document.getElementById("danhSachDoDat");

// đóng mở menu
function tatTatCaMenuTru(menuGiuLai) {
  if (menuGiuLai !== "Them") uiPanelThem?.classList.add("hidden");
  if (menuGiuLai !== "TruyVan") uiPanelTruyVan?.classList.add("hidden");
  if (menuGiuLai !== "ThongKe") {
    uiListThongKe?.classList.add("hidden");
    uiDashThongKe?.classList.add("hidden");
  }
  if (menuGiuLai !== "DoDat") uiPanelDoDat?.classList.add("hidden");
}

uiBtnThem?.addEventListener("click", () => {
  if (!hasPerm("feature.insert")) {
<<<<<<< HEAD
    showToast("Bạn không có quyền Thêm dữ liệu.");
=======
    showToast("🔒 Bạn không có quyền Thêm dữ liệu.");
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
    return;
  }

  const dangAn = uiPanelThem.classList.contains("hidden");
  tatTatCaMenuTru("Them");
  if (dangAn) uiPanelThem.classList.remove("hidden");
  else uiPanelThem.classList.add("hidden");
});

uiBtnTruyVan?.addEventListener("click", () => {
  const dangAn = uiPanelTruyVan.classList.contains("hidden");
  tatTatCaMenuTru("TruyVan");
  if (dangAn) uiPanelTruyVan.classList.remove("hidden");
  else uiPanelTruyVan.classList.add("hidden");
});

uiBtnThongKe?.addEventListener("click", () => {
  if (!hasPerm("stats.view")) {
<<<<<<< HEAD
    showToast("Bạn không có quyền xem Thống kê.");
=======
    showToast("🔒 Bạn không có quyền xem Thống kê.");
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
    return;
  }

  const dangAn = uiListThongKe.classList.contains("hidden");
  tatTatCaMenuTru("ThongKe");
  if (dangAn) uiListThongKe.classList.remove("hidden");
  else uiListThongKe.classList.add("hidden");
});

uiBtnDoDat?.addEventListener("click", () => {
  if (!hasPerm("feature.insert") && !hasPerm("admin.users")) {
<<<<<<< HEAD
    showToast("Chức năng đo đạc chỉ dành cho cán bộ và admin.");
=======
    showToast("🔒 Chức năng đo đạc chỉ dành cho cán bộ và admin.");
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
    return;
  }

  const dangAn = uiPanelDoDat.classList.contains("hidden");
  tatTatCaMenuTru("DoDat");
  if (dangAn) uiPanelDoDat.classList.remove("hidden");
  else uiPanelDoDat.classList.add("hidden");
});

btnDongThongKe.addEventListener("click", () => {
  panelThongKe.classList.add("hidden");
});

document.querySelectorAll(".stat-select-item").forEach((item) => {
  item.onclick = function () {
    const lopId = this.getAttribute("data-lop");
    const tenHienThi = this.getAttribute("data-ten");

    danhSachThongKe.classList.add("hidden");
    panelThongKe.classList.remove("hidden");

    thucThiThongKeLop(lopId, tenHienThi);
  };
});

// thống kê theo lớp
async function thucThiThongKeLop(lopId, tenLop) {
  document.getElementById("txtTenLopThongKe").innerText = "Thống kê: " + tenLop;
  const loader = document.getElementById("statLoader");
  const container = document.getElementById("statContainer");

  loader.classList.remove("hidden");
  container.classList.add("hidden");

  try {
    let keyPhanLoai = "";
    if (lopId.includes("khoangsan")) keyPhanLoai = "tinh_trang";
    else if (lopId.includes("rung")) keyPhanLoai = "loai_rung";
    else if (lopId.includes("dongvat") || lopId.includes("thucvat"))
      keyPhanLoai = "muc_do_nguy_cap";
    else if (lopId.includes("dat")) keyPhanLoai = "loai_dat_su_dung";
    else if (lopId.includes("waterways")) keyPhanLoai = "loai";

    const API_BASE = window.WEBGIS_API_BASE || "";

    const url =
      `${API_BASE}/api/wfs?typeName=${encodeURIComponent(lopId)}` +
      `&maxFeatures=2000`;

    const res = await fetch(url);
    if (!res.ok) throw new Error("Mất kết nối mạng");

    const data = await res.json();
    const features = data.features || [];
    let total = data.totalFeatures || features.length;

    currentReportFeatures = features;
    currentReportLayerName = tenLop;

    let dict = {};
    features.forEach((f) => {
      let val = f.properties[keyPhanLoai] || "Chưa xác định";
      dict[val] = (dict[val] || 0) + 1;
    });

    veBieuDo(Object.keys(dict), Object.values(dict));

    document.getElementById("statSummaryText").innerHTML = `
<<<<<<< HEAD
        <strong>Báo cáo tự động:</strong><br>
=======
        <strong>✅ Báo cáo tự động:</strong><br>
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
        Hệ thống đang lưu trữ tổng cộng <b class="text-red text-large">${total}</b> đối tượng thuộc lớp <b>${tenLop}</b>.<br><br>
        <i>Tiêu chí phân loại: ${keyPhanLoai.replace(/_/g, " ").toUpperCase()}.</i>
    `;

    loader.classList.add("hidden");
    container.classList.remove("hidden");
  } catch (err) {
    console.error("Lỗi thống kê:", err);
    loader.innerHTML =
<<<<<<< HEAD
      "<div class='text-red text-bold'>Lỗi lấy dữ liệu từ GeoServer! Vui lòng bật Live Server.</div>";
=======
      "<div class='text-red text-bold'>❌ Lỗi lấy dữ liệu từ GeoServer! Vui lòng bật Live Server.</div>";
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
  }
}

// biểu đồ thống kê
function veBieuDo(labels, data) {
  const ctx = document.getElementById("chartChinh").getContext("2d");

  if (chartHienTai) chartHienTai.destroy();

  const colors = [
    "#4caf50",
    "#2196f3",
    "#ff9800",
    "#f44336",
    "#9c27b0",
    "#795548",
    "#00bcd4",
  ];
  const chartColors = labels.map((_, index) => colors[index % colors.length]);

  chartHienTai = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [
        {
          data: data,
          backgroundColor: chartColors,
          borderWidth: 1,
          hoverOffset: 8,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            font: { size: 13 },
            generateLabels(chart) {
              const baseLabels =
                Chart.overrides.doughnut.plugins.legend.labels.generateLabels(
                  chart,
                );
              const values = chart.data.datasets[0]?.data || [];

              return baseLabels.map((item) => ({
                ...item,
                text: `${item.text} (${values[item.index]})`,
              }));
            },
          },
        },

        title: {
          display: true,
          text: "BIỂU ĐỒ PHÂN LOẠI CHI TIẾT",
          font: { size: 14 },
        },
      },
      cutout: "55%",
    },
  });
}

// mở và xuất báo cáo
document.getElementById("btnMoBaoCao").addEventListener("click", () => {
  if (currentReportFeatures.length === 0) {
    showToast("Chưa có dữ liệu để lập báo cáo!");
    return;
  }

  renderBaoCaoNoiTuyen({
    layerName: currentReportLayerName,
    features: currentReportFeatures,
    date: new Date().toLocaleDateString("vi-VN"),
    dictionary: TU_DIEN_COT,
  });

  document.getElementById("panelBaoCao")?.classList.remove("hidden");
});
document.getElementById("btnDongBaoCao")?.addEventListener("click", () => {
  document.getElementById("panelBaoCao")?.classList.add("hidden");
});

document.getElementById("btnExportPDFInline")?.addEventListener("click", () => {
  window.print();
});

document
  .getElementById("btnExportExcelInline")
  ?.addEventListener("click", () => {
    exportBaoCaoExcelNoiTuyen();
  });

// định dạng nội dung
function dichTrangThaiBaoCao(val) {
  const map = {
    nhap: "Bản nháp",
    cho_duyet: "Chờ duyệt",
    da_duyet: "Đã duyệt",
    cong_bo: "Công bố",
    cho_xoa: "Chờ xóa",
    da_xoa: "Đã xóa",
    tu_choi: "Từ chối",
  };
  return map[String(val || "").toLowerCase()] || val || "-";
}

function escBaoCao(val) {
  if (val === null || val === undefined) return "";
  return String(val)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// hiển thị và xuất báo cáo
function renderBaoCaoNoiTuyen(data) {
  const dict = data.dictionary || {};
  const features = Array.isArray(data.features) ? data.features : [];

  document.getElementById("txtTieuDeBaoCao").innerText =
    "Báo cáo chi tiết: " + (data.layerName || "Không rõ");
  document.getElementById("txtNgayLapBaoCao").innerText =
    "Ngày lập: " + (data.date || new Date().toLocaleDateString("vi-VN"));
  document.getElementById("txtBaoCaoTenLop").innerText =
    data.layerName || "Không rõ";
  document.getElementById("txtBaoCaoTongSo").innerText = features.length;

  const thead = document.getElementById("theadReportInline");
  const tbody = document.getElementById("tbodyReportInline");

  if (!features.length) {
    thead.innerHTML = "";
    tbody.innerHTML = "<tr><td>Không có dữ liệu</td></tr>";
    return;
  }

  const firstProps = features[0].properties || {};
  const keys = Object.keys(firstProps).filter((k) => {
    const ignored = [
      "bbox",
      "geom",
      "id",
      "fid",
      "objectid",
      "gid",
      "image_url",
      "ngay_tao",
      "nguoi_tao",
      "ngay_cap_nhat",
      "nguoi_cap_nhat",
      "ngay_phe_duyet",
      "nguoi_phe_duyet",
      "ngay_cong_bo",
      "nguoi_cong_bo",
      "ly_do",
    ];
    return !ignored.includes(k);
  });

  thead.innerHTML =
    "<tr><th>STT</th>" +
    keys.map((k) => `<th>${escBaoCao(dict[k] || k)}</th>`).join("") +
    "</tr>";

  tbody.innerHTML = features
    .map((feature, i) => {
      const props = feature.properties || {};
      const tds = keys
        .map((key) => {
          let val = props[key];
          if (key === "trang_thai_du_lieu") val = dichTrangThaiBaoCao(val);
          if (
            key.toLowerCase().includes("ngay") &&
            val &&
            !isNaN(Date.parse(val))
          ) {
            val = new Date(val).toLocaleDateString("vi-VN");
          }
          return `<td>${escBaoCao(val || "-")}</td>`;
        })
        .join("");

      return `<tr><td>${i + 1}</td>${tds}</tr>`;
    })
    .join("");
}

function exportBaoCaoExcelNoiTuyen() {
  if (!currentReportFeatures || !currentReportFeatures.length) return;

  const rows = currentReportFeatures.map((feature, i) => {
    const row = { STT: i + 1 };
    const props = feature.properties || {};

    Object.keys(props).forEach((k) => {
      const ignored = ["bbox", "geom", "id", "fid", "objectid", "gid"];
      if (ignored.includes(k)) return;
      row[TU_DIEN_COT[k] || k] =
        k === "trang_thai_du_lieu" ? dichTrangThaiBaoCao(props[k]) : props[k];
    });

    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Bao cao");
  XLSX.writeFile(
    wb,
    `Bao_Cao_${(currentReportLayerName || "GIS").replace(/\s+/g, "_")}.xlsx`,
  );
}

// chọn công cụ và xóa kết quả
document.querySelectorAll(".measure-item").forEach((el) => {
  el.addEventListener("click", function () {
    if (!hasPerm("feature.insert") && !hasPerm("admin.users")) {
<<<<<<< HEAD
      showToast("Chức năng đo đạc chỉ dành cho cán bộ và admin.");
=======
      showToast("🔒 Chức năng đo đạc chỉ dành cho cán bộ và admin.");
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
      return;
    }

    kieuDoDat = this.getAttribute("data-type");
    cheDoVe = "measure";
    taiNguyenDangChon = "";
    document.getElementById("danhSachDoDat")?.classList.add("hidden");

    if (kieuDoDat === "distance") {
      new L.Draw.Polyline(AppGIS.map).enable();
<<<<<<< HEAD
      showToast("Chọn các điểm để đo khoảng cách (double click để kết thúc).");
    } else {
      new L.Draw.Polygon(AppGIS.map).enable();
      showToast("Vẽ vùng để đo diện tích (double click để kết thúc).");
=======
      showToast(
        "📏 Chọn các điểm để đo khoảng cách (double click để kết thúc).",
      );
    } else {
      new L.Draw.Polygon(AppGIS.map).enable();
      showToast("📐 Vẽ vùng để đo diện tích (double click để kết thúc).");
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
    }
  });
});

document.getElementById("btnClearMeasure")?.addEventListener("click", () => {
  if (!hasPerm("feature.insert") && !hasPerm("admin.users")) {
<<<<<<< HEAD
    showToast("Chức năng đo đạc chỉ dành cho cán bộ và admin.");
=======
    showToast("🔒 Chức năng đo đạc chỉ dành cho cán bộ và admin.");
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
    return;
  }

  measureItems.clearLayers();
<<<<<<< HEAD
  cheDoVe = "";
  AppGIS.map.closePopup();
  document.getElementById("danhSachDoDat")?.classList.add("hidden");
});

// Menu và tìm kiếm trên điện thoại
=======
  AppGIS.map.closePopup();
  document.getElementById("danhSachDoDat")?.classList.add("hidden");
});
// ===============================
// MOBILE MENU (FIX): menu ☰ chạy được đủ chức năng
// - Thêm: hiện danh sách resource-item ngay trong menu
// - Thống kê: hiện danh sách stat-select-item
// - Đo đạc: hiện distance/area (measure-item)
// - Truy vấn: mở bangTruyVan
// - Layers: mở Leaflet layers
// ===============================
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
(function initMobileMenuFixed() {
  const btnOpen = document.getElementById("btnMobileMenu");

  const btnMobileSearch = document.getElementById("btnMobileSearch");
  const navbarSearchBox = document.querySelector(".navbar-search");

  btnMobileSearch?.addEventListener("click", (e) => {
    e.preventDefault();
    if (!navbarSearchBox) return;
    navbarSearchBox.classList.toggle("is-open");
    if (navbarSearchBox.classList.contains("is-open")) {
      document.getElementById("inpSearch")?.focus();
    }
  });

<<<<<<< HEAD
=======
  // Close search when tapping outside on mobile
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
  document.addEventListener("click", (e) => {
    if (!navbarSearchBox || !navbarSearchBox.classList.contains("is-open"))
      return;
    const t = e.target;
    if (t === btnMobileSearch) return;
    if (navbarSearchBox.contains(t)) return;
    navbarSearchBox.classList.remove("is-open");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") navbarSearchBox?.classList.remove("is-open");
  });
  const overlay = document.getElementById("mobileMenuOverlay");
  const panel = overlay?.querySelector(".mobile-menu-panel");
  const mainList = overlay?.querySelector(".mobile-menu-list");
  const btnClose = document.getElementById("btnMobileMenuClose");
  const menuUser = document.getElementById("mobileMenuUser");

  if (!btnOpen || !overlay || !panel || !mainList) return;

<<<<<<< HEAD
=======
  // tạo sub container nếu chưa có
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
  let sub = document.getElementById("mobileMenuSub");
  if (!sub) {
    sub = document.createElement("div");
    sub.id = "mobileMenuSub";
    sub.className = "mobile-menu-sub hidden";
    panel.appendChild(sub);
  }

  const authBtn = document.getElementById("mobileMenuAuth");
  const adminLink = document.getElementById("mobileMenuAdmin");

  function syncMenu() {
    const navUser = document.getElementById("navUser");
    const navAuth = document.getElementById("navAuth");
    const navAdmin = document.getElementById("navAdminUsers");

    const userText =
      navUser &&
      !navUser.classList.contains("hidden") &&
      navUser.textContent.trim()
        ? navUser.textContent.trim()
<<<<<<< HEAD
        : " Khách";
=======
        : "👤 Khách";
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
    if (menuUser) menuUser.textContent = userText;

    if (authBtn && navAuth) authBtn.textContent = navAuth.textContent;

    if (adminLink && navAdmin) {
      adminLink.style.display = navAdmin.classList.contains("hidden")
        ? "none"
        : "";
    }
  }
  function applyMobileMenuPermissions() {
    const mmAdminUsers =
      document.getElementById("mmAdminUsers") ||
      document.getElementById("mobileMenuAdmin");
<<<<<<< HEAD
    const mmHistory = document.getElementById("mmHistory");
    const mmLayerManage = document.getElementById("mmLayerManage");

    const adminCodes = ["admin", "quan_tri", "administrator"];
    const admin =
      Array.isArray(roles) &&
      roles
        .map((r) => (r || "").toLowerCase())
        .some((r) => adminCodes.includes(r));

    const approver = admin || hasPerm("feature.approve");

    setShow(mmAdminUsers, admin);
    setShow(mmHistory, approver);
    setShow(mmLayerManage, approver);
  }
  function openMenu() {
    syncMenu();
    applyMobileMenuPermissions();
=======
    const mmLayerManage = document.getElementById("mmLayerManage");
    const mmReport = document.getElementById("mmReport");

    // helper: show/hide
    const setShow = (el, ok) => {
      if (!el) return;
      if (ok) el.classList.remove("hidden");
      else el.classList.add("hidden");
    };

    // Quy ước quyền:
    // - Admin: roles includes "admin" OR perms includes "admin.users"
    const roles =
      typeof getRoles === "function"
        ? getRoles()
        : JSON.parse(localStorage.getItem("webgis_roles") || "[]") || [];
    const admin =
      Array.isArray(roles) &&
      roles.map((r) => (r || "").toLowerCase()).includes("admin"); // chỉ role admin mới coi là admin

    const staff =
      admin ||
      hasPerm("feature.insert") ||
      hasPerm("feature.update") ||
      hasPerm("feature.delete");

    // Bạn muốn cán bộ thấy gì?
    // Gợi ý:
    // - Quản lý tài khoản: CHỈ admin
    setShow(mmAdminUsers, admin);

    // - Quản lý lớp: thường chỉ admin (nếu muốn cán bộ thấy thì đổi staff)
    setShow(mmLayerManage, admin);

    // - Báo cáo: nếu có quyền riêng "report.view" thì cho, còn không admin mới thấy
    setShow(mmReport, admin || hasPerm("report.view"));
  }
  function openMenu() {
    syncMenu();
    applyMobileMenuPermissions(); // ✅ thêm dòng này
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    sub.classList.add("hidden");
    mainList.classList.remove("hidden");
  }

  function closeMenu() {
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
  }

  function showSubMenu(title, items) {
<<<<<<< HEAD
=======
    // items: [{label, onClick}]
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
    sub.innerHTML = `
      <div class="mobile-sub-head">
        <button class="mobile-sub-back" type="button" id="mobileSubBack">←</button>
        <div class="mobile-sub-title">${title}</div>
      </div>
    `;

    items.forEach((it, idx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mobile-menu-item";
      b.textContent = it.label;
      b.addEventListener("click", () => {
        closeMenu();
        it.onClick?.();
      });
      sub.appendChild(b);
    });

    sub.querySelector("#mobileSubBack")?.addEventListener("click", () => {
      sub.classList.add("hidden");
      mainList.classList.remove("hidden");
    });

    mainList.classList.add("hidden");
    sub.classList.remove("hidden");
  }

<<<<<<< HEAD
  function actionAdd() {
    if (!hasPerm("feature.insert") && !isAdmin()) {
      showToast("Bạn không có quyền thêm tài nguyên.");
=======
  // === Action handlers (KHÔNG phụ thuộc toolbar-container hiển thị) ===
  function actionAdd() {
    if (!hasPerm("feature.insert") && !isAdmin()) {
      showToast("🔒 Bạn không có quyền thêm tài nguyên.");
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
      return;
    }

    const els = Array.from(
      document.querySelectorAll("#danhSachLoaiTaiNguyen .resource-item"),
    );
    if (!els.length) {
      showToast(
        "Không tìm thấy danh sách loại tài nguyên (#danhSachLoaiTaiNguyen).",
      );
      console.log("DEBUG add: missing #danhSachLoaiTaiNguyen .resource-item");
      return;
    }
    console.log(
      "DEBUG add: resource items =",
      els.map((x) => x.textContent.trim()),
    );

    showSubMenu(
<<<<<<< HEAD
      "Thêm tài nguyên",
      els.map((el) => ({
        label: el.textContent.trim(),
        onClick: () => el.click(),
=======
      "➕ Thêm tài nguyên",
      els.map((el) => ({
        label: el.textContent.trim(),
        onClick: () => el.click(), // dùng handler có sẵn trong script.js
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
      })),
    );
  }

  function actionStats() {
    if (!hasPerm("stats.view") && !isAdmin()) {
<<<<<<< HEAD
      showToast("Bạn không có quyền xem thống kê.");
=======
      showToast("🔒 Bạn không có quyền xem thống kê.");
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
      return;
    }

    const els = Array.from(document.querySelectorAll(".stat-select-item"));
    if (!els.length) {
      showToast("Không tìm thấy danh sách thống kê (.stat-select-item).");
      return;
    }

    showSubMenu(
<<<<<<< HEAD
      "Thống kê",
      els.map((el) => ({
        label: el.textContent.trim(),
        onClick: () => el.click(),
=======
      "📊 Thống kê",
      els.map((el) => ({
        label: el.textContent.trim(),
        onClick: () => el.click(), // handler đã có: mở panelThongKe + gọi thống kê
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
      })),
    );
  }

  function actionMeasure() {
    if (!hasPerm("feature.insert") && !hasPerm("admin.users")) {
<<<<<<< HEAD
      showToast("Chức năng đo đạc chỉ dành cho cán bộ và admin.");
=======
      showToast("🔒 Chức năng đo đạc chỉ dành cho cán bộ và admin.");
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
      return;
    }

    const dist = document.querySelector('.measure-item[data-type="distance"]');
    const area = document.querySelector('.measure-item[data-type="area"]');

    if (!dist || !area) {
<<<<<<< HEAD
      showToast(" Không tìm thấy nút đo đạc (.measure-item distance/area).");
      return;
    }

    showSubMenu(" Đo đạc", [
      { label: " Đo khoảng cách", onClick: () => dist.click() },
      { label: " Đo diện tích", onClick: () => area.click() },
      {
        label: "Xóa kết quả đo",
=======
      showToast("❌ Không tìm thấy nút đo đạc (.measure-item distance/area).");
      return;
    }

    showSubMenu("📏 Đo đạc", [
      { label: "📏 Đo khoảng cách", onClick: () => dist.click() },
      { label: "📐 Đo diện tích", onClick: () => area.click() },
      {
        label: "🧹 Xóa kết quả đo",
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
        onClick: () => document.getElementById("btnClearMeasure")?.click(),
      },
    ]);
  }

  function actionQuery() {
    const panelQuery = document.getElementById("bangTruyVan");
    if (!panelQuery) return showToast("Không tìm thấy #bangTruyVan");
    panelQuery.classList.remove("hidden");
  }

  function actionLayers() {
    document.querySelector(".leaflet-control-layers-toggle")?.click();
  }

  function openMobileSearch() {
    const box = document.querySelector(".navbar-search");
    if (box) box.classList.add("is-open");
    document.getElementById("inpSearch")?.focus();
  }
  function closeMobileSearch() {
    document.querySelector(".navbar-search")?.classList.remove("is-open");
  }
  function actionSearch() {
    const box = document.querySelector(".navbar-search");
<<<<<<< HEAD
    box?.classList.add("is-open");
    document.getElementById("inpSearch")?.focus();
  }

=======
    box?.classList.add("is-open"); // ✅ bật UI search trên mobile
    document.getElementById("inpSearch")?.focus();
  }

  // ==== bind main menu buttons ====
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
  btnOpen.addEventListener("click", (e) => {
    e.preventDefault();
    openMenu();
  });
  btnClose?.addEventListener("click", (e) => {
    e.preventDefault();
    closeMenu();
  });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.classList.contains("hidden"))
      closeMenu();
  });

<<<<<<< HEAD
=======
  // buttons data-action (main view)
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
  mainList.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.getAttribute("data-action");
      if (!action) return;

      if (action === "add") return actionAdd();
      if (action === "stats") return actionStats();
      if (action === "measure") return actionMeasure();
      if (action === "query") {
        closeMenu();
        return actionQuery();
      }
      if (action === "layers") {
        closeMenu();
        return actionLayers();
      }
      if (action === "search") {
        closeMenu();
        return actionSearch();
      }

<<<<<<< HEAD
=======
      // fallback
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
      closeMenu();
    });
  });

<<<<<<< HEAD
=======
  // auth click (dùng navAuth logic có sẵn)
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
  authBtn?.addEventListener("click", () => {
    closeMenu();
    document.getElementById("navAuth")?.click();
  });

<<<<<<< HEAD
=======
  // link click -> đóng menu
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
  overlay.querySelectorAll("a.mobile-menu-link").forEach((a) => {
    a.addEventListener("click", () => closeMenu());
  });
})();
AppGIS.map.on("popupclose", function () {
  if (AppGIS.resultLayer) {
    AppGIS.resultLayer.clearLayers();
  }
});
