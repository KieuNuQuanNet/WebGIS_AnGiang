// backend/server.js
require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { createProxyMiddleware } = require("http-proxy-middleware");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { pool } = require("./db");

const app = express();
console.log("✅ RUNNING FILE:", __filename);
app.set("trust proxy", 1);
app.use(helmet());

// ✅ Nhận JSON cho login/register/admin
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ✅ Nhận XML raw body cho WFS-T
app.use(
  express.text({
    type: ["application/xml", "text/xml", "application/*+xml"],
    limit: "5mb",
  }),
);

// ===== CORS: cho phép cả localhost và 127.0.0.1 (và có thể cấu hình thêm bằng env) =====
const allowedOrigins = new Set(
  (
    process.env.CORS_ORIGINS ||
    process.env.CORS_ORIGIN ||
    "http://localhost:5500,http://127.0.0.1:5500"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, true);
      return cb(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Action", "X-Layer"],
  }),
);

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

// ===== Helpers RBAC =====
async function logLoginAttempt({
  req,
  userId = null,
  email = null,
  success,
  reason = null,
}) {
  try {
    const ua = (req.headers["user-agent"] || "").toString().slice(0, 500);
    const ipRaw = (req.headers["x-forwarded-for"] || req.ip || "").toString();
    const ip = ipRaw.split(",")[0].trim().slice(0, 80);

    await pool.query(
      `INSERT INTO public.lich_su_dang_nhap
        (tai_khoan_id, email, thanh_cong, ly_do, ip, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [userId, email, !!success, reason, ip, ua],
    );
  } catch (e) {
    // log không được thì bỏ qua, không làm hỏng login
    console.error("LOGIN_LOG_ERROR:", e.message);
  }
}
async function getUserRolesPermsByEmail(email) {
  const sql = `
    SELECT
      tk.id,
      tk.ho_ten,
      tk.email,
      tk.trang_thai,
      tk.mat_khau_hash,
      COALESCE(array_agg(DISTINCT vt.ma) FILTER (WHERE vt.ma IS NOT NULL), '{}') AS roles,
      COALESCE(array_agg(DISTINCT q.ma)  FILTER (WHERE q.ma  IS NOT NULL), '{}') AS permissions
    FROM public.tai_khoan tk
    LEFT JOIN public.tai_khoan_vai_tro tkvt ON tkvt.tai_khoan_id = tk.id
    LEFT JOIN public.vai_tro vt            ON vt.id = tkvt.vai_tro_id
    LEFT JOIN public.vai_tro_quyen vtq     ON vtq.vai_tro_id = vt.id
    LEFT JOIN public.quyen q               ON q.id = vtq.quyen_id
    WHERE tk.email = $1
    GROUP BY tk.id;
  `;
  const { rows } = await pool.query(sql, [email]);
  return rows[0] || null;
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
    },
    JWT_SECRET,
    { expiresIn: "8h" },
  );
}

function authRequired(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Missing token" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid/expired token" });
  }
}

function requirePerm(code) {
  return (req, res, next) => {
    const roles = req.user?.roles || [];
    const perms = req.user?.permissions || [];
    if (roles.includes("admin") || perms.includes(code)) return next();
    return res.status(403).json({ message: "Forbidden" });
  };
}

// ===== AUTH =====
app.post("/api/register", async (req, res) => {
  try {
    const { ho_ten, email, mat_khau } = req.body || {};
    if (!ho_ten || !email || !mat_khau)
      return res.status(400).json({ message: "Thiếu dữ liệu" });

    const hash = await bcrypt.hash(mat_khau, 10);

    const insertSql = `
      INSERT INTO public.tai_khoan (ho_ten, email, mat_khau_hash, trang_thai)
      VALUES ($1, $2, $3, 'cho_duyet')
      RETURNING id, ho_ten, email, trang_thai;
    `;
    const { rows } = await pool.query(insertSql, [ho_ten, email, hash]);

    // Tự gán role guest (để admin chỉ cần duyệt)
    await pool.query(
      `INSERT INTO public.tai_khoan_vai_tro(tai_khoan_id, vai_tro_id)
       SELECT $1, id FROM public.vai_tro WHERE ma='guest'
       ON CONFLICT DO NOTHING`,
      [rows[0].id],
    );

    return res.json({
      ok: true,
      message: "Đăng ký thành công. Vui lòng chờ Admin duyệt.",
      user: rows[0],
    });
  } catch (e) {
    if (e.code === "23505" || String(e).includes("duplicate key")) {
      return res
        .status(409)
        .json({ message: "Email đã tồn tại", detail: e.detail, code: e.code });
    }
    console.error("REGISTER_ERROR:", e);
    return res.status(500).json({
      message: "Server error",
      detail: e.message,
      code: e.code || null,
    });
  }
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body || {};

  try {
    if (!username || !password) {
      await logLoginAttempt({
        req,
        email: username || null,
        success: false,
        reason: "missing_fields",
      });
      return res.status(400).json({ message: "Thiếu dữ liệu" });
    }

    const user = await getUserRolesPermsByEmail(username);
    if (!user) {
      await logLoginAttempt({
        req,
        email: username,
        success: false,
        reason: "user_not_found",
      });
      return res.status(401).json({ message: "Sai tài khoản hoặc mật khẩu" });
    }

    if (user.trang_thai !== "hoat_dong") {
      await logLoginAttempt({
        req,
        userId: user.id,
        email: user.email,
        success: false,
        reason: "not_active",
      });
      return res
        .status(403)
        .json({ message: "Tài khoản chưa được duyệt hoặc đã bị khóa" });
    }

    const ok = await bcrypt.compare(password, user.mat_khau_hash || "");
    if (!ok) {
      await logLoginAttempt({
        req,
        userId: user.id,
        email: user.email,
        success: false,
        reason: "wrong_password",
      });
      return res.status(401).json({ message: "Sai tài khoản hoặc mật khẩu" });
    }

    // ✅ Login thành công
    await logLoginAttempt({
      req,
      userId: user.id,
      email: user.email,
      success: true,
      reason: null,
    });

    const token = signToken(user);
    return res.json({
      ok: true,
      token,
      ho_ten: user.ho_ten,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
    });
  } catch (e) {
    await logLoginAttempt({
      req,
      email: username || null,
      success: false,
      reason: "server_error",
    });
    console.error("LOGIN_ERROR:", e);
    return res.status(500).json({ message: "Server error", detail: e.message });
  }
});

app.get("/api/me", authRequired, (req, res) =>
  res.json({ ok: true, user: req.user }),
);

// ===== WFS-T Proxy =====
const ALLOWED = new Set(
  (process.env.ALLOWED_LAYERS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

function validateWfstRequest(req, res, next) {
  const action = (req.headers["x-action"] || "").toString().toLowerCase(); // insert|update|delete
  const layer = (req.headers["x-layer"] || "").toString();

  if (!["insert", "update", "delete"].includes(action)) {
    return res
      .status(400)
      .json({ message: "X-Action phải là insert|update|delete" });
  }
  if (!layer || (ALLOWED.size > 0 && !ALLOWED.has(layer))) {
    return res
      .status(400)
      .json({ message: "Layer không hợp lệ hoặc không được phép" });
  }

  const xml = typeof req.body === "string" ? req.body.trim() : "";
  if (!xml || !xml.includes("<wfs:Transaction") || xml.length < 50) {
    return res.status(400).json({ message: "Body XML không hợp lệ" });
  }

  if (action === "insert" && !xml.includes("<wfs:Insert"))
    return res.status(400).json({ message: "XML không phải Insert" });
  if (action === "update" && !xml.includes("<wfs:Update"))
    return res.status(400).json({ message: "XML không phải Update" });
  if (action === "delete" && !xml.includes("<wfs:Delete"))
    return res.status(400).json({ message: "XML không phải Delete" });

  req.wfst = { action, layer, xml };
  next();
}

function permForAction(action) {
  if (action === "insert") return "feature.insert";
  if (action === "update") return "feature.update";
  return "feature.delete";
}

app.post("/api/wfst", authRequired, validateWfstRequest, async (req, res) => {
  try {
    const { action, xml } = req.wfst;
    const need = permForAction(action);

    const roles = req.user?.roles || [];
    const perms = req.user?.permissions || [];
    if (!roles.includes("admin") && !perms.includes(need)) {
      return res.status(403).json({ message: "Không đủ quyền" });
    }

    const basic = Buffer.from(
      `${process.env.GEOSERVER_USER}:${process.env.GEOSERVER_PASS}`,
    ).toString("base64");
    const r = await fetch(process.env.GEOSERVER_OWS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/xml", Authorization: `Basic ${basic}` },
      body: xml,
    });

    const text = await r.text();
    return res.status(r.status).send(text);
  } catch (e) {
    console.error("WFST_PROXY_ERROR:", e);
    return res.status(500).json({ message: "Proxy error", detail: e.message });
  }
});

app.get(
  "/api/admin/roles",
  authRequired,
  requirePerm("admin.users"),
  async (req, res) => {
    const { rows } = await pool.query(
      "SELECT id, ma, ten FROM public.vai_tro ORDER BY id ASC",
    );
    return res.json(rows);
  },
);

app.get(
  "/api/admin/users",
  authRequired,
  requirePerm("admin.users"),
  async (req, res) => {
    const sql = `
    SELECT
      tk.id, tk.ho_ten, tk.email, tk.trang_thai, tk.created_at,
      COALESCE(array_agg(DISTINCT vt.ma) FILTER (WHERE vt.ma IS NOT NULL), '{}') AS roles
    FROM public.tai_khoan tk
    LEFT JOIN public.tai_khoan_vai_tro tkvt ON tkvt.tai_khoan_id = tk.id
    LEFT JOIN public.vai_tro vt ON vt.id = tkvt.vai_tro_id
    GROUP BY tk.id
    ORDER BY tk.id ASC;
  `;
    const { rows } = await pool.query(sql);
    return res.json(rows);
  },
);

app.patch(
  "/api/admin/users/:id/status",
  authRequired,
  requirePerm("admin.users"),
  async (req, res) => {
    const id = Number(req.params.id);
    const { trang_thai } = req.body || {};
    if (!["cho_duyet", "hoat_dong", "khoa"].includes(trang_thai)) {
      return res.status(400).json({ message: "trang_thai không hợp lệ" });
    }

    const { rows } = await pool.query(
      "UPDATE public.tai_khoan SET trang_thai=$2 WHERE id=$1 RETURNING id, email, trang_thai",
      [id, trang_thai],
    );
    return res.json({ ok: true, user: rows[0] });
  },
);

app.put(
  "/api/admin/users/:id/roles",
  authRequired,
  requirePerm("admin.users"),
  async (req, res) => {
    const id = Number(req.params.id);
    const roles = (req.body?.roles || []).map(String);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "DELETE FROM public.tai_khoan_vai_tro WHERE tai_khoan_id=$1",
        [id],
      );

      if (roles.length) {
        const r = await client.query(
          "SELECT id, ma FROM public.vai_tro WHERE ma = ANY($1::text[])",
          [roles],
        );
        for (const row of r.rows) {
          await client.query(
            "INSERT INTO public.tai_khoan_vai_tro(tai_khoan_id, vai_tro_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
            [id, row.id],
          );
        }
      }

      await client.query("COMMIT");
      return res.json({ ok: true });
    } catch (e) {
      await client.query("ROLLBACK");
      return res
        .status(500)
        .json({ message: "Server error", detail: e.message });
    } finally {
      client.release();
    }
  },
);

app.delete(
  "/api/admin/users/:id",
  authRequired,
  requirePerm("admin.users"),
  async (req, res) => {
    const id = Number(req.params.id);
    if (req.user?.sub === id)
      return res
        .status(400)
        .json({ message: "Không thể tự xóa tài khoản đang đăng nhập" });

    await pool.query("DELETE FROM public.tai_khoan WHERE id=$1", [id]);
    return res.json({ ok: true });
  },
);
app.get(
  "/api/admin/layers",
  authRequired,
  requirePerm("admin.users"),
  (req, res) => {
    const items = Object.keys(LAYER_META).map((layer) => ({
      layer,
      table: LAYER_META[layer].table,
    }));
    res.json(items);
  },
);
app.get(
  "/api/admin/layer-objects",
  authRequired,
  requirePerm("admin.users"),
  async (req, res) => {
    try {
      const layer = String(req.query.layer || "");
      const meta = LAYER_META[layer];
      if (!meta) return res.status(400).json({ message: "Layer không hợp lệ" });

      const table = meta.table;
      const q = String(req.query.q || "").trim();
      const status = String(req.query.status || "all").trim(); // all|nhap|cho_duyet|da_duyet|cong_bo|tu_choi
      const limit = Math.min(Number(req.query.limit || 50), 200);
      const page = Math.max(Number(req.query.page || 1), 1);
      const offset = (page - 1) * limit;

      const labelCol = await pickLabelColumn(table);

      const where = [];
      const params = [];

      if (status !== "all") {
        params.push(status);
        where.push(`t.trang_thai_du_lieu = $${params.length}`);
      }
      if (q && labelCol) {
        params.push(`%${q}%`);
        where.push(`CAST(t.${labelCol} AS TEXT) ILIKE $${params.length}`);
      }

      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

      // total
      const countSql = `SELECT COUNT(*)::int AS total FROM public.${table} t ${whereSql};`;
      const countRes = await pool.query(countSql, params);
      const total = countRes.rows[0]?.total || 0;

      // items
      params.push(limit);
      params.push(offset);

      const selectLabel = labelCol
        ? `t.${labelCol} AS ten`
        : `NULL::text AS ten`;

      const sql = `
        SELECT
          t.id,
          ${selectLabel},
          t.trang_thai_du_lieu,
          t.ngay_tao, t.nguoi_tao,
          t.ngay_cap_nhat, t.nguoi_cap_nhat,
          t.ngay_phe_duyet, t.nguoi_phe_duyet,
          t.ngay_cong_bo, t.nguoi_cong_bo,
          t.ly_do_tu_choi,
          u1.ho_ten AS ten_nguoi_tao,
          u2.ho_ten AS ten_nguoi_cap_nhat,
          u3.ho_ten AS ten_nguoi_phe_duyet,
          u4.ho_ten AS ten_nguoi_cong_bo
        FROM public.${table} t
        LEFT JOIN public.tai_khoan u1 ON u1.id = t.nguoi_tao
        LEFT JOIN public.tai_khoan u2 ON u2.id = t.nguoi_cap_nhat
        LEFT JOIN public.tai_khoan u3 ON u3.id = t.nguoi_phe_duyet
        LEFT JOIN public.tai_khoan u4 ON u4.id = t.nguoi_cong_bo
        ${whereSql}
        ORDER BY COALESCE(t.ngay_cong_bo, t.ngay_phe_duyet, t.ngay_cap_nhat, t.ngay_tao) DESC NULLS LAST
        LIMIT $${params.length - 1} OFFSET $${params.length};
      `;

      const { rows } = await pool.query(sql, params);
      return res.json({
        layer,
        table,
        labelCol,
        page,
        limit,
        total,
        items: rows,
      });
    } catch (e) {
      console.error(e);
      return res
        .status(500)
        .json({ message: "Lỗi lấy danh sách đối tượng", detail: e.message });
    }
  },
);
app.patch(
  "/api/admin/layer-objects/stage",
  authRequired,
  requirePerm("admin.users"),
  async (req, res) => {
    try {
      const { layer, ids, stage, reason } = req.body || {};
      const meta = LAYER_META[layer];
      if (!meta) return res.status(400).json({ message: "Layer không hợp lệ" });

      const table = meta.table;
      const userId = req.user.sub;

      if (!Array.isArray(ids) || ids.length === 0)
        return res.status(400).json({ message: "Thiếu ids" });

      const map = {
        nhap: {
          status: "nhap",
          set: "nguoi_tao=$2, ngay_tao=COALESCE(ngay_tao, now()), ly_do_tu_choi=NULL",
        },
        cho_duyet: {
          status: "cho_duyet",
          set: "nguoi_cap_nhat=$2, ngay_cap_nhat=now(), ly_do_tu_choi=NULL",
        },
        da_duyet: {
          status: "da_duyet",
          set: "nguoi_phe_duyet=$2, ngay_phe_duyet=now(), ly_do_tu_choi=NULL",
        },
        cong_bo: {
          status: "cong_bo",
          set: "nguoi_cong_bo=$2, ngay_cong_bo=now()",
        },
        tu_choi: {
          status: "tu_choi",
          set: "nguoi_phe_duyet=$2, ngay_phe_duyet=now(), ly_do_tu_choi=$3",
        },
      };

      if (!map[stage])
        return res.status(400).json({ message: "stage không hợp lệ" });

      const placeholders = ids.map((_, i) => `$${i + 4}`).join(",");
      const sql = `
        UPDATE public.${table}
        SET trang_thai_du_lieu='${map[stage].status}', ${map[stage].set}
        WHERE id IN (${placeholders})
        RETURNING id, trang_thai_du_lieu;
      `;
      const params = [layer, userId, reason || null, ...ids];
      const { rows } = await pool.query(sql, params);

      return res.json({ ok: true, updated: rows.length, rows });
    } catch (e) {
      console.error(e);
      return res
        .status(500)
        .json({ message: "Lỗi cập nhật trạng thái", detail: e.message });
    }
  },
);
/**************************************************
 * WORKFLOW + LỊCH SỬ CẬP NHẬT (DÙNG CHUNG MỌI LỚP)
 **************************************************/

// 1) Map layer (GeoServer) -> table (Postgres)
const LAYER_TABLE_MAP = {
  "webgis_angiang:rung": "rung",
  "webgis_angiang:dat": "dat",
  "webgis_angiang:khoangsan_diem_mo": "khoangsan_diem_mo",
  "webgis_angiang:thucvat_ag": "thucvat_ag",
  "webgis_angiang:dongvat_ag": "dongvat_ag",
  "webgis_angiang:waterways": "waterways",
  "webgis_angiang:go": "go",
};

// 2) Admin xem lịch sử theo layer (feature-level)
app.get(
  "/api/admin/history",
  authRequired,
  requirePerm("admin.users"),
  async (req, res) => {
    try {
      const { layer } = req.query;
      const table = layer ? LAYER_TABLE_MAP[layer] : null;
      if (!table) {
        return res
          .status(400)
          .json({ message: "Thiếu hoặc sai ?layer=workspace:layer" });
      }

      const q = `
        SELECT
          t.id,
          t.trang_thai_du_lieu,
          t.ngay_tao, t.nguoi_tao,
          t.ngay_cap_nhat, t.nguoi_cap_nhat,
          t.ngay_phe_duyet, t.nguoi_phe_duyet,
          t.ngay_cong_bo, t.nguoi_cong_bo,
          t.ly_do_tu_choi,

          u1.ho_ten AS ten_nguoi_tao,
          u2.ho_ten AS ten_nguoi_cap_nhat,
          u3.ho_ten AS ten_nguoi_phe_duyet,
          u4.ho_ten AS ten_nguoi_cong_bo
        FROM public.${table} t
        LEFT JOIN public.tai_khoan u1 ON u1.id = t.nguoi_tao
        LEFT JOIN public.tai_khoan u2 ON u2.id = t.nguoi_cap_nhat
        LEFT JOIN public.tai_khoan u3 ON u3.id = t.nguoi_phe_duyet
        LEFT JOIN public.tai_khoan u4 ON u4.id = t.nguoi_cong_bo
        ORDER BY COALESCE(t.ngay_cong_bo, t.ngay_phe_duyet, t.ngay_cap_nhat, t.ngay_tao) DESC NULLS LAST
        LIMIT 1000;
      `;
      const { rows } = await pool.query(q);
      return res.json(rows);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ message: "Lỗi lấy lịch sử" });
    }
  },
);

// 3) Set stage workflow (nhập/cập nhật/duyệt/công bố/từ chối)
app.patch("/api/workflow/set-stage", authRequired, async (req, res) => {
  try {
    const { layer, ids, stage, reason } = req.body || {};
    const table = LAYER_TABLE_MAP[layer];

    if (!table) return res.status(400).json({ message: "Layer không hợp lệ" });
    if (!Array.isArray(ids) || ids.length === 0)
      return res.status(400).json({ message: "Thiếu ids" });

    // ✅ ID trong token của bạn là sub (signToken dùng sub:user.id)
    const userId = req.user.sub;

    const roles = req.user?.roles || [];
    const perms = req.user?.permissions || [];
    const isAdmin = roles.includes("admin") || perms.includes("admin.users");
    const isStaff =
      isAdmin ||
      perms.includes("feature.insert") ||
      perms.includes("feature.update") ||
      perms.includes("feature.delete");

    const map = {
      nhap: {
        status: "nhap",
        set: "nguoi_tao=$2, ngay_tao=COALESCE(ngay_tao, now()), ly_do_tu_choi=NULL",
      },
      cho_duyet: {
        status: "cho_duyet",
        set: "nguoi_cap_nhat=$2, ngay_cap_nhat=now(), ly_do_tu_choi=NULL",
      },
      da_duyet: {
        status: "da_duyet",
        set: "nguoi_phe_duyet=$2, ngay_phe_duyet=now(), ly_do_tu_choi=NULL",
      },
      cong_bo: {
        status: "cong_bo",
        set: "nguoi_cong_bo=$2, ngay_cong_bo=now()",
      },
      tu_choi: {
        status: "tu_choi",
        set: "nguoi_phe_duyet=$2, ngay_phe_duyet=now(), ly_do_tu_choi=$3",
      },
    };
    if (!map[stage])
      return res.status(400).json({ message: "stage không hợp lệ" });

    if (
      (stage === "da_duyet" || stage === "cong_bo" || stage === "tu_choi") &&
      !isAdmin
    ) {
      return res
        .status(403)
        .json({ message: "Chỉ admin được duyệt/công bố/từ chối" });
    }
    if ((stage === "cap_nhat" || stage === "nhap") && !isStaff) {
      return res.status(403).json({ message: "Không đủ quyền cập nhật" });
    }

    const placeholders = ids.map((_, i) => `$${i + 4}`).join(",");
    const q = `
      UPDATE public.${table}
      SET trang_thai_du_lieu='${map[stage].status}', ${map[stage].set}
      WHERE id IN (${placeholders})
      RETURNING id, trang_thai_du_lieu;
    `;
    const params = [layer, userId, reason || null, ...ids];

    const { rows } = await pool.query(q, params);
    return res.json({ updated: rows.length, rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Lỗi workflow" });
  }
});
// ===== Start =====
app.get("/api/_ping", (req, res) => {
  res.json({ ok: true, file: __filename, time: new Date().toISOString() });
});
app.get(
  "/api/admin/resource-history",
  authRequired,
  requirePerm("admin.users"),
  async (req, res) => {
    try {
      const q = (req.query.q || "").toString().trim();
      const limit = Math.min(Number(req.query.limit || 200), 1000);

      const sql = `
        SELECT
          l.id,
          l.ten_tai_nguyen,
          l.ma_lop,
          l.trang_thai_du_lieu,
          l.ly_do_tu_choi,
          l.ngay_tao, l.nguoi_tao,
          l.ngay_cap_nhat, l.nguoi_cap_nhat,
          l.ngay_phe_duyet, l.nguoi_phe_duyet,
          l.ngay_cong_bo, l.nguoi_cong_bo,
          u1.ho_ten AS ten_nguoi_tao,
          u2.ho_ten AS ten_nguoi_cap_nhat,
          u3.ho_ten AS ten_nguoi_phe_duyet,
          u4.ho_ten AS ten_nguoi_cong_bo
        FROM public.lich_su_cap_nhat l
        LEFT JOIN public.tai_khoan u1 ON u1.id = l.nguoi_tao
        LEFT JOIN public.tai_khoan u2 ON u2.id = l.nguoi_cap_nhat
        LEFT JOIN public.tai_khoan u3 ON u3.id = l.nguoi_phe_duyet
        LEFT JOIN public.tai_khoan u4 ON u4.id = l.nguoi_cong_bo
        WHERE ($1 = '' OR l.ten_tai_nguyen ILIKE '%'||$1||'%' OR l.ma_lop ILIKE '%'||$1||'%')
        ORDER BY COALESCE(l.ngay_cong_bo, l.ngay_phe_duyet, l.ngay_cap_nhat, l.ngay_tao) DESC NULLS LAST
        LIMIT $2;
      `;
      const { rows } = await pool.query(sql, [q, limit]);
      return res.json(rows);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ message: "Lỗi lấy lịch sử cập nhật" });
    }
  },
);
app.patch(
  "/api/admin/resource-history/:id/stage",
  authRequired,
  requirePerm("admin.users"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { stage, reason } = req.body || {};
      const userId = req.user.sub;

      const map = {
        nhap: {
          status: "nhap",
          set: "nguoi_tao=$2, ngay_tao=COALESCE(ngay_tao, now())",
        },
        cho_duyet: {
          status: "cho_duyet",
          set: "nguoi_cap_nhat=$2, ngay_cap_nhat=now(), ly_do_tu_choi=NULL",
        },
        da_duyet: {
          status: "da_duyet",
          set: "nguoi_phe_duyet=$2, ngay_phe_duyet=now(), ly_do_tu_choi=NULL",
        },
        cong_bo: {
          status: "cong_bo",
          set: "nguoi_cong_bo=$2, ngay_cong_bo=now()",
        },
        tu_choi: {
          status: "tu_choi",
          set: "nguoi_phe_duyet=$2, ngay_phe_duyet=now(), ly_do_tu_choi=$3",
        },
      };

      if (!map[stage])
        return res.status(400).json({ message: "stage không hợp lệ" });

      const sql = `
        UPDATE public.lich_su_cap_nhat
        SET trang_thai_du_lieu='${map[stage].status}', ${map[stage].set}
        WHERE id=$1
        RETURNING *;
      `;
      const { rows } = await pool.query(sql, [id, userId, reason || null]);
      if (!rows[0])
        return res.status(404).json({ message: "Không tìm thấy tài nguyên" });

      return res.json({ ok: true, row: rows[0] });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ message: "Lỗi cập nhật workflow" });
    }
  },
);
// Layer -> Postgres table (chỉ cho phép các bảng này)
const LAYER_META = {
  "webgis_angiang:rung": { table: "rung" },
  "webgis_angiang:dat": { table: "dat" },
  "webgis_angiang:khoangsan_diem_mo": { table: "khoangsan_diem_mo" },
  "webgis_angiang:thucvat_ag": { table: "thucvat_ag" },
  "webgis_angiang:dongvat_ag": { table: "dongvat_ag" },
  "webgis_angiang:waterways": { table: "waterways" },
  "webgis_angiang:go": { table: "go" },
};

// Tự chọn “cột tên” để hiển thị (nếu bảng nào có)
const LABEL_CANDIDATES = [
  "ten",
  "name",
  "ten_don_vi",
  "ten_tai_nguyen",
  "ten_khoang_san",
  "loai",
  "ma",
];

async function pickLabelColumn(table) {
  const { rows } = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1`,
    [table],
  );
  const cols = new Set(rows.map((r) => r.column_name));
  const found = LABEL_CANDIDATES.find((c) => cols.has(c));
  return found || null; // null => chỉ hiển thị ID
}
app.listen(process.env.PORT || 3000, () => {
  console.log(`✅ API running at http://localhost:${process.env.PORT || 3000}`);
});
