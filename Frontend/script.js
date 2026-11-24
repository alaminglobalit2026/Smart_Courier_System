document.addEventListener("DOMContentLoaded", () => {
  const $ = id => document.getElementById(id);

  // =====================================
  // ADMIN LOGIN - BACKEND CONNECTION
  // =====================================

  const API_BASE = "https://smart-courier-system.onrender.com";
  const TOKEN_KEY = "smartcourier_admin_token";

  const loginForm = $("adminLoginForm");
  const loginScreen = $("loginScreen");
  const appShell = $("appShell");
  const loginError = $("loginError");
  const loginButton = $("adminLoginBtn");

  async function adminLogin(email, password) {
    try {
      loginButton.disabled = true;
      loginButton.textContent = "Logging in...";
      loginError.textContent = "";

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

      localStorage.setItem(TOKEN_KEY, data.token);

      loginScreen.style.display = "none";
      appShell.style.display = "block";

      if ($("sidebarAdminName")) {
        $("sidebarAdminName").textContent = data.user.name;
      }

      if ($("topAdminName")) {
        $("topAdminName").textContent = data.user.name;
      }

      toast("Admin login successful!");

    } catch (error) {
      loginError.textContent = error.message;
    } finally {
      loginButton.disabled = false;
      loginButton.textContent = "Login";
    }
  }

  loginForm.addEventListener("submit", function(e) {
    e.preventDefault();

    const email = $("adminEmail").value.trim();
    const password = $("adminPassword").value;

    if (!email || !password) {
      loginError.textContent = "Please enter email and password.";
      return;
    }

    adminLogin(email, password);
  });

  // Restore existing login session
  const savedToken = localStorage.getItem(TOKEN_KEY);

  if (savedToken) {
    fetch(`${API_BASE}/api/admin/dashboard`, {
      headers: {
        Authorization: `Bearer ${savedToken}`
      }
    })
    .then(async response => {
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error("Session expired");
      }

      loginScreen.style.display = "none";
      appShell.style.display = "block";

      if ($("sidebarAdminName")) {
        $("sidebarAdminName").textContent = data.user.name;
      }

      if ($("topAdminName")) {
        $("topAdminName").textContent = data.user.name;
      }
    })
    .catch(() => {
      localStorage.removeItem(TOKEN_KEY);
      loginScreen.style.display = "flex";
      appShell.style.display = "none";
    });
  }

  // Logout
  if ($("logoutBtn")) {
    $("logoutBtn").addEventListener("click", () => {
      localStorage.removeItem(TOKEN_KEY);
      location.reload();
    });
  }

  const STORE_PARCELS = "smartcouriersystem_parcels_v1";
  const STORE_DRIVERS = "smartcouriersystem_drivers_v1";
  let parcels = readStore(STORE_PARCELS, []);
  let drivers = readStore(STORE_DRIVERS, []);
  let editingDriverId = null;
  let editingTrackingId = null;

  function readStore(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch { return fallback; }
  }
  function save() {
    localStorage.setItem(STORE_PARCELS, JSON.stringify(parcels));
    localStorage.setItem(STORE_DRIVERS, JSON.stringify(drivers));
  }
  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    })[c]);
  }
  function initials(name) {
    return String(name || "?").trim().split(/\s+/).slice(0,2).map(x => x[0]).join("").toUpperCase();
  }
  function statusClass(status) {
    return "status-" + String(status).toLowerCase().replace(/\s+/g, "-");
  }
  function toast(message) {
    const el = $("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), 2600);
  }
  function openModal(id) { $(id).classList.add("open"); }
  function closeModal(id) { $(id).classList.remove("open"); }

  document.querySelectorAll("[data-close]").forEach(btn =>
    btn.addEventListener("click", () => closeModal(btn.dataset.close))
  );
  document.querySelectorAll(".modal-backdrop").forEach(backdrop =>
    backdrop.addEventListener("click", e => {
      if (e.target === backdrop) closeModal(backdrop.id);
    })
  );

  function goTo(page) {
    document.querySelectorAll(".page").forEach(p => p.classList.toggle("active", p.id === page));
    document.querySelectorAll(".nav-link").forEach(a => a.classList.toggle("active", a.dataset.page === page));
    const active = document.querySelector(`.nav-link[data-page="${page}"]`);
    $("breadcrumbPage").textContent = active ? active.textContent.trim().replace(/\s+\d+$/, "") : "Dashboard";
    $("sidebar").classList.remove("open");
    if (page === "reports") renderReports();
  }
  document.querySelectorAll(".nav-link").forEach(a => a.addEventListener("click", e => {
    e.preventDefault(); goTo(a.dataset.page);
  }));
  document.querySelectorAll("[data-goto]").forEach(b => b.addEventListener("click", () => goTo(b.dataset.goto)));
  $("mobileMenu").addEventListener("click", () => $("sidebar").classList.toggle("open"));
  $("helpBtn").addEventListener("click", () => toast("Help center will be connected in a future version."));
  $("notificationBtn").addEventListener("click", () => toast("You are all caught up!"));

  function driverOptions() {
    $("parcelDriver").innerHTML = '<option value="">Unassigned</option>' +
      drivers.map(d => `<option value="${esc(d.name)}">${esc(d.name)}</option>`).join("");
  }
  function showParcelModal() {
    editingTrackingId = null;
    $("parcelForm").reset();
    driverOptions();
    $("parcelModalTitle").textContent = "Create a shipment";
    $("parcelModalEyebrow").textContent = "NEW SHIPMENT";
    $("parcelSaveBtn").textContent = "Save shipment";
    $("trackingId").disabled = false;
    openModal("parcelModal");
  }

  function showEditParcelModal(id) {
    const parcel = parcels.find(p => p.trackingId === id);
    if (!parcel) return;

    editingTrackingId = id;
    $("parcelForm").reset();
    driverOptions();
    $("trackingId").value = parcel.trackingId;
    $("customerName").value = parcel.customer || "";
    $("customerPhone").value = parcel.phone || "";
    $("destination").value = parcel.destination || "";
    $("parcelDriver").value = parcel.driver || "";
    $("parcelModalTitle").textContent = "Edit shipment";
    $("parcelModalEyebrow").textContent = "UPDATE SHIPMENT";
    $("parcelSaveBtn").textContent = "Update shipment";
    // Keep the tracking ID stable so other records and tracking links remain consistent.
    $("trackingId").disabled = true;
    openModal("parcelModal");
  }

  function showParcelDetails(id) {
    const p = parcels.find(item => item.trackingId === id);
    if (!p) return;
    $("viewParcelContent").innerHTML = `
      <div class="tracking-result-card">
        <h3>Shipment ${esc(p.trackingId)}</h3>
        <p><b>Customer:</b> ${esc(p.customer)}</p>
        <p><b>Phone:</b> ${esc(p.phone)}</p>
        <p><b>Destination:</b> ${esc(p.destination)}</p>
        <p><b>Assigned driver:</b> ${esc(p.driver || "Unassigned")}</p>
        <p><b>Status:</b> ${badge(p.status)}</p>
        <p><b>Created:</b> ${p.createdAt ? esc(new Date(p.createdAt).toLocaleString()) : "—"}</p>
      </div>`;
    openModal("viewParcelModal");
  }
  document.querySelectorAll("[data-open-parcel]").forEach(b => b.addEventListener("click", showParcelModal));
  $("quickAddBtn").addEventListener("click", showParcelModal);

  $("parcelForm").addEventListener("submit", e => {
    e.preventDefault();
    const trackingId = $("trackingId").value.trim();
    const customer = $("customerName").value.trim();
    const phone = $("customerPhone").value.trim();
    const destination = $("destination").value.trim();
    const driver = $("parcelDriver").value;
    const existing = editingTrackingId
      ? parcels.find(p => p.trackingId === editingTrackingId)
      : null;

    const duplicate = parcels.some(p =>
      p !== existing && p.trackingId.toLowerCase() === trackingId.toLowerCase()
    );
    if (duplicate) {
      toast("That tracking ID already exists.");
      return;
    }

    if (existing) {
      // Preserve delivery status and creation date while updating editable fields.
      existing.customer = customer;
      existing.phone = phone;
      existing.destination = destination;
      existing.driver = driver;
      editingTrackingId = null;
      toast("Shipment updated successfully.");
    } else {
      parcels.unshift({
        trackingId,
        customer,
        phone,
        destination,
        driver,
        status: "Pending",
        createdAt: new Date().toISOString()
      });
      toast("Shipment created successfully.");
    }

    save();
    renderAll();
    closeModal("parcelModal");
    $("trackingId").disabled = false;
  });

 
function showDriverModal() {
  editingDriverId = null;
  $("driverForm").reset();
  $("driverModalTitle").textContent = "Add a driver";
  $("driverSaveBtn").textContent = "Add driver";
  openModal("driverModal");
}

$("addDriverBtn").addEventListener("click", showDriverModal);
$("emptyAddDriver").addEventListener("click", showDriverModal);

// Edit and Delete button actions
$("driverGrid").addEventListener("click", e => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const id = btn.dataset.id;
  const driver = drivers.find(d => d.id === id);
  if (!driver) return;

if (btn.dataset.action === "view") {
  $("viewDriverName").value = driver.name;
  $("viewDriverPhone").value = driver.phone;
  $("viewDriverVehicle").value = driver.vehicle;

  const activeShipments = parcels.filter(
    p => p.driver === driver.name &&
    ["Pending", "In Transit"].includes(p.status)
  ).length;

  $("viewDriverShipments").value = activeShipments;

  openModal("viewDriverModal");
}


  if (btn.dataset.action === "edit") {
    editingDriverId = id;

    $("driverName").value = driver.name;
    $("driverPhone").value = driver.phone;
    $("driverVehicle").value = driver.vehicle;
    $("driverModalTitle").textContent = "Edit driver";
    $("driverSaveBtn").textContent = "Save changes";

    openModal("driverModal");
  }

  if (btn.dataset.action === "delete") {
    if (!confirm("Are you sure you want to delete this driver?")) return;

    parcels.forEach(p => {
      if (p.driver === driver.name) p.driver = "";
    });

    drivers = drivers.filter(d => d.id !== id);

    save();
    renderAll();
    toast("Driver deleted successfully.");
  }
});

