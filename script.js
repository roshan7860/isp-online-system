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


function setStatus(text, value) {
    if (statusEl) statusEl.textContent = text;
    if (progress) progress.value = value || 0;
}


/* =========================
   CAMERA
========================= */

async function openCamera() {

    try {

        if (!navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia) {

            alert("ستاسو براوزر د کیمرې ملاتړ نه کوي.");

            return;
        }

        stream = await navigator.mediaDevices.getUserMedia({

            video: {
                facingMode: {
                    ideal: "environment"
                },

                width: {
                    ideal: 1920
                },

                height: {
                    ideal: 1080
                }
            },

            audio: false
        });


        camera.srcObject = stream;

        await camera.play();

        takePhoto.disabled = false;

        const msg =
            document.getElementById("cameraMessage");

        if (msg) {

            msg.textContent =
                "تذکره د چوکاټ منځ ته راوله";
        }

    }

    catch (error) {

        console.error(error);

        alert(
            "کیمرې ته اجازه ورکړئ یا له ګالرۍ عکس وټاکئ."
        );
    }
}


if (startCamera) {

    startCamera.addEventListener(
        "click",
        openCamera
    );
}


/* =========================
   TAKE PHOTO
========================= */

if (takePhoto) {

    takePhoto.addEventListener("click", function () {

        if (!stream) return;


        const width =
            camera.videoWidth || 1920;

        const height =
            camera.videoHeight || 1080;


        canvas.width = width;

        canvas.height = height;


        const ctx =
            canvas.getContext("2d");


        ctx.drawImage(
            camera,
            0,
            0,
            width,
            height
        );


        selectedImage =
            canvas.toDataURL(
                "image/jpeg",
                0.95
            );


        preview.src = selectedImage;

        preview.hidden = false;

        scanButton.disabled = false;

    });
}


/* =========================
   GALLERY
========================= */

if (fileInput) {

    fileInput.addEventListener(
        "change",
        function () {

            const file =
                fileInput.files[0];

            if (!file) return;


            const reader =
                new FileReader();


            reader.onload =
                function (event) {

                    selectedImage =
                        event.target.result;


                    preview.src =
                        selectedImage;


                    preview.hidden =
                        false;


                    scanButton.disabled =
                        false;
                };


            reader.readAsDataURL(file);

        }
    );
}


/* =========================
   DIGIT CONVERTER
========================= */

function normalizeDigits(text) {

    const map = {

        "۰": "0",
        "۱": "1",
        "۲": "2",
        "۳": "3",
        "۴": "4",
        "۵": "5",
        "۶": "6",
        "۷": "7",
        "۸": "8",
        "۹": "9",

        "٠": "0",
        "١": "1",
        "٢": "2",
        "٣": "3",
        "٤": "4",
        "٥": "5",
        "٦": "6",
        "٧": "7",
        "٨": "8",
        "٩": "9"
    };


    return String(text || "")
        .replace(
            /[۰-۹٠-٩]/g,
            function (c) {

                return map[c] || c;
            }
        );
}


/* =========================
   CLEAN TEXT
========================= */

function cleanText(text) {

    return String(text || "")

        .replace(/\r/g, "\n")

        .replace(/[ \t]+/g, " ")

        .replace(/\n{2,}/g, "\n")

        .trim();
}


function getLines(text) {

    return cleanText(text)

        .split("\n")

        .map(function (line) {

            return line
                .replace(/[|¦]/g, " ")
                .trim();

        })

        .filter(function (line) {

            return line.length > 0;

        });
}


/* =========================
   IMAGE PROCESSING
========================= */

