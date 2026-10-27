import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  Timestamp,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";


/* =========================================
   FIREBASE
========================================= */

const app = initializeApp(firebaseConfig);

// Default transaction date to today, while allowing manual selection.
const txDateInput = document.getElementById("txDate");
if (txDateInput) {
  const today = new Date();
  txDateInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

const auth = getAuth(app);

const db = getFirestore(app);

const $ = id => document.getElementById(id);

/* Persistent light/dark appearance preference; stored locally, never in Firebase. */
function applyTheme(theme) {
  const dark = theme === "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  const toggle = $("darkModeToggle");
  if (toggle) toggle.checked = dark;
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute("content", dark ? "#0b1220" : "#f5f8fc");
}
let savedTheme = "light";
try { savedTheme = localStorage.getItem("ccm-theme") === "dark" ? "dark" : "light"; } catch (_) {}
applyTheme(savedTheme);

/* Consistent lightweight outline icons (inline SVG; no external dependency). */
const ICONS = {
  settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="m19.4 15 .1.1 1.1.9-1.4 2.4-1.4-.6a7.9 7.9 0 0 1-1.5.9l-.2 1.5h-2.8l-.2-1.5a7.9 7.9 0 0 1-1.5-.9l-1.4.6-1.4-2.4 1.1-.9a7.2 7.2 0 0 1 0-1.8l-1.1-.9 1.4-2.4 1.4.6a7.9 7.9 0 0 1 1.5-.9l.2-1.5h2.8l.2 1.5a7.9 7.9 0 0 1 1.5.9l1.4-.6 1.4 2.4-1.1.9a7.2 7.2 0 0 1 0 1.8Z"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16.5-.8 4.3 4.3-.8L19.7 7.8a2.1 2.1 0 0 0-3-3L4 16.5Z"/><path d="m14.8 6.7 3 3"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  message: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.1-4.9A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8 11h.01M12 11h.01M16 11h.01"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>'
};
const icon = name => ICONS[name] || "";




/* =========================================
   GLOBAL VARIABLES
========================================= */

let currentUser = null;

let customers = [];

let selectedCustomer = null;

let editingCustomerId = null;


/* =========================================
   LOGIN
========================================= */

const loginForm = $("loginForm");
const loginButton = $("loginBtn");

loginForm.onsubmit = async (event) => {
  event.preventDefault();
  $("loginMsg").textContent = "";

  // Firebase Email/Password auth still requires the full email address.
  // The user enters only the local part; append the agreed Gmail domain.
  const username = $("email").value.trim().toLowerCase().replace(/@gmail\.com$/i, "");
  const password = $("password").value;

  if (!username || !password) {
    $("loginMsg").textContent = "Please enter username and password.";
    return;
  }
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(username)) {
    $("loginMsg").textContent = "Enter a valid Gmail username without @gmail.com.";
    return;
  }

  loginButton.disabled = true;
  loginButton.classList.add("isLoading");
  loginButton.dataset.originalText = loginButton.textContent;
  loginButton.textContent = "Signing in…";
  try {
    await signInWithEmailAndPassword(auth, `${username}@gmail.com`, password);
  } catch (e) {
    console.error("Login error:", e);
    $("loginMsg").textContent = e.code === "auth/invalid-credential" || e.code === "auth/user-not-found" || e.code === "auth/wrong-password"
      ? "Incorrect username or password."
      : e.code === "auth/too-many-requests"
        ? "Too many attempts. Please try again later."
        : e.message;
  } finally {
    loginButton.disabled = false;
    loginButton.classList.remove("isLoading");
    loginButton.innerHTML = 'Sign in <span aria-hidden="true">→</span>';
  }
};

$("toggleLoginPassword").onclick = () => {
  const field = $("password");
  field.type = field.type === "password" ? "text" : "password";
  $("toggleLoginPassword").setAttribute("aria-label", field.type === "password" ? "Show password" : "Hide password");
};


/* =========================================
   LOGOUT
========================================= */

$("logoutBtn").onclick = () => {

  signOut(auth);

};

/* Separate dashboard, customers and settings pages. */
function showPage(pageId) {
  ["dashboardView", "reportView", "customersView", "transactionsView", "settingsView"].forEach(id => {
    const node = $(id); if (node) node.classList.toggle("hidden", id !== pageId);
  });
  document.querySelectorAll(".navItem").forEach(btn => btn.classList.toggle("active", btn.dataset.page === pageId));
  if (pageId === "customersView") setTimeout(() => $("search")?.focus(), 0);
  window.scrollTo({ top: 0, behavior: "smooth" });
}
document.querySelectorAll(".navItem").forEach(btn => btn.addEventListener("click", () => showPage(btn.dataset.page)));
// Dashboard greeting shows the signed-in username; customer creation remains on the Customers page.
/* Account settings use Firebase Authentication; passwords are never stored in Firestore. */
function openSettingsPage() {
  if (!currentUser) return;
  $("settingsEmail").value = currentUser.email || "";
  $("settingsCurrentPassword").value = "";
  $("settingsNewPassword").value = "";
  $("settingsMsg").textContent = "";
  showPage("settingsView");
}
const settingsShortcut = $("settingsBtn"); if (settingsShortcut) settingsShortcut.onclick = openSettingsPage;
const darkModeToggle = $("darkModeToggle");
if (darkModeToggle) darkModeToggle.addEventListener("change", () => {
  const theme = darkModeToggle.checked ? "dark" : "light";
  applyTheme(theme);
  try { localStorage.setItem("ccm-theme", theme); } catch (_) {}
});
$("closeSettings").onclick = () => showPage("dashboardView");
$("saveSettings").onclick = async () => {
  const user = auth.currentUser;
  const email = $("settingsEmail").value.trim();
  const currentPassword = $("settingsCurrentPassword").value;
  const newPassword = $("settingsNewPassword").value;
  const msg = $("settingsMsg"); msg.textContent = "";
  if (!user) { msg.textContent = "Please sign in again."; return; }
  if (!email) { msg.textContent = "Please enter an email address."; return; }
  if (newPassword && newPassword.length < 6) { msg.textContent = "New password must be at least 6 characters."; return; }
  const changeEmail = email !== (user.email || "");
  const changePassword = Boolean(newPassword);
  if (!changeEmail && !changePassword) { msg.textContent = "There are no changes to save."; return; }
  if (!currentPassword) { msg.textContent = "Enter your current password to verify your identity."; return; }
  const btn = $("saveSettings"); btn.disabled = true;
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email || email, currentPassword));
    if (changeEmail) await updateEmail(user, email);
    if (changePassword) await updatePassword(user, newPassword);
    $("settingsCurrentPassword").value = ""; $("settingsNewPassword").value = "";
    msg.textContent = "Settings updated successfully.";
  } catch (e) {
    console.error("Account settings error:", e);
    msg.textContent = e.code === "auth/requires-recent-login" ? "Please sign out and sign in again, then retry." : e.code === "auth/email-already-in-use" ? "This email is already in use." : e.code === "auth/invalid-credential" ? "Current password is incorrect." : e.message;
  } finally { btn.disabled = false; }
};


