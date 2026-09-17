/*
=========================================================
 د افغانستان د تذکرې Scanner - Improved Version
=========================================================

 دا فایل یوازې د پخواني script.js پر ځای واچوئ.

 معلومات:
 1. د تذکرې نمبر
 2. نوم
 3. د پلار نوم
 4. د نیکه نوم

 OCR په Browser کې ترسره کېږي.
 د اپ خپل Database / Server ته معلومات نه لېږل کېږي.
=========================================================
*/


let stream = null;
let selectedImage = null;


/* ===============================
   ELEMENTS
================================ */

const camera =
    document.getElementById("camera");

const canvas =
    document.getElementById("canvas");

const preview =
    document.getElementById("preview");

const startCamera =
    document.getElementById("startCamera");

const takePhoto =
    document.getElementById("takePhoto");

const fileInput =
    document.getElementById("fileInput");

const scanButton =
    document.getElementById("scanButton");

const progressBox =
    document.getElementById("progressBox");

const statusEl =
    document.getElementById("status");

const progress =
    document.getElementById("progress");



/* ===============================
   STATUS
================================ */

function status(text, value) {

    if (statusEl)
        statusEl.textContent = text;

    if (progress)
        progress.value = value || 0;
}



/* ===============================
   CAMERA
================================ */

async function openCamera() {

    try {

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            alert(
                "ستاسو براوزر د کیمرې ملاتړ نه کوي."
            );

            return;
        }


        stream =
            await navigator.mediaDevices.getUserMedia({

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


        if (takePhoto)
            takePhoto.disabled = false;


        const message =
            document.getElementById(
                "cameraMessage"
            );


        if (message) {

            message.textContent =
                "تذکره د چوکاټ منځ ته راوله";

        }

    }

    catch (error) {

        console.error(error);

        alert(
            "کیمرې ته اجازه ورکړئ."
        );

    }

}



if (startCamera) {

    startCamera.addEventListener(
        "click",
        openCamera
    );

}



/* ===============================
   TAKE PHOTO
================================ */

if (takePhoto) {

    takePhoto.addEventListener(
        "click",
        function () {

            if (!stream)
                return;


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
                    0.96
                );


            preview.src =
                selectedImage;


            preview.hidden =
                false;


            scanButton.disabled =
                false;

        }
    );

}



/* ===============================
   GALLERY
================================ */

