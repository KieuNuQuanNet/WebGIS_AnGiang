const config = require("./config");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { createProxyMiddleware } = require("http-proxy-middleware");
const path = require("path");
const fs = require("fs");
const app = express();

app.use("/myproxy", (req, res, next) => {
  const url = (req.originalUrl || "").toLowerCase();

  const laWmsTheoPath = url.includes("/wms");
  const laWmsTheoQuery = url.includes("service=wms");

  if (!laWmsTheoPath && !laWmsTheoQuery) {
    return res.status(403).json({
      ok: false,
      message: "/myproxy chỉ cho phép WMS công khai",
    });
  }

  next();
});

app.use(
  "/myproxy",
  createProxyMiddleware({
    target: config.GEOSERVER_BASE_URL,
    changeOrigin: true,
    pathRewrite: { "^/myproxy": "" },
    logLevel: "warn",
  }),
);

app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || config.CORS_ORIGINS.includes(origin))
        return cb(null, true);
      return cb(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Action", "X-Layer"],
  }),
);

app.use(express.json({ limit: "5mb" }));
app.use(
  express.text({
    type: ["application/xml", "text/xml", "application/*+xml"],
    limit: "5mb",
  }),
);
const authRoutes = require("./routes/auth");
const proxyRoutes = require("./routes/proxy");
const adminRoutes = require("./routes/admin");

app.use("/api", authRoutes);
app.use("/api", proxyRoutes);
app.use("/api/admin", adminRoutes);
app.use((err, req, res, next) => {
  console.error("GLOBAL_ERROR:", err.stack);
  res.status(err.status || 500).json({
    ok: false,
    message: err.message || "Đã có lỗi hệ thống xảy ra",
  });
});
const resourceImagesDir = path.join(__dirname, "..", "images_resources");
if (!fs.existsSync(resourceImagesDir)) {
  fs.mkdirSync(resourceImagesDir, { recursive: true });
}
app.use("/images_resources", express.static(resourceImagesDir));
app.listen(config.PORT, () => {
  console.log(`API running at http://localhost:${config.PORT}`);
});