/* =========================================
   BASIC BUTTONS
========================================= */

$("addCustomerBtn").onclick = () => {

  openCustomerForm();

};


$("closeModal").onclick = () => {

  closeCustomerForm();

};


$("closeDetail").onclick = () => {

  $("customerPage")
    .classList
    .add("hidden");

};


$("search").oninput = () => {

  renderCustomers();

};


function updateDashboardDate() {
  const now = new Date();
  const dayEl = $("dashboardDay");
  const dateEl = $("dashboardDate");
  if (dayEl) dayEl.textContent = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(now);
  if (dateEl) dateEl.textContent = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(now);
}

// Refresh the date automatically while the dashboard remains open.
updateDashboardDate();
setInterval(updateDashboardDate, 60 * 1000);

/* Complete transaction history page with inclusive date-range filtering. */
function transactionSortDate(t) {
  if (typeof t.transactionDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.transactionDate)) return t.transactionDate;
  const stamp = t.createdAt?.toDate?.() || (t.createdAt?.seconds ? new Date(t.createdAt.seconds * 1000) : null);
  if (stamp && !Number.isNaN(stamp.getTime())) {
    return `${stamp.getFullYear()}-${String(stamp.getMonth()+1).padStart(2,"0")}-${String(stamp.getDate()).padStart(2,"0")}`;
  }
  return "";
}
function getAllTransactions() {
  return customers.flatMap(c => (c.transactions || []).map(t => ({...t, customerName:c.name || "Unnamed customer", customerId:c.id, dateKey:transactionSortDate(t)})))
    .sort((a,b) => (b.dateKey || "").localeCompare(a.dateKey || "") || ((b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)));
}
function renderTransactionsHistory() {
  const from = $("transactionsFromDate")?.value || "";
  const to = $("transactionsToDate")?.value || "";
  const msg = $("transactionsFilterMsg");
  if (from && to && from > to) {
    if (msg) msg.textContent = "The start date must be on or before the end date.";
    return;
  }
  if (msg) msg.textContent = "";
  const all = getAllTransactions();
  const filtered = all.filter(t => (!from || (t.dateKey && t.dateKey >= from)) && (!to || (t.dateKey && t.dateKey <= to)));
  const credit = filtered.filter(t => t.type === "credit").reduce((sum,t)=>sum+Number(t.amount||0),0);
  const debit = filtered.filter(t => t.type === "debit").reduce((sum,t)=>sum+Number(t.amount||0),0);
  $("filteredCreditTotal").textContent = money(credit);
  $("filteredDebitTotal").textContent = money(debit);
  $("filteredNetTotal").textContent = money(credit-debit);
  $("filteredTransactionCount").textContent = String(filtered.length);
  $("transactionsPeriodLabel").textContent = from || to ? `${from || "Beginning"} — ${to || "Today"}` : "All dates";
  const body = $("transactionsHistoryBody");
  if (!filtered.length) {
    body.innerHTML = '<tr><td colspan="6" class="transactionsEmpty">No transactions found for the selected date range.</td></tr>';
    return;
  }
  body.innerHTML = filtered.map(t => {
    const isCredit = t.type === "credit";
    const balance = customers.find(c=>c.id===t.customerId)?.balance ?? 0;
    return `<tr><td>${esc(t.dateKey || "—")}</td><td><button type="button" class="transactionCustomerLink" data-customer-id="${esc(t.customerId)}">${esc(t.customerName)}</button></td><td><span class="transactionPill ${isCredit?"creditPill":"debitPill"}">${isCredit?"Credit":"Debit / Payment"}</span></td><td>${esc(t.note || "—")}</td><td class="amountCell ${isCredit?"hasDebt":"settled"}">${isCredit?"+":"−"}${money(t.amount)}</td><td>${money(balance)}</td></tr>`;
  }).join("");
  body.querySelectorAll(".transactionCustomerLink").forEach(btn=>btn.addEventListener("click",()=>openCustomer(btn.dataset.customerId)));
}
$("filterTransactionsBtn")?.addEventListener("click", renderTransactionsHistory);
$("clearTransactionsFilterBtn")?.addEventListener("click", () => { $("transactionsFromDate").value=""; $("transactionsToDate").value=""; renderTransactionsHistory(); });

/* =========================================
   AUTH STATE
========================================= */

