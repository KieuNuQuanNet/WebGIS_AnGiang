const express = require("express");
const router = express.Router();
const { pool } = require("../db");
const fs = require("fs");
const path = require("path");
const { authenticateToken, requirePerm } = require("../middleware/auth");
const { LAYER_META_SHARED } = require("../../shared");
const LAYER_META = Object.fromEntries(
  Object.entries(LAYER_META_SHARED).map(([layer, meta]) => [
    layer,
    {
      table: meta.table,
      label: meta.label || meta.tieuDe,
      nameCol: meta.nameCol,
    },
  ]),
);

const LAYER_TABLE_MAP = Object.fromEntries(
  Object.entries(LAYER_META_SHARED).flatMap(([layer, meta]) => {
    const rawLayer = layer.includes(":") ? layer.split(":")[1] : layer;
    return [
      [layer, meta.table],
      [rawLayer, meta.table],
      [meta.table, meta.table],
    ];
  }),
);

const IMPORT_DENIED_COLUMNS = new Set([
  "id",
  "gid",
  "fid",
  "objectid",
  "bbox",
  "geom",
  "trang_thai_du_lieu",
  "ngay_tao",
  "nguoi_tao",
  "ngay_cap_nhat",
  "nguoi_cap_nhat",
  "ngay_phe_duyet",
  "nguoi_phe_duyet",
  "ngay_cong_bo",
  "nguoi_cong_bo",
  "ly_do",
]);

const IMPORT_DEFAULTS_BY_TABLE = {
  khoangsan_diem_mo: {
    loai_khoang_san: "Chưa phân loại",
    tinh_trang: "Chưa xác định",
    tru_luong: 0,
    dien_tich: 0,
    nguon_du_lieu: "Nhập từ file",
  },
  dongvat_ag: {
    nhom: "Chưa xác định",
    vi_tri_phan_bo: "Chưa xác định",
    muc_do_nguy_cap: "Ít quan tâm (LC)",
  },
  thucvat_ag: {
    nhom: "Chưa xác định",
    vi_tri_phan_bo: "Chưa xác định",
    muc_do_nguy_cap: "Ít quan tâm (LC)",
  },
  rung: {
    nhom: "rừng",
    loai_rung: "Rừng phòng hộ",
    tinh_trang: "Chưa xác định",
    nguon_du_lieu: "Nhập từ file",
  },
  waterways: {
    loai: "kênh",
    cap: "chính",
    nguon: "Nhập từ file",
  },
  dat: {
    nguon_du_lieu: "Nhập từ file",
  },
};

const IMPORT_COLUMN_ALIASES = {
  ten: ["ten", "name", "ten_doi_tuong"],
  ten_don_vi: ["ten_don_vi", "name", "company_name", "ten_cong_ty", "ten_mo"],
  ten_loai: ["ten_loai", "name", "species", "species_name", "ten_sinh_vat"],
  nhom: ["nhom", "group"],
  vi_tri_phan_bo: ["vi_tri_phan_bo", "vi_tri", "dia_diem", "location"],
  muc_do_nguy_cap: ["muc_do_nguy_cap", "nguy_cap", "muc_do", "status"],
  phan_loai: ["phan_loai", "classification"],
  loai_khoang_san: ["loai_khoang_san", "loai", "mineral_type"],
  tinh_trang: ["tinh_trang", "status"],
  tru_luong: ["tru_luong", "reserve", "reserves"],
  dien_tich: ["dien_tich", "area"],
  nguon_du_lieu: ["nguon_du_lieu", "nguon", "source"],
  loai_rung: ["loai_rung", "loai"],
  loai_dat_su_dung: ["loai_dat_su_dung", "loai"],
  nhom_su_dung: ["nhom_su_dung", "nhom"],
  loai: ["loai", "type"],
  cap: ["cap", "level"],
  nguon: ["nguon", "source"],
};

function normalizeImportKey(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeImportValue(value, dataType, fieldName) {
  if (value === undefined || value === null || value === "") return null;

  const type = String(dataType || "").toLowerCase();

  if (["smallint", "integer", "bigint"].includes(type)) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      throw new Error(`Giá trị "${fieldName}" không hợp lệ`);
    }
    return parsed;
  }

  if (
    ["numeric", "real", "double precision", "decimal"].includes(type) ||
    type.startsWith("timestamp") ||
    type === "date"
  ) {
    const parsed = Number(value);
    if (type.startsWith("timestamp") || type === "date") {
      return String(value);
    }
    if (!Number.isFinite(parsed)) {
      throw new Error(`Giá trị "${fieldName}" không hợp lệ`);
    }
    return parsed;
  }

  if (type === "boolean") {
    const normalized = String(value).trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n"].includes(normalized)) return false;
    throw new Error(`Giá trị "${fieldName}" không hợp lệ`);
  }

  return String(value);
}

function resolveImportProps(inputProps, table) {
  const props = inputProps && typeof inputProps === "object" ? inputProps : {};
  const normalizedMap = new Map(
    Object.entries(props).map(([key, value]) => [normalizeImportKey(key), value]),
  );

  const defaults = IMPORT_DEFAULTS_BY_TABLE[table] || {};
  const resolved = {};

  for (const [key, value] of Object.entries(props)) {
    resolved[key] = value;
  }

  Object.entries(IMPORT_COLUMN_ALIASES).forEach(([column, aliases]) => {
    if (resolved[column] !== undefined && resolved[column] !== null && resolved[column] !== "") {
      return;
    }

    const hit = aliases
      .map((alias) => normalizedMap.get(normalizeImportKey(alias)))
      .find((value) => value !== undefined && value !== null && value !== "");

    if (hit !== undefined) {
      resolved[column] = hit;
    }
  });

  return { ...defaults, ...resolved };
}

