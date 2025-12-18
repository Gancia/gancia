// Global variabel til at holde kalenderens indhold
// calendarData bliver indlæst fra content.js

// DOM elementer
const calendarContainer = document.getElementById('calendar-container');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalContent = document.getElementById('modal-content');
const modalLoader = document.getElementById('modal-loader');
const modalCloseButton = document.querySelector('.modal-close-button');
const dateInfo = document.getElementById('date-info');

// Dato-logik
const today = new Date();
const currentMonth = today.getMonth();
const currentDay = today.getDate();
// Test-tilstand styres nu fra content.js, med 'false' som fallback
const isTestMode = (calendarData.config && calendarData.config.isTestMode) || false;


// --- KERN FUNKTIONER ---

/**
 * Initialiserer hele applikationen
 * Henter data, opdaterer UI og starter animationer
 */
async function initializeApp() {
    // Check if calendarData was loaded from content.js
    if (typeof calendarData === 'undefined' || Object.keys(calendarData).length < 2) { // Checks for existence and that there's more than just a config
        calendarContainer.innerHTML = '<p style="color: #f8d7da; background-color: #721c24; padding: 1rem; border-radius: 4px;">Fejl: `content.js` mangler eller kunne ikke indlæses. Sørg for at filen eksisterer i projektets rodmappe.</p>';
        return;
    }

    // Ensure config exists to prevent errors
    if (!calendarData.config) {
        calendarData.config = {};
    }
    
    // Populate header with dynamic data
    const headerLogo = document.getElementById('header-logo');
    headerLogo.src = calendarData.config.logoUrl || 'assets/logo.png';
    headerLogo.alt = calendarData.config.logoAltText || 'Kalender-logo';
    document.getElementById('main-title').textContent = calendarData.config.mainTitle || 'Didaktisk Julekalender';
    document.getElementById('subtitle').textContent = calendarData.config.subtitle || 'En julekalender om didaktik';
    document.title = calendarData.config.mainTitle || 'Didaktisk Julekalender';

    updateDateInfo();
    createCalendar();
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    // Conditionally start animations based on config
    if (calendarData.config.showSnowfall !== false) {
        startSnowfall();
    }
    if (calendarData.config.showSnowdrift === false) {
        document.querySelector('.snowdrift-container').style.display = 'none';
    }

    // Show main content and hide loader
    const loadingOverlay = document.getElementById('loading-overlay');
    const mainContainer = document.querySelector('.calendar-main-container');

    mainContainer.classList.remove('content-hidden');
    
    // Fade out the loader
    loadingOverlay.style.opacity = '0';
    loadingOverlay.addEventListener('transitionend', () => {
        loadingOverlay.style.display = 'none';
    }, { once: true });
}

/**
 * Bygger kalender-gitteret baseret på data fra content.json
 */