onAuthStateChanged(
  auth,
  async user => {

    currentUser = user;

    if (user) {

      const usernameEl = $("dashboardUsername");
      if (usernameEl) {
        const emailName = (user.email || "").split("@")[0].replace(/[._-]+/g, " ").trim();
        const displayName = emailName
          .split(/\\s+/)
          .filter(Boolean)
          .map(part => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ");
        usernameEl.textContent = displayName || "User";
      }

      $("loginPage")
        .classList
        .add("hidden");

      $("app")
        .classList
        .remove("hidden");

      await loadCustomers();

    } else {

      $("app")
        .classList
        .add("hidden");

      $("loginPage")
        .classList
        .remove("hidden");

    }

  }
);


/* =========================================
   CUSTOMER FORM
========================================= */

function openCustomerForm(customer = null) {

  editingCustomerId =
    customer?.id || null;


  $("modalTitle").textContent =
    customer
      ? "Edit Customer"
      : "Add Customer";


  $("customerName").value =
    customer?.name || "";


  $("customerWhatsapp").value =
    customer?.whatsapp || "";


  $("customerAddress").value =
    customer?.address || "";


  $("customerMsg").textContent = "";


  $("deleteCustomerBtn")
    .classList
    .toggle(
      "hidden",
      !customer
    );


  $("modal")
    .classList
    .remove("hidden");

}


function closeCustomerForm() {

  $("modal")
    .classList
    .add("hidden");

  editingCustomerId = null;

}


/* =========================================
   SAVE CUSTOMER
========================================= */

$("saveCustomer").onclick =
  async () => {

    const name =
      $("customerName")
        .value
        .trim();


    const phone =
      $("customerWhatsapp")
        .value
        .trim();


    const address =
      $("customerAddress")
        .value
        .trim();


    if (!name) {

      $("customerMsg").textContent =
        "Customer name is required";

      return;
    }


    try {

      if (editingCustomerId) {

        const ref =
          doc(
            db,
            "customers",
            editingCustomerId
          );


        await updateDoc(
          ref,
          {
            name,
            whatsapp: phone,
            address,
            updatedAt:
              serverTimestamp()
          }
        );


      } else {

        const publicToken =
          randomToken();


        await addDoc(
          collection(
            db,
            "customers"
          ),
          {
            name,
            whatsapp: phone,
            address,
            ownerId:
              currentUser.uid,
            publicToken,
            createdAt:
              serverTimestamp()
          }
        );

      }


      closeCustomerForm();

      await loadCustomers();


    } catch (e) {

      console.error(
        "Save customer error:",
        e
      );

      $("customerMsg").textContent =
        e.message;

    }

  };


/* =========================================
   DELETE CUSTOMER
========================================= */

$("deleteCustomerBtn").onclick =
  async () => {

    if (!editingCustomerId) {
      return;
    }


    const c =
      customers.find(
        x =>
          x.id ===
          editingCustomerId
      );


    if (
      !confirm(
        `Delete customer "${c?.name || ""}" and all transactions?`
      )
    ) {

      return;
    }


    try {

      const txs =
        c?.transactions || [];


      for (const t of txs) {

        await deleteDoc(
          doc(
            db,
            "transactions",
            t.id
          )
        );

      }


      /* Delete public account */

      if (c?.publicToken) {

        const publicRef =
          doc(
            db,
            "public_accounts",
            c.publicToken
          );


        await deleteDoc(
          publicRef
        ).catch(
          () => {}
        );

      }


      /* Delete customer */

      await deleteDoc(
        doc(
          db,
          "customers",
          editingCustomerId
        )
      );


      closeCustomerForm();


      $("customerPage")
        .classList
        .add("hidden");


      await loadCustomers();


    } catch (e) {

      console.error(
        "Delete customer error:",
        e
      );

      $("customerMsg").textContent =
        e.message;

    }

  };


/* =========================================
   LOAD CUSTOMERS
========================================= */

async function loadCustomers() {
  if (!currentUser) return;
  const startedAt = performance.now();
  try {
    const customerQuery = query(collection(db, "customers"), where("ownerId", "==", currentUser.uid));
    const customerSnap = await getDocs(customerQuery);
    customers = customerSnap.docs.map(d => ({ id: d.id, ...d.data(), transactions: [], balance: 0 }));
    customers.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    // Render the customer list immediately; transaction data is loaded in batches below.
    renderAll();

    // Make sure public tokens exist without serializing writes one customer at a time.
    await Promise.all(customers.map(async c => {
      if (!c.publicToken) {
        c.publicToken = randomToken();
        await updateDoc(doc(db, "customers", c.id), { publicToken: c.publicToken });
      }
    }));

    // Fetch this user's transactions in one Firestore query instead of one query per customer.
    // Filtering by ownerId also matches the existing Firestore security rules.
    const grouped = new Map(customers.map(c => [c.id, c]));
    if (customers.length) {
      const transactionSnap = await getDocs(query(
        collection(db, "transactions"),
        where("ownerId", "==", currentUser.uid)
      ));
      transactionSnap.docs.forEach(d => {
        const t = { id: d.id, ...d.data() };
        const c = grouped.get(t.customerId);
        if (c) c.transactions.push(t);
      });
    }
    for (const c of customers) {
      c.transactions.sort((a, b) => {
        const stamp = t => {
          if (typeof t.transactionDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.transactionDate)) return new Date(t.transactionDate + "T00:00:00").getTime();
          return t.createdAt?.toMillis?.() ?? 0;
        };
        return stamp(b) - stamp(a);
      });
      c.balance = c.transactions.reduce((sum, t) => sum + (t.type === "credit" ? Number(t.amount) : -Number(t.amount)), 0);
    }
    renderAll();
    // Keep sync off the login-critical path.
    Promise.allSettled(customers.map(c => syncPublicCustomer(c))).then(results => {
      results.forEach((r, i) => { if (r.status === "rejected") console.warn("Public account sync failed:", customers[i]?.id, r.reason); });
    });
    console.info(`Customer data loaded in ${Math.round(performance.now() - startedAt)}ms`);
  } catch (e) {
    console.error("Firestore loadCustomers error:", e);
    alert("Could not load customers: " + (e.message || e));
  }
}

/* =========================================
   PUBLIC ACCOUNT SYNC
========================================= */

// Serialize public-account syncs per token so overlapping refreshes cannot
// re-create an older transaction snapshot after a newer one.
const publicSyncQueues = new Map();

