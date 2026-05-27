const canvas = document.getElementById("starfield");
const ctx = canvas.getContext("2d");
const timecode = document.getElementById("timecode");
const heroKicker = document.getElementById("hero-kicker");
const heroTitle = document.getElementById("title");
const heroSubtitle = document.getElementById("hero-subtitle");
const clientConsole = document.getElementById("client-console");
const consoleStatus = document.getElementById("console-status");
const fpsOutput = document.getElementById("fps-output");
const frameOutput = document.getElementById("frame-output");
const runtimeOutput = document.getElementById("runtime-output");
const memoryOutput = document.getElementById("memory-output");
const perfStatus = document.getElementById("perf-status");
const commandStatus = document.getElementById("command-status");
const commandLog = document.getElementById("command-log");
const commandForm = document.getElementById("command-form");
const commandInput = document.getElementById("command-input");
const scanlineControl = document.getElementById("scanline-control");
const neonControl = document.getElementById("neon-control");
const speedControl = document.getElementById("speed-control");
const resetControls = document.getElementById("reset-controls");
const cards = document.querySelectorAll(".card");
const points = [];
const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let width = 0;
let height = 0;
let frame = 0;
let raf;
let lastPerfTime = performance.now();
let framesSinceSample = 0;
let latestFps = 0;
let starSpeed = 1;
let signalBlue = "#49d9ff";
let signalOrange = "#ff8a1f";
let typewriterRun = 0;
let audioContext;
let audioEnabled = true;
let audioUnlocked = false;
const startTime = performance.now();
const typingRepeatMs = 60000;

const heroTransmission = {
    kicker: "Incoming transmission / DONGO PC uplink",
    title: "DONGO PC SIGNAL",
    subtitle: "Kék neon karakterfény, narancs rendszerfeliratok, hibás szalagkövetés, hideg terminálpanelek és egy régi űrállomás monitorának ideges vibrálása."
};

const commandHelp = [
    "help - commands",
    "status - client report",
    "scan - refresh diagnostics",
    "theme blue|amber|green",
    "glitch on|off",
    "sound on|off",
    "clear - empty log",
    "report - download json"
];