function createCalendar() {
    calendarContainer.innerHTML = '';
    const openedDoors = JSON.parse(localStorage.getItem('openedDoors')) || [];
    
    const doorNumbers = (calendarData.config && calendarData.config.doorOrder)
        ? calendarData.config.doorOrder
        : Array.from({ length: 24 }, (_, i) => i + 1);
    
    const isDecember = currentMonth === 11;
    const isTestMode = calendarData.config.isTestMode || false;

    doorNumbers.forEach(day => {
        const door = document.createElement('div');
        door.className = 'door';
        const doorType = calendarData.config.doorType || 'default';
        if (doorType !== 'default') {
            door.classList.add(`door--${doorType}`);
        }
        const doorDesign = calendarData.config.doorDesign || 'default';
        if (doorDesign !== 'default') {
            door.classList.add(`door-design--${doorDesign}`);
        }
        door.setAttribute('data-day', day);
        door.setAttribute('role', 'button');
        door.setAttribute('tabindex', '0');

        const isLocked = !isTestMode && (!isDecember || day > currentDay);
        const wasOpened = openedDoors.includes(day);

        // Back content (number and emoji) - This is visible underneath
        const data = calendarData[day];
        if (data) {
            const backContent = document.createElement('div');
            backContent.className = 'door-back-content';
            backContent.innerHTML = `
                <span class="door-back-content-day">${day}</span>
                <span class="door-back-content-emoji">${data.emoji || ''}</span>
            `;
            door.appendChild(backContent);
        }

        // Front of the door (the part that fades)
        const doorFront = document.createElement('div');
        doorFront.className = 'door-front';
        doorFront.innerHTML = `<span class="door-number">${day}</span>`;
        door.appendChild(doorFront);

        // Set initial states
        if (wasOpened && !isLocked) {
            door.classList.add('was-opened');
        }

        if (isLocked) {
            door.classList.add('locked');
            const lockedHandler = () => showMessage('Denne låge er låst!', `Kom tilbage den ${day}. december for at åbne den.`);
            door.addEventListener('click', lockedHandler);
            door.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); lockedHandler(); }
            });
        } else {
            const openHandler = () => openDoor(day);
            door.addEventListener('click', openHandler);
            door.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openHandler(); }
            });
        }
        
        calendarContainer.appendChild(door);
    });
}

/**
 * Åbner en låge, renderer indholdet fra JSON og gemmer status
 * @param {number} day - Dagen for den låge der skal åbnes
 */