function queuePublicSync(token, task) {
  const previous = publicSyncQueues.get(token) || Promise.resolve();
  const next = previous.catch(() => {}).then(task);
  publicSyncQueues.set(token, next);
  return next.finally(() => {
    if (publicSyncQueues.get(token) === next) publicSyncQueues.delete(token);
  });
}

async function syncPublicCustomer(c) {
  if (!c?.publicToken) return;
  const token = c.publicToken;
  // Snapshot transaction values before entering the queue.
  const transactions = (c.transactions || []).map(t => ({
    id: String(t.id), type: t.type, amount: Number(t.amount),
    note: t.note || "", transactionDate: t.transactionDate || null,
    createdAt: t.createdAt || null
  }));
  const summary = {
    name: c.name || "", whatsapp: c.whatsapp || "", address: c.address || "",
    balance: Number(c.balance || 0), updatedAt: serverTimestamp()
  };

  return queuePublicSync(token, async () => {
    const publicRef = doc(db, "public_accounts", token);
    const publicTxRef = collection(db, "public_accounts", token, "transactions");
    const existingSnap = await getDocs(publicTxRef);
    const currentIds = new Set(transactions.map(t => t.id));
    const staleRefs = existingSnap.docs.filter(d => !currentIds.has(d.id)).map(d => d.ref);

    // A batch makes stale-copy removal and current-copy upserts atomic for the
    // normal case. This prevents customers briefly seeing old+new dates.
    const operations = [
      { kind: "set", ref: publicRef, data: summary, options: { merge: true } },
      ...staleRefs.map(ref => ({ kind: "delete", ref })),
      ...transactions.map(t => ({
        kind: "set",
        ref: doc(db, "public_accounts", token, "transactions", t.id),
        data: { type: t.type, amount: t.amount, note: t.note,
          transactionDate: t.transactionDate, createdAt: t.createdAt },
        options: { merge: false }
      }))
    ];

    // Firestore batches allow at most 500 writes. Typical customer accounts
    // fit in one atomic batch; larger accounts are handled in safe chunks.
    if (operations.length <= 450) {
      const batch = writeBatch(db);
      for (const op of operations) {
        if (op.kind === "delete") batch.delete(op.ref);
        else batch.set(op.ref, op.data, op.options);
      }
      await batch.commit();
      return;
    }

    // For very large histories, remove all stale IDs first, then upsert the
    // authoritative transactions in chunks. Stable admin IDs prevent copies.
    for (let i = 0; i < staleRefs.length; i += 400) {
      const batch = writeBatch(db);
      staleRefs.slice(i, i + 400).forEach(ref => batch.delete(ref));
      await batch.commit();
    }
    const summaryBatch = writeBatch(db);
    summaryBatch.set(publicRef, summary, { merge: true });
    await summaryBatch.commit();
    for (let i = 0; i < transactions.length; i += 400) {
      const batch = writeBatch(db);
      transactions.slice(i, i + 400).forEach(t => batch.set(
        doc(db, "public_accounts", token, "transactions", t.id),
        { type: t.type, amount: t.amount, note: t.note,
          transactionDate: t.transactionDate, createdAt: t.createdAt },
        { merge: false }
      ));
      await batch.commit();
    }
  });
}

/* =========================================
   DASHBOARD
========================================= */

function renderRecentCustomers() {
  const target = $("recentCustomers");
  if (!target) return;
  const latest = [...customers]
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
    .slice(0, 5);
  target.innerHTML = latest.length ? latest.map((c, i) => {
    const initial = esc((c.name || "?").trim().slice(0, 1).toUpperCase());
    const created = c.createdAt?.toDate ? c.createdAt.toDate() : null;
    const dateLabel = created ? created.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Recently added";
    return `<button type="button" class="recentCustomerRow" data-id="${c.id}">
      <span class="recentCustomerAvatar">${initial}</span>
      <span class="recentCustomerInfo"><b>${esc(c.name || "Unnamed customer")}</b><small>${esc(c.whatsapp || "No phone number")} · ${dateLabel}</small></span>
      <span class="recentCustomerBalance ${c.balance > 0 ? "hasDebt" : "settled"}">${money(c.balance)} <small>AFN</small></span>
      <span class="recentCustomerArrow" aria-hidden="true">›</span>
    </button>`;
  }).join("") : `<p class="muted recentEmpty">No customers have been added yet.</p>`;
  target.querySelectorAll(".recentCustomerRow").forEach(row => {
    row.addEventListener("click", () => openCustomer(row.dataset.id));
  });
}

function renderRecentTransactions() {
  const target = $("recentTransactions");
  if (!target) return;
  const all = customers.flatMap(c => (c.transactions || []).map(t => ({ ...t, customerName: c.name || "Unnamed customer", customerId: c.id })));
  const sortValue = t => {
    if (typeof t.transactionDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.transactionDate)) {
      const day = new Date(t.transactionDate + "T00:00:00").getTime();
      const created = t.createdAt?.toMillis?.() ?? 0;
      return day + created % 86400000;
    }
    return t.createdAt?.toMillis?.() ?? 0;
  };
  const latest = all.sort((a, b) => sortValue(b) - sortValue(a)).slice(0, 5);
  target.innerHTML = latest.length ? latest.map(t => {
    const isLoan = t.type === "credit";
    const typeLabel = isLoan ? "Loan / Credit" : "Payment Received";
    const dateLabel = transactionDateLabel(t);
    const note = t.note ? ` · ${esc(t.note)}` : "";
    return `<button type="button" class="recentCustomerRow recentTransactionRow" data-customer-id="${esc(t.customerId)}">
      <span class="transactionTypeMark ${isLoan ? "transactionLoan" : "transactionPayment"}" aria-hidden="true">${isLoan ? "+" : "−"}</span>
      <span class="recentCustomerInfo"><b>${esc(t.customerName)}</b><small>${typeLabel} · ${esc(dateLabel)}${note}</small></span>
      <span class="recentCustomerBalance ${isLoan ? "hasDebt" : "settled"}">${money(t.amount)} <small>AFN</small></span>
      <span class="recentCustomerArrow" aria-hidden="true">›</span>
    </button>`;
  }).join("") : `<p class="muted recentEmpty">No transactions have been recorded yet.</p>`;
  target.querySelectorAll(".recentTransactionRow").forEach(row => {
    row.addEventListener("click", () => openCustomer(row.dataset.customerId));
  });
}