function normalizeIntegerInput(value, fieldName) {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new Error(`${fieldName} vuot qua gioi han so an toan`);
    }
    return String(value);
  }

  const normalized = String(value ?? "").trim();
  if (!/^-?\d+$/.test(normalized)) {
    throw new Error(`${fieldName} khong hop le`);
  }

  return normalized;
}

async function resolveIdColumn(table) {
  const { rows } = await pool.query(
    `SELECT column_name, data_type
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name IN ('gid', 'id', 'fid', 'objectid')`,
    [table],
  );

  const validCols = rows.map((r) => r.column_name);
  const idCol = validCols.includes("gid")
    ? "gid"
    : validCols.includes("id")
      ? "id"
      : validCols.includes("fid")
        ? "fid"
        : validCols.includes("objectid")
          ? "objectid"
          : "id";

  const idMeta = rows.find((r) => r.column_name === idCol);
  return { idCol, idMeta };
}

router.get("/_ping", (req, res) => res.json({ ok: true, time: new Date() }));

router.get(
  "/roles",
  authenticateToken,
  requirePerm("admin.users"),
  async (req, res) => {
    const { rows } = await pool.query(
      "SELECT id, ma, ten FROM public.vai_tro ORDER BY id ASC",
    );
    res.json(rows);
  },
);

router.get(
  "/users",
  authenticateToken,
  requirePerm("admin.users"),
  async (req, res) => {
    const sql = `SELECT tk.id, tk.ho_ten, tk.email, tk.trang_thai, tk.created_at, COALESCE(array_agg(DISTINCT vt.ma) FILTER (WHERE vt.ma  
      IS NOT NULL), '{}') AS roles
                   FROM public.tai_khoan tk LEFT JOIN public.tai_khoan_vai_tro tkvt ON tkvt.tai_khoan_id = tk.id LEFT JOIN public.vai_tro vt
      ON vt.id = tkvt.vai_tro_id
                   GROUP BY tk.id ORDER BY tk.id ASC;`;
    const { rows } = await pool.query(sql);
    res.json(rows);
  },
);

router.patch(
  "/users/:id/status",
  authenticateToken,
  requirePerm("admin.users"),
  async (req, res) => {
    const id = normalizeIntegerInput(req.params.id, "user id");
    const { trang_thai } = req.body || {};
    const { rows } = await pool.query(
      "UPDATE public.tai_khoan SET trang_thai=$2 WHERE id=$1 RETURNING id, email, trang_thai",
      [id, trang_thai],
    );
    res.json({ ok: true, user: rows[0] });
  },
);
router.put(
  "/users/:id/roles",
  authenticateToken,
  requirePerm("admin.users"),
  async (req, res) => {
    const id = normalizeIntegerInput(req.params.id, "user id");
    const { roles } = req.body;
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query(
        "DELETE FROM public.tai_khoan_vai_tro WHERE tai_khoan_id = $1",
        [id],
      );

      if (Array.isArray(roles) && roles.length > 0) {
        for (const rMa of roles) {
          const { rows: rRows } = await client.query(
            "SELECT id FROM public.vai_tro WHERE ma = $1",
            [rMa],
          );

          if (rRows.length > 0) {
            await client.query(
              "INSERT INTO public.tai_khoan_vai_tro (tai_khoan_id, vai_tro_id) VALUES ($1, $2)",
              [id, rRows[0].id],
            );
          }
        }
      }

      await client.query("COMMIT");
      res.json({ ok: true, message: "Cập nhật vai trò thành công" });
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch (_) {}

      res.status(500).json({ message: "Lỗi cập nhật vai trò" });
    } finally {
      client.release();
    }
  },
);
router.delete(
  "/users/:id",
  authenticateToken,
  requirePerm("admin.users"),
  async (req, res) => {
    const id = normalizeIntegerInput(req.params.id, "user id");
    try {
      await pool.query("DELETE FROM public.tai_khoan WHERE id = $1", [id]);
      res.json({ ok: true, message: "Đã xóa tài khoản" });
    } catch (e) {
      res.status(500).json({ message: "Lỗi xóa tài khoản" });
    }
  },
);
router.get(
  "/layers",
  authenticateToken,
  requirePerm("feature.approve"),
  (req, res) => {
    res.json(
      Object.keys(LAYER_META).map((layer) => ({
        layer,
        table: LAYER_META[layer].table,
        label: LAYER_META[layer].label,
      })),
    );
  },
);

router.get(
  "/layer-objects",
  authenticateToken,
  requirePerm("feature.approve"),
  async (req, res) => {
    try {
      const { layer, status, q } = req.query;
      const meta = LAYER_META[layer];
      if (!meta)
        return res.status(400).json({ message: "Lớp dữ liệu không hợp lệ" });

      const table = meta.table;
      const nameCol = meta.nameCol || "ten";

      let whereClauses = [];
      let params = [];

      if (status && status !== "tat_ca") {
        whereClauses.push(`t.trang_thai_du_lieu = $${params.length + 1}`);
        params.push(status);
      } else {
        whereClauses.push(`t.trang_thai_du_lieu != 'da_xoa'`);
      }

      if (q && q.trim() !== "") {
        whereClauses.push(`t.${nameCol} ILIKE $${params.length + 1}`);
        params.push(`%${q.trim()}%`);
      }

      const whereSql =
        whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

      const sql = `
                      SELECT t.*, u.ho_ten as ten_nguoi_tao, t.${nameCol} as ten
                         FROM public.${table} t
                         LEFT JOIN public.tai_khoan u ON CAST(u.id AS TEXT) = CAST(t.nguoi_tao AS TEXT)
                        ${whereSql}
                        ORDER BY
                          CASE
                             WHEN t.trang_thai_du_lieu::text = 'cho_xoa' THEN 1
                            WHEN t.trang_thai_du_lieu::text = 'cho_duyet' THEN 2
                            WHEN t.trang_thai_du_lieu::text = 'nhap' THEN 3
                            WHEN t.trang_thai_du_lieu::text = 'cong_bo' THEN 4
                            ELSE 5
                          END ASC,
                          COALESCE(t.ngay_cap_nhat, t.ngay_tao) DESC NULLS LAST
                        LIMIT 1000
                    `;

      const { rows } = await pool.query(sql, params);
      res.json(rows);
    } catch (e) {
      console.error("LOI_GET_OBJECTS:", e);
      res
        .status(500)
        .json({ message: "Lỗi hệ thống khi lấy danh sách đối tượng" });
    }
  },
);

