import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, getDocs, getDoc, query, where,
  serverTimestamp, doc, updateDoc, deleteDoc, setDoc
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = id => document.getElementById(id);

let currentUser = null, customers = [], selectedCustomer = null, editingCustomerId = null;

$("loginBtn").onclick = async () => {
  $("loginMsg").textContent = "";
  try {
    await signInWithEmailAndPassword(auth, $("email").value.trim(), $("password").value);
  } catch (e) {
    $("loginMsg").textContent = e.message;
  }
};
$("logoutBtn").onclick = () => signOut(auth);
$("addCustomerBtn").onclick = () => openCustomerForm();
$("closeModal").onclick = () => closeCustomerForm();
$("closeDetail").onclick = () => $("customerPage").classList.add("hidden");
$("search").oninput = renderCustomers;

onAuthStateChanged(auth, async user => {
  currentUser = user;
  if (user) {
    $("loginPage").classList.add("hidden");
    $("app").classList.remove("hidden");
    await loadCustomers();
  } else {
    $("app").classList.add("hidden");
    $("loginPage").classList.remove("hidden");
  }
});

function openCustomerForm(customer = null) {
  editingCustomerId = customer?.id || null;
  $("modalTitle").textContent = customer ? "Edit Customer" : "Add Customer";
  $("customerName").value = customer?.name || "";
  $("customerWhatsapp").value = customer?.whatsapp || "";
  $("customerAddress").value = customer?.address || "";
  $("customerMsg").textContent = "";
  $("deleteCustomerBtn").classList.toggle("hidden", !customer);
  $("modal").classList.remove("hidden");
}

function closeCustomerForm() {
  $("modal").classList.add("hidden");
  editingCustomerId = null;
}

$("saveCustomer").onclick = async () => {
  const name = $("customerName").value.trim();
  const phone = $("customerWhatsapp").value.trim();
  const address = $("customerAddress").value.trim();
  if (!name) {
    $("customerMsg").textContent = "Customer name is required";
    return;
  }

  try {
    if (editingCustomerId) {
      const ref = doc(db, "customers", editingCustomerId);
      await updateDoc(ref, { name, whatsapp: phone, address, updatedAt: serverTimestamp() });
      const c = customers.find(x => x.id === editingCustomerId);
      if (c?.publicToken) await syncPublicCustomer(c);
    } else {
      const publicToken = randomToken();
      await addDoc(collection(db, "customers"), {
        name, whatsapp: phone, address,
        ownerId: currentUser.uid,
        publicToken,
        createdAt: serverTimestamp()
      });
    }
    closeCustomerForm();
    await loadCustomers();
  } catch (e) {
    $("customerMsg").textContent = e.message;
  }
};

$("deleteCustomerBtn").onclick = async () => {
  if (!editingCustomerId) return;
  const c = customers.find(x => x.id === editingCustomerId);
  if (!confirm(`Delete customer "${c?.name || ""}" and all transactions?`)) return;

  try {
    const txs = c?.transactions || [];
    for (const t of txs) await deleteDoc(doc(db, "transactions", t.id));
    if (c?.publicToken) {
      const publicRef = doc(db, "public_accounts", c.publicToken);
      await deleteDoc(publicRef).catch(() => {});
    }
    await deleteDoc(doc(db, "customers", editingCustomerId));
    closeCustomerForm();
    $("customerPage").classList.add("hidden");
    await loadCustomers();
  } catch (e) {
    $("customerMsg").textContent = e.message;
  }
};