function processImage(
    dataURL,
    mode
) {

    return new Promise(function (
        resolve,
        reject
    ) {

        const img =
            new Image();


        img.onload =
            function () {

                const maxSize = 2800;


                let scale =
                    Math.min(
                        maxSize /
                        Math.max(
                            img.width,
                            img.height
                        ),

                        2.5
                    );


                if (scale < 1)
                    scale = 1;


                const width =
                    Math.round(
                        img.width * scale
                    );


                const height =
                    Math.round(
                        img.height * scale
                    );


                const c =
                    document.createElement(
                        "canvas"
                    );


                c.width = width;

                c.height = height;


                const ctx =
                    c.getContext(
                        "2d",
                        {
                            willReadFrequently:
                                true
                        }
                    );


                ctx.drawImage(
                    img,
                    0,
                    0,
                    width,
                    height
                );


                const imageData =
                    ctx.getImageData(
                        0,
                        0,
                        width,
                        height
                    );


                const data =
                    imageData.data;


                for (
                    let i = 0;
                    i < data.length;
                    i += 4
                ) {

                    let gray =
                        0.299 * data[i] +
                        0.587 * data[i + 1] +
                        0.114 * data[i + 2];


                    let value =
                        gray;


                    if (mode === "contrast") {

                        value =
                            (gray - 128) * 1.7 +
                            128;


                        value =
                            Math.max(
                                0,
                                Math.min(
                                    255,
                                    value
                                )
                            );
                    }


                    if (mode === "bw") {

                        value =
                            gray > 145
                                ? 255
                                : 0;
                    }


                    data[i] =
                        value;

                    data[i + 1] =
                        value;

                    data[i + 2] =
                        value;
                }


                ctx.putImageData(
                    imageData,
                    0,
                    0
                );


                resolve(
                    c.toDataURL(
                        "image/jpeg",
                        0.95
                    )
                );
            };


        img.onerror = reject;

        img.src = dataURL;

    });
}


/* =========================
   OCR
========================= */

async function runOCR(
    image,
    language,
    psm
) {

    return await Tesseract.recognize(

        image,

        language,

        {

            psm: psm || 6,

            logger:
                function (message) {

                    if (
                        typeof message.progress ===
                        "number"
                    ) {

                        const value =
                            Math.round(
                                message.progress *
                                100
                            );


                        setStatus(
                            message.status ||
                            "متن لوستل کېږي...",
                            value
                        );
                    }
                }
        }
    );
}


/* =========================
   ID NUMBER
========================= */

function findIDNumber(text) {

    const normalized =
        normalizeDigits(text);


    const lines =
        getLines(normalized);


    /* لومړی د تذکرې نمبر د لیبل سره پیدا کړه */

    for (
        let i = 0;
        i < lines.length;
        i++
    ) {

        const line =
            lines[i];


        if (
            /تذکر|تذکره|تذکرې|شماره|نمبر|ID/i
                .test(line)
        ) {

            const numbers =
                line.match(
                    /\d[\d\s\-\/]{7,25}\d/g
                );


            if (
                numbers &&
                numbers.length
            ) {

                const n =
                    numbers[0]
                        .replace(
                            /[^\d]/g,
                            ""
                        );


                if (
                    n.length >= 8 &&
                    n.length <= 20
                ) {

                    return n;
                }
            }


            if (lines[i + 1]) {

                const next =
                    lines[i + 1]
                        .replace(
                            /[^\d]/g,
                            ""
                        );


                if (
                    next.length >= 8 &&
                    next.length <= 20
                ) {

                    return next;
                }
            }
        }
    }


    /* که لیبل پیدا نه شو */

    const all =
        normalized.match(
            /\d[\d\s\-\/]{8,25}\d/g
        ) || [];


    for (
        let i = 0;
        i < all.length;
        i++
    ) {

        const number =
            all[i].replace(
                /[^\d]/g,
                ""
            );


        if (
            number.length >= 10 &&
            number.length <= 20
        ) {

            return number;
        }
    }


    return "";
}


/* =========================
   NAME DETECTION
========================= */

function isName(text) {

    if (!text) return false;


    text =
        text.trim();


    if (text.length < 2)
        return false;


    if (
        /\d{3,}/.test(
            normalizeDigits(text)
        )
    ) {

        return false;
    }


    if (
        /تذکر|شماره|نمبر|جنسیت|تابعیت|ولایت|ولسوال|زیږون|ولد|ادرس|پته/i
            .test(text)
    ) {

        return false;
    }


    return (
        /[\u0600-\u06FF]/.test(text) ||
        /[A-Za-z]/.test(text)
    );
}


/* =========================
   VALUE AFTER LABEL
========================= */

function valueAfter(
    line,
    labels
) {

    for (
        let i = 0;
        i < labels.length;
        i++
    ) {

        const label =
            labels[i];


        const position =
            line.indexOf(label);


        if (position !== -1) {

            let value =
                line.substring(
                    position +
                    label.length
                );


            value =
                value
                    .replace(
                        /^[\s:：\-–—|]+/,
                        ""
                    )
                    .trim();


            if (
                isName(value)
            ) {

                return value;
            }
        }
    }


    return "";
}