function renderAll() {

  /* Customer count */

  $("customerCount")
    .textContent =
      customers.length;


  /* Total Credit */

  $("totalCredit")
    .textContent =
      money(

        customers.reduce(
          (s, c) =>
            s +
            (
              c.transactions || []
            )
              .filter(
                t =>
                  t.type ===
                  "credit"
              )
              .reduce(
                (a, t) =>
                  a +
                  Number(
                    t.amount
                  ),
                0
              ),
          0
        )

      );


  /* Total Debit */

  $("totalDebit")
    .textContent =
      money(

        customers.reduce(
          (s, c) =>
            s +
            (
              c.transactions || []
            )
              .filter(
                t =>
                  t.type ===
                  "debit"
              )
              .reduce(
                (a, t) =>
                  a +
                  Number(
                    t.amount
                  ),
                0
              ),
          0
        )

      );


  /* Total balance */

  $("totalBalance")
    .textContent =
      money(

        customers.reduce(
          (s, c) =>
            s +
            c.balance,
          0
        )

      );


  /* Dashboard report chart */
  const creditTotal = customers.reduce((sum, c) => sum + (c.transactions || []).filter(t => t.type === "credit").reduce((a, t) => a + Number(t.amount || 0), 0), 0);
  const debitTotal = customers.reduce((sum, c) => sum + (c.transactions || []).filter(t => t.type === "debit").reduce((a, t) => a + Number(t.amount || 0), 0), 0);
  const balanceTotal = customers.reduce((sum, c) => sum + Number(c.balance || 0), 0);
  const maxTotal = Math.max(creditTotal, debitTotal, balanceTotal, 1);
  [["creditBar", "creditBarValue", creditTotal], ["debitBar", "debitBarValue", debitTotal], ["balanceBar", "balanceBarValue", balanceTotal]].forEach(([barId, valueId, value]) => {
    const bar = $(barId), label = $(valueId);
    if (bar) bar.style.width = `${Math.max(value > 0 ? 2 : 0, value / maxTotal * 100)}%`;
    if (label) label.textContent = money(value);
  });

  /* Top 5 debtors */

  const top =
    [...customers]
      .sort(
        (a, b) =>
          b.balance -
          a.balance
      )
      .filter(
        c =>
          c.balance > 0
      )
      .slice(
        0,
        5
      );


  $("topDebtors")
    .innerHTML =
      top.length

        ? top.map(
            c => `

              <div
                class="debtor"
                data-id="${c.id}"
              >

                <div>

                  <b>
                    ${esc(c.name)}
                  </b>

                  <small>
                    ${esc(
                      c.whatsapp || ""
                    )}
                  </small>

                </div>


                <span
                  class="amount positive"
                >
                  ${money(
                    c.balance
                  )} AFN
                </span>

              </div>

            `
          ).join("")

        : `
          <p class="muted">
            No outstanding debt.
          </p>
        `;


  /* Debtor click */

  document
    .querySelectorAll(
      ".debtor"
    )
    .forEach(
      x => {

        x.onclick =
          () =>
            openCustomer(
              x.dataset.id
            );

      }
    );


  renderDashboardAnalytics();
  renderCustomers();
  renderRecentCustomers();
  renderRecentTransactions();

  renderTransactionsHistory();
}