async function loadCustomers() {
  try {
    const q = query(collection(db, "customers"), where("ownerId", "==", currentUser.uid));
    const snap = await getDocs(q);
    customers = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    customers.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

    for (const c of customers) {
      if (!c.publicToken) {
        c.publicToken = randomToken();
        await updateDoc(doc(db, "customers", c.id), { publicToken: c.publicToken });
      }

      const tq = query(collection(db, "transactions"), where("customerId", "==", c.id));
      const ts = await getDocs(tq);
      c.transactions = ts.docs.map(d => ({ id: d.id, ...d.data() }));
      c.transactions.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      c.balance = (c.transactions || []).reduce(
        (s, t) => s + (t.type === "credit" ? Number(t.amount) : -Number(t.amount)), 0
      );

      await syncPublicCustomer(c);
    }
    renderAll();
  } catch (e) {
    console.error("Firestore loadCustomers error:", e);
    alert("Could not load customers: " + (e.message || e));
  }
}

async function syncPublicCustomer(c) {
  if (!c?.publicToken) return;
  const ref = doc(db, "public_accounts", c.publicToken);
  await setDoc(ref, {
    name: c.name,
    whatsapp: c.whatsapp || "",
    address: c.address || "",
    balance: Number(c.balance || 0),
    updatedAt: serverTimestamp()
  });
  for (const t of (c.transactions || [])) {
    await setDoc(doc(db, "public_accounts", c.publicToken, "transactions", t.id), {
      type: t.type,
      amount: Number(t.amount),
      note: t.note || "",
      createdAt: t.createdAt || null
    });
  }
}

function renderAll() {
  $("customerCount").textContent = customers.length;
  $("totalCredit").textContent = money(customers.reduce(
    (s, c) => s + (c.transactions || []).filter(t => t.type === "credit").reduce((a, t) => a + Number(t.amount), 0), 0
  ));
  $("totalDebit").textContent = money(customers.reduce(
    (s, c) => s + (c.transactions || []).filter(t => t.type === "debit").reduce((a, t) => a + Number(t.amount), 0), 0
  ));
  $("totalBalance").textContent = money(customers.reduce((s, c) => s + c.balance, 0));

  const top = [...customers].sort((a, b) => b.balance - a.balance).filter(c => c.balance > 0).slice(0, 5);
  $("topDebtors").innerHTML = top.length
    ? top.map(c => `
      <div class="debtor" data-id="${c.id}">
        <div><b>${esc(c.name)}</b><small>${esc(c.whatsapp || "")}</small></div>
        <span class="amount positive">${money(c.balance)} AFN</span>
      </div>`).join("")
    : "<p class='muted'>No outstanding debt.</p>";

  document.querySelectorAll(".debtor").forEach(x => x.onclick = () => openCustomer(x.dataset.id));
  renderCustomers();
}

function renderCustomers() {
  const term = $("search").value.toLowerCase();
  const list = customers.filter(c =>
    c.name.toLowerCase().includes(term) || (c.whatsapp || "").includes(term)
  );

  $("customers").innerHTML = list.length ? list.map(c => `
    <div class="customer" data-id="${c.id}">
      <div class="customerMain">
        <div>
          <div class="row"><b>${esc(c.name)}</b><span class="balancePill ${c.balance > 0 ? "debt" : "paid"}">${money(c.balance)} AFN</span></div>
          <small>${esc(c.whatsapp || "")}</small>
        </div>
        <div class="customerActions">
          <button class="iconBtn editBtn" title="Edit customer">✏️</button>
          <button class="iconBtn reminderBtn" title="Send WhatsApp reminder">🔔</button>
          <button class="iconBtn deleteBtn" title="Delete customer">🗑️</button>
        </div>
      </div>
    </div>`).join("") : "<p class='muted'>No customers found.</p>";

  document.querySelectorAll(".customer").forEach(row => {
    const id = row.dataset.id;
    row.onclick = e => {
      if (e.target.closest(".customerActions")) return;
      openCustomer(id);
    };
    row.querySelector(".editBtn").onclick = e => {
      e.stopPropagation();
      const c = customers.find(x => x.id === id);
      openCustomerForm(c);
    };
    row.querySelector(".deleteBtn").onclick = async e => {
      e.stopPropagation();
      const c = customers.find(x => x.id === id);
      openCustomerForm(c);
      $("deleteCustomerBtn").click();
    };
    row.querySelector(".reminderBtn").onclick = e => {
      e.stopPropagation();
      const c = customers.find(x => x.id === id);
      sendReminder(c);
    };
  });
}