router.get(
  "/resource-history",
  authenticateToken,
  requirePerm("feature.approve"),
  async (req, res) => {
    try {
      const layer = req.query.layer || "angiang:rung";
      const meta = LAYER_META[layer];

      if (!meta) return res.status(400).json({ message: "Sai layer" });

      const table = meta.table;
      const nameCol = meta.nameCol || "ten";
      const { rows: idCols } = await pool.query(
        `SELECT column_name
     FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
      AND column_name IN ('gid', 'id', 'fid', 'objectid')`,
        [table],
      );

      const validIdCols = idCols.map((c) => c.column_name);
      const orderIdCol = validIdCols.includes("gid")
        ? "gid"
        : validIdCols.includes("id")
          ? "id"
          : validIdCols.includes("fid")
            ? "fid"
            : validIdCols.includes("objectid")
              ? "objectid"
              : null;

      const q = (req.query.q || "").trim();
      let whereClause = "";
      let params = [];

      if (q) {
        whereClause = `WHERE t.${nameCol} ILIKE $1`;
        params.push(`%${q}%`);
      }

      const sql = `
        SELECT
            t.*,
            '${layer}' as ma_lop,
            u1.ho_ten as ten_nguoi_tao,
            u2.ho_ten as ten_nguoi_cap_nhat,
            u3.ho_ten as ten_nguoi_phe_duyet,
            u4.ho_ten as ten_nguoi_cong_bo,
            t.${nameCol} as ten_tai_nguyen
        FROM public.${table} t
        LEFT JOIN public.tai_khoan u1 ON CAST(u1.id AS TEXT) = CAST(t.nguoi_tao AS TEXT)
        LEFT JOIN public.tai_khoan u2 ON CAST(u2.id AS TEXT) = CAST(t.nguoi_cap_nhat AS TEXT)
        LEFT JOIN public.tai_khoan u3 ON CAST(u3.id AS TEXT) = CAST(t.nguoi_phe_duyet AS TEXT)
        LEFT JOIN public.tai_khoan u4 ON CAST(u4.id AS TEXT) = CAST(t.nguoi_cong_bo AS TEXT)
       ${whereClause}
     ORDER BY
   COALESCE(t.ngay_cap_nhat, t.ngay_tao) DESC
   ${orderIdCol ? `, t.${orderIdCol} DESC` : ""}
 LIMIT 1000
  `;

      const { rows } = await pool.query(sql, params);
      res.json(rows);
    } catch (e) {
      console.error("HISTORY_ERROR:", e);
      res.status(500).json({ message: "Lỗi lấy lịch sử" });
    }
  },
);

