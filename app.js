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
  setDoc
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

$("loginBtn").onclick = async () => {

  $("loginMsg").textContent = "";

  const email =
    $("email").value.trim();

  const password =
    $("password").value;

  if (!email || !password) {

    $("loginMsg").textContent =
      "Please enter email and password.";

    return;
  }

  try {

    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

  } catch (e) {

    console.error("Login error:", e);

    $("loginMsg").textContent =
      e.message;

  }

};


/* =========================================
   LOGOUT
========================================= */

$("logoutBtn").onclick = () => {

  signOut(auth);

};

/* Account settings use Firebase Authentication; passwords are never stored in Firestore. */
$("settingsBtn").onclick = () => {
  if (!currentUser) return;
  $("settingsEmail").value = currentUser.email || "";
  $("settingsCurrentPassword").value = "";
  $("settingsNewPassword").value = "";
  $("settingsMsg").textContent = "";
  $("settingsModal").classList.remove("hidden");
};
$("closeSettings").onclick = () => $("settingsModal").classList.add("hidden");
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


/* =========================================
   AUTH STATE
========================================= */

onAuthStateChanged(
  auth,
  async user => {

    currentUser = user;

    if (user) {

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

  try {

    if (!currentUser) {
      return;
    }


    /* Get customers */

    const q =
      query(
        collection(
          db,
          "customers"
        ),
        where(
          "ownerId",
          "==",
          currentUser.uid
        )
      );


    const snap =
      await getDocs(q);


    customers =
      snap.docs.map(
        d => ({
          id: d.id,
          ...d.data()
        })
      );


    /* Sort customers */

    customers.sort(
      (a, b) =>
        (
          b.createdAt
            ?.toMillis?.() ?? 0
        ) -
        (
          a.createdAt
            ?.toMillis?.() ?? 0
        )
    );


    /* Load each customer's transactions */

    for (
      const c of customers
    ) {


      /* Create public token
         if missing */

      if (!c.publicToken) {

        c.publicToken =
          randomToken();


        await updateDoc(
          doc(
            db,
            "customers",
            c.id
          ),
          {
            publicToken:
              c.publicToken
          }
        );

      }


      /* Get transactions */

      const tq =
        query(
          collection(
            db,
            "transactions"
          ),
          where(
            "customerId",
            "==",
            c.id
          )
        );


      const ts =
        await getDocs(tq);


      c.transactions =
        ts.docs.map(
          d => ({
            id: d.id,
            ...d.data()
          })
        );


      /* Sort transactions */

      c.transactions.sort(
        (a, b) =>
          (
            b.createdAt
              ?.toMillis?.() ?? 0
          ) -
          (
            a.createdAt
              ?.toMillis?.() ?? 0
          )
      );


      /* Calculate balance */

      c.balance =
        (
          c.transactions || []
        ).reduce(
          (s, t) =>
            s +
            (
              t.type === "credit"
                ? Number(t.amount)
                : -Number(t.amount)
            ),
          0
        );


      /*
        IMPORTANT:
        Sync public account separately.

        If public account permission
        fails, dashboard will NOT fail.
      */

      try {

        await syncPublicCustomer(c);

      } catch (syncError) {

        console.error(
          "Public account sync failed:",
          syncError
        );

      }

    }


    /* Render dashboard */

    renderAll();


  } catch (e) {

    console.error(
      "Firestore loadCustomers error:",
      e
    );


    alert(
      "Could not load customers: " +
      (
        e.message ||
        e
      )
    );

  }

}


/* =========================================
   PUBLIC ACCOUNT SYNC
========================================= */

async function syncPublicCustomer(c) {

  if (!c?.publicToken) {
    return;
  }


  /* Main public account */

  const ref =
    doc(
      db,
      "public_accounts",
      c.publicToken
    );


  await setDoc(
    ref,
    {
      name:
        c.name,

      whatsapp:
        c.whatsapp || "",

      address:
        c.address || "",

      balance:
        Number(
          c.balance || 0
        ),

      updatedAt:
        serverTimestamp()
    }
  );


  /* Public transactions */

  for (
    const t of (
      c.transactions || []
    )
  ) {

    await setDoc(

      doc(
        db,
        "public_accounts",
        c.publicToken,
        "transactions",
        t.id
      ),

      {
        type:
          t.type,

        amount:
          Number(
            t.amount
          ),

        note:
          t.note || "",

        createdAt:
          t.createdAt || null
      }

    );

  }

}


/* =========================================
   DASHBOARD
========================================= */

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


  renderCustomers();

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

async function editTransaction(t) {
  if (!selectedCustomer || !t?.id) return;
  const amountText = prompt("Enter transaction amount:", String(t.amount ?? ""));
  if (amountText === null) return;
  const amount = Number(amountText);
  if (!Number.isFinite(amount) || amount <= 0) { alert("Enter a valid amount greater than zero."); return; }
  const note = prompt("Enter transaction note:", t.note || "");
  if (note === null) return;
  try { await updateDoc(doc(db, "transactions", t.id), { amount, note: note.trim(), updatedAt: serverTimestamp() }); await refreshCustomerAndPublic(selectedCustomer.id); }
  catch (e) { console.error("Edit transaction error:", e); alert("Could not edit transaction: " + e.message); }
}

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
      <div class="row between"><b><span class="txTypeLabel">${t.type === "credit" ? "قرض" : "رسید"}</span> — ${money(t.amount)} AFN</b><span>${date(t.createdAt)}</span></div>
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
    if (!dateValue) { alert("مهرباني وکړئ د معاملې نېټه وټاکئ."); return; }
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