function openDoor(day) {
    const doorElement = document.querySelector(`.door[data-day="${day}"]`);
    if (doorElement.classList.contains('locked')) return;

    const showModal = () => {
        const data = calendarData[day];
        if (!data) {
            console.error(`Intet indhold fundet for dag ${day}.`);
            return;
        }

        // 1. Forbered modal og vis loader
        modalTitle.innerHTML = `${data.emoji || ''} ${data.title}`;
        modalContent.innerHTML = ''; // Ryd tidligere indhold
        modalContent.style.display = 'none';
        modalLoader.style.display = 'flex';
        modal.classList.add('is-visible'); // Vis modal med loader

        // 2. Byg HTML-streng for indhold
        let contentHtml = '';
        let quizIdCounter = 0;
        data.body.forEach(block => {
            switch (block.type) {
                case 'question':
                    const isOldFormat = typeof block.value === 'string';
                    const titleText = isOldFormat ? 'Spørgsmål/Princip' : (block.value.titleType === 'principle' ? 'Princip' : 'Spørgsmål');
                    const questionText = isOldFormat ? block.value : block.value.text;
                    contentHtml += `<div class="question-box"><p class="box-title"><i data-lucide="help-circle"></i> ${titleText}</p><p>${questionText}</p></div>`;
                    break;
                case 'answer':
                    contentHtml += `<div class="answer-box"><p class="box-title"><i data-lucide="message-square"></i> Svar</p><p>${block.value}</p></div>`;
                    break;
                case 'html':
                    contentHtml += `<div class="html-block">${block.value}</div>`;
                    break;
                case 'image':
                    contentHtml += `<div class="image-block"><img src="${block.value}" alt="${block.alt || ''}"></div>`;
                    break;
                case 'video':
                    contentHtml += `<div class="video-container"><iframe src="${block.value}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"></iframe></div>`;
                    break;
                case 'quiz':
                    const quizId = `quiz-${quizIdCounter++}`;
                    const encodedExplanation = encodeURIComponent(block.value.explanation);
                    contentHtml += `<div class="quiz-block" id="${quizId}" data-explanation="${encodedExplanation}"><p class="quiz-question">${block.value.question}</p><div class="quiz-options">${block.value.options.map((option, index) => `<button class="quiz-option" data-is-correct="${index === block.value.correctIndex}">${option}</button>`).join('')}</div><div class="quiz-feedback"></div></div>`;
                    break;
                case 'custom-box':
                    const iconHtml = block.value.icon ? `<i data-lucide="${block.value.icon}"></i>` : '';
                    contentHtml += `<div class="question-box"><p class="box-title">${iconHtml} ${block.value.title || ''}</p><p>${block.value.content || ''}</p></div>`;
                    break;
                case 'citat':
                    contentHtml += `<div class="quote-block"><blockquote>${block.value.text || ''}</blockquote><cite>— ${block.value.author || ''}</cite></div>`;
                    break;
                case 'refleksion':
                    contentHtml += `<div class="question-box" style="border-left-color: #663399;"><p class="box-title"><i data-lucide="brain-circuit"></i> Til Refleksion</p><p>${block.value || ''}</p></div>`;
                    break;
            }
        });

        // 3. Sæt indhold og find medier, der skal ventes på
        modalContent.innerHTML = contentHtml;
        
        const images = Array.from(modalContent.querySelectorAll('img'));
        const iframes = Array.from(modalContent.querySelectorAll('iframe'));
        const mediaPromises = [];

        images.forEach(img => {
            const promise = new Promise((resolve) => {
                if (img.complete) {
                    resolve();
                } else {
                    img.onload = resolve;
                    img.onerror = resolve; // Fortsæt selvom et billede fejler
                }
            });
            mediaPromises.push(promise);
        });

        iframes.forEach(iframe => {
            const promise = new Promise((resolve) => {
                iframe.onload = resolve;
                iframe.onerror = resolve; // Fortsæt selvom en video fejler
            });
            mediaPromises.push(promise);
        });

        // 4. Vent på alle medier, vis derefter indhold
        Promise.allSettled(mediaPromises).then(() => {
            // Opsæt quiz-listeners efter indholdet er klar
            modalContent.querySelectorAll('.quiz-block').forEach(quizBlock => {
                quizBlock.querySelectorAll('.quiz-option').forEach(optionButton => {
                    optionButton.addEventListener('click', () => handleQuizAnswer(optionButton, optionButton.dataset.isCorrect === 'true'));
                });
            });

            // Genskab Lucide-ikoner
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }

            // Skjul loader og vis indhold
            modalLoader.style.display = 'none';
            modalContent.style.display = 'block';
        });
    };

    // Hvis lågen allerede var åbnet, vis modal direkte
    if (doorElement.classList.contains('was-opened')) {
        showModal();
        return;
    }

    // Logik for førstegangs-åbning (med animation)
    const openedDoors = JSON.parse(localStorage.getItem('openedDoors')) || [];
    if (!openedDoors.includes(day)) {
        openedDoors.push(day);
        localStorage.setItem('openedDoors', JSON.stringify(openedDoors));
    }
    
    closeModal(); // Sørg for at andre modaler er lukket før animation

    const doorFront = doorElement.querySelector('.door-front');
    if (doorFront) {
        // 'transitionend' eventet fyrer, når fade-out er færdig
        doorFront.addEventListener('transitionend', showModal, { once: true });
    } else {
        // Fallback for en sikkerheds skyld
        setTimeout(showModal, 500);
    }
    
    // Tilføj klasse for at starte fade-out animationen
    doorElement.classList.add('was-opened');
}

/**
 * Håndterer logikken, når en bruger svarer på en quiz
 * @param {HTMLElement} buttonElement - Det knap-element der blev klikket på
 * @param {boolean} isCorrect - Om det valgte svar er korrekt
 */
function handleQuizAnswer(buttonElement, isCorrect) {
    const quizBlock = buttonElement.closest('.quiz-block');
    const options = quizBlock.querySelectorAll('.quiz-option');
    const feedbackEl = quizBlock.querySelector('.quiz-feedback');
    const explanation = decodeURIComponent(quizBlock.dataset.explanation).replace(/\n/g, '<br>');

    options.forEach(option => {
        option.disabled = true;
    });

    buttonElement.classList.add(isCorrect ? 'correct' : 'incorrect');
    if (!isCorrect) {
        options.forEach(option => {
            if (option.dataset.isCorrect === 'true') {
                option.classList.add('correct');
            }
        });
    }

    feedbackEl.innerHTML = `<div class="quiz-explanation">${explanation}</div>`;
}