router.post(
  "/approval-requests",
  authenticateToken,
  requirePerm("feature.update"),
  async (req, res) => {
    try {
      const { layer, tai_nguyen_id, loai_yeu_cau, du_lieu_de_xuat, ly_do } =
        req.body || {};

      const table = LAYER_TABLE_MAP[layer];
      if (!table) {
        return res.status(400).json({ message: "Lớp dữ liệu không hợp lệ" });
      }

      const requestType = String(loai_yeu_cau || "").trim();
      if (!["cap_nhat_tai_nguyen", "xoa_tai_nguyen"].includes(requestType)) {
        return res.status(400).json({ message: "Loại yêu cầu không hợp lệ" });
      }

      const uid = normalizeIntegerInput(
        req.user.sub ?? req.user.id ?? "0",
        "user id",
      );

      if (!du_lieu_de_xuat || typeof du_lieu_de_xuat !== "object") {
        return res
          .status(400)
          .json({ message: "Dữ liệu đề xuất không hợp lệ" });
      }

      const taiNguyenId = normalizeIntegerInput(tai_nguyen_id, "tai_nguyen_id");
      const { idCol } = await resolveIdColumn(table);

      const sqlCurrent = `SELECT * FROM public.${table} WHERE ${idCol} = $1 LIMIT 1`;
      const { rows: currentRows } = await pool.query(sqlCurrent, [taiNguyenId]);

      if (!currentRows.length) {
        return res.status(404).json({ message: "Không tìm thấy tài nguyên" });
      }

      const currentData = currentRows[0];

      const { rows: pendingRows } = await pool.query(
        `SELECT id
           FROM public.yeu_cau_duyet_tai_nguyen
          WHERE loai_lop = $1
            AND tai_nguyen_id = $2
            AND loai_yeu_cau = $3
            AND trang_thai = 'cho_duyet'
          ORDER BY id DESC
          LIMIT 1`,
        [table, taiNguyenId, requestType],
      );

      if (pendingRows.length) {
        return res.status(409).json({
          message: "Tài nguyên này đã có một yêu cầu chờ duyệt cùng loại",
        });
      }

      const { rows } = await pool.query(
        `INSERT INTO public.yeu_cau_duyet_tai_nguyen (
            loai_lop,
            tai_nguyen_id,
            loai_yeu_cau,
            trang_thai,
            du_lieu_hien_tai,
            du_lieu_de_xuat,
            ly_do,
            nguoi_tao
         )
         VALUES (
            $1,
            $2::bigint,
            $3,
            'cho_duyet',
            $4::jsonb,
            $5::jsonb,
            $6,
            $7::bigint
         )
         RETURNING *`,
        [
          table,
          taiNguyenId,
          requestType,
          JSON.stringify(currentData),
          JSON.stringify(du_lieu_de_xuat),
          ly_do || null,
          uid,
        ],
      );

      res.json({
        ok: true,
        message: "Đã tạo yêu cầu chờ duyệt",
        request: rows[0],
      });
    } catch (e) {
      console.error("CREATE_APPROVAL_REQUEST_ERROR:", e);
      res.status(500).json({
        message: e.message || "Lỗi tạo yêu cầu chờ duyệt",
      });
    }
  },
);
router.get(
  "/approval-requests",
  authenticateToken,
  requirePerm("feature.approve"),
  async (req, res) => {
    try {
      const { layer, q, status } = req.query;
      const meta = LAYER_META[layer];
      const table = LAYER_TABLE_MAP[layer];

      if (!meta || !table) {
        return res.status(400).json({ message: "Lớp dữ liệu không hợp lệ" });
      }

      const requestStatus = String(status || "cho_duyet").trim();
      const nameCol = meta.nameCol || "ten";

      const params = [table, requestStatus, nameCol];
      let whereSql = `
        WHERE y.loai_lop = $1
          AND y.trang_thai = $2
      `;

      if (q && String(q).trim() !== "") {
        params.push(`%${String(q).trim()}%`);
        whereSql += `
          AND COALESCE(
  y.du_lieu_de_xuat ->> 'ten_tai_nguyen',
  y.du_lieu_hien_tai ->> 'ten_tai_nguyen',
  y.du_lieu_de_xuat ->> $3,
  y.du_lieu_hien_tai ->> $3,
  ''
) ILIKE $4
        `;
      }

      const { rows } = await pool.query(
        `
        SELECT
          y.*,
          u1.ho_ten AS ten_nguoi_tao,
          u2.ho_ten AS ten_nguoi_phe_duyet,
          COALESCE(
  y.du_lieu_de_xuat ->> 'ten_tai_nguyen',
  y.du_lieu_hien_tai ->> 'ten_tai_nguyen',
  y.du_lieu_de_xuat ->> $3,
  y.du_lieu_hien_tai ->> $3,
  'Không tên'
) AS ten_tai_nguyen
        FROM public.yeu_cau_duyet_tai_nguyen y
        LEFT JOIN public.tai_khoan u1 ON u1.id = y.nguoi_tao
        LEFT JOIN public.tai_khoan u2 ON u2.id = y.nguoi_phe_duyet
        ${whereSql}
        ORDER BY y.ngay_tao DESC, y.id DESC
        LIMIT 1000
        `,
        params,
      );

      res.json(rows);
    } catch (e) {
      console.error("GET_APPROVAL_REQUESTS_ERROR:", e);
      res.status(500).json({
        message: e.message || "Lỗi lấy danh sách yêu cầu chờ duyệt",
      });
    }
  },
);

