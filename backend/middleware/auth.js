<<<<<<< HEAD
// Auth middleware - xac thuc JWT
const jwt = require("jsonwebtoken");
const config = require("../config");

async function authenticateToken(req, res, next) {
=======
const jwt = require("jsonwebtoken");
const config = require("../config");
const crypto = require("crypto");
async function authenticateToken(req, res, next) {
  const { pool } = require("../db"); // Thêm import db
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Missing token" });

  try {
<<<<<<< HEAD
=======
    // 1. Kiểm tra Token có nằm trong danh sách đen không
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const { rows } = await pool.query(
      "SELECT 1 FROM public.token_blacklist WHERE token_hash = $1",
      [tokenHash],
    );
    if (rows.length > 0) {
      return res
        .status(401)
        .json({ message: "Token has been revoked (logged out)" });
    }

    // 2. Nếu không nằm trong danh sách đen -> Verify JWT như bình thường
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
    req.user = jwt.verify(token, config.JWT_SECRET);
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid/expired token" });
  }
}

<<<<<<< HEAD
// Auth middleware - kiem tra quyen theo route
function requirePerm(code) {
  return (req, res, next) => {
    const roles = (req.user?.roles || []).map((r) =>
      String(r || "").toLowerCase(),
    );
    const perms = (req.user?.permissions || []).map((p) =>
      String(p || "").toLowerCase(),
    );
    const adminCodes = ["admin", "quan_tri", "administrator"];

    if (
      roles.some((r) => adminCodes.includes(r)) ||
      perms.includes(String(code || "").toLowerCase())
    ) {
      return next();
    }

=======
function requirePerm(code) {
  return (req, res, next) => {
    const roles = req.user?.roles || [];
    const perms = req.user?.permissions || [];
    if (roles.includes("admin") || perms.includes(code)) return next();
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
    return res.status(403).json({ message: "Forbidden" });
  };
}

module.exports = { authenticateToken, requirePerm };
