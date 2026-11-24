// MediStock frontend: plain JavaScript + Fetch API (no frontend framework).
const API_BASE = `${window.MEDISTOCK_API_URL || "http://localhost:8080"}/api`;

async function apiRequest(path, options = {}) {
  const token = sessionStorage.getItem("medistockToken");
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text || "Unexpected server response" };
  }
  if (!response.ok)
    throw new Error(data.message || `Request failed (${response.status})`);
  return data;
}

function formBody(values) {
  return new URLSearchParams(values).toString();
}
function showError(error) {
  alert(error.message || "Something went wrong");
}

async function registerUser() {
  const username = document.getElementById("registerUsername").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  if (!username || !email || !password || !confirmPassword)
    return alert("Please fill all fields");
  if (password !== confirmPassword) return alert("Passwords do not match");
  if (password.length < 8)
    return alert("Password must contain at least 8 characters");
  try {
    await apiRequest("/register", {
      method: "POST",
      body: formBody({ username, email, password }),
    });
    alert("Registration successful! Please log in.");
    window.location.href = "index.html";
  } catch (error) {
    showError(error);
  }
}

async function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  if (!username || !password) return alert("Enter username and password");
  try {
    const data = await apiRequest("/login", {
      method: "POST",
      body: formBody({ username, password }),
    });
    sessionStorage.setItem("medistockUser", JSON.stringify(data.user));
    sessionStorage.setItem("medistockToken", data.token);
    window.location.href = "dashboard.html";
  } catch (error) {
    showError(error);
  }
}

function addMedicine() {
  const form = document.getElementById("addMedicineForm");
  if (!form) return;
  form.hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "center" });
  document.getElementById("medicineName").focus();
}
function closeMedicineForm() {
  const form = document.getElementById("addMedicineForm");
  if (form) form.hidden = true;
}
function viewMedicine() {
  document
    .getElementById("inventory")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}
function logout() {
  sessionStorage.removeItem("medistockUser");
  sessionStorage.removeItem("medistockToken");
  window.location.href = "index.html";
}

