// cấu hình phần đăng nhập
const API_BASE = window.WEBGIS_API_BASE || "";

const frmLogin = document.getElementById("frmLogin");
const frmRegister = document.getElementById("frmRegister");
const loginMsg = document.getElementById("loginMsg");
const registerMsg = document.getElementById("registerMsg");
const brandLogoImage = document.getElementById("brandLogoImage");
const sectionLogin = document.getElementById("sectionLogin");
const sectionRegister = document.getElementById("sectionRegister");
const btnShowRegister = document.getElementById("btnShowRegister");
const btnShowLogin = document.getElementById("btnShowLogin");
const authTitle = document.getElementById("authTitle");

// hiển thị thông báo
function showMsg(target, message, type = "error") {
  if (!target) return;
  target.classList.remove("hidden", "msg-error", "msg-success");
  target.classList.add(type === "success" ? "msg-success" : "msg-error");
  target.textContent = message;
}

function hideMsg(target) {
  if (!target) return;
  target.classList.add("hidden");
  target.textContent = "";
}

function moSection(section) {
  const laDangKy = section === "register";
  sectionLogin?.classList.toggle("active", !laDangKy);
  sectionRegister?.classList.toggle("active", laDangKy);

  if (authTitle) {
    authTitle.textContent = laDangKy ? "TẠO TÀI KHOẢN" : "ĐĂNG NHẬP HỆ THỐNG";
  }

  hideMsg(loginMsg);
  hideMsg(registerMsg);
}

brandLogoImage?.addEventListener("error", () => {
  brandLogoImage.classList.add("hidden");
});

btnShowRegister?.addEventListener("click", () => moSection("register"));
btnShowLogin?.addEventListener("click", () => moSection("login"));

// xử lý token email
const qs = new URLSearchParams(window.location.search);
const verifyToken = qs.get("verify");

if (!verifyToken && localStorage.getItem("webgis_token")) {
  window.location.href = "index.html";
}

(async function handleVerify() {
  if (!verifyToken) return;

  try {
    const r = await fetch(
      `${API_BASE}/api/xac-nhan-email?token=${encodeURIComponent(verifyToken)}`,
    );
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw new Error(data.message || "Xác nhận email thất bại");
    }

<<<<<<< HEAD
    moSection("login");
    showToast(data.message || "Xác nhận email thành công!", "success");
    showMsg(
      loginMsg,
      "Email đã được xác nhận. Bạn có thể đăng nhập sau khi quản trị viên phê duyệt.",
      "success",
    );
=======
    showToast(data.message || "Xác nhận email thành công!", "success");
    gotoLogin();
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
  } catch (e) {
    moSection("login");
    showMsg(loginMsg, e.message || "Xác nhận email thất bại");
  } finally {
    window.history.replaceState({}, "", "login.html");
  }
})();

<<<<<<< HEAD
//  form đăng nhập
=======
// Toggle
btnToRegister?.addEventListener("click", (e) => {
  e.preventDefault?.();
  gotoRegister();
});

btnToLogin?.addEventListener("click", (e) => {
  e.preventDefault?.();
  gotoLogin();
});

// REGISTER
frmRegister?.addEventListener("submit", async (e) => {
  e.preventDefault();
  hide(successMsg);
  hide(errorRegMsg);

  const ho_ten = document.getElementById("regName")?.value.trim() || "";
  const email = document.getElementById("regEmail")?.value.trim() || "";
  const mat_khau = document.getElementById("regPass")?.value || "";
  const mat_khau2 = document.getElementById("regPassConfirm")?.value || "";
  const btn = document.getElementById("btnRegSubmit");

  if (mat_khau !== mat_khau2) {
    show(errorRegMsg, "❌ Mật khẩu nhập lại không khớp!");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = "⏳ Đang xử lý...";
  }

  try {
    const r = await fetch(`${API_BASE}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ho_ten, email, mat_khau }),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = [data.message, data.detail, data.code]
        .filter(Boolean)
        .join(" — ");
      throw new Error(msg || "Lỗi đăng ký");
    }

    showToast(data.message || "Đăng ký thành công!", "success");
    frmRegister.reset();

    setTimeout(() => {
      hide(successMsg);
      gotoLogin();
    }, 1200);
  } catch (err) {
    show(errorRegMsg, "❌ " + (err.message || err));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = "Đăng ký";
    }
  }
});

// LOGIN
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
frmLogin?.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMsg(loginMsg);

  const username = document.getElementById("loginUser")?.value.trim() || "";
  const password = document.getElementById("loginPass")?.value || "";
  const btn = document.getElementById("btnLoginSubmit");

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Đang đăng nhập...";
  }

  try {
    const r = await fetch(`${API_BASE}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await r.json().catch(() => ({}));
<<<<<<< HEAD
    if (!r.ok) {
      throw new Error(data.message || "Sai tài khoản hoặc mật khẩu!");
    }

=======

    // 🛡️ THÊM ĐOẠN KIỂM TRA LỖI NÀY:
    if (!r.ok) {
      throw new Error(data.message || "Sai tài khoản hoặc mật khẩu!");
    }

    // Chỉ khi đăng nhập thành công mới chạy tiếp các dòng dưới đây
>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
    localStorage.setItem("webgis_token", data.token);
    localStorage.setItem("webgis_roles", JSON.stringify(data.roles || []));
    localStorage.setItem(
      "webgis_permissions",
      JSON.stringify(data.permissions || []),
    );
    localStorage.setItem("webgis_user", data.ho_ten || "");

<<<<<<< HEAD
=======
    // compat role cũ
    const roles = (data.roles || []).map((x) => (x || "").trim().toLowerCase());
    const mainRole =
      roles.includes("admin") || roles.includes("quan_tri")
        ? "admin"
        : roles.includes("can_bo")
          ? "can_bo"
          : "guest";
    localStorage.setItem("webgis_role", mainRole);

>>>>>>> 08fe1accd45adf68f381579099e0c7fec0a7d091
    window.location.href = "index.html";
  } catch (err) {
    showMsg(loginMsg, err.message || "Đăng nhập thất bại");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Đăng nhập";
    }
  }
});

// tạo tài khoan form
frmRegister?.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMsg(registerMsg);

  const hoTen = document.getElementById("registerName")?.value.trim() || "";
  const email = document.getElementById("registerEmail")?.value.trim() || "";
  const pass = document.getElementById("registerPass")?.value || "";
  const pass2 = document.getElementById("registerPass2")?.value || "";
  const btn = document.getElementById("btnRegisterSubmit");

  if (!hoTen || !email || !pass) {
    showMsg(registerMsg, "Vui lòng nhập đầy đủ thông tin");
    return;
  }

  if (pass.length < 6) {
    showMsg(registerMsg, "Mật khẩu phải có ít nhất 6 ký tự");
    return;
  }

  if (pass !== pass2) {
    showMsg(registerMsg, "Nhập lại mật khẩu chưa khớp");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Đang tạo tài khoản...";
  }

  try {
    const r = await fetch(`${API_BASE}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ho_ten: hoTen,
        email,
        mat_khau: pass,
      }),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw new Error(data.message || "Tạo tài khoản thất bại");
    }

    frmRegister.reset();
    showMsg(
      registerMsg,
      data.message ||
        "Đăng ký thành công. Hãy xác nhận email và chờ quản trị viên duyệt.",
      "success",
    );
  } catch (err) {
    showMsg(registerMsg, err.message || "Tạo tài khoản thất bại");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Tạo tài khoản";
    }
  }
});
