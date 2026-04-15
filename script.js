// ==========================================
// CONFIGURACIÓN Y ESTADO GLOBAL DEL JUEGO
// ==========================================

// Variables de estado
let timeRemaining = 180; // 3 minutos (180 segundos)
let energy = 0;
const MAX_ENERGY = 100;
let score = 0;
let highScore = localStorage.getItem('ecoHighScore') || 0; 
let isGameActive = false;

// Variables para el Game Loop profesional
let lastRenderTime = 0;
let timeAccumulator = 0; // Para contar los segundos exactos
let npcSpawnTimer = 0;

// Contexto de audio (se inicia con el primer clic para evitar bloqueos del navegador)
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;

// Definición de los dispositivos en la casa
const devices = {
    lamp: { id: 'lamp', useTime: 3000, energyRate: 1.5, isOn: false, inUse: false, timer: null },
    bath: { id: 'bath', useTime: 2000, energyRate: 2.0, isOn: false, inUse: false, timer: null },
    charger: { id: 'charger', useTime: 10000, energyRate: 0.8, isOn: false, inUse: false, timer: null }
};

const eduMessages = [
    "Desconectar cargadores evita el 'consumo fantasma'.",
    "Apagar luces innecesarias ayuda a reducir la tarifa eléctrica.",
    "No interrumpas a las personas mientras usan la energía, ¡espera tu turno!",
    "La energía es responsabilidad de todos en el hogar."
];

// ==========================================
// INICIALIZACIÓN Y CONTROL DEL JUEGO
// ==========================================

// Cargar el puntaje máximo al abrir la página
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("loading-msg").innerText = eduMessages[Math.floor(Math.random() * eduMessages.length)];
    console.log("Juego cargado. Mejor puntaje histórico: " + highScore);
});

