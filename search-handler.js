<<<<<<< HEAD
=======
// ==========================================
// PHẦN 6: TÌM KIẾM ĐA LUỒNG VÀ HIỂN THỊ FULL POPUP
// ==========================================
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
const inpSearch = document.getElementById("inpSearch");
const btnSearch = document.getElementById("btnSearch");
const searchResults = document.getElementById("searchResults");

<<<<<<< HEAD
// xử lý chuỗi
=======
// ✅ Helper: bỏ dấu + viết thường (để nhận "rung" = "rừng" khi tìm theo loại tài nguyên)
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
function boDauVaThuong(s = "") {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

<<<<<<< HEAD
=======
// ✅ Helper: chọn field hiển thị đẹp nhất cho từng lớp
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
function chonGiaTriDauTien(props, fields) {
  for (const f of fields) {
    const v = props?.[f];
    if (v !== null && v !== undefined && String(v).trim() !== "")
      return String(v);
  }
  return "";
}

<<<<<<< HEAD
// truy vấn và hiển thị kết quả
=======
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
function thucThiTimKiem() {
  const queryRaw = inpSearch.value.trim();
  if (!queryRaw) return;

  const queryNorm = boDauVaThuong(queryRaw);
<<<<<<< HEAD
  const queryNormEscaped = queryNorm.replace(/'/g, "''");

  const MAX_PER_LAYER = 10;
=======
  // Escape nháy đơn cho CQL (tránh lỗi khi người dùng gõ ký tự ')
  const qCql = queryRaw.replace(/'/g, "''");

  const MAX_PER_LAYER = 10; // tăng/giảm tuỳ dữ liệu

  // 1) Cấu hình: tìm theo thuộc tính + cho phép "tìm theo loại/lớp tài nguyên"
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
  const cacLopCanTim = [
    {
      typeKey: "dongvat",
      layer: "angiang:dongvat",
      cols: ["nhom", "ten_loai"],
      nameFields: ["ten_loai", "nhom", "phan_loai"],
      label: "Động vật",
      keywords: ["dong vat", "động vật", "animal"],
    },
    {
      typeKey: "thucvat",
      layer: "angiang:thucvat",
      cols: ["nhom", "ten_loai"],
      nameFields: ["ten_loai", "nhom", "phan_loai"],
      label: "Thực vật",
      keywords: ["thuc vat", "thực vật", "plant"],
    },
    {
      typeKey: "rung",
      layer: "angiang:rung",
      cols: ["ten", "loai_rung"],
      nameFields: ["ten", "loai_rung"],
      label: "Rừng",
      keywords: ["rung", "rừng", "forest"],
    },
    {
      typeKey: "dat",
      layer: "angiang:dat",
      cols: ["ten", "nhom_su_dung"],
      nameFields: ["ten", "nhom_su_dung", "loai_dat_su_dung"],
      label: "Đất",
      keywords: ["dat", "đất", "land"],
    },
    {
      typeKey: "nuoc",
      layer: "angiang:waterways",
      cols: ["ten", "loai"],
      nameFields: ["ten", "loai"],
      label: "Nước",
      keywords: ["nuoc", "nước", "song", "suoi", "river", "water"],
    },
    {
      typeKey: "khoangsan",
      layer: "angiang:khoangsan_diem_mo",
      cols: ["ten_don_vi", "loai_khoang_san"],
      nameFields: ["ten_don_vi", "loai_khoang_san"],
      label: "Khoáng sản",
      keywords: ["khoang san", "khoáng sản", "mo", "mỏ", "mine", "mineral"],
    },
  ];

<<<<<<< HEAD
=======
  // ✅ Nhận diện: người dùng đang tìm theo "lớp/loại tài nguyên" hay theo "thuộc tính"
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
  const isTypeMatch = (cfg) => {
    const labelNorm = boDauVaThuong(cfg.label);
    if (queryNorm === labelNorm) return true;
    if (queryNorm === boDauVaThuong(cfg.typeKey)) return true;
    if (
      Array.isArray(cfg.keywords) &&
      cfg.keywords.some((k) => boDauVaThuong(k) === queryNorm)
    )
      return true;
    return false;
  };

  const lopTheoLoai = cacLopCanTim.filter(isTypeMatch);
  const targets = lopTheoLoai.length ? lopTheoLoai : cacLopCanTim;

  searchResults.classList.remove("hidden");
<<<<<<< HEAD
  searchResults.innerHTML = "<div class='search-item'>Đang tìm kiếm...</div>";

  const promises = targets.map((cfg) => {
    const API_BASE = window.WEBGIS_API_BASE || "";

    const urlBase =
      `${API_BASE}/api/wfs?typeName=${encodeURIComponent(cfg.layer)}` +
      `&maxFeatures=${MAX_PER_LAYER}`;

    let url = urlBase;

    if (!lopTheoLoai.length) {
      const filter = cfg.cols
        .map((c) => `strToLowerCase(${c}) LIKE '%${queryNormEscaped}%'`)
        .join(" OR ");

      url += `&cql_filter=${encodeURIComponent(filter)}`;
=======
  searchResults.innerHTML =
    "<div class='search-item'>⏳ Đang tìm kiếm...</div>";

  const promises = targets.map((cfg) => {
    const urlBase =
      `/myproxy/angiang/ows?service=WFS&version=1.0.0&request=GetFeature` +
      `&typeName=${cfg.layer}&outputFormat=application/json&maxFeatures=${MAX_PER_LAYER}`;

    let url = urlBase;

    if (lopTheoLoai.length) {
      // Tìm theo loại tài nguyên (vd: gõ "rừng")
      url = urlBase + `&CQL_FILTER=${encodeURIComponent(CQL_CONG_BO)}`;
    } else {
      // Tìm theo tên/thuộc tính cụ thể
      // Sử dụng strToLowerCase và LIKE để tương thích tốt nhất với GeoServer
      const filter = cfg.cols
        .map((c) => `strToLowerCase(${c}) LIKE '%${queryNorm}%'`)
        .join(" OR ");
      const filterFull = `(${CQL_CONG_BO}) AND (${filter})`;
      url = urlBase + `&CQL_FILTER=${encodeURIComponent(filterFull)}`;
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
    }

    return fetch(url)
      .then((res) => res.json())
      .then((data) => {
        const feats = Array.isArray(data.features) ? data.features : [];
        return feats.map((f) => {
          const tenHienThi =
            chonGiaTriDauTien(f.properties, cfg.nameFields) || "Không xác định";
          return {
            ten: tenHienThi,
            loai: cfg.label,
            tieuDe: cfg.label,
            layerName: cfg.layer,
            feature: f,
          };
        });
      })
      .catch(() => []);
  });

  Promise.all(promises).then((mangKetQua) => {
    let tatCaKetQua = mangKetQua.flat();

<<<<<<< HEAD
=======
    // ✅ Lọc trùng (nếu có)
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
    const seen = new Set();
    tatCaKetQua = tatCaKetQua.filter((it) => {
      const fid = it.feature?.id ?? it.feature?.properties?.id ?? it.ten;
      const key = `${it.loai}|${fid}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

<<<<<<< HEAD
=======
    // ✅ Sắp xếp: item có tên chứa query đứng trước (khi tìm theo thuộc tính)
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
    if (!lopTheoLoai.length) {
      const qn = boDauVaThuong(queryRaw);
      tatCaKetQua.sort((a, b) => {
        const an = boDauVaThuong(a.ten);
        const bn = boDauVaThuong(b.ten);
        const as = an.includes(qn) ? 1 : 0;
        const bs = bn.includes(qn) ? 1 : 0;
        return bs - as;
      });
    }

    searchResults.innerHTML = "";

    if (tatCaKetQua.length === 0) {
      searchResults.innerHTML =
<<<<<<< HEAD
        "<div class='search-item text-red'>Không tìm thấy kết quả!</div>";
      return;
    }

=======
        "<div class='search-item text-red'>❌ Không tìm thấy kết quả!</div>";
      return;
    }

    // ✅ Render theo nhóm tài nguyên (nhìn đỡ “sai lệch”)
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
    const group = new Map();
    tatCaKetQua.forEach((it) => {
      if (!group.has(it.loai)) group.set(it.loai, []);
      group.get(it.loai).push(it);
    });

    group.forEach((items, loai) => {
      const header = document.createElement("div");
      header.className = "search-item search-header";
<<<<<<< HEAD
      header.innerHTML = `${loai} <small>(${items.length} kết quả)</small>`;
      searchResults.appendChild(header);

=======
      header.innerHTML = `📌 ${loai} <small>(${items.length} kết quả)</small>`;
      searchResults.appendChild(header);

      // Xác định Icon và Màu sắc cho từng loại (Xanh nước cho hiện đại)
      let icon = "📍";
      if (loai.includes("Khoáng sản")) icon = "⛏️";
      else if (loai.includes("Rừng")) icon = "🌳";
      else if (loai.includes("Động vật")) icon = "🐅";
      else if (loai.includes("Đất")) icon = "🟤";
      else if (loai.includes("Nước")) icon = "💧";
      else if (loai.includes("Thực vật")) icon = "🌿";

>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
      items.forEach((item) => {
        const div = document.createElement("div");
        div.className = "search-item";

<<<<<<< HEAD
        div.innerHTML = `
              <div class="res-item-container search-variant">
  <div class="res-info-body">
      <h4 class="res-title">${item.ten}</h4>
      <span class="res-badge">${item.loai}</span>
  </div>
</div>`;

        div.addEventListener("click", function () {
          AppGIS.resultLayer.clearLayers();

=======
        // Thêm class 'search-variant' để đổi màu trong CSS
        div.innerHTML = `
              <div class="res-item-container search-variant">
                  <div class="res-icon-box">${icon}</div>
                  <div class="res-info-body">
                      <h4 class="res-title">${item.ten}</h4>
                      <span class="res-badge">${item.loai}</span>
                  </div>
              </div>`;

        div.addEventListener("click", function () {
          // 1. Dọn sạch các "chấm xanh" cũ trên bản đồ
          AppGIS.resultLayer.clearLayers();

          // 2. Tạo "chấm xanh nước" (Highlight) cho đối tượng đang chọn
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
          const highlight = L.geoJSON(item.feature, {
            pointToLayer: (f, latlng) =>
              L.circleMarker(latlng, {
                radius: 10,
<<<<<<< HEAD
                fillColor: "#2196F3",
=======
                fillColor: "#2196F3", // Màu xanh nước biển
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
                color: "#fff",
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8,
              }),
            style: {
              color: "#2196F3",
              weight: 4,
              opacity: 0.8,
              fillOpacity: 0.3,
            },
          }).addTo(AppGIS.resultLayer);

          const bounds = highlight.getBounds();
          const tamDiem = bounds.getCenter();

<<<<<<< HEAD
=======
          // 3. Kích hoạt lớp và lấy tiêu đề
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
          const meta = damBaoLopWmsDangBat(item.layerName);
          const tieuDe =
            item.tieuDe || meta?.tieuDe || item.loai || "Tài nguyên";

<<<<<<< HEAD
          AppGIS.map.flyToBounds(bounds, { padding: [50, 50], duration: 1.2 });

=======
          // 4. Bay đến đối tượng (Fly)
          AppGIS.map.flyToBounds(bounds, { padding: [50, 50], duration: 1.2 });

          // 5. Hiện Popup ngay lập tức
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
          const block = taoPopupThongTin(
            item.feature,
            tieuDe,
            item.layerName,
            meta?.layerObj,
          );
          L.popup().setLatLng(tamDiem).setContent(block).openOn(AppGIS.map);

          searchResults.classList.add("hidden");
        });

        searchResults.appendChild(div);
      });
    });

<<<<<<< HEAD
    if (lopTheoLoai.length && tatCaKetQua.length >= MAX_PER_LAYER) {
      const tip = document.createElement("div");
      tip.className = "search-item search-tip";
      tip.innerHTML = `Đang hiển thị tối đa ${MAX_PER_LAYER} kết quả. Muốn “đủ hết” thì tăng MAX_PER_LAYER hoặc bổ sung phân trang.`;
=======
    // Gợi ý khi user tìm theo loại và dữ liệu quá nhiều
    if (lopTheoLoai.length && tatCaKetQua.length >= MAX_PER_LAYER) {
      const tip = document.createElement("div");
      tip.className = "search-item search-tip";
      tip.innerHTML = `ℹ️ Đang hiển thị tối đa ${MAX_PER_LAYER} kết quả. Muốn “đủ hết” thì tăng MAX_PER_LAYER hoặc bổ sung phân trang.`;
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
      searchResults.appendChild(tip);
    }
  });
}

<<<<<<< HEAD
// giao diện
=======
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
btnSearch.addEventListener("click", thucThiTimKiem);
inpSearch.addEventListener("keypress", function (e) {
  if (e.key === "Enter") thucThiTimKiem();
});
document.addEventListener("click", function (e) {
  if (!e.target.closest(".navbar-search"))
    searchResults.classList.add("hidden");
});
