let stream = null;
let selectedImage = null;

const camera = document.getElementById("camera");
const canvas = document.getElementById("canvas");
const preview = document.getElementById("preview");
const startCamera = document.getElementById("startCamera");
const takePhoto = document.getElementById("takePhoto");
const fileInput = document.getElementById("fileInput");
const scanButton = document.getElementById("scanButton");
const progressBox = document.getElementById("progressBox");
const statusEl = document.getElementById("status");
const progress = document.getElementById("progress");

async function openCamera() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("ستاسو براوزر د کیمرې ملاتړ نه کوي. له ګالرۍ عکس وټاکئ.");
      return;
    }
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false
    });
    camera.srcObject = stream;
    takePhoto.disabled = false;
    document.getElementById("cameraMessage").textContent = "تذکره د چوکاټ منځ ته راوله";
  } catch (e) {
    alert("کیمرې ته اجازه ورنه کړل شوه. د براوزر Camera permission فعاله کړئ.");
  }
}

function useImage(dataUrl) {
  selectedImage = dataUrl;
  preview.src = dataUrl;
  preview.hidden = false;
  scanButton.disabled = false;
}

startCamera.addEventListener("click", openCamera);

takePhoto.addEventListener("click", () => {
  if (!stream) return;
  const w = camera.videoWidth || 1280;
  const h = camera.videoHeight || 720;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(camera, 0, 0, w, h);
  useImage(canvas.toDataURL("image/jpeg", 0.92));
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => useImage(e.target.result);
  reader.readAsDataURL(file);
});

function cleanText(s) {
  return (s || "").replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
}

function findAfterLabels(text, labels) {
  const lines = text.split("\n").map(x => cleanText(x)).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const label of labels) {
      if (line.includes(label)) {
        let value = line.split(label).slice(1).join(label).replace(/^[:：\-–\s]+/, "").trim();
        if (!value && lines[i + 1]) value = lines[i + 1];
        if (value) return value;
      }
    }
  }
  return "";
}

function extractFields(text) {
  const idMatch = text.match(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/) ||
                  text.match(/\b\d{4}[-\s]?\d{4}[-\s]?\d{3,5}\b/);

  return {
    idNumber: idMatch ? idMatch[0].replace(/\s+/g, "-") : "",
    fullName: findAfterLabels(text, ["نوم", "اسم"]),
    fatherName: findAfterLabels(text, ["د پلار نوم", "پلار نوم", "نام پدر"]),
    grandfatherName: findAfterLabels(text, ["د نیکه نوم", "نیکه نوم", "نام پدرکلان", "نام پدر بزرگ"])
  };
}

scanButton.addEventListener("click", async () => {
  if (!selectedImage) return;

  progressBox.hidden = false;
  progress.value = 0;
  statusEl.textContent = "OCR چمتو کېږي...";

  try {
    // Recognition is performed in the browser. The ID image itself is not sent
    // to our server. Tesseract.js may download language data from its CDN.
    const result = await Tesseract.recognize(
      selectedImage,
      "fas+pus+eng",
      {
        logger: m => {
          if (typeof m.progress === "number") progress.value = Math.round(m.progress * 100);
          if (m.status) statusEl.textContent = m.status;
        }
      }
    );

    const text = cleanText(result.data.text);
    const fields = extractFields(text);

    document.getElementById("idNumber").value = fields.idNumber;
    document.getElementById("fullName").value = fields.fullName;
    document.getElementById("fatherName").value = fields.fatherName;
    document.getElementById("grandfatherName").value = fields.grandfatherName;
    document.getElementById("rawText").value = text;

    document.getElementById("scanPage").hidden = true;
    document.getElementById("resultPage").hidden = false;
    progressBox.hidden = true;
  } catch (err) {
    console.error(err);
    statusEl.textContent = "سکین ناکام شو.";
    alert("OCR سکین ناکام شو. روښانه او مستقیم عکس وکاروئ.");
  }
});

document.querySelectorAll("[data-copy]").forEach(btn => {
  btn.addEventListener("click", async () => {
    const el = document.getElementById(btn.dataset.copy);
    await navigator.clipboard.writeText(el.value || "");
    btn.textContent = "✓ کاپي شو";
    setTimeout(() => btn.textContent = "کاپي", 1200);
  });
});

document.getElementById("copyAll").addEventListener("click", async () => {
  const data = [
    "د تذکرې نمبر: " + document.getElementById("idNumber").value,
    "نوم: " + document.getElementById("fullName").value,
    "د پلار نوم: " + document.getElementById("fatherName").value,
    "د نیکه نوم: " + document.getElementById("grandfatherName").value
  ].join("\n");
  await navigator.clipboard.writeText(data);
  alert("ټول معلومات کاپي شول.");
});

document.getElementById("newScan").addEventListener("click", () => {
  document.getElementById("resultPage").hidden = true;
  document.getElementById("scanPage").hidden = false;
  selectedImage = null;
  preview.hidden = true;
  scanButton.disabled = true;
  fileInput.value = "";
  document.getElementById("rawText").value = "";
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
    camera.srcObject = null;
  }
});