/* =========================================
   LIVE DASHBOARD ANALYTICS
========================================= */
function renderDashboardAnalytics() {
  const all = customers.flatMap(c => (c.transactions || []).map(t => ({ ...t, customerName: c.name })));
  const localDateKey = value => {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const d = value?.toDate ? value.toDate() : value instanceof Date ? value : null;
    if (!d || Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };
  const dateOf = t => localDateKey(t.transactionDate) || localDateKey(t.createdAt);
  const now = new Date(); now.setHours(0,0,0,0);
  const key = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const shift = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth()+1, 1);
  const monday = shift(now, -((now.getDay()+6)%7));
  // Keep transaction type comparisons explicit; malformed records are ignored.
  const sum = items => items.reduce((o,t) => { const a=Number(t.amount||0); if(t.type==='credit') o.credit+=a; if(t.type==='debit') o.debit+=a; return o; }, {credit:0,debit:0});
  const byDate = d => all.filter(t => dateOf(t) === key(d));
  const daily = [];
  for (let h=0; h<24; h+=3) {
    const subset = all.filter(t => {
      if (dateOf(t)!==key(now)) return false;
      const dt = t.createdAt?.toDate ? t.createdAt.toDate() : null;
      return dt ? Math.floor(dt.getHours()/3)*3===h : h===12;
    });
    daily.push({label: `${String(h%12||12)}${h<12?'a':'p'}`, ...sum(subset)});
  }
  const weekly=[];
  for(let i=0;i<7;i++){const d=shift(monday,i);weekly.push({label:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i],...sum(byDate(d))});}
  const monthly=[];
  const daysInMonth = new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
  for(let start=1; start<=daysInMonth; start+=Math.ceil(daysInMonth/4)) {
    const end=Math.min(daysInMonth,start+Math.ceil(daysInMonth/4)-1);
    const subset=all.filter(t=>{const k=dateOf(t);return k>=key(new Date(now.getFullYear(),now.getMonth(),start))&&k<=key(new Date(now.getFullYear(),now.getMonth(),end));});
    monthly.push({label:`${start}-${end}`, ...sum(subset)});
  }
  const yesterday=sum(byDate(shift(now,-1))), today=sum(byDate(now));
  const lastMonth=sum(all.filter(t=>dateOf(t)>=key(prevMonthStart)&&dateOf(t)<key(monthStart)));
  const thisMonth=sum(all.filter(t=>dateOf(t)>=key(monthStart)&&dateOf(t)<key(nextMonthStart)));
  const fmt = n => money(n) + ' AFN';
  const el = id => document.getElementById(id);
  const setText=(id,v)=>{if(el(id))el(id).textContent=v;};
  setText('todayChartDate',now.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}));
  setText('monthChartLabel',now.toLocaleDateString('en-GB',{month:'long',year:'numeric'}));
  setText('todayCreditTotal',fmt(today.credit));setText('todayDebitTotal',fmt(today.debit));
  setText('weekCreditTotal',fmt(sum(weekly).credit));setText('weekDebitTotal',fmt(sum(weekly).debit));
  setText('monthCreditTotal',fmt(thisMonth.credit));setText('monthDebitTotal',fmt(thisMonth.debit));
  const chart=(id,rows)=>{
    const node=el(id); if(!node)return;
    const max=Math.max(1,...rows.flatMap(r=>[r.credit,r.debit]));
    node.innerHTML=rows.map(r=>`<div class="chartColumn" title="${esc(r.label)} — Credit ${esc(fmt(r.credit))}, Debit ${esc(fmt(r.debit))}"><div class="barPair"><span class="chartBar creditBar" style="height:${Math.max(r.credit>0?2:0,r.credit/max*100)}%"></span><span class="chartBar debitBar" style="height:${Math.max(r.debit>0?2:0,r.debit/max*100)}%"></span></div><small>${esc(r.label)}</small></div>`).join('');
  };
  chart('todayChart',daily);chart('weekChart',weekly);chart('monthChart',monthly);
  const comparison=(chartId,summaryId,a,b,labelA,labelB)=>{
    const node=el(chartId); if(node){const max=Math.max(1,a.credit,a.debit,b.credit,b.debit);node.innerHTML=`<div class="compareLegend"><span class="legendCredit">${esc(labelA)}</span><span class="legendDebit">${esc(labelB)}</span></div><div class="compareRows">${[['Credit',a.credit,b.credit],['Debit',a.debit,b.debit]].map(([label,x,y])=>`<div class="compareRow"><span>${label}</span><div class="compareTracks"><div class="compareTrack"><i class="creditBar" style="width:${x/max*100}%"></i></div><div class="compareTrack"><i class="debitBar" style="width:${y/max*100}%"></i></div></div><b>${fmt(x)} / ${fmt(y)}</b></div>`).join('')}</div>`;}
    const summaryNode=el(summaryId);if(summaryNode)summaryNode.innerHTML=[['Credit',a.credit,b.credit],['Debit',a.debit,b.debit]].map(([label,x,y])=>{const delta=y-x;const pct=x?Math.round(delta/x*100):y?100:0;return `<div class="deltaCard"><span>${label} difference</span><b class="${delta>=0?'deltaUp':'deltaDown'}">${delta>=0?'+':'−'}${fmt(Math.abs(delta))}</b><small>${delta>=0?'Increase':'Decrease'} ${Math.abs(pct)}%</small></div>`;}).join('');
  };
  comparison('dayCompareChart','dayCompareSummary',yesterday,today,'Yesterday','Today');
  comparison('monthCompareChart','monthCompareSummary',lastMonth,thisMonth,prevMonthStart.toLocaleDateString('en-GB',{month:'short'}),monthStart.toLocaleDateString('en-GB',{month:'short'}));
}

/* =========================================
   CUSTOMER LIST
========================================= */

function renderCustomers() {

  const term =
    $("search")
      .value
      .toLowerCase();


  const list =
    customers.filter(
      c =>
        c.name
          .toLowerCase()
          .includes(term)

        ||

        (
          c.whatsapp ||
          ""
        ).includes(term)
    );


  $("customers")
    .innerHTML =

      list.length

        ? list.map(
            c => `

              <div
                class="customer"
                data-id="${c.id}"
              >

                <div
                  class="customerMain"
                >

                  <div>

                    <div class="row">

                      <b>
                        ${esc(
                          c.name
                        )}
                      </b>


                      <span
                        class="balancePill ${
                          c.balance > 0
                            ? "debt"
                            : "paid"
                        }"
                      >
                        ${money(
                          c.balance
                        )} AFN
                      </span>

                    </div>


                    <small>
                      ${esc(
                        c.whatsapp || ""
                      )}
                    </small>

                  </div>


                  <div
                    class="customerActions"
                  >

                    <button
                      class="iconBtn editBtn"
                      title="Edit customer"
                    >
                      <span class="iconSvg" aria-hidden="true">${icon("edit")}</span>
                    </button>


                    <button
                      class="iconBtn reminderBtn"
                      title="Send WhatsApp reminder"
                    >
                      <span class="iconSvg" aria-hidden="true">${icon("message")}</span>
                    </button>


                    <button
                      class="iconBtn deleteBtn"
                      title="Delete customer"
                    >
                      <span class="iconSvg" aria-hidden="true">${icon("trash")}</span>
                    </button>

                  </div>

                </div>

              </div>

            `
          ).join("")

        : `
          <p class="muted">
            No customers found.
          </p>
        `;


  /* Customer events */

  document
    .querySelectorAll(
      ".customer"
    )
    .forEach(
      row => {

        const id =
          row.dataset.id;


        /* Open customer */

        row.onclick =
          e => {

            if (
              e.target.closest(
                ".customerActions"
              )
            ) {
              return;
            }


            openCustomer(id);

          };


        /* Edit */

        row
          .querySelector(
            ".editBtn"
          )
          .onclick =
            e => {

              e.stopPropagation();


              const c =
                customers.find(
                  x =>
                    x.id === id
                );


              openCustomerForm(c);

            };


        /* Delete */

        row
          .querySelector(
            ".deleteBtn"
          )
          .onclick =
            async e => {

              e.stopPropagation();


              const c =
                customers.find(
                  x =>
                    x.id === id
                );


              openCustomerForm(c);


              $("deleteCustomerBtn")
                .click();

            };


        /* Reminder */

        row
          .querySelector(
            ".reminderBtn"
          )
          .onclick =
            e => {

              e.stopPropagation();


              const c =
                customers.find(
                  x =>
                    x.id === id
                );


              sendReminder(c);

            };

      }
    );

}