if (fileInput) {

    fileInput.addEventListener(
        "change",
        function () {

            const file =
                fileInput.files[0];


            if (!file)
                return;


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



/* ===============================
   DIGITS
================================ */

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



/* ===============================
   CLEAN TEXT
================================ */

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

        .map(function (x) {

            return x
                .replace(/[|¦]/g, " ")
                .trim();

        })

        .filter(function (x) {

            return x.length > 0;

        });

}



/* ===============================
   IMAGE PROCESSING
================================ */

function processImage(
    source,
    mode
) {

    return new Promise(
        function (resolve, reject) {

            const img =
                new Image();


            img.onload =
                function () {

                    let scale = 1;


                    const biggest =
                        Math.max(
                            img.width,
                            img.height
                        );


                    if (biggest < 2200) {

                        scale =
                            2200 / biggest;

                    }


                    if (scale > 2.5)
                        scale = 2.5;


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


                    c.width =
                        width;

                    c.height =
                        height;


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


                        if (
                            mode ===
                            "contrast"
                        ) {

                            value =
                                (gray - 128) *
                                1.8 +
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


                        if (
                            mode === "bw"
                        ) {

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
                            0.96
                        )
                    );

                };


            img.onerror =
                reject;


            img.src =
                source;

        }
    );

}



/* ===============================
   OCR
================================ */

async function OCR(
    image,
    psm
) {

    return await Tesseract.recognize(

        image,

        "pus+fas+eng",

        {

            psm: psm || 6,

            logger:
                function (m) {

                    if (
                        typeof m.progress ===
                        "number"
                    ) {

                        status(
                            m.status ||
                            "متن لوستل کېږي...",
                            Math.round(
                                m.progress * 100
                            )
                        );

                    }

                }

        }

    );

}



/* ===============================
   NAME CHECK
================================ */

function isPossibleName(value) {

    if (!value)
        return false;


    value =
        value.trim();


    if (value.length < 2)
        return false;


    if (value.length > 60)
        return false;


    const normalized =
        normalizeDigits(value);


    if (
        /\d{3,}/.test(
            normalized
        )
    )
        return false;


    if (
        /جمهوري|اسلامي|افغانستان|وزارت|امور|داخله|تذکره|تابعیت|سکونت|ولایت|ولسوالي|ولسوالۍ|زیږون|جنسیت|اسلام|افغان|پکتیکا|کابل|غزني/i
            .test(value)
    )
        return false;


    return (
        /[\u0600-\u06FF]/.test(
            value
        ) ||
        /[A-Za-z]/.test(
            value
        )
    );

}



/* ===============================
   REMOVE OCR NOISE
================================ */

function cleanName(value) {

    if (!value)
        return "";


    value =
        value

            .replace(
                /[|¦_~`]+/g,
                " "
            )

            .replace(
                /\s+/g,
                " "
            )

            .trim();


    return value;

}



/* ===============================
   LABEL SEARCH
================================ */

function findValueAfterLabel(
    lines,
    labels
) {

    for (
        let i = 0;
        i < lines.length;
        i++
    ) {

        const line =
            lines[i];


        for (
            let j = 0;
            j < labels.length;
            j++
        ) {

            const label =
                labels[j];


            const position =
                line.indexOf(
                    label
                );


            if (
                position !== -1
            ) {

                let value =
                    line.substring(
                        position +
                        label.length
                    );


                value =
                    value.replace(
                        /^[\s:：\-–—|]+/,
                        ""
                    );


                value =
                    cleanName(
                        value
                    );


                if (
                    isPossibleName(
                        value
                    )
                ) {

                    return value;

                }


                /*
                 که value په بل line کې وي
                */

                if (
                    lines[i + 1] &&
                    isPossibleName(
                        lines[i + 1]
                    )
                ) {

                    return cleanName(
                        lines[i + 1]
                    );

                }

            }

        }

    }


    return "";

}



/* ===============================
   ID NUMBER
================================ */

function findID(text) {

    const normalized =
        normalizeDigits(
            text
        );


    const lines =
        getLines(
            normalized
        );


    /*
      لومړی د تذکرې د نمبر لیبل
      سره شمېره پیدا کوو.
    */

    for (
        let i = 0;
        i < lines.length;
        i++
    ) {

        if (
            /تذکر|تذکره|تذکرې|شماره|نمبر|ID/i
                .test(
                    lines[i]
                )
        ) {

            const numbers =
                lines[i].match(
                    /\d[\d\s\-\/]{7,25}\d/g
                );


            if (
                numbers &&
                numbers.length
            ) {

                for (
                    let n = 0;
                    n < numbers.length;
                    n++
                ) {

                    const number =
                        numbers[n]
                            .replace(
                                /[^\d]/g,
                                ""
                            );


                    if (
                        number.length >= 8 &&
                        number.length <= 20
                    ) {

                        return number;

                    }

                }

            }


            /*
              که نمبر په بل line کې وي
            */

            if (
                lines[i + 1]
            ) {

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


    /*
      د ټول OCR څخه نمبر پیدا کول
    */

    const numbers =
        normalized.match(
            /\d[\d\s\-\/]{8,25}\d/g
        ) || [];


    for (
        let i = 0;
        i < numbers.length;
        i++
    ) {

        const number =
            numbers[i]
                .replace(
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



/* ===============================
   EXTRACT INFORMATION
================================ */

function extractInformation(
    text
) {

    const lines =
        getLines(
            text
        );


    const result = {

        idNumber:
            findID(text),

        fullName:
            "",

        fatherName:
            "",

        grandfatherName:
            ""

    };


    /*
      نوم
    */

    result.fullName =
        findValueAfterLabel(
            lines,
            [
                "د نوم",
                "نوم",
                "اسم",
                "نام"
            ]
        );


    /*
      پلار
    */

    result.fatherName =
        findValueAfterLabel(
            lines,
            [
                "د پلار نوم",
                "پلار نوم",
                "نام پدر",
                "نام پدر",
                "پدر"
            ]
        );


    /*
      نیکه
    */

    result.grandfatherName =
        findValueAfterLabel(
            lines,
            [
                "د نیکه نوم",
                "نیکه نوم",
                "نام پدرکلان",
                "پدرکلان",
                "پدر بزرگ"
            ]
        );


    return result;

}



/* ===============================
   ALTERNATIVE OCR RESULT
================================ */

function improveFromAllOCR(
    results
) {

    let final = {

        idNumber: "",

        fullName: "",

        fatherName: "",

        grandfatherName: ""

    };


    for (
        let i = 0;
        i < results.length;
        i++
    ) {

        const text =
            cleanText(
                results[i]
            );


        if (!text)
            continue;


        const data =
            extractInformation(
                text
            );


        if (
            !final.idNumber &&
            data.idNumber
        ) {

            final.idNumber =
                data.idNumber;

        }


        if (
            !final.fullName &&
            data.fullName
        ) {

            final.fullName =
                data.fullName;

        }


        if (
            !final.fatherName &&
            data.fatherName
        ) {

            final.fatherName =
                data.fatherName;

        }


        if (
            !final.grandfatherName &&
            data.grandfatherName
        ) {

            final.grandfatherName =
                data.grandfatherName;

        }

    }


    return final;

}



/* ===============================
   MAIN SCAN
================================ */

if (scanButton) {

    scanButton.addEventListener(
        "click",
        async function () {

            if (!selectedImage)
                return;


            progressBox.hidden =
                false;


            try {

                /*
                  اصلي عکس
                */

                status(
                    "عکس چمتو کېږي...",
                    3
                );


                const normal =
                    await processImage(
                        selectedImage,
                        "normal"
                    );


                /*
                  Contrast
                */

                status(
                    "د عکس کیفیت ښه کېږي...",
                    8
                );


                const contrast =
                    await processImage(
                        selectedImage,
                        "contrast"
                    );


                /*
                  Black / White
                */

                status(
                    "د متن بڼه برابریږي...",
                    15
                );


                const bw =
                    await processImage(
                        selectedImage,
                        "bw"
                    );


                const OCRTexts = [];


                /*
                  OCR #1
                */

                status(
                    "د تذکرې پښتو او دري متن لوستل کېږي...",
                    20
                );


                const r1 =
                    await OCR(
                        normal,
                        6
                    );


                OCRTexts.push(
                    r1.data.text
                );


                /*
                  OCR #2
                */

                status(
                    "د تذکرې معلومات بیا لوستل کېږي...",
                    45
                );


                const r2 =
                    await OCR(
                        contrast,
                        11
                    );


                OCRTexts.push(
                    r2.data.text
                );


                /*
                  OCR #3
                */

                status(
                    "د تذکرې ساحې بیا پېژندل کېږي...",
                    70
                );


                const r3 =
                    await OCR(
                        bw,
                        6
                    );


                OCRTexts.push(
                    r3.data.text
                );


                /*
                  معلومات استخراج
                */

                status(
                    "نوم، پلار نوم، نیکه نوم او نمبر جلا کېږي...",
                    90
                );


                const information =
                    improveFromAllOCR(
                        OCRTexts
                    );


                /*
                  Fill fields
                */

                document.getElementById(
                    "idNumber"
                ).value =
                    information.idNumber ||
                    "";


                document.getElementById(
                    "fullName"
                ).value =
                    information.fullName ||
                    "";


                document.getElementById(
                    "fatherName"
                ).value =
                    information.fatherName ||
                    "";


                document.getElementById(
                    "grandfatherName"
                ).value =
                    information.grandfatherName ||
                    "";


                /*
                  ټول OCR متن
                */

                document.getElementById(
                    "rawText"
                ).value =
                    OCRTexts
                        .map(
                            cleanText
                        )
                        .filter(
                            Boolean
                        )
                        .join(
                            "\n\n----------------\n\n"
                        );


                /*
                  Result page
                */

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

                console.error(
                    error
                );


                progressBox.hidden =
                    true;


                alert(
                    "سکین ناکام شو.\n\n" +
                    "تذکره مستقیمه او روښانه ونیسئ."
                );

            }

        }
    );

}



/* ===============================
   COPY INDIVIDUAL
================================ */

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
                        element.value ||
                        "";


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


                    const old =
                        button.textContent;


                    button.textContent =
                        "✓ کاپي شو";


                    setTimeout(
                        function () {

                            button.textContent =
                                old;

                        },
                        1200
                    );

                }
            );

        }
    );



/* ===============================
   COPY ALL
================================ */

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

                const area =
                    document.createElement(
                        "textarea"
                    );


                area.value =
                    text;


                document.body.appendChild(
                    area
                );


                area.select();


                document.execCommand(
                    "copy"
                );


                area.remove();


                alert(
                    "ټول معلومات کاپي شول."
                );

            }

        }
    );

}



/* ===============================
   NEW SCAN
================================ */

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


            document.getElementById(
                "rawText"
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
