import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $=id=>document.getElementById(id);
let currentUser=null, customers=[], selectedCustomer=null;

$("loginBtn").onclick=async()=>{
  $("loginMsg").textContent="";
  try{await signInWithEmailAndPassword(auth,$("email").value.trim(),$("password").value)}
  catch(e){$("loginMsg").textContent=e.message}
};
$("logoutBtn").onclick=()=>signOut(auth);
$("addCustomerBtn").onclick=()=>{$("modal").classList.remove("hidden");$("customerMsg").textContent=""};
$("closeModal").onclick=()=>$("modal").classList.add("hidden");
$("closeDetail").onclick=()=>$("customerPage").classList.add("hidden");
$("search").oninput=renderCustomers;

onAuthStateChanged(auth, async user=>{
 currentUser=user;
 if(user){$("loginPage").classList.add("hidden");$("app").classList.remove("hidden");await loadCustomers()}
 else{$("app").classList.add("hidden");$("loginPage").classList.remove("hidden")}
});

$("saveCustomer").onclick=async()=>{
 const name=$("customerName").value.trim(), phone=$("customerWhatsapp").value.trim(), address=$("customerAddress").value.trim();
 if(!name){$("customerMsg").textContent="Customer name is required";return}
 try{
  await addDoc(collection(db,"customers"),{name,whatsapp:phone,address,ownerId:currentUser.uid,createdAt:serverTimestamp()});
  $("customerName").value=$("customerWhatsapp").value=$("customerAddress").value="";
  $("modal").classList.add("hidden"); await loadCustomers();
 }catch(e){$("customerMsg").textContent=e.message}
};

async function loadCustomers(){
 try {
 const q=query(collection(db,"customers"),where("ownerId","==",currentUser.uid));
 const snap=await getDocs(q);
 customers=snap.docs.map(d=>({id:d.id,...d.data()}));
 customers.sort((a,b)=>{
   const at=a.createdAt?.toMillis?.() ?? 0;
   const bt=b.createdAt?.toMillis?.() ?? 0;
   return bt-at;
 });
 for(const c of customers){
  const tq=query(collection(db,"transactions"),where("customerId","==",c.id));
  const ts=await getDocs(tq);
  c.transactions=ts.docs.map(d=>({id:d.id,...d.data()}));
  c.transactions.sort((a,b)=>{
    const at=a.createdAt?.toMillis?.() ?? 0;
    const bt=b.createdAt?.toMillis?.() ?? 0;
    return bt-at;
  });
  c.balance=(c.transactions||[]).reduce((s,t)=>s+(t.type==="credit"?Number(t.amount): -Number(t.amount)),0);
 }
 renderAll();
 } catch(e) {
   console.error("Firestore loadCustomers error:", e);
   alert("Could not load customers: " + (e.message || e));
 }
}
function renderAll(){
 $("customerCount").textContent=customers.length;
 $("totalCredit").textContent=money(customers.reduce((s,c)=>s+(c.transactions||[]).filter(t=>t.type==="credit").reduce((a,t)=>a+Number(t.amount),0),0));
 $("totalDebit").textContent=money(customers.reduce((s,c)=>s+(c.transactions||[]).filter(t=>t.type==="debit").reduce((a,t)=>a+Number(t.amount),0),0));
 $("totalBalance").textContent=money(customers.reduce((s,c)=>s+c.balance,0));
 const top=[...customers].sort((a,b)=>b.balance-a.balance).filter(c=>c.balance>0).slice(0,5);
 $("topDebtors").innerHTML=top.length?top.map(c=>`<div class="debtor" data-id="${c.id}"><b>${esc(c.name)}</b><span class="amount positive">${money(c.balance)}</span></div>`).join(""):"<p class='muted'>No outstanding debt.</p>";
 document.querySelectorAll(".debtor").forEach(x=>x.onclick=()=>openCustomer(x.dataset.id));
 renderCustomers();
}
function renderCustomers(){
 const term=$("search").value.toLowerCase();
 const list=customers.filter(c=>c.name.toLowerCase().includes(term)||(c.whatsapp||"").includes(term));
 $("customers").innerHTML=list.length?list.map(c=>`<div class="customer" data-id="${c.id}"><div class="row between"><b>${esc(c.name)}</b><span class="amount ${c.balance>0?"positive":"negative"}">${money(c.balance)}</span></div><small>${esc(c.whatsapp||"")}</small></div>`).join(""):"<p class='muted'>No customers found.</p>";
 document.querySelectorAll(".customer").forEach(x=>x.onclick=()=>openCustomer(x.dataset.id));
}
async function openCustomer(id){
 selectedCustomer=customers.find(c=>c.id===id);
 $("detailName").textContent=selectedCustomer.name;$("detailPhone").textContent=selectedCustomer.whatsapp||"";
 $("detailBalance").textContent=money(selectedCustomer.balance);
 $("customerPage").classList.remove("hidden");renderHistory();
}
function renderHistory(){
 const ts=selectedCustomer.transactions||[];
 $("history").innerHTML=ts.length?ts.map(t=>`<div class="tx"><div class="row between"><b>${t.type==="credit"?"Credit":"Debit"} — ${money(t.amount)}</b><span>${date(t.createdAt)}</span></div><div>${esc(t.note||"")}</div></div>`).join(""):"<p class='muted'>No transactions.</p>";
}
$("saveTx").onclick=async()=>{
 if(!selectedCustomer)return;
 const amount=Number($("txAmount").value), type=$("txType").value, note=$("txNote").value.trim();
 if(!amount||amount<=0)return alert("Enter a valid amount");
 await addDoc(collection(db,"transactions"),{customerId:selectedCustomer.id,ownerId:currentUser.uid,type,amount,note,createdAt:serverTimestamp()});
 const message=`Hello ${selectedCustomer.name}, your current outstanding balance is ${money(selectedCustomer.balance+(type==="credit"?amount:-amount))}. ${note?note:""}`;
 const wa=(selectedCustomer.whatsapp||"").replace(/\D/g,"");
 if(wa) window.open(`https://wa.me/${wa}?text=${encodeURIComponent(message)}`,"_blank");
 $("txAmount").value="";$("txNote").value="";await loadCustomers();await openCustomer(selectedCustomer.id);
};
const money=n=>Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
const date=x=>x?.toDate?x.toDate().toLocaleString():"Just now";
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