/* =========================================
   OPEN CUSTOMER
========================================= */

async function openCustomer(id) {

  selectedCustomer =
    customers.find(
      c =>
        c.id === id
    );


  if (!selectedCustomer) {
    return;
  }


  $("detailName")
    .textContent =
      selectedCustomer.name;


  $("detailPhone")
    .textContent =
      selectedCustomer.whatsapp || "";


  $("detailBalance")
    .textContent =
      `${money(
        selectedCustomer.balance
      )} AFN`;


  $("customerPage")
    .classList
    .remove("hidden");


  renderHistory();

}


/* =========================================
   CUSTOMER HISTORY
========================================= */

async function refreshCustomerAndPublic(customerId) {
  await loadCustomers();
  selectedCustomer = customers.find(c => c.id === customerId) || null;
  if (selectedCustomer) { await syncPublicCustomer(selectedCustomer); await openCustomer(customerId); }
}

let transactionBeingEdited = null;
function editTransaction(t) {
  if (!selectedCustomer || !t?.id) return;
  transactionBeingEdited = t;
  $("editTxType").value = t.type === "debit" ? "debit" : "credit";
  $("editTxAmount").value = String(t.amount ?? "");
  const oldDate = (typeof t.transactionDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.transactionDate))
    ? t.transactionDate
    : (t.createdAt?.toDate ? (() => { const d=t.createdAt.toDate(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })() : new Date().toISOString().slice(0,10));
  $("editTxDate").value = oldDate;
  $("editTxNote").value = t.note || "";
  $("editTxMsg").textContent = "";
  $("editTxModal").classList.remove("hidden");
}
function closeEditTransaction() {
  $("editTxModal").classList.add("hidden");
  transactionBeingEdited = null;
}
$("cancelEditTx").onclick = closeEditTransaction;
$("cancelEditTx2").onclick = closeEditTransaction;
$("saveEditTx").onclick = async () => {
  const t = transactionBeingEdited;
  if (!selectedCustomer || !t?.id) return;
  const amount = Number($("editTxAmount").value);
  const type = $("editTxType").value;
  const transactionDate = $("editTxDate").value;
  const note = $("editTxNote").value.trim();
  if (!Number.isFinite(amount) || amount <= 0) { $("editTxMsg").textContent = "Please enter a valid amount."; return; }
  if (!["credit", "debit"].includes(type)) { $("editTxMsg").textContent = "Invalid transaction type."; return; }
  if (!transactionDate || !/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) { $("editTxMsg").textContent = "Please select a date."; return; }
  const customerId = selectedCustomer.id;
  $("saveEditTx").disabled = true;
  $("saveEditTx").textContent = "Saving...";
  try {
    const oldTimestamp = t.createdAt?.toDate ? t.createdAt.toDate() : new Date();
    const newTimestamp = new Date(transactionDate + "T00:00:00");
    newTimestamp.setHours(oldTimestamp.getHours(), oldTimestamp.getMinutes(), oldTimestamp.getSeconds(), oldTimestamp.getMilliseconds());
    await updateDoc(doc(db, "transactions", t.id), {
      amount, type, transactionDate, note,
      createdAt: Timestamp.fromDate(newTimestamp),
      updatedAt: serverTimestamp()
    });
    closeEditTransaction();
    await refreshCustomerAndPublic(customerId);
  } catch (e) {
    console.error("Edit transaction error:", e);
    $("editTxMsg").textContent = "Could not update transaction: " + (e.message || e);
  } finally {
    $("saveEditTx").disabled = false;
    $("saveEditTx").textContent = "Save changes";
  }
};

async function removeTransaction(t) {
  if (!selectedCustomer || !t?.id) return;
  if (!confirm("Delete this transaction? This cannot be undone.")) return;
  const customerId = selectedCustomer.id;
  try { await deleteDoc(doc(db, "transactions", t.id)); await refreshCustomerAndPublic(customerId); }
  catch (e) { console.error("Delete transaction error:", e); alert("Could not delete transaction: " + e.message); }
}

function renderHistory() {
  const ts = selectedCustomer?.transactions || [];
  $("history").innerHTML = ts.length ? ts.map(t => `
    <div class="tx ${t.type === "credit" ? "txCredit" : "txDebit"}">
      <div class="row between"><b><span class="txTypeLabel">${t.type === "credit" ? "قرض" : "رسید"}</span> — ${money(t.amount)} AFN</b><span>${transactionDateLabel(t)}</span></div>
      <div class="note">${esc(t.note || "")}</div>
      <div class="txActions"><button type="button" class="secondary" data-edit-tx="${esc(t.id)}" aria-label="Edit transaction"><span class="iconSvg" aria-hidden="true">${icon('edit')}</span> Edit</button><button type="button" class="danger" data-delete-tx="${esc(t.id)}" aria-label="Delete transaction"><span class="iconSvg" aria-hidden="true">${icon('trash')}</span> Delete</button></div>
    </div>
  `).join("") : `<p class="muted">No transactions.</p>`;
  $("history").querySelectorAll("[data-edit-tx]").forEach(btn => { btn.onclick = () => { const tx = ts.find(t => t.id === btn.dataset.editTx); if (tx) editTransaction(tx); }; });
  $("history").querySelectorAll("[data-delete-tx]").forEach(btn => { btn.onclick = () => { const tx = ts.find(t => t.id === btn.dataset.deleteTx); if (tx) removeTransaction(tx); }; });
}

/* =========================================
   SAVE TRANSACTION
========================================= */

