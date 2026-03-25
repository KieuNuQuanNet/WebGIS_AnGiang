const inpSearch = document.getElementById("inpSearch");
const btnSearch = document.getElementById("btnSearch");
const searchResults = document.getElementById("searchResults");

// xử lý chuỗi
function boDauVaThuong(s = "") {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function chonGiaTriDauTien(props, fields) {
  for (const f of fields) {
    const v = props?.[f];
    if (v !== null && v !== undefined && String(v).trim() !== "")
      return String(v);
  }
  return "";
}

// truy vấn và hiển thị kết quả
function thucThiTimKiem() {
  const queryRaw = inpSearch.value.trim();
  if (!queryRaw) return;

  const queryNorm = boDauVaThuong(queryRaw);
  const queryLower = String(queryRaw).toLowerCase().trim();
  const queryLowerEscaped = queryLower.replace(/'/g, "''");

  const MAX_PER_LAYER = 10;
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
  searchResults.innerHTML = "<div class='search-item'>Đang tìm kiếm...</div>";

  const promises = targets.map((cfg) => {
    const API_BASE = window.WEBGIS_API_BASE || "";

    const urlBase =
      `${API_BASE}/api/wfs?typeName=${encodeURIComponent(cfg.layer)}` +
      `&maxFeatures=${MAX_PER_LAYER}`;

    let url = urlBase;

    if (!lopTheoLoai.length) {
      const filter = cfg.cols
        .map((c) => `strToLowerCase(${c}) LIKE '%${queryLowerEscaped}%'`)
        .join(" OR ");

      url += `&cql_filter=${encodeURIComponent(filter)}`;
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

    const seen = new Set();
    tatCaKetQua = tatCaKetQua.filter((it) => {
      const fid = it.feature?.id ?? it.feature?.properties?.id ?? it.ten;
      const key = `${it.loai}|${fid}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

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
        "<div class='search-item text-red'>Không tìm thấy kết quả!</div>";
      return;
    }

    const group = new Map();
    tatCaKetQua.forEach((it) => {
      if (!group.has(it.loai)) group.set(it.loai, []);
      group.get(it.loai).push(it);
    });

    group.forEach((items, loai) => {
      const header = document.createElement("div");
      header.className = "search-item search-header";
      header.innerHTML = `${loai} <small>(${items.length} kết quả)</small>`;
      searchResults.appendChild(header);

      items.forEach((item) => {
        const div = document.createElement("div");
        div.className = "search-item";

        div.innerHTML = `
              <div class="res-item-container search-variant">
  <div class="res-info-body">
      <h4 class="res-title">${item.ten}</h4>
      <span class="res-badge">${item.loai}</span>
  </div>
</div>`;

        div.addEventListener("click", function () {
          AppGIS.resultLayer.clearLayers();

          const highlight = L.geoJSON(item.feature, {
            pointToLayer: (f, latlng) =>
              L.circleMarker(latlng, {
                radius: 10,
                fillColor: "#2196F3",
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

          const meta = damBaoLopWmsDangBat(item.layerName);
          const tieuDe =
            item.tieuDe || meta?.tieuDe || item.loai || "Tài nguyên";

          AppGIS.map.flyToBounds(bounds, { padding: [50, 50], duration: 1.2 });

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

    if (lopTheoLoai.length && tatCaKetQua.length >= MAX_PER_LAYER) {
      const tip = document.createElement("div");
      tip.className = "search-item search-tip";
      tip.innerHTML = `Đang hiển thị tối đa ${MAX_PER_LAYER} kết quả. Muốn “đủ hết” thì tăng MAX_PER_LAYER hoặc bổ sung phân trang.`;
      searchResults.appendChild(tip);
    }
  });
}

// giao diện
btnSearch.addEventListener("click", thucThiTimKiem);
inpSearch.addEventListener("keypress", function (e) {
  if (e.key === "Enter") thucThiTimKiem();
});
document.addEventListener("click", function (e) {
  if (!e.target.closest(".navbar-search"))
    searchResults.classList.add("hidden");
});