// Save new driver or update existing driver
$("driverForm").addEventListener("submit", e => {
  e.preventDefault();

  const driverData = {
    name: $("driverName").value.trim(),
    phone: $("driverPhone").value.trim(),
    vehicle: $("driverVehicle").value
  };

  const duplicateDriver = drivers.some(d =>
    d.id !== editingDriverId &&
    String(d.name).trim().toLowerCase() === driverData.name.toLowerCase()
  );
  if (duplicateDriver) {
    toast("A driver with this name already exists.");
    return;
  }

  if (editingDriverId) {
    const driver = drivers.find(d => d.id === editingDriverId);

    if (driver) {
      const oldName = driver.name;
      Object.assign(driver, driverData);

      parcels.forEach(p => {
        if (p.driver === oldName) p.driver = driverData.name;
      });
    }

    toast("Driver updated successfully.");
  } else {
    drivers.push({
      id: (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : String(Date.now())),
      ...driverData
    });

    toast("Driver added successfully.");
  }

  editingDriverId = null;
  save();
  renderAll();
  closeModal("driverModal");
  $("driverModalTitle").textContent = "Add a driver";
  $("driverSaveBtn").textContent = "Add driver";
});


  function renderMetrics() {
    const total = parcels.length;
    const count = status => parcels.filter(p => p.status === status).length;
    const transit = count("In Transit"), delivered = count("Delivered"), pending = count("Pending"), failed = count("Failed");
    $("metricTotal").textContent = total;
    $("metricTransit").textContent = transit;
    $("metricDelivered").textContent = delivered;
    $("metricIssues").textContent = failed;
    $("navParcelCount").textContent = total;
    $("donutTotal").textContent = total;
    $("breakDelivered").textContent = delivered;
    $("breakTransit").textContent = transit;
    $("breakPending").textContent = pending;
    $("breakFailed").textContent = failed;
    const pct = n => total ? n / total * 100 : 0;
    let start = 0;
    const colors = [["#19b28d",delivered],["#6492e8",transit],["#eab04d",pending],["#e4777d",failed]];
    const segments = colors.map(([color,n]) => {
      const from = start; start += pct(n); return `${color} ${from}% ${start}%`;
    });
    $("statusDonut").style.background = total ? `conic-gradient(${segments.join(",")})` : "#edf1f5";
  }

  function customerCell(name) {
    return `<span class="customer-cell"><i class="tiny-avatar">${esc(initials(name))}</i>${esc(name)}</span>`;
  }
  function badge(status) {
    return `<span class="status-badge ${statusClass(status)}">${esc(status)}</span>`;
  }
  function renderRecent() {
    const list = parcels.slice(0,5);
    $("recentRows").innerHTML = list.map(p => `<tr>
      <td class="tracking-code">${esc(p.trackingId)}</td><td>${customerCell(p.customer)}</td>
      <td>${esc(p.destination)}</td><td>${esc(p.driver || "Unassigned")}</td><td>${badge(p.status)}</td>
      <td><button class="row-action" title="View tracking" data-track="${esc(p.trackingId)}">•••</button></td>
    </tr>`).join("");
    $("recentEmpty").classList.toggle("show", list.length === 0);
    $("recentRows").closest(".table-scroll").style.display = list.length ? "" : "none";
  }
  function renderParcels() {
    const query = $("parcelSearch").value.trim().toLowerCase();
    const filter = $("statusFilter").value;
    const list = parcels.filter(p =>
      (filter === "all" || p.status === filter) &&
      (p.trackingId.toLowerCase().includes(query) || p.customer.toLowerCase().includes(query) || p.destination.toLowerCase().includes(query))
    );
    $("parcelRows").innerHTML = list.map(p => `<tr>
      <td class="tracking-code">${esc(p.trackingId)}</td><td>${customerCell(p.customer)}</td>
      <td>${esc(p.phone)}</td><td>${esc(p.destination)}</td><td>${esc(p.driver || "Unassigned")}</td>
      <td>${badge(p.status)}</td>
      <td class="parcel-actions">
        <button class="row-action" data-view="${esc(p.trackingId)}" title="View shipment" aria-label="View shipment">View</button>
        <button class="row-action" data-edit="${esc(p.trackingId)}" title="Edit shipment" aria-label="Edit shipment">Edit</button>
        <button class="row-action row-action-danger" data-delete="${esc(p.trackingId)}" title="Delete shipment" aria-label="Delete shipment">Delete</button>
      </td>
    </tr>`).join("");
    $("parcelEmpty").classList.toggle("show", list.length === 0);
    $("parcelRows").closest(".table-scroll").style.display = list.length ? "" : "none";
  }
  $("parcelSearch").addEventListener("input", renderParcels);
  $("statusFilter").addEventListener("change", renderParcels);
  $("parcelRows").addEventListener("click", e => {
    const button = e.target.closest("button[data-view], button[data-edit], button[data-delete]");
    if (!button) return;

    const id = button.dataset.view || button.dataset.edit || button.dataset.delete;
    if (button.dataset.view) {
      showParcelDetails(id);
      return;
    }
    if (button.dataset.edit) {
      showEditParcelModal(id);
      return;
    }
    if (button.dataset.delete && confirm(`Delete shipment ${id}?`)) {
      parcels = parcels.filter(p => p.trackingId !== id);
      save();
      renderAll();
      toast("Shipment deleted.");
    }
  });
  $("recentRows").addEventListener("click", e => {
    const id = e.target.dataset.track;
    if (id) { goTo("tracking"); $("trackingInput").value = id; showTracking(id); }
  });

  function renderDeliveries() {
    $("deliveryRows").innerHTML = parcels.map(p => `<tr>
      <td class="tracking-code">${esc(p.trackingId)}</td><td>${esc(p.customer)}</td>
      <td>${esc(p.driver || "Unassigned")}</td><td>${badge(p.status)}</td>
      <td><select class="status-select" data-update="${esc(p.trackingId)}">
        ${["Pending","In Transit","Delivered","Failed"].map(s => `<option ${p.status===s?"selected":""}>${s}</option>`).join("")}
      </select></td></tr>`).join("");
    $("deliveryEmpty").classList.toggle("show", parcels.length === 0);
    $("deliveryRows").closest(".table-scroll").style.display = parcels.length ? "" : "none";
  }
  $("deliveryRows").addEventListener("change", e => {
    const id = e.target.dataset.update;
    if (!id) return;
    const parcel = parcels.find(p => p.trackingId === id);
    if (parcel) { parcel.status = e.target.value; save(); renderAll(); toast("Delivery status updated."); }
  });

