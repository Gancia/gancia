// Global variabel til at holde kalenderens indhold
// calendarData bliver indlæst fra content.js

// DOM elementer
const calendarContainer = document.getElementById('calendar-container');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalContent = document.getElementById('modal-content');
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
    
    // Populate header with dynamic data
    if (calendarData.config) {
        document.getElementById('header-logo').src = calendarData.config.logoUrl;
        document.getElementById('main-title').textContent = calendarData.config.mainTitle;
        document.getElementById('subtitle').textContent = calendarData.config.subtitle;
        document.title = calendarData.config.mainTitle || 'Didaktisk Julekalender';
    }

    updateDateInfo();
    createCalendar();
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    startSnowfall();
}

/**
 * Bygger kalender-gitteret baseret på data fra content.json
 */
function createCalendar() {
    calendarContainer.innerHTML = '';
    const openedDoors = JSON.parse(localStorage.getItem('openedDoors')) || [];
    
    // Use doorOrder from config, with a fallback for backward compatibility
    const doorNumbers = (calendarData.config && calendarData.config.doorOrder)
        ? calendarData.config.doorOrder
        : [15, 8, 22, 3, 19, 11, 6, 24, 1, 14, 9, 20, 5, 17, 2, 12, 21, 7, 18, 4, 13, 23, 10, 16];
    
    const isDecember = currentMonth === 11;

    doorNumbers.forEach(day => {
        const door = document.createElement('div');
        door.className = 'door';
        door.setAttribute('data-day', day);
        door.setAttribute('role', 'button');
        door.setAttribute('tabindex', '0');

        // Correct locking logic
        const isLocked = !isTestMode && (!isDecember || day > currentDay);
        const wasOpened = openedDoors.includes(day);

        if (wasOpened && !isLocked) { // A door should only appear open if it was opened AND is not currently locked
            door.classList.add('was-opened');
            const data = calendarData[day];
            if (data) {
                const content = document.createElement('div');
                content.className = 'door-back-content is-visible';
                content.innerHTML = `
                    <span class="door-back-content-day">${day}</span>
                    <span class="door-back-content-emoji">${data.emoji || ''}</span>
                `;
                door.appendChild(content);
            }
        }

        if (isLocked) {
            door.classList.add('locked');
            const lockedHandler = () => showMessage('Denne låge er låst!', `Kom tilbage den ${day}. december for at åbne den.`);
            door.addEventListener('click', lockedHandler);
            door.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    lockedHandler();
                }
            });
        } else {
            const openHandler = () => openDoor(day);
            door.addEventListener('click', openHandler);
            door.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openHandler();
                }
            });
        }

        const numberSpan = document.createElement('span');
        numberSpan.className = 'door-number';
        numberSpan.textContent = day;

        const doorInner = document.createElement('div');
        doorInner.className = 'door-inner';

        const doorFront = document.createElement('div');
        doorFront.className = 'door-front';

        const doorBack = document.createElement('div');
        doorBack.className = 'door-back';

        doorFront.appendChild(numberSpan);
        doorInner.appendChild(doorFront);
        doorInner.appendChild(doorBack);
        door.appendChild(doorInner);

        calendarContainer.appendChild(door);
    });
}

/**
 * Åbner en låge, renderer indholdet fra JSON og gemmer status
 * @param {number} day - Dagen for den låge der skal åbnes
 */
function openDoor(day) {
    const doorElement = document.querySelector(`.door[data-day="${day}"]`);
    if (doorElement.classList.contains('locked')) return; // Still prevent locked doors

    const isDoorAlreadyVisuallyOpen = doorElement.classList.contains('open');

    if (!isDoorAlreadyVisuallyOpen) {
        const openedDoors = JSON.parse(localStorage.getItem('openedDoors')) || [];
        if (!openedDoors.includes(day)) {
            openedDoors.push(day);
            localStorage.setItem('openedDoors', JSON.stringify(openedDoors));
        }

        doorElement.classList.add('was-opened');
        closeModal(); 
        doorElement.classList.add('open');

        if (!doorElement.querySelector('.door-back-content')) {
            const data = calendarData[day];
            if (data) {
                const content = document.createElement('div');
                content.className = 'door-back-content';
                content.innerHTML = `
                    <span class="door-back-content-day">${day}</span>
                    <span class="door-back-content-emoji">${data.emoji || ''}</span>
                `;
                doorElement.appendChild(content);

                setTimeout(() => {
                    content.classList.add('is-visible');
                }, 200);
            }
        }
    } else {
        closeModal();
    }

    setTimeout(() => {
        const data = calendarData[day];
        if (!data) {
            console.error(`Intet indhold fundet for dag ${day} i content.json`);
            return;
        }

        modal.classList.remove('is-visible');
        modalContent.innerHTML = '';

        modalTitle.innerHTML = `${data.emoji || ''} ${data.title}`;
        let contentHtml = '';
        let quizIdCounter = 0;
        data.body.forEach(block => {
            switch (block.type) {
                case 'question':
                    // Handle old and new data structures
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
                    contentHtml += `<div class="image-block"><img src="${block.value}" alt="${block.alt || 'Billede fra julekalenderen'}"></div>`;
                    break;
                case 'video':
                    contentHtml += `<div class="video-container"><iframe src="${block.value}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
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
        modalContent.innerHTML = contentHtml;
        modalContent.querySelectorAll('.quiz-block').forEach(quizBlock => {
            quizBlock.querySelectorAll('.quiz-option').forEach(optionButton => {
                optionButton.addEventListener('click', () => handleQuizAnswer(optionButton, optionButton.dataset.isCorrect === 'true'));
            });
        });

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        const images = modalContent.querySelectorAll('img');
        const imagePromises = [...images].map(img => {
            return new Promise((resolve) => {
                if (img.complete) resolve();
                else {
                    img.onload = resolve;
                    img.onerror = resolve;
                }
            });
        });

        Promise.all(imagePromises).then(() => {
            void modal.offsetHeight; 
            modal.classList.add('is-visible');
        });
        
    }, isDoorAlreadyVisuallyOpen ? 0 : 900);
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
    const explanation = decodeURIComponent(quizBlock.dataset.explanation);

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

    feedbackEl.innerHTML = `<p class="quiz-explanation">${explanation}</p>`;
}

/**
 * Lukker modal-vinduet
 */
function closeModal() {
    modal.classList.remove('is-visible');
    document.querySelectorAll('.door.open').forEach(door => door.classList.remove('open'));
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

// Start applikationen når siden er klar
window.onload = initializeApp;