 
 function registerUser() {
    let username = document.getElementById("registerUsername").value.trim();
    let email = document.getElementById("registerEmail").value.trim();
    let password = document.getElementById("registerPassword").value.trim();
    let confirmPassword = document.getElementById("confirmPassword").value.trim();

    if (username === "" || email === "" || password === "" || confirmPassword === "") {
        alert("Please fill all fields");
        return;
    }

    if (password !== confirmPassword) {
        alert("Passwords do not match");
        return;
    }

    alert("Registration successful!");
    window.location.href = "index.html";
}


function login() {
 
let username=
document.getElementById("username").value.trim();
let password=
document.getElementById("password").value.trim();

if (username === "Priya" && password === "1234") {
    alert("Login successful!");
    window.location.href= "dashboard.html";  
} else {
    alert("Invalid username or password");
}
}function login() {
 
let username=
document.getElementById("username").value.trim();
let password=
document.getElementById("password").value.trim();

if (username === "Priya" && password === "1234") {
    alert("Login successful!");
    window.location.href= "dashboard.html";  
} else {
    alert("Invalid username or password");
} 
}
function addMedicine(){
    const form = document.getElementById("addMedicineForm");
    form.hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "center" });
    document.getElementById("medicineName").focus();
}
function closeMedicineForm(){
    document.getElementById("addMedicineForm").hidden = true;
}
function viewMedicine(){
    document.getElementById("inventory").scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateMedicine(button){
    let row = button && button.closest("tr");
    if (!row) {
        const name = prompt("Enter medicine name to update:");
        if (name === null) return;
        const rows = document.querySelectorAll("#medicineTable tbody tr");
        row = Array.from(rows).find(item => item.cells[0].textContent.trim().toLowerCase() === name.trim().toLowerCase());
    }
    if (!row) {
        alert("Medicine not found!");
        return;
    }
    const newQuantity = prompt("Enter new quantity:", row.cells[2].textContent.trim());
    if (newQuantity === null) return;
    if (newQuantity.trim() === "" || !Number.isFinite(Number(newQuantity)) || Number(newQuantity) < 0) {
        alert("Enter a valid quantity.");
        return;
    }
    row.cells[2].textContent = String(Number(newQuantity));
    refreshInventorySummary();
}

function deleteMedicine(button){
    let row = button && button.closest("tr");
    if (!row) {
        const name = prompt("Enter medicine name to delete:");
        if (name === null) return;
        const rows = document.querySelectorAll("#medicineTable tbody tr");
        row = Array.from(rows).find(item => item.cells[0].textContent.trim().toLowerCase() === name.trim().toLowerCase());
    }
    if (!row) {
        alert("Medicine not found!");
        return;
    }
    if (confirm(`Delete ${row.cells[0].textContent.trim()} from inventory?`)) {
        row.remove();
        refreshInventorySummary();
    }
}
function logout(){
    window.location.href="index.html";
}
function saveMedicine(){
    const name = document.getElementById("medicineName").value.trim();
    const id = document.getElementById("medicineId").value.trim();
    const quantity = document.getElementById("quantity").value;
    const price = document.getElementById("price").value;
    const expiry = document.getElementById("expiryDate").value;
    if(name === "" || id === "" || quantity === "" || price === "" || expiry === ""){
        alert("Please fill all fields");
        return;
    }
    const duplicateId = Array.from(document.querySelectorAll("#medicineTable tbody tr")).some(row => row.cells[1].textContent.trim().toLowerCase() === id.toLowerCase());
    if (duplicateId) {
        alert("A medicine with this ID already exists.");
        return;
    }
    const row = document.querySelector("#medicineTable tbody").insertRow();
    [name, id, String(Number(quantity)), `$${Number(price).toFixed(2)}`, expiry].forEach(value => {
        row.insertCell().textContent = value;
    });
    row.cells[0].className = "medicine-name";
    row.cells[2].className = "quantity-cell";
    const statusCell = row.insertCell();
    const badge = document.createElement("span");
    badge.className = `stock-badge ${Number(quantity) <= 25 ? "low-stock" : "in-stock"}`;
    badge.textContent = Number(quantity) <= 25 ? "Low stock" : "In stock";
    statusCell.appendChild(badge);
    const actionsCell = row.insertCell();
    actionsCell.className = "row-actions";
    actionsCell.innerHTML = '<button type="button" aria-label="Update medicine">Edit</button><button type="button" aria-label="Delete medicine">Delete</button>';
    actionsCell.children[0].addEventListener("click", () => updateMedicine(actionsCell.children[0]));
    actionsCell.children[1].addEventListener("click", () => deleteMedicine(actionsCell.children[1]));
    document.querySelector(".medicine-form").reset();
    closeMedicineForm();
    refreshInventorySummary();
}
function searchMedicine(){
    const searchText = document.getElementById("searchInput").value.trim().toLowerCase();
    document.querySelectorAll("#medicineTable tbody tr").forEach(row => {
        const matches = row.cells[0].textContent.toLowerCase().includes(searchText) || row.cells[1].textContent.toLowerCase().includes(searchText);
        row.style.display = matches ? "" : "none";
    });
}

function refreshInventorySummary(){
    const rows = Array.from(document.querySelectorAll("#medicineTable tbody tr"));
    let units = 0;
    let stockValue = 0;
    let lowStock = 0;
    rows.forEach(row => {
        const quantity = Number(row.cells[2].textContent) || 0;
        const price = Number(row.cells[3].textContent.replace(/[^\d.]/g, "")) || 0;
        units += quantity;
        stockValue += quantity * price;
        if (quantity <= 25) lowStock++;
        const badge = row.cells[5].querySelector(".stock-badge");
        badge.className = `stock-badge ${quantity <= 25 ? "low-stock" : "in-stock"}`;
        badge.textContent = quantity <= 25 ? "Low stock" : "In stock";
    });
    document.getElementById("productCount").textContent = rows.length;
    document.getElementById("unitCount").textContent = units.toLocaleString();
    document.getElementById("lowStockCount").textContent = lowStock;
    document.getElementById("stockValue").textContent = `$${stockValue.toFixed(2)}`;
    document.getElementById("inventoryCount").textContent = `Showing ${rows.length} ${rows.length === 1 ? "medicine" : "medicines"}`;
}

document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("medicineTable")) refreshInventorySummary();
});