// ---------- 1. DATA ----------
// All transactions live in this array of objects. It is saved to localStorage.
let transactions = JSON.parse(localStorage.getItem("transactions")) || [];
let editingId = null;   // null = adding, otherwise the id being edited
let chart = null;       // Chart.js instance

const CATEGORIES = ["Food","Transport","Bills","Shopping","Health","Education","Salary","Other"];

// ---------- 2. GRAB ELEMENTS ----------
const $ = (id) => document.getElementById(id);
const form = $("txForm"), titleEl = $("title"), amountEl = $("amount"),
      typeEl = $("type"), categoryEl = $("category"), dateEl = $("date"),
      errorEl = $("error"), listEl = $("list");

// ---------- 3. HELPERS ----------
const money = (n) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function save() {
  localStorage.setItem("transactions", JSON.stringify(transactions));
}

// Escape text so user input can never inject HTML (basic security)
function esc(text) {
  const d = document.createElement("div");
  d.textContent = text;
  return d.innerHTML;
}

// ---------- 4. VALIDATION ----------
function validate() {
  if (titleEl.value.trim() === "") return "Please enter a title.";
  const amount = parseFloat(amountEl.value);
  if (isNaN(amount) || amount <= 0) return "Amount must be greater than 0.";
  if (!dateEl.value) return "Please choose a date.";
  return "";
}

// ---------- 5. ADD / EDIT / DELETE ----------
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const msg = validate();
  errorEl.textContent = msg;
  if (msg) return;

  const data = {
    title: titleEl.value.trim(),
    amount: parseFloat(amountEl.value),
    type: typeEl.value,
    category: categoryEl.value,
    date: dateEl.value,
  };

  if (editingId) {
    // update the existing transaction
    transactions = transactions.map((t) => (t.id === editingId ? { ...t, ...data } : t));
  } else {
    // create a new one with a unique id
    transactions.push({ id: Date.now().toString(), ...data });
  }
  save();
  resetForm();
  render();
});

function startEdit(id) {
  const t = transactions.find((x) => x.id === id);
  titleEl.value = t.title;
  amountEl.value = t.amount;
  typeEl.value = t.type;
  categoryEl.value = t.category;
  dateEl.value = t.date;
  editingId = id;
  $("formTitle").textContent = "Edit transaction";
  $("saveBtn").textContent = "Save changes";
  $("cancelBtn").hidden = false;
  form.scrollIntoView({ behavior: "smooth" });
}

function deleteTx(id) {
  if (!confirm("Delete this transaction?")) return;
  transactions = transactions.filter((t) => t.id !== id);
  save();
  render();
}

function resetForm() {
  form.reset();
  dateEl.value = new Date().toISOString().slice(0, 10);   // default to today
  editingId = null;
  errorEl.textContent = "";
  $("formTitle").textContent = "Add transaction";
  $("saveBtn").textContent = "Add transaction";
  $("cancelBtn").hidden = true;
}
$("cancelBtn").addEventListener("click", resetForm);

// ---------- 6. FILTERING ----------
function getFiltered() {
  const q = $("search").value.trim().toLowerCase();
  const cat = $("filterCategory").value;
  const month = $("filterMonth").value;   // format: YYYY-MM
  return transactions
    .filter((t) => t.title.toLowerCase().includes(q))
    .filter((t) => cat === "all" || t.category === cat)
    .filter((t) => !month || t.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date));   // newest first
}

["search", "filterCategory", "filterMonth"].forEach((id) =>
  $(id).addEventListener("input", render)
);
$("clearBtn").addEventListener("click", () => {
  $("search").value = "";
  $("filterCategory").value = "all";
  $("filterMonth").value = "";
  render();
});

// ---------- 7. RENDER (updates the whole screen) ----------
function render() {
  const items = getFiltered();

  // Totals use the filtered items so they match what is shown
  const income = items.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = items.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  $("income").textContent = money(income);
  $("expense").textContent = money(expense);
  $("balance").textContent = money(income - expense);

  // List
  listEl.innerHTML = items.map((t) => `
    <li class="${t.type}">
      <div>
        <div class="name">${esc(t.title)}</div>
        <div class="meta">${esc(t.category)} &middot; ${t.date}</div>
      </div>
      <div class="amt">${t.type === "income" ? "+" : "-"}${money(t.amount)}</div>
      <div class="row-actions">
        <button class="ghost" onclick="startEdit('${t.id}')">Edit</button>
        <button class="ghost" onclick="deleteTx('${t.id}')">Delete</button>
      </div>
    </li>`).join("");
  $("listEmpty").hidden = items.length > 0;

  drawChart(items);
}

// ---------- 8. CHART ----------
function drawChart(items) {
  // Sum the expenses for each category
  const totals = {};
  items.filter((t) => t.type === "expense").forEach((t) => {
    totals[t.category] = (totals[t.category] || 0) + t.amount;
  });
  const labels = Object.keys(totals);
  $("chartEmpty").hidden = labels.length > 0;

  if (chart) chart.destroy();   // remove the old chart before drawing a new one
  if (labels.length === 0) return;

  const textColor = getComputedStyle(document.documentElement).getPropertyValue("--text");
  chart = new Chart($("chart"), {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: Object.values(totals),
        backgroundColor: ["#0f766e","#c2410c","#4f46e5","#ca8a04","#be185d","#0369a1","#65a30d","#64748b"],
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,   // lets the chart fit its box on any screen
      plugins: { legend: { position: "bottom", labels: { color: textColor } } },
    },
  });
}

// ---------- 9. DARK MODE ----------
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  $("themeBtn").textContent = theme === "dark" ? "Light mode" : "Dark mode";
  localStorage.setItem("theme", theme);
  render();   // redraw so the chart legend color matches
}
$("themeBtn").addEventListener("click", () => {
  const now = document.documentElement.getAttribute("data-theme");
  applyTheme(now === "dark" ? "light" : "dark");
});

// ---------- 10. START THE APP ----------
CATEGORIES.forEach((c) => {
  const o = document.createElement("option");
  o.value = o.textContent = c;
  $("filterCategory").appendChild(o);
});
resetForm();
applyTheme(localStorage.getItem("theme") || "light");
