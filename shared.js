// dùng chung cho giao diện và trung gian
const LAYER_META_SHARED = {
  "angiang:khoangsan_diem_mo": {
    tieuDe: "Khoáng sản",
    label: "Khoáng sản",
    table: "khoangsan_diem_mo",
    nameCol: "ten_don_vi",
    layerKey: "khoangsan",
    chkMainId: "chkKhoangSan",
    subClass: "sub-khoangsan",
    columnName: "loai_khoang_san",
  },
  "angiang:rung": {
    tieuDe: "Rừng",
    label: "Rừng",
    table: "rung",
    nameCol: "ten",
    layerKey: "rung",
    chkMainId: "chkRung",
    subClass: "sub-rung",
    columnName: "loai_rung",
  },
  "angiang:waterways": {
    tieuDe: "Nước",
    label: "Sông ngòi",
    table: "waterways",
    nameCol: "ten",
    layerKey: "nuoc",
    chkMainId: "chkNuoc",
    subClass: "sub-nuoc",
    columnName: "loai",
  },
  "angiang:dat": {
    tieuDe: "Đất",
    label: "Đất",
    table: "dat",
    nameCol: "ten",
    layerKey: "dat",
    chkMainId: "chkDat",
    subClass: "sub-dat",
    columnName: "loai_dat_su_dung",
  },
  "angiang:dongvat": {
    tieuDe: "Động vật",
    label: "Động vật",
    table: "dongvat_ag",
    nameCol: "ten_loai",
    layerKey: "dongvat",
    chkMainId: "chkDongVat",
    subClass: "sub-dongvat",
    columnName: "muc_do_nguy_cap",
  },
  "angiang:thucvat": {
    tieuDe: "Thực vật",
    label: "Thực vật",
    table: "thucvat_ag",
    nameCol: "ten_loai",
    layerKey: "thucvat",
    chkMainId: "chkThucVat",
    subClass: "sub-thucvat",
    columnName: "muc_do_nguy_cap",
  },
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { LAYER_META_SHARED };
}

if (typeof window !== "undefined") {
  window.LAYER_META_SHARED = LAYER_META_SHARED;
}