$("saveTx").onclick =
  async () => {

    if (!selectedCustomer) {
      return;
    }


    const amount =
      Number(
        $("txAmount")
          .value
      );


    const type =
      $("txType")
        .value;

    const dateValue = $("txDate").value;
    if (!dateValue) { alert("Please select a transaction date."); return; }
    const selectedDate = new Date(dateValue + "T00:00:00");
    const now = new Date();
    selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());

    const note =
      $("txNote")
        .value
        .trim();


    const sendWhatsApp =
      $("waToggle")
        .checked;


    if (
      !amount ||
      amount <= 0
    ) {

      alert(
        "Enter a valid amount"
      );

      return;
    }


    const wa =
      (
        selectedCustomer
          .whatsapp || ""
      ).replace(
        /\D/g,
        ""
      );


    /* Open WhatsApp window
       before Firestore operation */

    const waWindow =
      sendWhatsApp && wa
        ? window.open(
            "about:blank",
            "_blank"
          )
        : null;


    try {

      /* Add transaction */

      await addDoc(

        collection(
          db,
          "transactions"
        ),

        {
          customerId:
            selectedCustomer.id,

          ownerId:
            currentUser.uid,

          type,

          amount,

          note,

          // Keep the chosen calendar date explicitly as well as the timestamp.
          transactionDate: dateValue,

          createdAt:
            Timestamp.fromDate(selectedDate)
        }

      );


      $("txAmount")
        .value = "";

      $("txDate").value = new Date().toLocaleDateString("en-CA");

      $("txNote")
        .value = "";


      /* Reload customers */

      await loadCustomers();


      /* Select customer again */

      selectedCustomer =
        customers.find(
          c =>
            c.id ===
            selectedCustomer.id
        );


      if (!selectedCustomer) {

        if (waWindow) {
          waWindow.close();
        }

        return;

      }


      await openCustomer(
        selectedCustomer.id
      );


      /* Update public account */

      try {

        await syncPublicCustomer(
          selectedCustomer
        );

      } catch (syncError) {

        console.error(
          "Public account sync failed:",
          syncError
        );

      }


      /* WhatsApp */

      if (
        waWindow &&
        selectedCustomer
      ) {

        const message =
          buildPashtoMessage(
            selectedCustomer
          );


        const encodedMessage = encodeURIComponent(message);
        const isAndroid = /Android/i.test(navigator.userAgent);
        waWindow.location.href = isAndroid
          ? `intent://send?phone=${wa}&text=${encodedMessage}#Intent;scheme=whatsapp;package=com.whatsapp;end`
          : `https://wa.me/${wa}?text=${encodedMessage}`;

      }


    } catch (e) {

      if (waWindow) {
        waWindow.close();
      }


      console.error(
        "Save transaction error:",
        e
      );


      alert(
        "Could not save transaction: " +
        e.message
      );

    }

  };


/* =========================================
   WHATSAPP REMINDER
========================================= */

function sendReminder(c) {

  if (!c) {
    return;
  }


  const wa =
    (
      c.whatsapp || ""
    ).replace(
      /\D/g,
      ""
    );


  if (!wa) {

    alert(
      "This customer has no WhatsApp number."
    );

    return;
  }


  const message =
    buildPashtoMessage(c);


  const encodedMessage = encodeURIComponent(message);
  const isAndroid = /Android/i.test(navigator.userAgent);
  const whatsappUrl = isAndroid
    ? `intent://send?phone=${wa}&text=${encodedMessage}#Intent;scheme=whatsapp;package=com.whatsapp;end`
    : `https://wa.me/${wa}?text=${encodedMessage}`;

  window.open(whatsappUrl, "_blank");

}


/* =========================================
   PASHTO WHATSAPP MESSAGE
========================================= */

function buildPashtoMessage(c) {
  return `السلام علیکم، محترم *${c.name}*!

ستاسو د حساب تازه معلومات:

💰 *پاتې پیسې:* ${money(c.balance)} افغانۍ

مهرباني وکړئ د پاتې پیسو د تصفیې لپاره اقدام وکړئ.

📋 *د خپل حساب د بشپړو معلوماتو لپاره لاندې لینک پانیزئ:*

${portalUrl(c.publicToken)}`;
}


/* =========================================
   PUBLIC ACCOUNT URL
========================================= */

function portalUrl(token) {

  return `${location.origin}${
    location.pathname
      .replace(
        /\/$/,
        ""
      )
  }/customer.html?token=${
    encodeURIComponent(token)
  }`;

}


/* =========================================
   RANDOM TOKEN
========================================= */

function randomToken() {

  return `${
    crypto
      .randomUUID()
      .replace(
        /-/g,
        ""
      )
  }${
    crypto
      .randomUUID()
      .replace(
        /-/g,
        ""
      )
  }`;

}


/* =========================================
   MONEY FORMAT
========================================= */

const money =
  n => {
    const value = Number(n || 0);
    return Number.isFinite(value)
      ? value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).replace(/\\.0+$/, "").replace(/(\\.\\d*?)0+$/, "$1")
      : "0";
  };


/* =========================================
   TRANSACTION DATE DISPLAY
========================================= */

const transactionDateLabel = t => {
  // New records use the explicitly selected calendar date. Older records fall back to createdAt.
  if (typeof t?.transactionDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.transactionDate)) {
    const [year, month, day] = t.transactionDate.split("-").map(Number);
    const time = t?.createdAt?.toDate ? t.createdAt.toDate() : null;
    const shown = new Date(year, month - 1, day, time ? time.getHours() : 12, time ? time.getMinutes() : 0);
    return shown.toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
  }
  return date(t?.createdAt);
};

/* =========================================
   DATE FORMAT
========================================= */

const date =
  x =>
    x?.toDate
      ? x.toDate().toLocaleString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true
        })
      : "Just now";


/* =========================================
   HTML ESCAPE
========================================= */

const esc =
  s =>
    String(
      s ?? ""
    ).replace(
      /[&<>"']/g,
      m => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[m])
    );


/* =========================================
   DETAIL PAGE REMINDER
========================================= */

$("detailReminder").onclick =
  () => {

    sendReminder(
      selectedCustomer
    );

  };