router.get(
  "/approval-requests/:id",
  authenticateToken,
  requirePerm("feature.approve"),
  async (req, res) => {
    try {
      const requestId = normalizeIntegerInput(req.params.id, "request id");

      const { rows } = await pool.query(
        `
        SELECT
          y.*,
          u1.ho_ten AS ten_nguoi_tao,
          u2.ho_ten AS ten_nguoi_phe_duyet
        FROM public.yeu_cau_duyet_tai_nguyen y
        LEFT JOIN public.tai_khoan u1 ON u1.id = y.nguoi_tao
        LEFT JOIN public.tai_khoan u2 ON u2.id = y.nguoi_phe_duyet
        WHERE y.id = $1
        LIMIT 1
        `,
        [requestId],
      );

      if (!rows.length) {
        return res.status(404).json({ message: "Không tìm thấy yêu cầu" });
      }

      res.json(rows[0]);
    } catch (e) {
      console.error("GET_APPROVAL_REQUEST_DETAIL_ERROR:", e);
      res.status(500).json({
        message: e.message || "Lỗi lấy chi tiết yêu cầu duyệt",
      });
    }
  },
);
router.patch(
  "/approval-requests/:id/decision",
  authenticateToken,
  requirePerm("feature.approve"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const requestId = normalizeIntegerInput(req.params.id, "request id");
      const decision = String(req.body?.action || "").trim();
      const note = String(req.body?.note || "").trim() || null;

      if (!["approve", "reject"].includes(decision)) {
        return res.status(400).json({ message: "Hành động không hợp lệ" });
      }

      const uid = normalizeIntegerInput(
        req.user.sub ?? req.user.id ?? "0",
        "user id",
      );
      const now = new Date().toISOString();

      await client.query("BEGIN");

      const { rows: reqRows } = await client.query(
        `SELECT *
           FROM public.yeu_cau_duyet_tai_nguyen
          WHERE id = $1
          LIMIT 1`,
        [requestId],
      );

      if (!reqRows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Không tìm thấy yêu cầu" });
      }

      const requestRow = reqRows[0];

      if (requestRow.trang_thai !== "cho_duyet") {
        await client.query("ROLLBACK");
        return res.status(409).json({
          message: "Yêu cầu này không còn ở trạng thái chờ duyệt",
        });
      }

      if (decision === "reject") {
        if (requestRow.loai_yeu_cau === "them_anh") {
          const pendingImage =
            requestRow.du_lieu_de_xuat &&
            typeof requestRow.du_lieu_de_xuat === "object"
              ? requestRow.du_lieu_de_xuat
              : null;

          const relativePath = String(pendingImage?.duong_dan_file || "");
          if (relativePath.startsWith("/images_resources/")) {
            const absPath = path.join(
              __dirname,
              "..",
              "..",
              relativePath.replace(/^\/+/, ""),
            );

            if (fs.existsSync(absPath)) {
              fs.unlinkSync(absPath);
            }
          }
        }

        await client.query(
          `UPDATE public.yeu_cau_duyet_tai_nguyen
        SET trang_thai = 'tu_choi',
            ghi_chu_phe_duyet = $2,
            nguoi_phe_duyet = $3::bigint,
            ngay_phe_duyet = $4
      WHERE id = $1`,
          [requestId, note, uid, now],
        );

        await client.query("COMMIT");
        return res.json({
          ok: true,
          message: "Đã từ chối yêu cầu",
        });
      }

      const table = requestRow.loai_lop;
      const { idCol, idMeta } = await resolveIdColumn(table);
      const idCast = idMeta?.data_type === "bigint" ? "bigint" : "integer";

      if (requestRow.loai_yeu_cau === "cap_nhat_tai_nguyen") {
        const payload =
          requestRow.du_lieu_de_xuat &&
          typeof requestRow.du_lieu_de_xuat === "object"
            ? requestRow.du_lieu_de_xuat
            : {};

        const { rows: colRows } = await client.query(
          `SELECT column_name
             FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = $1`,
          [table],
        );

        const validCols = new Set(colRows.map((r) => r.column_name));
        const deniedCols = new Set([
          "id",
          "gid",
          "fid",
          "objectid",
          "bbox",
          "geom",
          "ngay_tao",
          "nguoi_tao",
          "ngay_cap_nhat",
          "nguoi_cap_nhat",
          "ngay_phe_duyet",
          "nguoi_phe_duyet",
          "ngay_cong_bo",
          "nguoi_cong_bo",
        ]);

        const updateEntries = Object.entries(payload).filter(
          ([key]) => validCols.has(key) && !deniedCols.has(key),
        );

        if (!updateEntries.length) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            message: "Không có dữ liệu hợp lệ để phê duyệt cập nhật",
          });
        }

        const setClauses = [];
        const values = [];
        let idx = 1;

        updateEntries.forEach(([key, value]) => {
          setClauses.push(`${key} = $${idx}`);
          values.push(value);
          idx += 1;
        });

        if (validCols.has("nguoi_cap_nhat")) {
          setClauses.push(`nguoi_cap_nhat = $${idx}::bigint`);
          values.push(uid);
          idx += 1;
        }

        if (validCols.has("ngay_cap_nhat")) {
          setClauses.push(`ngay_cap_nhat = $${idx}`);
          values.push(now);
          idx += 1;
        }

        if (validCols.has("nguoi_phe_duyet")) {
          setClauses.push(`nguoi_phe_duyet = $${idx}::bigint`);
          values.push(uid);
          idx += 1;
        }

        if (validCols.has("ngay_phe_duyet")) {
          setClauses.push(`ngay_phe_duyet = $${idx}`);
          values.push(now);
          idx += 1;
        }

        values.push(requestRow.tai_nguyen_id);

        await client.query(
          `UPDATE public.${table}
              SET ${setClauses.join(", ")}
            WHERE ${idCol} = $${idx}::${idCast}`,
          values,
        );
      } else if (requestRow.loai_yeu_cau === "xoa_tai_nguyen") {
        await client.query(
          `UPDATE public.${table}
              SET trang_thai_du_lieu = 'da_xoa'::public.trang_thai_du_lieu_enum,
                  ly_do = $1,
                  nguoi_cap_nhat = $2::bigint,
                  ngay_cap_nhat = $3,
                  nguoi_phe_duyet = $2::bigint,
                  ngay_phe_duyet = $3
            WHERE ${idCol} = $4::${idCast}`,
          [
            note || requestRow.ly_do || "Đã duyệt xóa",
            uid,
            now,
            requestRow.tai_nguyen_id,
          ],
        );
      } else if (requestRow.loai_yeu_cau === "them_anh") {
        const payload =
          requestRow.du_lieu_de_xuat &&
          typeof requestRow.du_lieu_de_xuat === "object"
            ? requestRow.du_lieu_de_xuat
            : {};

        await client.query(
          `INSERT INTO public.hinh_anh_tai_nguyen (
              tai_nguyen_id,
              loai_tai_nguyen,
              duong_dan_file,
              ten_file,
              mime_type,
              kich_thuoc_bytes,
              chu_thich,
              thu_tu_hien_thi,
              la_anh_dai_dien,
              trang_thai_du_lieu,
              nguoi_tao,
              nguoi_cap_nhat
           )
           VALUES (
              $1::bigint,
              $2::varchar(50),
              $3::text,
              $4::varchar(255),
              $5::varchar(100),
              $6::bigint,
              $7::text,
              COALESCE(
                (
                  SELECT COALESCE(MAX(thu_tu_hien_thi), 0) + 1
                  FROM public.hinh_anh_tai_nguyen
                  WHERE loai_tai_nguyen = $2::varchar(50)
                    AND tai_nguyen_id = $1::bigint
                ),
                1
              ),
              COALESCE($8::boolean, false),
              'cong_bo'::public.trang_thai_du_lieu_enum,
              $9::bigint,
              $9::bigint
           )`,
          [
            requestRow.tai_nguyen_id,
            requestRow.loai_lop,
            payload.duong_dan_file,
            payload.ten_file,
            payload.mime_type,
            payload.kich_thuoc_bytes,
            payload.chu_thich || null,
            !!payload.la_anh_dai_dien,
            uid,
          ],
        );
      } else if (requestRow.loai_yeu_cau === "xoa_anh") {
        const currentImage =
          requestRow.du_lieu_hien_tai &&
          typeof requestRow.du_lieu_hien_tai === "object"
            ? requestRow.du_lieu_hien_tai
            : {};

        const imageId = normalizeIntegerInput(
          currentImage.image_id,
          "image id",
        );

        await client.query(
          `DELETE FROM public.hinh_anh_tai_nguyen
            WHERE id = $1::bigint`,
          [imageId],
        );

        const relativePath = String(currentImage.duong_dan_file || "");
        if (relativePath.startsWith("/images_resources/")) {
          const absPath = path.join(
            __dirname,
            "..",
            "..",
            relativePath.replace(/^\/+/, ""),
          );

          if (fs.existsSync(absPath)) {
            fs.unlinkSync(absPath);
          }
        }
      } else {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Loại yêu cầu này chưa hỗ trợ phê duyệt ở bước hiện tại",
        });
      }

      await client.query(
        `UPDATE public.yeu_cau_duyet_tai_nguyen
            SET trang_thai = 'da_duyet',
                ghi_chu_phe_duyet = $2,
                nguoi_phe_duyet = $3::bigint,
                ngay_phe_duyet = $4
          WHERE id = $1`,
        [requestId, note, uid, now],
      );

      await client.query("COMMIT");

      res.json({
        ok: true,
        message: "Đã phê duyệt yêu cầu thành công",
      });
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch (_) {}

      console.error("DECIDE_APPROVAL_REQUEST_ERROR:", e);
      res.status(500).json({
        message: e.message || "Lỗi xử lý phê duyệt yêu cầu",
      });
    } finally {
      client.release();
    }
  },
);