async function loadMedicines() {
  const tbody = document.getElementById("medicineTableBody");
  if (!tbody) return;
  try {
    const medicines = await apiRequest("/medicines");
    tbody.replaceChildren();
    medicines.forEach(renderMedicineRow);
    refreshInventorySummary();
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="7">Unable to load inventory: ${escapeHtml(error.message)}</td></tr>`;
  }
}

function renderMedicineRow(medicine) {
  const tbody = document.getElementById("medicineTableBody");
  const row = document.createElement("tr");
  row.dataset.id = medicine.id;
  const values = [
    medicine.name,
    medicine.medicineCode,
    medicine.quantity,
    `₹${Number(medicine.unitPrice).toFixed(2)}`,
    medicine.expiryDate,
  ];
  values.forEach((value, index) => {
    const cell = row.insertCell();
    cell.textContent = value;
    if (index === 0) cell.className = "medicine-name";
    if (index === 2) cell.className = "quantity-cell";
  });
  const statusCell = row.insertCell();
  const badge = document.createElement("span");
  badge.className = `stock-badge ${Number(medicine.quantity) <= 25 ? "low-stock" : "in-stock"}`;
  badge.textContent =
    Number(medicine.quantity) <= 25 ? "Low stock" : "In stock";
  statusCell.appendChild(badge);
  const actions = row.insertCell();
  actions.className = "row-actions";
  const updateButton = document.createElement("button");
  updateButton.type = "button";
  updateButton.textContent = "Edit";
  updateButton.addEventListener("click", () => updateMedicine(updateButton));
  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.textContent = "Delete";
  deleteButton.addEventListener("click", () => deleteMedicine(deleteButton));
  actions.append(updateButton, deleteButton);
  tbody.appendChild(row);
}

async function updateMedicine(button) {
  const row = button?.closest("tr");
  if (!row) return;
  const newQuantity = prompt(
    "Enter new quantity:",
    row.cells[2].textContent.trim(),
  );
  if (newQuantity === null) return;
  if (
    newQuantity.trim() === "" ||
    !Number.isInteger(Number(newQuantity)) ||
    Number(newQuantity) < 0
  )
    return alert("Enter a valid whole-number quantity.");
  try {
    await apiRequest("/medicines/update-quantity", {
      method: "POST",
      body: formBody({ id: row.dataset.id, quantity: newQuantity }),
    });
    await loadMedicines();
  } catch (error) {
    showError(error);
  }
}

async function deleteMedicine(button) {
  const row = button?.closest("tr");
  if (!row) return;
  if (!confirm(`Delete ${row.cells[0].textContent.trim()} from inventory?`))
    return;
  try {
    await apiRequest("/medicines/delete", {
      method: "POST",
      body: formBody({ id: row.dataset.id }),
    });
    await loadMedicines();
  } catch (error) {
    showError(error);
  }
}

async function saveMedicine() {
  const values = {
    name: document.getElementById("medicineName").value.trim(),
    medicineCode: document.getElementById("medicineId").value.trim(),
    quantity: document.getElementById("quantity").value,
    unitPrice: document.getElementById("price").value,
    expiryDate: document.getElementById("expiryDate").value,
  };
  if (Object.values(values).some((value) => value === ""))
    return alert("Please fill all fields");
  if (Number(values.quantity) < 0 || Number(values.unitPrice) < 0)
    return alert("Quantity and price cannot be negative");
  try {
    await apiRequest("/medicines", { method: "POST", body: formBody(values) });
    document.querySelector(".medicine-form").reset();
    closeMedicineForm();
    await loadMedicines();
  } catch (error) {
    showError(error);
  }
}

function searchMedicine() {
  const searchText = document
    .getElementById("searchInput")
    .value.trim()
    .toLowerCase();
  document.querySelectorAll("#medicineTableBody tr").forEach((row) => {
    const matches =
      row.cells[0].textContent.toLowerCase().includes(searchText) ||
      row.cells[1].textContent.toLowerCase().includes(searchText);
    row.style.display = matches ? "" : "none";
  });
}

function refreshInventorySummary() {
  const rows = Array.from(document.querySelectorAll("#medicineTableBody tr"));
  let units = 0,
    stockValue = 0,
    lowStock = 0;
  rows.forEach((row) => {
    const quantity = Number(row.cells[2].textContent) || 0;
    const price = Number(row.cells[3].textContent.replace(/[^\d.]/g, "")) || 0;
    units += quantity;
    stockValue += quantity * price;
    if (quantity <= 25) lowStock++;
    const badge = row.cells[5]?.querySelector(".stock-badge");
    if (badge) {
      badge.className = `stock-badge ${quantity <= 10 ? "low-stock" : "in-stock"}`;
      badge.textContent = quantity <= 10 ? "Low stock" : "In stock";
    }
  });
  document.getElementById("productCount").textContent = rows.length;
  document.getElementById("unitCount").textContent = units.toLocaleString();
  document.getElementById("lowStockCount").textContent = lowStock;
  document.getElementById("stockValue").textContent =
    `₹${stockValue.toFixed(2)}`;
  document.getElementById("inventoryCount").textContent =
    `Showing ${rows.length} ${rows.length === 1 ? "medicine" : "medicines"}`;
}
function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
}

document.addEventListener("DOMContentLoaded", () => {
  const tbody = document.getElementById("medicineTableBody");
  if (tbody) {
    const user = JSON.parse(sessionStorage.getItem("medistockUser") || "null");
    if (!user || !sessionStorage.getItem("medistockToken")) {
      window.location.href = "index.html";
      return;
    }
    const hour = new Date().getHours();
    const greeting =
      hour < 12
        ? "Good morning"
        : hour < 18
          ? "Good afternoon"
          : "Good evening";
    document.getElementById("welcomeHeading").textContent =
      `${greeting}, ${user.username}`;
    document.getElementById("loggedInUser").innerHTML =
      `${escapeHtml(user.username)}<small>Administrator</small>`;
    loadMedicines();
  }
});