function detectBrowser() {
    const ua = navigator.userAgent;
    const brands = navigator.userAgentData?.brands || [];
    const brand = brands.find((item) => !/Not.A.Brand/i.test(item.brand));

    if (/Edg\//.test(ua)) return "Microsoft Edge";
    if (/OPR\//.test(ua)) return "Opera";
    if (/Firefox\//.test(ua)) return "Firefox";
    if (/SamsungBrowser\//.test(ua)) return "Samsung Internet";
    if (/Chrome\//.test(ua) || /CriOS\//.test(ua)) return brand?.brand || "Chrome";
    if (/Safari\//.test(ua)) return "Safari";

    return brand?.brand || "Unknown";
}

function detectOS() {
    const platform = navigator.userAgentData?.platform || navigator.platform || "";
    const ua = navigator.userAgent;
    const source = `${platform} ${ua}`;

    if (/Windows/i.test(source)) return "Windows";
    if (/Android/i.test(source)) return "Android";
    if (/iPhone|iPad|iPod/i.test(source)) return "iOS / iPadOS";
    if (/Mac/i.test(source)) return "macOS";
    if (/Linux/i.test(source)) return "Linux";

    return platform || "Unknown";
}

function getClientData() {
    return [
        ["OS", detectOS()],
        ["Browser", detectBrowser()],
        ["Viewport", `${window.innerWidth} x ${window.innerHeight}`],
        ["Screen", `${screen.width} x ${screen.height}`],
        ["Pixel ratio", `${Math.round(window.devicePixelRatio * 100) / 100}x`],
        ["Language", navigator.language || "Unknown"],
        ["Color mode", window.matchMedia("(prefers-color-scheme: dark)").matches ? "Dark" : "Light"],
        ["Touch", navigator.maxTouchPoints > 0 ? `${navigator.maxTouchPoints} points` : "No touch"],
        ["Connection", navigator.onLine ? "Online" : "Offline"]
    ];
}

function wait(ms) {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });
}

function getAudioContext() {
    const AudioEngine = window.AudioContext || window.webkitAudioContext;
    if (!AudioEngine) return null;

    if (!audioContext) {
        audioContext = new AudioEngine();
    }

    return audioContext;
}

function unlockAudio() {
    const context = getAudioContext();
    if (!context) return;

    context.resume().then(() => {
        if (audioUnlocked) return;
        audioUnlocked = true;
        playTypewriterSequence();
    }).catch(() => {
        audioUnlocked = false;
    });
}

function chirpCharacter(character, index) {
    const context = getAudioContext();
    if (!audioEnabled || !audioUnlocked || !context || /\s/.test(character)) return;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    const now = context.currentTime;
    const frequency = 1180 + ((character.charCodeAt(0) + index * 37) % 520);

    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.72, now + 0.035);

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(frequency, now);
    filter.Q.setValueAtTime(9, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.035, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.05);
}

function renderTypedText(element, text) {
    element.textContent = text;
    if (element === heroTitle) {
        element.dataset.text = text;
    }
}

async function typeText(element, text, speed, runId) {
    element.classList.add("typing-cursor");
    renderTypedText(element, "");

    for (let index = 0; index < text.length; index += 1) {
        if (runId !== typewriterRun) return false;
        renderTypedText(element, text.slice(0, index + 1));
        chirpCharacter(text[index], index);
        await wait(speed);
    }

    element.classList.remove("typing-cursor");
    return true;
}

function renderClientConsole() {
    clientConsole.replaceChildren();

    getClientData().forEach(([label, value]) => {
        const line = document.createElement("p");
        const name = document.createElement("span");
        const data = document.createElement("strong");

        line.className = "console-line";
        name.textContent = `> ${label}`;
        data.textContent = value;

        line.append(name, data);
        clientConsole.append(line);
    });

    const cursor = document.createElement("p");
    cursor.className = "cursor-block";
    cursor.textContent = "> monitor active ";
    clientConsole.append(cursor);

    consoleStatus.textContent = navigator.onLine ? "RX-ONLINE" : "RX-OFFLINE";
}

async function typeClientConsole(runId) {
    clientConsole.replaceChildren();
    consoleStatus.textContent = "SCANNING";

    for (const [label, value] of getClientData()) {
        const line = document.createElement("p");
        line.className = "typing-cursor";
        clientConsole.append(line);

        const completed = await typeText(line, `> ${label}: ${value}`, 18, runId);
        line.classList.remove("typing-cursor");
        if (!completed) return;
        await wait(80);
    }

    const cursor = document.createElement("p");
    cursor.className = "cursor-block";
    cursor.textContent = "> monitor active ";
    clientConsole.append(cursor);
    consoleStatus.textContent = navigator.onLine ? "RX-ONLINE" : "RX-OFFLINE";
}

async function playTypewriterSequence() {
    typewriterRun += 1;
    const runId = typewriterRun;

    await typeText(heroKicker, heroTransmission.kicker, 28, runId);
    await wait(180);
    if (!await typeText(heroTitle, heroTransmission.title, 42, runId)) return;
    await wait(220);
    if (!await typeText(heroSubtitle, heroTransmission.subtitle, 14, runId)) return;
    await wait(160);
    await typeClientConsole(runId);
}

function formatRuntime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
}

function updatePerformancePanel(now) {
    framesSinceSample += 1;

    if (now - lastPerfTime < 500) return;

    latestFps = Math.round((framesSinceSample * 1000) / (now - lastPerfTime));
    framesSinceSample = 0;
    lastPerfTime = now;

    fpsOutput.textContent = String(latestFps);
    frameOutput.textContent = String(frame);
    runtimeOutput.textContent = formatRuntime(now - startTime);
    perfStatus.textContent = latestFps >= 50 ? "LIVE" : "DROPPED";

    if (performance.memory) {
        const used = Math.round(performance.memory.usedJSHeapSize / 1048576);
        const limit = Math.round(performance.memory.jsHeapSizeLimit / 1048576);
        memoryOutput.textContent = `${used}/${limit} MB`;
    } else {
        memoryOutput.textContent = "N/A";
    }
}

function addLog(message, type = "") {
    const line = document.createElement("p");
    line.textContent = message;
    if (type) line.className = type;
    commandLog.append(line);
    commandLog.scrollTop = commandLog.scrollHeight;
}

function setTheme(name) {
    const themes = {
        blue: {
            blue: "#49d9ff",
            orange: "#ff8a1f",
            green: "#8dffcf"
        },
        amber: {
            blue: "#ffd166",
            orange: "#ff7a1a",
            green: "#ffe8a3"
        },
        green: {
            blue: "#65ffb8",
            orange: "#ffb000",
            green: "#9dff7a"
        }
    };
    const theme = themes[name];

    if (!theme) {
        addLog(`> unknown theme: ${name}`, "log-warn");
        return;
    }

    document.documentElement.style.setProperty("--blue", theme.blue);
    document.documentElement.style.setProperty("--orange", theme.orange);
    document.documentElement.style.setProperty("--green", theme.green);
    signalBlue = theme.blue;
    signalOrange = theme.orange;
    addLog(`> theme channel set to ${name}`);
}

function setGlitch(enabled) {
    document.body.classList.toggle("glitch-muted", !enabled);
    addLog(enabled ? "> glitch layer online" : "> glitch layer muted");
}

function setSound(enabled) {
    audioEnabled = enabled;
    if (enabled) {
        unlockAudio();
    }
    addLog(enabled ? "> cursor chirp armed" : "> cursor chirp muted");
}

function applyControls() {
    const scanlines = Number(scanlineControl.value) / 100;
    const neon = Number(neonControl.value) / 100;
    starSpeed = Number(speedControl.value) / 100;

    document.documentElement.style.setProperty("--scanline-opacity", scanlines.toFixed(2));
    document.documentElement.style.setProperty("--neon-boost", neon.toFixed(2));
}

function createReport() {
    return {
        generatedAt: new Date().toISOString(),
        client: Object.fromEntries(getClientData()),
        performance: {
            fps: latestFps,
            frame,
            runtime: runtimeOutput.textContent,
            memory: memoryOutput.textContent
        },
        controls: {
            scanlines: scanlineControl.value,
            neon: neonControl.value,
            starSpeed: speedControl.value,
            sound: audioEnabled ? "on" : "off"
        }
    };
}

function downloadReport() {
    const blob = new Blob([JSON.stringify(createReport(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "orbital-88-report.json";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    addLog("> report downloaded");
}

function runCommand(rawCommand) {
    const [command = "", argument = ""] = rawCommand.trim().toLowerCase().split(/\s+/, 2);
    if (!command) return;

    addLog(`> ${rawCommand}`, "log-muted");

    if (command === "help") {
        commandHelp.forEach((line) => addLog(`> ${line}`));
    } else if (command === "status") {
        getClientData().forEach(([label, value]) => addLog(`> ${label}: ${value}`));
        addLog(`> FPS: ${latestFps}`);
    } else if (command === "scan") {
        renderClientConsole();
        addLog("> client diagnostics refreshed");
    } else if (command === "theme") {
        setTheme(argument || "blue");
    } else if (command === "glitch") {
        setGlitch(argument !== "off");
    } else if (command === "sound") {
        setSound(argument !== "off");
    } else if (command === "clear") {
        commandLog.replaceChildren();
    } else if (command === "report") {
        downloadReport();
    } else {
        addLog(`> command not found: ${command}`, "log-warn");
    }

    commandStatus.textContent = "READY";
}

function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
}

function seed() {
    points.length = 0;
    const count = Math.min(180, Math.floor((width * height) / 7600));
    for (let i = 0; i < count; i++) {
        points.push({
            x: Math.random() * width,
            y: Math.random() * height,
            z: Math.random() * 1.8 + 0.25,
            char: Math.random() > 0.5 ? "1" : "0",
            drift: Math.random() * 0.5 + 0.15
        });
    }
}

function draw() {
    const now = performance.now();
    frame += 1;
    ctx.clearRect(0, 0, width, height);
    ctx.font = "13px Courier New";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    points.forEach((p, index) => {
        const dx = (pointer.x - width / 2) * 0.0008 * p.z;
        const dy = (pointer.y - height / 2) * 0.00045 * p.z;
        p.x += dx + p.drift * p.z * starSpeed;
        p.y += dy + Math.sin((frame + index) * 0.018) * 0.12;

        if (p.x > width + 20) p.x = -20;
        if (p.y > height + 20) p.y = -20;
        if (p.y < -20) p.y = height + 20;

        const pulse = 0.45 + Math.sin((frame + index * 7) * 0.05) * 0.25;
        ctx.fillStyle = signalBlue;
        ctx.globalAlpha = pulse;
        ctx.shadowColor = signalBlue;
        ctx.shadowBlur = 10 * p.z;
        ctx.fillText(p.char, p.x, p.y);
        ctx.globalAlpha = 1;

        if (index % 8 === 0) {
            ctx.fillStyle = signalOrange;
            ctx.globalAlpha = 0.42;
            ctx.shadowColor = signalOrange;
            ctx.fillText("+", p.x + 16, p.y - 12);
            ctx.globalAlpha = 1;
        }
    });

    if (frame % 5 === 0) {
        const seconds = Math.floor(frame / 30);
        const hh = String(Math.floor(seconds / 3600)).padStart(2, "0");
        const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
        const ss = String(seconds % 60).padStart(2, "0");
        const ff = String(frame % 30).padStart(2, "0");
        timecode.textContent = `TCR ${hh}:${mm}:${ss}:${ff}`;
    }

    updatePerformancePanel(now);
    raf = requestAnimationFrame(draw);
}

window.addEventListener("resize", resize);
window.addEventListener("online", renderClientConsole);
window.addEventListener("offline", renderClientConsole);
window.addEventListener("pointerdown", unlockAudio, { once: true });
window.addEventListener("keydown", unlockAudio, { once: true });
scanlineControl.addEventListener("input", applyControls);
neonControl.addEventListener("input", applyControls);
speedControl.addEventListener("input", applyControls);
resetControls.addEventListener("click", () => {
    scanlineControl.value = "44";
    neonControl.value = "100";
    speedControl.value = "100";
    applyControls();
    setTheme("blue");
    setGlitch(true);
    addLog("> controls reset");
});
commandForm.addEventListener("submit", (event) => {
    event.preventDefault();
    commandStatus.textContent = "EXEC";
    runCommand(commandInput.value);
    commandInput.value = "";
    commandInput.focus();
});
window.addEventListener("pointermove", (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
});

const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.24 });

cards.forEach((card, index) => {
    card.style.transitionDelay = `${index * 110}ms`;
    observer.observe(card);
});

document.querySelectorAll(".command, .nav a").forEach((item) => {
    item.addEventListener("click", () => {
        document.body.style.filter = "hue-rotate(8deg) contrast(1.25)";
        window.setTimeout(() => {
            document.body.style.filter = "";
        }, 120);
    });
});

resize();
applyControls();
runCommand("help");
playTypewriterSequence();
window.setInterval(playTypewriterSequence, typingRepeatMs);
draw();

document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        cancelAnimationFrame(raf);
    } else {
        draw();
    }
});