function initAudio() {
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function startGame() {
    initAudio(); // Activa el sonido con la interacción del usuario

    // Reiniciar valores
    timeRemaining = 180;
    energy = 0;
    score = 0;
    timeAccumulator = 0;
    npcSpawnTimer = 0;
    isGameActive = true;

    // Limpiar el estado de todos los dispositivos
    Object.keys(devices).forEach(key => {
        devices[key].isOn = false;
        devices[key].inUse = false;
        clearTimeout(devices[key].timer);
        updateDeviceUI(key);
    });

    // Cambiar pantallas
    document.getElementById("start-screen").style.display = "none";
    document.getElementById("end-screen").style.display = "none";
    document.getElementById("game-container").style.display = "block";

    updateUI();
    
    // Iniciar el ciclo del juego con el reloj interno del navegador
    lastRenderTime = performance.now();
    requestAnimationFrame(gameLoop);
}

// ==========================================
// GAME LOOP (MOTOR PRINCIPAL)
// ==========================================

function gameLoop(currentTime) {
    if (!isGameActive) return;

    // Calcular cuánto tiempo pasó desde el último cuadro (frame)
    const deltaTime = currentTime - lastRenderTime;
    lastRenderTime = currentTime;
    
    timeAccumulator += deltaTime;
    npcSpawnTimer += deltaTime;

    // Lógica que se ejecuta exactamente cada 1 segundo
    if (timeAccumulator >= 1000) {
        timeRemaining--;
        timeAccumulator -= 1000;

        // Calcular penalización de energía por aparatos encendidos
        let energyIncrease = 0;
        Object.values(devices).forEach(dev => {
            if (dev.isOn) energyIncrease += dev.energyRate;
        });
        energy += energyIncrease;

        checkEndConditions();
    }

    // Lógica para intentar crear un NPC cada 2.5 segundos
    if (npcSpawnTimer >= 2500) {
        spawnNPC();
        npcSpawnTimer -= 2500;
    }

    updateUI(); // Refrescar la pantalla fluidamente

    // Continuar el bucle
    if (isGameActive) {
        requestAnimationFrame(gameLoop);
    }
}

// ==========================================
// SISTEMA DE NPCs (EVENTOS ALEATORIOS)
// ==========================================

function spawnNPC() {
    // Filtra los dispositivos que están libres
    const availableDevices = Object.values(devices).filter(d => !d.isOn && !d.inUse);
    
    if (availableDevices.length > 0) {
        // 40% de probabilidad de que alguien use un dispositivo
        if (Math.random() < 0.40) {
            const dev = availableDevices[Math.floor(Math.random() * availableDevices.length)];
            activateDevice(dev.id);
        }
    }
}

function activateDevice(id) {
    const dev = devices[id];
    dev.isOn = true;
    dev.inUse = true;
    
    playSound(400, "square", 0.05); // Sonido de encendido eléctrico leve
    updateDeviceUI(id);
    
    // Animar la barra de progreso del NPC
    const progBar = document.getElementById(`prog-${id}`);
    if(progBar) {
        progBar.style.transition = 'none';
        progBar.style.width = '100%';
        // Pequeño timeout para que el navegador registre el cambio de CSS
        setTimeout(() => {
            progBar.style.transition = `width ${dev.useTime}ms linear`;
            progBar.style.width = '0%';
        }, 50);
    }

    // El NPC se va después del tiempo de uso, pero deja la luz prendida
    dev.timer = setTimeout(() => {
        dev.inUse = false; 
        updateDeviceUI(id);
    }, dev.useTime);
}

// ==========================================
// INTERACCIÓN DEL JUGADOR
// ==========================================

function interactDevice(id) {
    if (!isGameActive) return;
    const dev = devices[id];

    if (dev.inUse) {
        // ERROR: El jugador apagó la luz mientras el NPC la usaba
        score -= 15;
        playSound(150, "sawtooth", 0.1); 
        showFloatingText(`dev-${id}`, "-15", "#ff3333");
        
        // Forzar apagado y cancelar el temporizador del NPC
        dev.inUse = false;
        dev.isOn = false;
        clearTimeout(dev.timer);
        
    } else if (dev.isOn) {
        // ACIERTO: El jugador apagó algo que el NPC dejó encendido
        score += 10;
        playSound(800, "sine", 0.1); 
        showFloatingText(`dev-${id}`, "+10", "#4caf50");
        dev.isOn = false;
        
    } else {
        // Dispositivo ya estaba apagado (clic innecesario)
        playSound(300, "triangle", 0.05);
    }

    updateUI();
    updateDeviceUI(id);
}

// ==========================================
// ACTUALIZACIÓN DE INTERFAZ GRÁFICA (UI)
// ==========================================

function updateUI() {
    // Formatear el tiempo en MM:SS
    let m = Math.floor(timeRemaining / 60);
    let s = timeRemaining % 60;
    document.getElementById("time-display").innerText = 
        `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

    // Calcular y pintar la barra de energía
    let energyPercent = Math.min((energy / MAX_ENERGY) * 100, 100);
    const eBar = document.getElementById("energy-bar");
    if(eBar) {
        eBar.style.width = energyPercent + "%";
        // Sistema de semáforo de peligro
        if (energyPercent > 80) eBar.style.background = "#ff3333";
        else if (energyPercent > 50) eBar.style.background = "#ffcc00";
        else eBar.style.background = "#4caf50";
    }

    document.getElementById("score-display").innerText = score;
}

function updateDeviceUI(id) {
    const el = document.getElementById(`dev-${id}`);
    if(!el) return;
    
    const dev = devices[id];
    
    // Toggle de clases CSS según el estado
    dev.isOn ? el.classList.add("on") : el.classList.remove("on");
    dev.inUse ? el.classList.add("in-use") : el.classList.remove("in-use");
}

function showFloatingText(elementId, text, color) {
    const parent = document.getElementById(elementId);
    if(!parent) return;

    const floatEl = document.createElement("div");
    floatEl.innerText = text;
    floatEl.style.position = "absolute";
    floatEl.style.color = color;
    floatEl.style.fontWeight = "bold";
    floatEl.style.fontSize = "14px";
    floatEl.style.textShadow = "1px 1px 0 #000";
    floatEl.style.zIndex = "100";
    floatEl.style.animation = "floatUp 1s ease-out forwards";
    
    parent.appendChild(floatEl);
    
    // Eliminar el elemento del DOM después de la animación para limpiar memoria
    setTimeout(() => floatEl.remove(), 1000);
}

// ==========================================
// LÓGICA DE FIN DE JUEGO
// ==========================================

function checkEndConditions() {
    if (energy >= MAX_ENERGY) {
        endGame(false);
    } else if (timeRemaining <= 0) {
        endGame(true);
    }
}

function endGame(isWin) {
    isGameActive = false; // Esto detiene el Game Loop automáticamente

    // Gestionar el High Score (Puntaje Máximo)
    let newRecord = false;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('ecoHighScore', highScore);
        newRecord = true;
    }

    document.getElementById("game-container").style.display = "none";
    const endScreen = document.getElementById("end-screen");
    endScreen.style.display = "flex";

    const titleEl = document.getElementById("end-title");
    const reasonEl = document.getElementById("end-reason");

    if (isWin) {
        titleEl.innerText = "¡TIEMPO COMPLETADO!";
        titleEl.style.color = "#4caf50";
        reasonEl.innerText = "Lograste mantener un consumo responsable en la casa.";
    } else {
        titleEl.innerText = "¡APAGÓN GENERAL!";
        titleEl.style.color = "#ff3333";
        reasonEl.innerText = "Sobrecargaste la red eléctrica. ¡Atento a los consumos fantasma!";
    }

    let scoreText = `Puntaje Final: ${score}\nMejor Puntaje: ${highScore}`;
    if (newRecord) scoreText += "\n🌟 ¡NUEVO RÉCORD! 🌟";
    document.getElementById("end-score").innerText = scoreText;
}

function resetGame() {
    document.getElementById("start-screen").style.display = "flex";
    document.getElementById("end-screen").style.display = "none";
    document.getElementById("loading-msg").innerText = eduMessages[Math.floor(Math.random() * eduMessages.length)];
}

// ==========================================
// MOTOR DE AUDIO SINTETIZADO (Cero Archivos Extra)
// ==========================================

function playSound(freq, type, vol) {
    if (!audioCtx || audioCtx.state === 'suspended') return;
    
    try {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
        
        gainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
        console.log("Audio no disponible temporalmente.");
    }
}