/* =========================
   EXTRACT INFORMATION
========================= */

function extractInformation(
    text
) {

    const lines =
        getLines(text);


    const result = {

        idNumber:
            findIDNumber(text),

        fullName:
            "",

        fatherName:
            "",

        grandfatherName:
            ""
    };


    /* نوم */

    for (
        let i = 0;
        i < lines.length;
        i++
    ) {

        let value =
            valueAfter(
                lines[i],
                [
                    "د نوم",
                    "نوم",
                    "اسم",
                    "نام"
                ]
            );


        if (value) {

            result.fullName =
                value;

            break;
        }
    }


    /* د پلار نوم */

    for (
        let i = 0;
        i < lines.length;
        i++
    ) {

        let value =
            valueAfter(
                lines[i],
                [
                    "د پلار نوم",
                    "پلار نوم",
                    "نام پدر",
                    "پدر"
                ]
            );


        if (!value &&
            /د پلار نوم|پلار نوم|نام پدر|پدر/
                .test(lines[i])) {

            if (lines[i + 1]) {

                if (
                    isName(
                        lines[i + 1]
                    )
                ) {

                    value =
                        lines[i + 1];
                }
            }
        }


        if (value) {

            result.fatherName =
                value;

            break;
        }
    }


    /* د نیکه نوم */

    for (
        let i = 0;
        i < lines.length;
        i++
    ) {

        let value =
            valueAfter(
                lines[i],
                [
                    "د نیکه نوم",
                    "نیکه نوم",
                    "نام پدرکلان",
                    "پدرکلان",
                    "پدر بزرگ"
                ]
            );


        if (!value &&
            /د نیکه نوم|نیکه نوم|نام پدرکلان|پدرکلان/
                .test(lines[i])) {

            if (lines[i + 1]) {

                if (
                    isName(
                        lines[i + 1]
                    )
                ) {

                    value =
                        lines[i + 1];
                }
            }
        }


        if (value) {

            result.grandfatherName =
                value;

            break;
        }
    }


    /*
       Fallback:
       که OCR لیبلونه ونه پېژني،
       د نومونو احتمالي کرښې پیدا کوي.
    */

    const candidates =
        lines.filter(
            function (line) {

                return isName(line);
            }
        );


    if (
        !result.fullName &&
        candidates.length > 0
    ) {

        result.fullName =
            candidates[0];
    }


    if (
        !result.fatherName &&
        candidates.length > 1
    ) {

        result.fatherName =
            candidates[1];
    }


    if (
        !result.grandfatherName &&
        candidates.length > 2
    ) {

        result.grandfatherName =
            candidates[2];
    }


    return result;
}


/* =========================
   SCAN BUTTON
========================= */

if (scanButton) {

    scanButton.addEventListener(
        "click",
        async function () {

            if (!selectedImage)
                return;


            progressBox.hidden =
                false;


            setStatus(
                "د عکس کیفیت برابرېږي...",
                2
            );


            try {

                /*
                   د OCR لپاره څو مختلف عکسونه
                   جوړوو ترڅو نتیجه ښه شي.
                */

                const normal =
                    await processImage(
                        selectedImage,
                        "normal"
                    );


                const contrast =
                    await processImage(
                        selectedImage,
                        "contrast"
                    );


                const blackWhite =
                    await processImage(
                        selectedImage,
                        "bw"
                    );


                let allText = "";


                /* OCR 1 */

                setStatus(
                    "د پښتو او دري متن لوستل کېږي...",
                    10
                );


                const result1 =
                    await runOCR(
                        normal,
                        "pus+fas+eng",
                        6
                    );


                allText +=
                    "\n" +
                    result1.data.text;


                /* OCR 2 */

                setStatus(
                    "دوهم ځل متن پېژندل کېږي...",
                    40
                );


                const result2 =
                    await runOCR(
                        contrast,
                        "pus+fas+eng",
                        11
                    );


                allText +=
                    "\n" +
                    result2.data.text;


                /* OCR 3 */

                setStatus(
                    "د تذکرې عددونه او متن بیا لوستل کېږي...",
                    70
                );


                const result3 =
                    await runOCR(
                        blackWhite,
                        "pus+fas+eng",
                        6
                    );


                allText +=
                    "\n" +
                    result3.data.text;


                allText =
                    cleanText(
                        allText
                    );


                setStatus(
                    "معلومات جلا کېږي...",
                    90
                );


                const information =
                    extractInformation(
                        allText
                    );


                /* خانې ډکول */

                document.getElementById(
                    "idNumber"
                ).value =
                    information.idNumber;


                document.getElementById(
                    "fullName"
                ).value =
                    information.fullName;


                document.getElementById(
                    "fatherName"
                ).value =
                    information.fatherName;


                document.getElementById(
                    "grandfatherName"
                ).value =
                    information.grandfatherName;


                document.getElementById(
                    "rawText"
                ).value =
                    allText;


                /* نتیجه صفحه */

                document.getElementById(
                    "scanPage"
                ).hidden =
                    true;


                document.getElementById(
                    "resultPage"
                ).hidden =
                    false;


                progressBox.hidden =
                    true;

            }

            catch (error) {

                console.error(error);

                progressBox.hidden =
                    true;


                alert(
                    "سکین ناکام شو.\n\n" +
                    "مهرباني وکړئ د تذکرې روښانه، " +
                    "مستقیم او نږدې عکس واخلئ."
                );
            }

        }
    );
}