async function openCustomer(id) {
  selectedCustomer = customers.find(c => c.id === id);
  if (!selectedCustomer) return;

  $("detailName").textContent = selectedCustomer.name;
  $("detailPhone").textContent = selectedCustomer.whatsapp || "";
  $("detailBalance").textContent = `${money(selectedCustomer.balance)} AFN`;
  $("customerPage").classList.remove("hidden");
  renderHistory();
}

function renderHistory() {
  const ts = selectedCustomer.transactions || [];
  $("history").innerHTML = ts.length ? ts.map(t => `
    <div class="tx ${t.type === "credit" ? "txCredit" : "txDebit"}">
      <div class="row between">
        <b>${t.type === "credit" ? "Credit" : "Debit"} — ${money(t.amount)} AFN</b>
        <span>${date(t.createdAt)}</span>
      </div>
      <div class="note">${esc(t.note || "")}</div>
    </div>`).join("") : "<p class='muted'>No transactions.</p>";
}

$("saveTx").onclick = async () => {
  if (!selectedCustomer) return;

  const amount = Number($("txAmount").value);
  const type = $("txType").value;
  const note = $("txNote").value.trim();
  const sendWhatsApp = $("waToggle").checked;

  if (!amount || amount <= 0) return alert("Enter a valid amount");

  // Open immediately so browser popup blockers do not stop the WhatsApp window.
  const wa = (selectedCustomer.whatsapp || "").replace(/\D/g, "");
  const waWindow = sendWhatsApp && wa ? window.open("about:blank", "_blank") : null;

  try {
    const ref = await addDoc(collection(db, "transactions"), {
      customerId: selectedCustomer.id,
      ownerId: currentUser.uid,
      type, amount, note, createdAt: serverTimestamp()
    });

    $("txAmount").value = "";
    $("txNote").value = "";

    await loadCustomers();
    selectedCustomer = customers.find(c => c.id === selectedCustomer.id);
    await openCustomer(selectedCustomer.id);

    if (waWindow && selectedCustomer) {
      const message = buildPashtoMessage(selectedCustomer);
      waWindow.location.href = `https://wa.me/${wa}?text=${encodeURIComponent(message)}`;
    }
  } catch (e) {
    if (waWindow) waWindow.close();
    alert("Could not save transaction: " + e.message);
  }
};

function sendReminder(c) {
  if (!c) return;
  const wa = (c.whatsapp || "").replace(/\D/g, "");
  if (!wa) {
    alert("This customer has no WhatsApp number.");
    return;
  }
  const message = buildPashtoMessage(c);
  window.open(`https://wa.me/${wa}?text=${encodeURIComponent(message)}`, "_blank");
}

function buildPashtoMessage(c) {
  const d = new Intl.DateTimeFormat("ps-AF", {
    year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());

  return `سلام

محترم: ${c.name}

تاسو تر ${d} همدې تاریخ پورې زمونږ حساب پر تاسو پاتي دی.
پر تاسو پاتې پیسې: ${money(c.balance)} افغانۍ دي.

هیله ده حساب تاسو په خپل وخت راته ورسوئ،
مننه.

ستاسو د حسابونو د لیدلو لپاره په لاندې لینک کلیک کولای شئ.

${portalUrl(c.publicToken)}`;
}

function portalUrl(token) {
  return `${location.origin}${location.pathname.replace(/\/$/, "")}/customer.html?token=${encodeURIComponent(token)}`;
}

function randomToken() {
  return `${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`;
}

const money = n => Number(n || 0).toLocaleString("en-US", {
  minimumFractionDigits: 2, maximumFractionDigits: 2
});
const date = x => x?.toDate ? x.toDate().toLocaleString("en-GB") : "Just now";
const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
}[m]));

$("detailReminder").onclick = () => sendReminder(selectedCustomer);
