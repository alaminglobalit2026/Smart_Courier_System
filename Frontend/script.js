
document.addEventListener("DOMContentLoaded", () => {
  const $ = id => document.getElementById(id);

  // =====================================
  // API CONFIGURATION
  // =====================================
  const API_BASE = "https://smart-courier-system.onrender.com";
  const TOKEN_KEY = "smartcourier_admin_token";

  let token = sessionStorage.getItem(TOKEN_KEY) || "";

  let parcels = [];
  let drivers = [];
  let editingParcelId = null;
  let editingDriverId = null;

  const notificationDefaults = {
    smsEnabled: false,
    emailEnabled: false,
    smsProvider: "twilio",
    emailProvider: "sendgrid",
    notifyPending: true,
    notifyTransit: true,
    notifyDelivered: true,
    notifyFailed: true
  };

  let notificationSettings = {
    ...notificationDefaults,
    ...readStore("smartcourier_notifications_v1", {})
  };

  // =====================================
  // COMMON FUNCTIONS
  // =====================================
  function readStore(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch {
      return fallback;
    }
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);
  }

  function initials(name) {
    return String(name || "?")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(x => x[0])
      .join("")
      .toUpperCase();
  }

  function imageUrl(url) {
    if (!url) return "";

    try {
      const parsed = new URL(url);

      return ["https:", "http:"].includes(parsed.protocol)
        ? esc(url)
        : "";
    } catch {
      return "";
    }
  }

  function toast(message) {
    const el = $("toast");

    if (!el) {
      alert(message);
      return;
    }

    el.textContent = message;
    el.classList.add("show");

    clearTimeout(toast.timer);

    toast.timer = setTimeout(() => {
      el.classList.remove("show");
    }, 3000);
  }

  function bind(id, event, callback) {
    const element = $(id);

    if (element) {
      element.addEventListener(event, callback);
    }
  }

  function statusLabel(status) {
    const labels = {
      pending: "Pending",
      picked_up: "Picked Up",
      in_transit: "In Transit",
      out_for_delivery: "Out for Delivery",
      delivered: "Delivered",
      cancelled: "Cancelled"
    };

    return labels[status] || status || "Unknown";
  }

  function statusClass(status) {
    return "status-" + String(statusLabel(status))
      .toLowerCase()
      .replace(/\s+/g, "-");
  }

  function badge(status) {
    return `
      <span class="status-badge ${statusClass(status)}">
        ${esc(statusLabel(status))}
      </span>
    `;
  }

  function dateFormat(date) {
    return date ? new Date(date).toLocaleDateString() : "—";
  }

  // =====================================
  // API REQUEST
  // Supports JSON and FormData
  // =====================================
  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const isFormData =
      typeof FormData !== "undefined" &&
      options.body instanceof FormData;

    if (options.body && !isFormData) {
      headers["Content-Type"] = "application/json";
    }

    if (isFormData) {
      delete headers["Content-Type"];
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers
    });

    let data = {};

    try {
      data = await response.json();
    } catch {
      throw new Error("Invalid server response.");
    }

    if (response.status === 401) {
      logout(false);
      throw new Error("Session expired. Please login again.");
    }

    if (!response.ok || data.success === false) {
      throw new Error(data.message || "Server request failed.");
    }

    return data;
  }

  // =====================================
  // MODALS
  // =====================================
  function openModal(id) {
    if ($(id)) {
      $(id).classList.add("open");
    }
  }

  function closeModal(id) {
    if ($(id)) {
      $(id).classList.remove("open");
    }
  }

  document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click", () => {
      closeModal(button.dataset.close);
    });
  });

  document.querySelectorAll(".modal-backdrop").forEach(backdrop => {
    backdrop.addEventListener("click", e => {
      if (e.target === backdrop) {
        closeModal(backdrop.id);
      }
    });
  });

  // =====================================
  // IMAGE PREVIEW
  // =====================================
  function previewImage(inputId, previewId) {
    const input = $(inputId);
    const preview = $(previewId);

    if (!input || !preview) return;

    input.addEventListener("change", () => {
      const file = input.files?.[0];

      if (!file) {
        preview.removeAttribute("src");
        preview.style.display = "none";
        return;
      }

      if (!file.type.startsWith("image/")) {
        toast("Please select an image file.");
        input.value = "";
        preview.style.display = "none";
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast("Image size must be 5 MB or less.");
        input.value = "";
        preview.style.display = "none";
        return;
      }

      const reader = new FileReader();

      reader.onload = () => {
        preview.src = reader.result;
        preview.style.display = "block";
      };

      reader.readAsDataURL(file);
    });
  }

  previewImage("productImage", "productImagePreview");
  previewImage("driverProfileImage", "driverImagePreview");

  function resetPreview(inputId, previewId) {
    if ($(inputId)) {
      $(inputId).value = "";
    }

    if ($(previewId)) {
      $(previewId).removeAttribute("src");
      $(previewId).style.display = "none";
    }
  }

  // =====================================
  // ADMIN LOGIN AND SCREEN CONTROL
  // =====================================
  function showApp() {
    if ($("loginScreen")) {
      $("loginScreen").style.display = "none";
    }

    if ($("appShell")) {
      $("appShell").style.display = "block";
    }

    document.documentElement.classList.add("auth-ready");
  }

  function showLogin() {
    if ($("loginScreen")) {
      $("loginScreen").style.display = "flex";
    }

    if ($("appShell")) {
      $("appShell").style.display = "none";
    }

    document.documentElement.classList.add("auth-ready");
  }

  function logout(showMessage = true) {
    sessionStorage.removeItem(TOKEN_KEY);
    token = "";

    closeSidebar();
    showLogin();

    if (showMessage) {
      toast("Logged out successfully.");
    }
  }

  bind("adminLoginForm", "submit", async e => {
    e.preventDefault();

    const email = $("adminEmail")?.value.trim();
    const password = $("adminPassword")?.value;

    const errorElement = $("loginError");
    const button = $("adminLoginBtn");

    if (!email || !password) {
      if (errorElement) {
        errorElement.textContent = "Enter email and password.";
      }
      return;
    }

    try {
      if (button) {
        button.disabled = true;
        button.textContent = "Logging in...";
      }

      if (errorElement) {
        errorElement.textContent = "";
      }

      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Login failed.");
      }

      if (data.user.role !== "admin") {
        throw new Error("This account is not an Admin account.");
      }

      token = data.token;

      sessionStorage.setItem(TOKEN_KEY, token);

      if ($("sidebarAdminName")) {
        $("sidebarAdminName").textContent = data.user.name;
      }

      if ($("topAdminName")) {
        $("topAdminName").textContent = data.user.name;
      }

      showApp();

      await loadAllData();

      toast("Admin login successful!");

    } catch (error) {
      if (errorElement) {
        errorElement.textContent = error.message;
      }
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Login to Dashboard";
      }
    }
  });

  bind("logoutBtn", "click", () => logout());
  bind("clearDataBtn", "click", () => logout());

  // =====================================
  // SESSION RESTORE
  // =====================================
  async function restoreSession() {
    if (!token) {
      showLogin();
      return;
    }

    try {
      const data = await api("/api/admin/dashboard");

      if ($("sidebarAdminName")) {
        $("sidebarAdminName").textContent = data.user.name;
      }

      if ($("topAdminName")) {
        $("topAdminName").textContent = data.user.name;
      }

      showApp();

      await loadAllData();

    } catch (error) {
      console.error("Session restore:", error.message);

      sessionStorage.removeItem(TOKEN_KEY);
      token = "";

      showLogin();
    }
  }

  // =====================================
  // LOAD DATABASE DATA
  // =====================================
  async function loadAllData() {
    try {
      const results = await Promise.all([
        api("/api/admin/dashboard"),
        api("/api/admin/parcels"),
        api("/api/admin/drivers")
      ]);

      const dashboard = results[0];

      parcels = results[1].parcels || [];
      drivers = results[2].drivers || [];

      if ($("sidebarAdminName")) {
        $("sidebarAdminName").textContent = dashboard.user.name;
      }

      if ($("topAdminName")) {
        $("topAdminName").textContent = dashboard.user.name;
      }

      renderAll();

      console.log("Dashboard loaded:", dashboard);
      console.log("Parcels loaded:", parcels.length);
      console.log("Drivers loaded:", drivers.length);

    } catch (error) {
      console.error("Data loading error:", error);
      toast(error.message);
    }
  }

  bind("refreshDataBtn", "click", async () => {
    await loadAllData();
    toast("Database data refreshed.");
  });

  // =====================================
  // MOBILE SIDEBAR
  // =====================================
  function openSidebar() {
    if ($("sidebar")) {
      $("sidebar").classList.add("open");
    }

    if ($("sidebarOverlay")) {
      $("sidebarOverlay").classList.add("show");
    }

    document.body.classList.add("sidebar-open");
  }

  function closeSidebar() {
    if ($("sidebar")) {
      $("sidebar").classList.remove("open");
    }

    if ($("sidebarOverlay")) {
      $("sidebarOverlay").classList.remove("show");
    }

    document.body.classList.remove("sidebar-open");
  }

  bind("mobileMenu", "click", () => {
    if ($("sidebar")?.classList.contains("open")) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  bind("sidebarOverlay", "click", closeSidebar);

  // =====================================
  // NAVIGATION
  // =====================================
  function goTo(page) {
    document.querySelectorAll(".page").forEach(p => {
      p.classList.toggle("active", p.id === page);
    });

    document.querySelectorAll(".nav-link").forEach(a => {
      a.classList.toggle("active", a.dataset.page === page);
    });

    const active = document.querySelector(
      `.nav-link[data-page="${page}"]`
    );

    if ($("breadcrumbPage")) {
      $("breadcrumbPage").textContent = active
        ? active.textContent.trim().replace(/\s+\d+$/, "")
        : "Dashboard";
    }

    closeSidebar();

    if (page === "reports") {
      renderReports();
    }
  }

  document.querySelectorAll(".nav-link").forEach(a => {
    a.addEventListener("click", e => {
      e.preventDefault();
      goTo(a.dataset.page);
    });
  });

  document.querySelectorAll("[data-goto]").forEach(button => {
    button.addEventListener("click", () => {
      goTo(button.dataset.goto);
    });
  });

  bind("helpBtn", "click", () => {
    toast("Help center will be connected in a future version.");
  });

  bind("notificationBtn", "click", () => {
    toast("You are all caught up!");
  });

  // =====================================
  // PARCEL DRIVER OPTIONS
  // =====================================
  function driverOptions() {
    if (!$("parcelDriver")) return;

    $("parcelDriver").innerHTML =
      '<option value="">Unassigned</option>' +
      drivers.map(d =>
        `<option value="${esc(d._id)}">${esc(d.name)}</option>`
      ).join("");
  }

  // =====================================
  // CREATE / EDIT PARCEL MODAL
  // =====================================
  function showParcelModal() {
    if (!$("parcelForm")) return;

    editingParcelId = null;

    $("parcelForm").reset();

    resetPreview("productImage", "productImagePreview");

    driverOptions();

    if ($("parcelDriver")) {
      $("parcelDriver").disabled = false;
    }

    if ($("parcelModalTitle")) {
      $("parcelModalTitle").textContent = "Create a shipment";
    }

    if ($("parcelModalEyebrow")) {
      $("parcelModalEyebrow").textContent = "NEW SHIPMENT";
    }

    if ($("parcelSaveBtn")) {
      $("parcelSaveBtn").textContent = "Save shipment";
    }

    if ($("trackingId")) {
      $("trackingId").value = "Auto generated";
      $("trackingId").disabled = true;
    }

    openModal("parcelModal");
  }

  function showParcelEditModal(id) {
    const p = parcels.find(item => item._id === id);

    if (!p) {
      toast("Parcel not found.");
      return;
    }

    editingParcelId = p._id;

    $("parcelForm").reset();

    resetPreview("productImage", "productImagePreview");

    driverOptions();

    if ($("trackingId")) {
      $("trackingId").value = p.trackingNumber || "";
      $("trackingId").disabled = true;
    }

    $("senderName").value = p.senderName || "";
    $("senderPhone").value = p.senderPhone || "";
    $("receiverName").value = p.receiverName || "";
    $("receiverPhone").value = p.receiverPhone || "";
    $("pickupAddress").value = p.pickupAddress || "";
    $("deliveryAddress").value = p.deliveryAddress || "";
    $("parcelDescription").value = p.parcelDescription || "";
    $("weightKg").value = p.weightKg ?? "";

    if ($("parcelDriver")) {
      $("parcelDriver").value =
        p.assignedDriver?._id || p.assignedDriver || "";

      $("parcelDriver").disabled = false;
    }

    if ($("parcelModalTitle")) {
      $("parcelModalTitle").textContent = "Edit shipment";
    }

    if ($("parcelModalEyebrow")) {
      $("parcelModalEyebrow").textContent = "UPDATE SHIPMENT";
    }

    if ($("parcelSaveBtn")) {
      $("parcelSaveBtn").textContent = "Update shipment";
    }

    if (p.productImage && $("productImagePreview")) {
      $("productImagePreview").src = p.productImage;
      $("productImagePreview").style.display = "block";
    }

    openModal("parcelModal");
  }

  document.querySelectorAll("[data-open-parcel]").forEach(button => {
    button.addEventListener("click", showParcelModal);
  });

  bind("quickAddBtn", "click", showParcelModal);

  // =====================================
  // SAVE / UPDATE PARCEL
  // =====================================
  bind("parcelForm", "submit", async e => {
    e.preventDefault();

    const button = $("parcelSaveBtn");

    try {
      const parcelData = {
        senderName: $("senderName")?.value.trim(),
        senderPhone: $("senderPhone")?.value.trim(),
        receiverName: $("receiverName")?.value.trim(),
        receiverPhone: $("receiverPhone")?.value.trim(),
        pickupAddress: $("pickupAddress")?.value.trim(),
        deliveryAddress: $("deliveryAddress")?.value.trim(),
        parcelDescription: $("parcelDescription")?.value.trim(),
        weightKg: Number($("weightKg")?.value)
      };

      const driverId = $("parcelDriver")?.value;
      const imageFile = $("productImage")?.files?.[0];

      if (
        !parcelData.senderName ||
        !parcelData.senderPhone ||
        !parcelData.receiverName ||
        !parcelData.receiverPhone ||
        !parcelData.pickupAddress ||
        !parcelData.deliveryAddress ||
        !parcelData.parcelDescription ||
        !Number.isFinite(parcelData.weightKg) ||
        parcelData.weightKg < 0.1
      ) {
        toast("Please complete all required fields. Weight must be at least 0.1 KG.");
        return;
      }

      if (button) {
        button.disabled = true;
        button.textContent = editingParcelId ? "Updating..." : "Saving...";
      }

      if (editingParcelId) {
        const currentParcel = parcels.find(p => p._id === editingParcelId);

        if (!currentParcel) {
          throw new Error("Parcel not found.");
        }

        let body = JSON.stringify(parcelData);

        if (imageFile) {
          const formData = new FormData();

          Object.entries(parcelData).forEach(([key, value]) => {
            formData.append(key, value);
          });

          formData.append("productImage", imageFile);

          body = formData;
        }

        await api(`/api/admin/parcels/${encodeURIComponent(editingParcelId)}`, {
          method: "PUT",
          body
        });

        const currentDriverId =
          currentParcel.assignedDriver?._id ||
          currentParcel.assignedDriver ||
          "";

        if (driverId !== currentDriverId) {
          if (driverId) {
            await api("/api/admin/assign-parcel", {
              method: "PUT",
              body: JSON.stringify({
                trackingNumber: currentParcel.trackingNumber,
                driverId
              })
            });
          }
        }

        editingParcelId = null;

        closeModal("parcelModal");

        $("parcelForm").reset();

        resetPreview("productImage", "productImagePreview");

        await loadAllData();

        toast("Parcel updated successfully!");

        return;
      }

      let createBody = JSON.stringify(parcelData);

      if (imageFile) {
        const formData = new FormData();

        Object.entries(parcelData).forEach(([key, value]) => {
          formData.append(key, value);
        });

        formData.append("productImage", imageFile);

        createBody = formData;
      }

      const result = await api("/api/parcels/book", {
        method: "POST",
        body: createBody
      });

      const trackingNumber =
        result.trackingNumber || result.parcel?.trackingNumber;

      if (driverId && trackingNumber) {
        try {
          await api("/api/admin/assign-parcel", {
            method: "PUT",
            body: JSON.stringify({
              trackingNumber,
              driverId
            })
          });

          toast("Parcel created and driver assigned!");

        } catch (assignError) {
          toast(
            "Parcel created, but driver assignment failed: " +
            assignError.message
          );
        }
      } else {
        toast("Parcel created successfully!");
      }

      closeModal("parcelModal");

      $("parcelForm").reset();

      resetPreview("productImage", "productImagePreview");

      await loadAllData();

      if (trackingNumber) {
        alert("New Tracking Number: " + trackingNumber);
      }

    } catch (error) {
      toast(error.message);

    } finally {
      if (button) {
        button.disabled = false;

        button.textContent = editingParcelId
          ? "Update shipment"
          : "Save shipment";
      }
    }
  });

  // =====================================
  // PARCEL DETAILS
  // =====================================
  function showParcelDetails(id) {
    const p = parcels.find(item => item.trackingNumber === id);

    if (!p) return;

    const productImage = imageUrl(p.productImage);

    if ($("viewParcelContent")) {
      $("viewParcelContent").innerHTML = `
        <div class="tracking-result-card">

          ${productImage ? `
            <img
              src="${productImage}"
              alt="Product image"
              class="product-image parcel-image"
            >
          ` : ""}

          <h3>Shipment ${esc(p.trackingNumber)}</h3>

          <p><b>Sender:</b> ${esc(p.senderName)}</p>
          <p><b>Sender Phone:</b> ${esc(p.senderPhone)}</p>
          <p><b>Receiver:</b> ${esc(p.receiverName)}</p>
          <p><b>Receiver Phone:</b> ${esc(p.receiverPhone)}</p>
          <p><b>Pickup:</b> ${esc(p.pickupAddress)}</p>
          <p><b>Destination:</b> ${esc(p.deliveryAddress)}</p>
          <p><b>Description:</b> ${esc(p.parcelDescription)}</p>
          <p><b>Weight:</b> ${esc(p.weightKg)} kg</p>
          <p><b>Assigned Driver:</b> ${esc(p.assignedDriver?.name || "Unassigned")}</p>
          <p><b>Status:</b> ${badge(p.status)}</p>
          <p><b>Created:</b> ${esc(p.createdAt ? new Date(p.createdAt).toLocaleString() : "—")}</p>

        </div>
      `;
    }

    openModal("viewParcelModal");
  }

  // =====================================
  // DASHBOARD METRICS
  // =====================================
  function renderMetrics() {
    const total = parcels.length;

    const count = status =>
      parcels.filter(p => p.status === status).length;

    const pending = count("pending");

    const transit =
      count("in_transit") +
      count("picked_up") +
      count("out_for_delivery");

    const delivered = count("delivered");
    const failed = count("cancelled");

    if ($("metricTotal")) {
      $("metricTotal").textContent = total;
    }

    if ($("metricTransit")) {
      $("metricTransit").textContent = transit;
    }

    if ($("metricDelivered")) {
      $("metricDelivered").textContent = delivered;
    }

    if ($("metricIssues")) {
      $("metricIssues").textContent = failed;
    }

    if ($("navParcelCount")) {
      $("navParcelCount").textContent = total;
    }

    if ($("donutTotal")) {
      $("donutTotal").textContent = total;
    }

    if ($("breakDelivered")) {
      $("breakDelivered").textContent = delivered;
    }

    if ($("breakTransit")) {
      $("breakTransit").textContent = transit;
    }

    if ($("breakPending")) {
      $("breakPending").textContent = pending;
    }

    if ($("breakFailed")) {
      $("breakFailed").textContent = failed;
    }

    const pct = n => total ? n / total * 100 : 0;

    let start = 0;

    const colors = [
      ["#19b28d", delivered],
      ["#6492e8", transit],
      ["#eab04d", pending],
      ["#e4777d", failed]
    ];

    const segments = colors.map(([color, number]) => {
      const from = start;

      start += pct(number);

      return `${color} ${from}% ${start}%`;
    });

    if ($("statusDonut")) {
      $("statusDonut").style.background = total
        ? `conic-gradient(${segments.join(",")})`
        : "#edf1f5";
    }
  }

  // =====================================
  // TABLE HELPERS
  // =====================================
  function customerCell(name) {
    return `
      <span class="customer-cell">
        <i class="tiny-avatar">${esc(initials(name))}</i>
        ${esc(name)}
      </span>
    `;
  }

  function driverName(p) {
    return p.assignedDriver?.name || "Unassigned";
  }

  function parcelTracking(p) {
    return p.trackingNumber || "";
  }

  // =====================================
  // RECENT SHIPMENTS
  // =====================================
  function renderRecent() {
    const list = parcels.slice(0, 5);

    if (!$("recentRows")) return;

    $("recentRows").innerHTML = list.map(p => `
      <tr>
        <td class="tracking-code">${esc(parcelTracking(p))}</td>
        <td>${customerCell(p.receiverName)}</td>
        <td>${esc(p.deliveryAddress)}</td>
        <td>${esc(driverName(p))}</td>
        <td>${badge(p.status)}</td>
        <td>
          <button
            class="row-action action-view"
            data-track="${esc(parcelTracking(p))}"
          >View</button>
        </td>
      </tr>
    `).join("");

    if ($("recentEmpty")) {
      $("recentEmpty").classList.toggle("show", list.length === 0);
    }

    const table = $("recentRows").closest(".table-scroll");

    if (table) {
      table.style.display = list.length ? "" : "none";
    }
  }

  bind("recentRows", "click", e => {
    const button = e.target.closest("[data-track]");

    if (!button) return;

    goTo("tracking");

    if ($("trackingInput")) {
      $("trackingInput").value = button.dataset.track;
    }

    if ($("trackingPhone")) {
      $("trackingPhone").value = "";
    }

    toast("Enter receiver phone number to track this parcel.");
  });

  // =====================================
  // PARCEL TABLE
  // =====================================
  function renderParcels() {
    if (!$("parcelRows")) return;

    const query =
      $("parcelSearch")?.value.trim().toLowerCase() || "";

    const filter =
      $("statusFilter")?.value || "all";

    const list = parcels.filter(p => {
      const matchesStatus =
        filter === "all" ||
        p.status === filter ||
        statusLabel(p.status) === filter;

      const searchText = [
        p.trackingNumber,
        p.senderName,
        p.receiverName,
        p.receiverPhone,
        p.deliveryAddress
      ].join(" ").toLowerCase();

      return matchesStatus && searchText.includes(query);
    });

    $("parcelRows").innerHTML = list.map(p => `
      <tr>
        <td class="tracking-code">${esc(parcelTracking(p))}</td>
        <td>${customerCell(p.receiverName)}</td>
        <td>${esc(p.receiverPhone)}</td>
        <td>${esc(p.deliveryAddress)}</td>
        <td>${esc(driverName(p))}</td>
        <td>${badge(p.status)}</td>

        <td class="parcel-actions">

          <button
            class="row-action action-view"
            data-parcel-action="view"
            data-id="${esc(p._id)}"
          >View</button>

          <button
            class="row-action action-edit"
            data-parcel-action="edit"
            data-id="${esc(p._id)}"
          >Edit</button>

          <button
            class="row-action action-delete"
            data-parcel-action="delete"
            data-id="${esc(p._id)}"
          >Delete</button>

        </td>
      </tr>
    `).join("");

    if ($("parcelEmpty")) {
      $("parcelEmpty").classList.toggle("show", list.length === 0);
    }

    const table = $("parcelRows").closest(".table-scroll");

    if (table) {
      table.style.display = list.length ? "" : "none";
    }
  }

  bind("parcelSearch", "input", renderParcels);
  bind("statusFilter", "change", renderParcels);

  bind("parcelRows", "click", async e => {
    const button = e.target.closest("[data-parcel-action]");

    if (!button) return;

    const id = button.dataset.id;
    const action = button.dataset.parcelAction;

    if (action === "view") {
      const parcel = parcels.find(p => p._id === id);

      if (parcel) {
        showParcelDetails(parcel.trackingNumber);
      }

      return;
    }

    if (action === "edit") {
      showParcelEditModal(id);
      return;
    }

    if (action === "delete") {
      const parcel = parcels.find(p => p._id === id);

      if (!parcel) return;

      if (!confirm(
        `Are you sure you want to delete parcel ${parcel.trackingNumber}?`
      )) {
        return;
      }

      try {
        await api(`/api/admin/parcels/${encodeURIComponent(id)}`, {
          method: "DELETE"
        });

        await loadAllData();

        toast("Parcel deleted successfully!");

      } catch (error) {
        toast(error.message);
      }
    }
  });

  // =====================================
  // DELIVERY TABLE
  // =====================================
  function renderDeliveries() {
    if (!$("deliveryRows")) return;

    $("deliveryRows").innerHTML = parcels.map(p => `
      <tr>
        <td class="tracking-code">${esc(parcelTracking(p))}</td>
        <td>${esc(p.receiverName)}</td>
        <td>${esc(driverName(p))}</td>
        <td>${badge(p.status)}</td>
        <td>${esc(dateFormat(p.updatedAt))}</td>
      </tr>
    `).join("");

    if ($("deliveryEmpty")) {
      $("deliveryEmpty").classList.toggle("show", parcels.length === 0);
    }

    const table = $("deliveryRows").closest(".table-scroll");

    if (table) {
      table.style.display = parcels.length ? "" : "none";
    }
  }

  // =====================================
  // CREATE / EDIT DRIVER
  // =====================================
  function showDriverModal() {
    if (!$("driverForm")) return;

    editingDriverId = null;

    $("driverForm").reset();

    resetPreview("driverProfileImage", "driverImagePreview");

    if ($("driverModalTitle")) {
      $("driverModalTitle").textContent = "Add a driver";
    }

    if ($("driverSaveBtn")) {
      $("driverSaveBtn").textContent = "Add driver";
    }

    if ($("driverPassword")) {
      $("driverPassword").required = true;
      $("driverPassword").placeholder = "Enter password";
    }

    openModal("driverModal");
  }

  function showDriverEditModal(id) {
    const driver = drivers.find(d => d._id === id);

    if (!driver) {
      toast("Driver not found.");
      return;
    }

    editingDriverId = driver._id;

    $("driverForm").reset();

    resetPreview("driverProfileImage", "driverImagePreview");

    $("driverName").value = driver.name || "";
    $("driverPhone").value = driver.phone || "";
    $("driverEmail").value = driver.email || "";

    if (driver.profileImage && $("driverImagePreview")) {
      $("driverImagePreview").src = driver.profileImage;
      $("driverImagePreview").style.display = "block";
    }

    if ($("driverPassword")) {
      $("driverPassword").value = "";
      $("driverPassword").required = false;
      $("driverPassword").placeholder =
        "Leave blank to keep current password";
    }

    if ($("driverModalTitle")) {
      $("driverModalTitle").textContent = "Edit driver";
    }

    if ($("driverSaveBtn")) {
      $("driverSaveBtn").textContent = "Update driver";
    }

    openModal("driverModal");
  }

  bind("addDriverBtn", "click", showDriverModal);
  bind("emptyAddDriver", "click", showDriverModal);

  // =====================================
  // SAVE / UPDATE DRIVER
  // =====================================
  bind("driverForm", "submit", async e => {
    e.preventDefault();

    const button = $("driverSaveBtn");

    try {
      const driverData = {
        name: $("driverName")?.value.trim(),
        email: $("driverEmail")?.value.trim(),
        phone: $("driverPhone")?.value.trim()
      };

      const password = $("driverPassword")?.value || "";

      const imageFile =
        $("driverProfileImage")?.files?.[0];

      if (!driverData.name || !driverData.email || !driverData.phone) {
        toast("Please complete all required driver fields.");
        return;
      }

      if (editingDriverId && password && password.length < 8) {
        toast("Password must be at least 8 characters.");
        return;
      }

      if (!editingDriverId && !password) {
        toast("Driver password is required.");
        return;
      }

      if (!editingDriverId && password.length < 8) {
        toast("Driver password must be at least 8 characters.");
        return;
      }

      if (password) {
        driverData.password = password;
      }

      if (button) {
        button.disabled = true;

        button.textContent = editingDriverId
          ? "Updating..."
          : "Creating...";
      }

      let body = JSON.stringify(driverData);

      if (imageFile) {
        const formData = new FormData();

        Object.entries(driverData).forEach(([key, value]) => {
          formData.append(key, value);
        });

        formData.append("profileImage", imageFile);

        body = formData;
      }

      if (editingDriverId) {
        await api(`/api/admin/drivers/${encodeURIComponent(editingDriverId)}`, {
          method: "PUT",
          body
        });

        editingDriverId = null;

        closeModal("driverModal");

        $("driverForm").reset();

        resetPreview("driverProfileImage", "driverImagePreview");

        await loadAllData();

        toast("Driver updated successfully!");

      } else {
        await api("/api/admin/drivers", {
          method: "POST",
          body
        });

        closeModal("driverModal");

        $("driverForm").reset();

        resetPreview("driverProfileImage", "driverImagePreview");

        await loadAllData();

        toast("Driver created successfully!");
      }

    } catch (error) {
      toast(error.message);

    } finally {
      if (button) {
        button.disabled = false;

        button.textContent = editingDriverId
          ? "Update driver"
          : "Add driver";
      }

      if ($("driverPassword") && !editingDriverId) {
        $("driverPassword").required = true;
        $("driverPassword").placeholder = "Enter password";
      }
    }
  });

  // =====================================
  // DRIVER CARDS
  // =====================================
  function renderDrivers() {
    if (!$("driverGrid")) return;

    $("driverGrid").innerHTML = drivers.map(d => {
      const activeShipments = parcels.filter(p =>
        String(p.assignedDriver?._id || p.assignedDriver || "") ===
        String(d._id) &&
        !["delivered", "cancelled"].includes(p.status)
      ).length;

      // FIXED: photo variable
      const photo = imageUrl(d.profileImage);

      return `
        <article class="driver-card">

          <div class="driver-card-head">

            <div class="driver-avatar">
              ${photo
                ? `
                  <img
                    src="${photo}"
                    alt="${esc(d.name)} profile picture"
                  >
                `
                : esc(initials(d.name))
              }
            </div>

            <div>
              <h3>${esc(d.name)}</h3>
              <small>Delivery partner</small>
            </div>

          </div>

          <div class="driver-meta">
            <span>☎ &nbsp;${esc(d.phone || "No phone")}</span>
            <span>✉ &nbsp;${esc(d.email)}</span>
            <span>↗ &nbsp;${activeShipments} active assigned shipment(s)</span>
          </div>

          <div class="driver-actions">

            <button
              class="btn action-view"
              data-action="view"
              data-id="${esc(d._id)}"
            >View</button>

            <button
              class="btn action-edit"
              data-action="edit"
              data-id="${esc(d._id)}"
            >Edit</button>

            <button
              class="btn action-delete"
              data-action="delete"
              data-id="${esc(d._id)}"
            >Delete</button>

          </div>

        </article>
      `;
    }).join("");

    if ($("driverEmpty")) {
      $("driverEmpty").classList.toggle("show", drivers.length === 0);
    }
  }

  // =====================================
  // DRIVER VIEW / EDIT / DELETE
  // =====================================
  bind("driverGrid", "click", async e => {
    const button = e.target.closest("button[data-action]");

    if (!button) return;

    const id = button.dataset.id;
    const action = button.dataset.action;

    const driver = drivers.find(d => d._id === id);

    if (!driver) return;

    if (action === "view") {
      if ($("viewDriverName")) {
        $("viewDriverName").value = driver.name || "";
      }

      if ($("viewDriverPhone")) {
        $("viewDriverPhone").value = driver.phone || "";
      }

      if ($("viewDriverEmail")) {
        $("viewDriverEmail").value = driver.email || "";
      }

      const active = parcels.filter(p =>
        String(p.assignedDriver?._id || p.assignedDriver || "") ===
        String(driver._id) &&
        !["delivered", "cancelled"].includes(p.status)
      ).length;

      if ($("viewDriverShipments")) {
        $("viewDriverShipments").value = active;
      }

      if ($("viewDriverImage")) {
        if (driver.profileImage) {
          $("viewDriverImage").src = driver.profileImage;
          $("viewDriverImage").style.display = "block";
        } else {
          $("viewDriverImage").removeAttribute("src");
          $("viewDriverImage").style.display = "none";
        }
      }

      openModal("viewDriverModal");

      return;
    }

    if (action === "edit") {
      showDriverEditModal(id);
      return;
    }

    if (action === "delete") {
      const assignedParcels = parcels.filter(p =>
        String(p.assignedDriver?._id || p.assignedDriver || "") ===
        String(driver._id)
      );

      if (assignedParcels.length > 0) {
        alert(
          `This driver has ${assignedParcels.length} assigned parcel(s).\n\nPlease reassign those parcels to another driver before deleting this driver.`
        );

        return;
      }

      if (!confirm(
        `Are you sure you want to delete driver ${driver.name}?`
      )) {
        return;
      }

      try {
        await api(`/api/admin/drivers/${encodeURIComponent(id)}`, {
          method: "DELETE"
        });

        await loadAllData();

        toast("Driver deleted successfully!");

      } catch (error) {
        toast(error.message);
      }
    }
  });

  // =====================================
  // CUSTOMER TRACKING
  // =====================================
  async function showTracking(trackingNumber, receiverPhone) {
    if (!$("trackingResult")) return;

    $("trackingResult").innerHTML =
      '<div class="tracking-result-card">Searching parcel...</div>';

    try {
      const query = new URLSearchParams({
        receiverPhone
      });

      const response = await fetch(
        `${API_BASE}/api/parcels/track/${encodeURIComponent(trackingNumber)}?${query}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Parcel not found.");
      }

      const p = data.parcel || data;

      const photo = imageUrl(p.productImage);

      $("trackingResult").innerHTML = `
        <div class="tracking-result-card">

          ${photo ? `
            <img
              src="${photo}"
              alt="Product image"
              class="product-image parcel-image"
            >
          ` : ""}

          <h3>Shipment ${esc(p.trackingNumber || trackingNumber)}</h3>

          <p><b>Description:</b> ${esc(p.parcelDescription || "—")}</p>
          <p><b>Status:</b> ${badge(p.status)}</p>
          <p><b>Created:</b> ${esc(dateFormat(p.createdAt))}</p>
          <p><b>Last Updated:</b> ${esc(dateFormat(p.updatedAt))}</p>

        </div>
      `;

    } catch (error) {
      $("trackingResult").innerHTML = `
        <div class="tracking-result-card">
          ${esc(error.message)}
        </div>
      `;
    }
  }

  bind("trackingForm", "submit", e => {
    e.preventDefault();

    const trackingNumber =
      $("trackingInput")?.value.trim();

    const receiverPhone =
      $("trackingPhone")?.value.trim();

    if (!trackingNumber || !receiverPhone) {
      toast("Enter tracking number and receiver phone.");
      return;
    }

    showTracking(trackingNumber, receiverPhone);
  });

  // =====================================
  // REPORTS
  // =====================================
  function renderReports() {
    if (!$("reportMetrics") || !$("reportRows")) return;

    const count = s =>
      parcels.filter(p => p.status === s).length;

    const delivered = count("delivered");

    const transit =
      count("in_transit") +
      count("picked_up") +
      count("out_for_delivery");

    const cancelled = count("cancelled");

    $("reportMetrics").innerHTML = [
      ["Total shipments", parcels.length],
      ["Delivered", delivered],
      ["In transit", transit],
      ["Cancelled", cancelled]
    ].map(([label, value], index) => `
      <article class="metric-card metric-color-${index + 1}">
        <div class="metric-top">
          <span>${label}</span>
        </div>
        <div class="metric-value">${value}</div>
      </article>
    `).join("");

    $("reportRows").innerHTML = parcels.map(p => `
      <tr>
        <td class="tracking-code">${esc(parcelTracking(p))}</td>
        <td>${esc(p.receiverName)}</td>
        <td>${esc(p.deliveryAddress)}</td>
        <td>${badge(p.status)}</td>
        <td>${esc(dateFormat(p.createdAt))}</td>
      </tr>
    `).join("");
  }

  // =====================================
  // CSV EXPORT
  // =====================================
  function exportCSV() {
    if (!parcels.length) {
      toast("There are no shipments to export.");
      return;
    }

    const rows = [[
      "Tracking Number",
      "Sender",
      "Sender Phone",
      "Receiver",
      "Receiver Phone",
      "Pickup Address",
      "Delivery Address",
      "Driver",
      "Status",
      "Created"
    ]];

    parcels.forEach(p => {
      rows.push([
        p.trackingNumber,
        p.senderName,
        p.senderPhone,
        p.receiverName,
        p.receiverPhone,
        p.pickupAddress,
        p.deliveryAddress,
        driverName(p),
        statusLabel(p.status),
        p.createdAt
      ]);
    });

    const csv = rows.map(row =>
      row.map(v =>
        `"${String(v ?? "").replace(/"/g, '""')}"`
      ).join(",")
    ).join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;
    a.download = "smart-courier-report.csv";
    a.click();

    URL.revokeObjectURL(url);

    toast("CSV report downloaded.");
  }

  bind("exportBtn", "click", exportCSV);
  bind("reportExport", "click", exportCSV);

  // =====================================
  // BACKUP EXPORT
  // =====================================
  bind("settingsExport", "click", () => {
    const data = {
      parcels,
      drivers,
      notificationSettings,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob(
      [JSON.stringify(data, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;
    a.download = "smart-courier-backup.json";
    a.click();

    URL.revokeObjectURL(url);

    toast("Backup downloaded.");
  });

  // =====================================
  // NOTIFICATION SETTINGS
  // =====================================
  function loadNotificationSettings() {
    Object.keys(notificationDefaults).forEach(key => {
      const element = $(key);

      if (!element) return;

      if (element.type === "checkbox") {
        element.checked = !!notificationSettings[key];
      } else {
        element.value = notificationSettings[key];
      }
    });

    updateToggleLabels();
  }

  function updateToggleLabels() {
    if ($("smsStatus") && $("smsEnabled")) {
      $("smsStatus").textContent =
        $("smsEnabled").checked ? "ON" : "OFF";

      $("smsStatus").classList.toggle(
        "is-on",
        $("smsEnabled").checked
      );
    }

    if ($("emailStatus") && $("emailEnabled")) {
      $("emailStatus").textContent =
        $("emailEnabled").checked ? "ON" : "OFF";

      $("emailStatus").classList.toggle(
        "is-on",
        $("emailEnabled").checked
      );
    }
  }

  bind("smsEnabled", "change", updateToggleLabels);
  bind("emailEnabled", "change", updateToggleLabels);

  bind("saveNotificationSettings", "click", () => {
    Object.keys(notificationDefaults).forEach(key => {
      const element = $(key);

      if (!element) return;

      notificationSettings[key] =
        element.type === "checkbox"
          ? element.checked
          : element.value;
    });

    localStorage.setItem(
      "smartcourier_notifications_v1",
      JSON.stringify(notificationSettings)
    );

    updateToggleLabels();

    toast("Notification settings saved.");
  });

  // =====================================
  // GLOBAL SEARCH
  // =====================================
  bind("globalSearch", "keydown", e => {
    if (e.key === "Enter") {
      goTo("parcels");

      if ($("parcelSearch")) {
        $("parcelSearch").value = e.target.value;
      }

      renderParcels();
    }
  });

  // =====================================
  // KEYBOARD SHORTCUTS
  // =====================================
  document.addEventListener("keydown", e => {
    if (
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === "k"
    ) {
      e.preventDefault();

      if ($("globalSearch")) {
        $("globalSearch").focus();
      }
    }

    if (e.key === "Escape") {
      document.querySelectorAll(".modal-backdrop.open").forEach(m => {
        m.classList.remove("open");
      });

      closeSidebar();
    }
  });

  // =====================================
  // RENDER ALL
  // =====================================
  function renderAll() {
    renderMetrics();
    renderRecent();
    renderParcels();
    renderDeliveries();
    renderDrivers();
    renderReports();
    driverOptions();
  }

  // =====================================
  // LOAD NOTIFICATION SETTINGS
  // =====================================
  loadNotificationSettings();

  // =====================================
  // START APPLICATION
  // =====================================
  restoreSession();

});
// SMS ON/OFF STATUS
const smsEnabled = document.getElementById("smsEnabled");
const smsStatus = document.getElementById("smsStatus");

if (smsEnabled && smsStatus) {
  const updateSmsStatus = () => {
    smsStatus.textContent = smsEnabled.checked ? "ON" : "OFF";
    smsStatus.classList.toggle("is-on", smsEnabled.checked);
  };

  smsEnabled.addEventListener("change", updateSmsStatus);
  updateSmsStatus();
}


// EMAIL ON/OFF STATUS
const emailEnabled = document.getElementById("emailEnabled");
const emailStatus = document.getElementById("emailStatus");

if (emailEnabled && emailStatus) {
  const updateEmailStatus = () => {
    emailStatus.textContent = emailEnabled.checked ? "ON" : "OFF";
    emailStatus.classList.toggle("is-on", emailEnabled.checked);
  };

  emailEnabled.addEventListener("change", updateEmailStatus);
  updateEmailStatus();
}