router.patch(
  "/layer-objects/stage",
  authenticateToken,
  requirePerm("feature.approve"),
  async (req, res) => {
    try {
      const { layer, ids, stage, reason } = req.body;
      const table = LAYER_TABLE_MAP[layer];

      if (!table || !ids || !ids.length)
        return res.status(400).json({ message: "Dữ liệu thiếu" });

      const { rows: colCheck } = await pool.query(
        `SELECT column_name, data_type FROM information_schema.columns
              WHERE table_schema = 'public'
              AND table_name = $1
              AND column_name IN ('gid', 'id', 'fid', 'objectid')`,
        [table],
      );

      const validCols = colCheck.map((c) => c.column_name);

      const idCol = validCols.includes("gid")
        ? "gid"
        : validCols.includes("id")
          ? "id"
          : validCols.includes("fid")
            ? "fid"
            : validCols.includes("objectid")
              ? "objectid"
              : "id";
      const idMeta = colCheck.find((c) => c.column_name === idCol);
      const idArrayCast =
        idMeta?.data_type === "bigint" ? "bigint[]" : "integer[]";

      const numericIds = ids.map((id, index) =>
        normalizeIntegerInput(id, `id[${index}]`),
      );
      const uid = normalizeIntegerInput(
        req.user.sub ?? req.user.id ?? "0",
        "user id",
      );
      const now = new Date().toISOString();

      console.log(
        `[DEBUG] Bảng: ${table} | Cột ID dùng: ${idCol} | Danh sách ID: ${numericIds}`,
      );

      const sql = `
          UPDATE public.${table}
          SET trang_thai_du_lieu = $1::text::trang_thai_du_lieu_enum,
              ly_do = (CASE WHEN $1::text = 'cong_bo' THEN NULL ELSE $2::text END),
              nguoi_cap_nhat = $3::bigint,
              ngay_cap_nhat = $4,
              nguoi_phe_duyet = (CASE WHEN $1::text = 'cong_bo' THEN nguoi_phe_duyet ELSE $3::bigint END),
              ngay_phe_duyet = (CASE WHEN $1::text = 'cong_bo' THEN ngay_phe_duyet ELSE $4 END),
              nguoi_cong_bo = (CASE WHEN $1::text = 'cong_bo' THEN $3::bigint ELSE nguoi_cong_bo END),
              ngay_cong_bo = (CASE WHEN $1::text = 'cong_bo' THEN $4 ELSE ngay_cong_bo END)
          WHERE ${idCol} = ANY($5::${idArrayCast})
      `;

      const values = [stage, reason || null, uid, now, numericIds];
      const result = await pool.query(sql, values);

      if (result.rowCount === 0) {
        return res.status(404).json({
          ok: false,
          message:
            "Không tìm thấy dữ liệu để cập nhật (Kiểm tra ID hoặc tên bảng)!",
        });
      }

      res.json({
        ok: true,
        message: `Thành công! Đã cập nhật ${result.rowCount} đối tượng.`,
      });
    } catch (e) {
      console.error("LỖI_SERVER_ADMIN:", e);
      res.status(500).json({ message: "Lỗi hệ thống: " + e.message });
    }
  },
);