/* =========================
   COPY BUTTONS
========================= */

document
    .querySelectorAll(
        "[data-copy]"
    )
    .forEach(
        function (button) {

            button.addEventListener(
                "click",
                async function () {

                    const element =
                        document.getElementById(
                            button.dataset.copy
                        );


                    const value =
                        element.value || "";


                    try {

                        await navigator
                            .clipboard
                            .writeText(
                                value
                            );

                    }

                    catch {

                        element.focus();

                        element.select();

                        document.execCommand(
                            "copy"
                        );
                    }


                    const oldText =
                        button.textContent;


                    button.textContent =
                        "✓ کاپي شو";


                    setTimeout(
                        function () {

                            button.textContent =
                                oldText;

                        },
                        1200
                    );

                }
            );

        }
    );


/* =========================
   COPY ALL
========================= */

const copyAll =
    document.getElementById(
        "copyAll"
    );


if (copyAll) {

    copyAll.addEventListener(
        "click",
        async function () {

            const text =

                "د تذکرې نمبر: " +
                document.getElementById(
                    "idNumber"
                ).value +

                "\nنوم: " +
                document.getElementById(
                    "fullName"
                ).value +

                "\nد پلار نوم: " +
                document.getElementById(
                    "fatherName"
                ).value +

                "\nد نیکه نوم: " +
                document.getElementById(
                    "grandfatherName"
                ).value;


            try {

                await navigator
                    .clipboard
                    .writeText(
                        text
                    );


                alert(
                    "ټول معلومات کاپي شول."
                );

            }

            catch {

                const textarea =
                    document.createElement(
                        "textarea"
                    );


                textarea.value =
                    text;


                document.body.appendChild(
                    textarea
                );


                textarea.select();


                document.execCommand(
                    "copy"
                );


                textarea.remove();


                alert(
                    "ټول معلومات کاپي شول."
                );
            }

        }
    );
}


/* =========================
   NEW SCAN
========================= */

const newScan =
    document.getElementById(
        "newScan"
    );


if (newScan) {

    newScan.addEventListener(
        "click",
        function () {

            document.getElementById(
                "resultPage"
            ).hidden =
                true;


            document.getElementById(
                "scanPage"
            ).hidden =
                false;


            selectedImage =
                null;


            preview.hidden =
                true;


            scanButton.disabled =
                true;


            if (fileInput)
                fileInput.value = "";


            document.getElementById(
                "rawText"
            ).value = "";


            document.getElementById(
                "idNumber"
            ).value = "";


            document.getElementById(
                "fullName"
            ).value = "";


            document.getElementById(
                "fatherName"
            ).value = "";


            document.getElementById(
                "grandfatherName"
            ).value = "";


            if (stream) {

                stream
                    .getTracks()
                    .forEach(
                        function (track) {
                            track.stop();
                        }
                    );


                stream =
                    null;


                camera.srcObject =
                    null;
            }

        }
    );
}