function renderDrivers() {
  $("driverGrid").innerHTML = drivers.map(d => `
    <article class="driver-card">
      <div class="driver-card-head">
        <div class="driver-avatar">${esc(initials(d.name))}</div>
        <div>
          <h3>${esc(d.name)}</h3>
          <small>Delivery partner</small>
        </div>
      </div>

      <div class="driver-meta">
        <span>☎ &nbsp;${esc(d.phone)}</span>
        <span>▣ &nbsp;${esc(d.vehicle)}</span>
        <span>↗ &nbsp;${parcels.filter(p => p.driver === d.name && ["Pending","In Transit"].includes(p.status)).length} active assigned shipment(s)</span>
      </div>

      
<div class="driver-actions">
  <button class="btn btn-secondary"
    data-action="view" data-id="${esc(d.id)}">View</button>

  <button class="btn btn-primary"
    data-action="edit" data-id="${esc(d.id)}">Edit</button>

  <button class="btn btn-danger"
    data-action="delete" data-id="${esc(d.id)}">Delete</button>
</div>

    </article>
  `).join("");

  $("driverEmpty").classList.toggle("show", drivers.length === 0);
}

  function showTracking(id) {
    const p = parcels.find(x => x.trackingId.toLowerCase() === id.toLowerCase());
    if (!p) {
      $("trackingResult").innerHTML = `<div class="tracking-result-card">We couldn't find that tracking number. Please check it and try again.</div>`;
      return;
    }
    $("trackingResult").innerHTML = `<div class="tracking-result-card">
      <h3>Shipment ${esc(p.trackingId)}</h3>
      <p><b>Customer:</b> ${esc(p.customer)}</p><p><b>Destination:</b> ${esc(p.destination)}</p>
      <p><b>Status:</b> ${badge(p.status)}</p><p><b>Assigned driver:</b> ${esc(p.driver || "Not assigned")}</p>
    </div>`;
  }
  $("trackingForm").addEventListener("submit", e => {
    e.preventDefault(); showTracking($("trackingInput").value.trim());
  });

  function renderReports() {
    const count = s => parcels.filter(p => p.status === s).length;
    $("reportMetrics").innerHTML = [
      ["Total shipments",parcels.length,"blue"],["Delivered",count("Delivered"),"green"],
      ["In transit",count("In Transit"),"orange"],["Failed",count("Failed"),"red"]
    ].map(([label,value,color]) => `<article class="metric-card"><div class="metric-top"><span>${label}</span></div><div class="metric-value">${value}</div></article>`).join("");
    $("reportRows").innerHTML = parcels.map(p => `<tr><td class="tracking-code">${esc(p.trackingId)}</td><td>${esc(p.customer)}</td><td>${esc(p.destination)}</td><td>${badge(p.status)}</td><td>${p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—"}</td></tr>`).join("");
  }

  function exportCSV() {
    if (!parcels.length) { toast("There are no shipments to export yet."); return; }
    const rows = [["Tracking ID","Customer","Phone","Destination","Driver","Status","Created"]];
    parcels.forEach(p => rows.push([p.trackingId,p.customer,p.phone,p.destination,p.driver,p.status,p.createdAt]));
    const csv = rows.map(row => row.map(v => `"${String(v ?? "").replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], {type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "smartcouriersystem-shipment-report.csv"; a.click();
    URL.revokeObjectURL(url); toast("CSV report downloaded.");
  }
  $("exportBtn").addEventListener("click", exportCSV);
  $("reportExport").addEventListener("click", exportCSV);
  $("settingsExport").addEventListener("click", () => {
    const data = {
      parcels,
      drivers,
      notificationSettings: readStore("smartcourier_notifications_v1", notificationDefaults),
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href=url; a.download="smartcouriersystem-backup.json"; a.click(); URL.revokeObjectURL(url);
    toast("Data backup downloaded.");
  });
  $("clearDataBtn").addEventListener("click", () => {
    if (!confirm("Permanently clear all demo parcels and drivers from this browser?")) return;
    parcels=[]; drivers=[]; save(); renderAll(); toast("Demo data cleared.");
  });
  $("globalSearch").addEventListener("keydown", e => {
    if (e.key === "Enter") {
      goTo("parcels"); $("parcelSearch").value = e.target.value; renderParcels();
    }
  });
  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault(); $("globalSearch").focus();
    }
    if (e.key === "Escape") document.querySelectorAll(".modal-backdrop.open").forEach(m => m.classList.remove("open"));
  });

// NOTIFICATION SETTINGS
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

const notificationSettings = {
  ...notificationDefaults,
  ...readStore("smartcourier_notifications_v1", {})
};

// Load saved settings
function loadNotificationSettings() {
  Object.keys(notificationDefaults).forEach(key => {
    const element = $(key);
    if (!element) return;

    if (element.type === "checkbox") {
      element.checked = notificationSettings[key];
    } else {
      element.value = notificationSettings[key];
    }
  });
}

function updateToggleLabels() {
  const smsStatus = $("smsStatus");
  const emailStatus = $("emailStatus");

  if (smsStatus) smsStatus.textContent = $("smsEnabled").checked ? "ON" : "OFF";
  if (emailStatus) emailStatus.textContent = $("emailEnabled").checked ? "ON" : "OFF";
}

$("smsEnabled").addEventListener("change", updateToggleLabels);
$("emailEnabled").addEventListener("change", updateToggleLabels);


// Save settings
$("saveNotificationSettings").addEventListener("click", () => {
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

  toast("Notification settings saved successfully.");
  updateToggleLabels();
});

loadNotificationSettings();
updateToggleLabels();

  function renderAll() {
    renderMetrics(); renderRecent(); renderParcels(); renderDeliveries(); renderDrivers(); renderReports(); driverOptions();
  }
  renderAll();
});