router.get(
  "/resource-images",
  authenticateToken,
  requirePerm("feature.update"),
  async (req, res) => {
    try {
      const { loai_tai_nguyen, tai_nguyen_id } = req.query;

      if (!loai_tai_nguyen || !tai_nguyen_id) {
        return res
          .status(400)
          .json({ message: "Thiếu loại tài nguyên hoặc ID" });
      }
      const taiNguyenIdNum = Number(tai_nguyen_id);
      if (!Number.isInteger(taiNguyenIdNum) || taiNguyenIdNum <= 0) {
        return res.status(400).json({ message: "ID tài nguyên không hợp lệ" });
      }

      const { rows } = await pool.query(
        `SELECT id, tai_nguyen_id, loai_tai_nguyen, duong_dan_file, ten_file,
                mime_type, kich_thuoc_bytes, chu_thich, thu_tu_hien_thi,
                la_anh_dai_dien, trang_thai_du_lieu, ngay_tao, ngay_cap_nhat
           FROM public.hinh_anh_tai_nguyen_public
WHERE loai_tai_nguyen = $1
  AND tai_nguyen_id = $2
          ORDER BY thu_tu_hien_thi ASC, id ASC`,
        [loai_tai_nguyen, taiNguyenIdNum],
      );

      res.json(rows);
    } catch (e) {
      res.status(500).json({ message: "Lỗi lấy danh sách ảnh tài nguyên" });
    }
  },
);
router.post(
  "/resource-images",
  authenticateToken,
  requirePerm("feature.update"),
  async (req, res) => {
    try {
      const {
        loai_tai_nguyen,
        tai_nguyen_id,
        ten_tai_nguyen,
        file_name,
        mime_type,
        data_base64,
        chu_thich,
        la_anh_dai_dien,
      } = req.body || {};

      if (
        !loai_tai_nguyen ||
        !tai_nguyen_id ||
        !file_name ||
        !mime_type ||
        !data_base64
      ) {
        return res.status(400).json({ message: "Thiếu dữ liệu upload ảnh" });
      }
      const taiNguyenIdNum = Number(tai_nguyen_id);
      if (!Number.isInteger(taiNguyenIdNum) || taiNguyenIdNum <= 0) {
        return res.status(400).json({ message: "ID tài nguyên không hợp lệ" });
      }

      const mimeAllow = ["image/jpeg", "image/png", "image/webp"];
      if (!mimeAllow.includes(mime_type)) {
        return res.status(400).json({ message: "Định dạng ảnh không hợp lệ" });
      }

      const extMap = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
      };

      const rawBase64 = String(data_base64).replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(rawBase64, "base64");

      if (!buffer.length || buffer.length > 2097152) {
        return res
          .status(400)
          .json({ message: "Ảnh phải lớn hơn 0 và không vượt quá 2MB" });
      }

      const uploadsDir = path.join(__dirname, "..", "..", "images_resources");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const safeLoai = String(loai_tai_nguyen).replace(/[^a-z0-9_]/gi, "_");
      const safeId = String(taiNguyenIdNum);
      const timeKey = Date.now();
      const ext = extMap[mime_type] || ".bin";
      const storedName = `${safeLoai}_${safeId}_${timeKey}${ext}`;
      const absPath = path.join(uploadsDir, storedName);
      const publicPath = `/images_resources/${storedName}`;

      fs.writeFileSync(absPath, buffer);
      const userId = normalizeIntegerInput(
        req.user?.sub ?? req.user?.id ?? "0",
        "user id",
      );

      const deXuatAnh = {
        ten_tai_nguyen: ten_tai_nguyen || null,
        duong_dan_file: publicPath,
        ten_file: file_name,
        mime_type,
        kich_thuoc_bytes: buffer.length,
        chu_thich: chu_thich || null,
        la_anh_dai_dien: !!la_anh_dai_dien,
      };

      const { rows } = await pool.query(
        `INSERT INTO public.yeu_cau_duyet_tai_nguyen (
      loai_lop,
      tai_nguyen_id,
      loai_yeu_cau,
      trang_thai,
      du_lieu_hien_tai,
      du_lieu_de_xuat,
      ly_do,
      nguoi_tao
   )
   VALUES (
      $1::varchar(50),
      $2::bigint,
      'them_anh',
      'cho_duyet',
      '{}'::jsonb,
      $3::jsonb,
      $4::text,
      $5::bigint
   )
   RETURNING *`,
        [
          loai_tai_nguyen,
          taiNguyenIdNum,
          JSON.stringify(deXuatAnh),
          "Người dùng gửi yêu cầu thêm ảnh",
          userId,
        ],
      );

      res.json({
        ok: true,
        message: "Đã gửi yêu cầu thêm ảnh chờ duyệt",
        request: rows[0],
      });
    } catch (e) {
      console.error("UPLOAD_RESOURCE_IMAGE_ERROR:", e);
      res
        .status(500)
        .json({ message: e.message || "Lỗi upload ảnh tài nguyên" });
    }
  },
);
router.delete(
  "/resource-images/:id",
  authenticateToken,
  requirePerm("feature.update"),
  async (req, res) => {
    try {
      const imageIdNum = Number(req.params.id);
      if (!Number.isInteger(imageIdNum) || imageIdNum <= 0) {
        return res.status(400).json({ message: "ID ảnh không hợp lệ" });
      }

      const { rows } = await pool.query(
        `SELECT id, tai_nguyen_id, loai_tai_nguyen, duong_dan_file, ten_file,
          mime_type, kich_thuoc_bytes, chu_thich, la_anh_dai_dien
     FROM public.hinh_anh_tai_nguyen
    WHERE id = $1
    LIMIT 1`,
        [imageIdNum],
      );

      if (!rows.length) {
        return res.status(404).json({ message: "Không tìm thấy ảnh" });
      }

      const imageRow = rows[0];
      const table = imageRow.loai_tai_nguyen;
      const meta = LAYER_META[table];
      const nameCol = meta?.nameCol || "ten";
      const { idCol } = await resolveIdColumn(table);

      const { rows: resourceRows } = await pool.query(
        `SELECT ${nameCol} AS ten_tai_nguyen
     FROM public.${table}
    WHERE ${idCol} = $1::bigint
    LIMIT 1`,
        [imageRow.tai_nguyen_id],
      );

      const tenTaiNguyen = resourceRows[0]?.ten_tai_nguyen || null;

      const userId = normalizeIntegerInput(
        req.user?.sub ?? req.user?.id ?? "0",
        "user id",
      );

      const duLieuHienTai = {
        image_id: imageRow.id,
        ten_tai_nguyen: tenTaiNguyen,
        duong_dan_file: imageRow.duong_dan_file,
        ten_file: imageRow.ten_file,
        mime_type: imageRow.mime_type,
        kich_thuoc_bytes: imageRow.kich_thuoc_bytes,
        chu_thich: imageRow.chu_thich,
        la_anh_dai_dien: imageRow.la_anh_dai_dien,
      };

      const duLieuDeXuat = {
        action: "delete",
        image_id: imageRow.id,
      };

      await pool.query(
        `INSERT INTO public.yeu_cau_duyet_tai_nguyen (
      loai_lop,
      tai_nguyen_id,
      loai_yeu_cau,
      trang_thai,
      du_lieu_hien_tai,
      du_lieu_de_xuat,
      ly_do,
      nguoi_tao
   )
   VALUES (
      $1::varchar(50),
      $2::bigint,
      'xoa_anh',
      'cho_duyet',
      $3::jsonb,
      $4::jsonb,
      $5::text,
      $6::bigint
   )`,
        [
          imageRow.loai_tai_nguyen,
          imageRow.tai_nguyen_id,
          JSON.stringify(duLieuHienTai),
          JSON.stringify(duLieuDeXuat),
          "Người dùng gửi yêu cầu xóa ảnh",
          userId,
        ],
      );

      res.json({
        ok: true,
        message: "Đã gửi yêu cầu xóa ảnh chờ duyệt",
      });
    } catch (e) {
      console.error("DELETE_RESOURCE_IMAGE_ERROR:", e);
      res.status(500).json({ message: e.message || "Lỗi xóa ảnh tài nguyên" });
    }
  },
);