/**
 * Lukker modal-vinduet
 */
function closeModal() {
    modal.classList.remove('is-visible');
}

/**
 * Viser en simpel besked i modalen (f.eks. for låste låger)
 */
function showMessage(title, message) {
    modalTitle.textContent = title;
    modalContent.innerHTML = `<p style="text-align: center; font-size: 1.125rem; margin-top: 16px;">${message}</p>`;
    modal.classList.add('is-visible');
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

/**
 * Opdaterer dato-information og test-knap i headeren
 */
function updateDateInfo() {
    const isTestMode = calendarData.config.isTestMode || false;
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const formattedDate = today.toLocaleDateString('da-DK', options);
    
    let statusText = '';
    let resetButtonHtml = '';
    let countdownText = '';

    if (isTestMode) {
        statusText = `Test-tilstand er aktiv. Alle låger kan åbnes.`;
        resetButtonHtml = `<button onclick="resetCalendarState()" class="reset-button">Nulstil Kalender</button>`;
    } else if (currentMonth === 11) { // Live mode, in December
        const daysLeft = 24 - currentDay;

        if (currentDay < 24) {
            countdownText = `Kun ${daysLeft} ${daysLeft === 1 ? 'dag' : 'dage'} til juleaften!`;
        } else if (currentDay === 24) {
            countdownText = `Glædelig jul!`;
        }
    } else { // Live mode, but not in December
        statusText = `Kalenderen kan åbnes fra den 1. december.`;
    }

    let fullDateInfo = `Dagens dato: <span style="font-weight: 700; color: #004b4c;">${formattedDate}</span>.`;
    if (countdownText) {
        fullDateInfo += ` ${countdownText}`;
    }
    if (statusText) {
        fullDateInfo += ` <span style="font-weight: 700;">${statusText}</span>`;
    }

    dateInfo.innerHTML = `${fullDateInfo} ${resetButtonHtml}`;
}

/**
 * Nulstiller kalenderens gemte status (åbnede låger)
 */
function resetCalendarState() {
    if (confirm('Er du sikker på, at du vil nulstille kalenderen? Alle låger vil blive markeret som lukkede igen.')) {
        localStorage.removeItem('openedDoors');
        location.reload();
    }
}


// --- Animationer og Events ---

/**
 * Skaber et fast antal snefnug og lader CSS-animationen køre i et uendeligt loop.
 */
function startSnowfall() {
    const snowContainer = document.getElementById('snow-container');
    const numberOfSnowflakes = 75;

    for (let i = 0; i < numberOfSnowflakes; i++) {
        const snowflake = document.createElement('div');
        snowflake.classList.add('snowflake');
        
        const fallDuration = `${Math.random() * 5 + 8}s`;
        const fallDelay = `${Math.random() * -10}s`;
        const spinDuration = `${Math.random() * 10 + 5}s`;
        const spinDirection = Math.random() > 0.5 ? 'normal' : 'reverse';

        snowflake.style.left = `${Math.random() * 100}%`;
        snowflake.style.fontSize = `${Math.random() * 0.8 + 0.5}em`;
        snowflake.style.opacity = `${Math.random() * 0.5 + 0.5}`;
        
        snowflake.style.animationDuration = `${fallDuration}, ${spinDuration}`;
        snowflake.style.animationDelay = `${fallDelay}, ${fallDelay}`;
        snowflake.style.animationDirection = `normal, ${spinDirection}`;
        
        const snowChars = ['❅', '❆', '❄', '✶', '✷', '★'];
        snowflake.textContent = snowChars[Math.floor(Math.random() * snowChars.length)];
        
        snowContainer.appendChild(snowflake);
    }
}

// Luk modal med Escape-tasten
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-visible')) {
        closeModal();
    }
});

// Luk modal med knappen
modalCloseButton.addEventListener('click', closeModal);

// Start applikationen når siden er klar
window.onload = initializeApp;
