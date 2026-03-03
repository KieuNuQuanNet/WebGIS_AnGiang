// Tích hợp từ điển vào trang báo cáo để dịch cột chuẩn xác
const TU_DIEN_COT = {
  ten: "Tên tài nguyên",
  ten_don_vi: "Tên mỏ / Đơn vị",
  ten_loai: "Tên loài sinh vật",
  nhom: "Nhóm",
  loai: "Loại",
  loai_rung: "Loại rừng",
  loai_khoang_san: "Loại khoáng sản",
  loai_dat_su_dung: "Loại đất",
  nhom_su_dung: "Nhóm sử dụng",
  tinh_trang: "Tình trạng",
  dien_tich: "Diện tích",
  dien_tich_ha: "Diện tích (Hecta)",
  dien_tich_m2: "Diện tích (m2)",
  tru_luong: "Trữ lượng",
  dia_chi: "Địa chỉ",
  doi_tuong_bao_ve: "Đối tượng bảo vệ",
  cap: "Cấp",
  phan_loai: "Phân loại",
  vi_tri_phan_bo: "Vị trí phân bố",
  muc_do_nguy_cap: "Mức độ nguy cấp",
  nguon_du_lieu: "Nguồn dữ liệu",
  nguon: "Nguồn tham khảo",
};

let reportData = null;

window.onload = function () {
  // Lấy dữ liệu từ sessionStorage do trang Bản đồ gửi sang
  const raw = sessionStorage.getItem("webgis_report_data");
  if (!raw) {
    alert(
      "Không tìm thấy dữ liệu! Vui lòng thực hiện thống kê ở trang bản đồ trước.",
    );
    window.close();
    return;
  }

  // Dùng setTimeout để giao diện Loading hiện lên trước khi JavaScript "đóng băng" trình duyệt để vẽ bảng lớn
  setTimeout(() => {
    reportData = JSON.parse(raw);
    renderReport(reportData);
  }, 100);
};

function renderReport(data) {
  document.getElementById("txtTenLop").innerText = data.layerName;
  document.getElementById("txtNgayLap").innerText = "Ngày lập: " + data.date;
  document.getElementById("txtTongSo").innerText =
    data.features.length + " đối tượng";

  const thead = document.getElementById("theadReport");
  const tbody = document.getElementById("tbodyReport");

  if (data.features.length === 0) return;

  // 1. Tạo tiêu đề cột
  const firstProps = data.features[0].properties;
  const keys = Object.keys(firstProps).filter(
    (k) => !["bbox", "geom", "id"].includes(k),
  );

  let headRow = "<tr><th>STT</th>";
  keys.forEach((k) => {
    const tenTiengViet = TU_DIEN_COT[k] || k;
    headRow += `<th>${tenTiengViet}</th>`;
  });
  thead.innerHTML = headRow + "</tr>";

  // 2. Đổ dữ liệu (Gom thành 1 chuỗi HTML lớn để Render cực nhanh)
  let bodyHtml = "";
  data.features.forEach((f, index) => {
    let rowHtml = `<tr><td style="text-align:center;">${index + 1}</td>`;
    keys.forEach((k) => {
      const value =
        f.properties[k] !== null && f.properties[k] !== ""
          ? f.properties[k]
          : "-";
      rowHtml += `<td>${value}</td>`;
    });
    bodyHtml += rowHtml + "</tr>";
  });
  tbody.innerHTML = bodyHtml;

  // Tắt màn hình chờ
  document.getElementById("loading-overlay").style.display = "none";
}

// Lệnh In
document.getElementById("btnExportPDF").onclick = () => window.print();

// Lệnh xuất Excel bằng SheetJS
document.getElementById("btnExportExcel").onclick = () => {
  if (!reportData) return;

  const excelRows = reportData.features.map((f, i) => {
    let row = { STT: i + 1 };
    for (let k in f.properties) {
      if (!["bbox", "geom", "id"].includes(k)) {
        const headerName = TU_DIEN_COT[k] || k;
        row[headerName] = f.properties[k];
      }
    }
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(excelRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Báo Cáo GIS");

  const fileName = `Bao_Cao_${reportData.layerName.replace(/\s+/g, "_")}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};