router.post(
  "/import-features",
  authenticateToken,
  requirePerm("feature.approve"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const { layer, format, records } = req.body || {};
      const meta = LAYER_META[layer];

      if (!meta) {
        return res.status(400).json({ message: "Lớp dữ liệu không hợp lệ" });
      }

      if (!["csv", "geojson"].includes(String(format || "").toLowerCase())) {
        return res.status(400).json({ message: "Định dạng import không hợp lệ" });
      }

      if (!Array.isArray(records) || !records.length) {
        return res.status(400).json({ message: "Không có dữ liệu để nhập" });
      }

      if (records.length > 1000) {
        return res.status(400).json({ message: "Mỗi lần chỉ nhập tối đa 1000 bản ghi" });
      }

      const table = meta.table;
      const uid = normalizeIntegerInput(
        req.user?.sub ?? req.user?.id ?? "0",
        "user id",
      );
      const now = new Date().toISOString();

      const { rows: colRows } = await client.query(
        `SELECT column_name, data_type, is_nullable
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1`,
        [table],
      );

      const validCols = new Map(colRows.map((row) => [row.column_name, row]));

      if (!validCols.has("geom")) {
        return res.status(400).json({ message: "Lớp dữ liệu không có cột hình học" });
      }

      await client.query("BEGIN");

      let imported = 0;

      for (let index = 0; index < records.length; index += 1) {
        const record = records[index] || {};
        const geometry = record.geometry;
        const rawProps = resolveImportProps(record.properties, table);

        if (!geometry || typeof geometry !== "object") {
          throw new Error(`Bản ghi ${index + 1} thiếu geometry hợp lệ`);
        }

        const insertCols = [];
        const insertVals = [];
        const params = [];
        let paramIndex = 1;

        Object.entries(rawProps).forEach(([key, value]) => {
          const colMeta = validCols.get(key);
          if (!colMeta || IMPORT_DENIED_COLUMNS.has(key)) return;

          const normalizedValue = normalizeImportValue(value, colMeta.data_type, key);
          if (normalizedValue === null && colMeta.is_nullable === "NO") return;

          insertCols.push(key);
          insertVals.push(`$${paramIndex}`);
          params.push(normalizedValue);
          paramIndex += 1;
        });

        if (validCols.has("trang_thai_du_lieu")) {
          insertCols.push("trang_thai_du_lieu");
          insertVals.push(`$${paramIndex}::text::public.trang_thai_du_lieu_enum`);
          params.push("nhap");
          paramIndex += 1;
        }

        if (validCols.has("ngay_tao")) {
          insertCols.push("ngay_tao");
          insertVals.push(`$${paramIndex}`);
          params.push(now);
          paramIndex += 1;
        }

        if (validCols.has("nguoi_tao")) {
          insertCols.push("nguoi_tao");
          insertVals.push(`$${paramIndex}::bigint`);
          params.push(uid);
          paramIndex += 1;
        }

        if (validCols.has("ngay_cap_nhat")) {
          insertCols.push("ngay_cap_nhat");
          insertVals.push(`$${paramIndex}`);
          params.push(now);
          paramIndex += 1;
        }

        if (validCols.has("nguoi_cap_nhat")) {
          insertCols.push("nguoi_cap_nhat");
          insertVals.push(`$${paramIndex}::bigint`);
          params.push(uid);
          paramIndex += 1;
        }

        insertCols.push("geom");
        insertVals.push(`ST_SetSRID(ST_GeomFromGeoJSON($${paramIndex}), 4326)`);
        params.push(JSON.stringify(geometry));

        const sql = `
          INSERT INTO public.${table} (${insertCols.join(", ")})
          VALUES (${insertVals.join(", ")})
        `;

        await client.query(sql, params);
        imported += 1;
      }

      await client.query("COMMIT");

      return res.json({
        ok: true,
        imported,
        message: `Đã nhập ${imported} bản ghi vào lớp ${meta.label || layer}`,
      });
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch (_) {}

      console.error("IMPORT_FEATURES_ERROR:", e);
      return res.status(500).json({
        message: e.message || "Lỗi nhập dữ liệu từ file",
      });
    } finally {
      client.release();
    }
  },
);

module.exports = router;
