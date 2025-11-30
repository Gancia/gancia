document.addEventListener('DOMContentLoaded', () => {
    // Globale variable
    if (typeof calendarData === 'undefined' || Object.keys(calendarData).length === 0) {
        alert("Fejl: 'content.js' kunne ikke indlæses, eller 'calendarData' er ikke defineret. Opretter en tom kalender. Generer en ny content.js for at starte.");
        window.calendarData = { config: { mainTitle: "Ny Kalender", subtitle: "Beskrivelse...", logoUrl: "assets/logo.png" }, "1": { title: "", emoji: "", body: [] } };
    }
    
    let currentDay = null;
    let originalDayData = null;
    let originalConfigData = null;
    let hasUnsavedChanges = false;

    let savedRange = null; // Global variable to store text selection
    let currentEditor = null; // Global variable to store the active contenteditable element

    // Oversættelsesmap til bloktyper
    const blockTypeTranslations = {
        question: 'Spørgsmål',
        answer: 'Svar',
        html: 'HTML',
        image: 'Billede',
        video: 'Video',
        quiz: 'Quiz',
        'custom-box': 'Brugerdefineret Boks',
        citat: 'Citat',
        refleksion: 'Refleksion'
    };

    // --- DOM-elementer ---
    const configMainTitle = document.getElementById('config-main-title');
    const configSubtitle = document.getElementById('config-subtitle');
    const configLogoUrl = document.getElementById('config-logo-url');
    const shuffleDoorsButton = document.getElementById('shuffle-doors');
    const configTestMode = document.getElementById('config-test-mode');
    const configFieldsContainer = document.querySelector('.editor-container > div');
    const doorOrderContainer = document.getElementById('door-order-container');

    const daySelector = document.getElementById('day-selector');
    const editorFields = document.getElementById('editor-fields');
    const dayTitle = document.getElementById('day-title');
    const dayEmoji = document.getElementById('day-emoji');
    const contentBlocksContainer = document.getElementById('content-blocks');
    
    const generateButton = document.getElementById('generate-json');
    const previewButton = document.getElementById('preview-door');
    const undoButton = document.getElementById('undo-changes');
    const emojiPicker = document.querySelector('emoji-picker');
    const emojiPickerBtn = document.getElementById('emoji-picker-btn');
    const addBlockButtons = document.querySelector('.add-block-buttons');
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    const modalCloseButton = document.getElementById('modal-close-button');

    // --- Utility Functions ---
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // --- Autosave Functions ---
    const debouncedSave = debounce(() => {
        if (!hasUnsavedChanges) return;

        // First, update the main data object from the UI
        calendarData.config.mainTitle = configMainTitle.value;
        calendarData.config.subtitle = configSubtitle.value;
        calendarData.config.logoUrl = configLogoUrl.value;
        calendarData.config.isTestMode = configTestMode.checked;

        const dayData = currentDay ? getCurrentDayDataFromForm() : null;
        // If validation fails (returns null), don't save the state.
        if (currentDay && dayData === null) {
            console.warn("Autosave skipped: Form data is invalid (e.g., a quiz is missing a correct answer).");
            return;
        }

        const stateToSave = {
            config: calendarData.config,
            currentDay: currentDay,
            dayData: dayData
        };
        localStorage.setItem('julekalenderEditorState', JSON.stringify(stateToSave));
    }, 1000);

    function loadStateFromLocalStorage() {
        const savedStateJSON = localStorage.getItem('julekalenderEditorState');
        if (savedStateJSON) {
            if (confirm("Du har ugemte ændringer fra en tidligere session. Vil du gendanne dem?")) {
                const savedState = JSON.parse(savedStateJSON);
                calendarData.config = savedState.config;
                if (savedState.currentDay && savedState.dayData) {
                    calendarData[savedState.currentDay] = savedState.dayData;
                }
                alert("Ændringerne er blevet gendannet. Husk at generere en ny content.js for at gemme dem permanent.");
                hasUnsavedChanges = true;
                
                return savedState.currentDay; 
            } else {
                localStorage.removeItem('julekalenderEditorState');
            }
        }
        return null;
    }
    
    function markChange() {
        hasUnsavedChanges = true;
        debouncedSave();
    }

    function initializeEditor() {
        const restoredDay = loadStateFromLocalStorage();

        if (!calendarData.config) {
            calendarData.config = { mainTitle: "Didaktisk Julekalender", subtitle: "Åbn en låge...", logoUrl: "assets/logo.png"};
        }
        if (!calendarData.config.doorOrder || calendarData.config.doorOrder.length !== 24) {
            calendarData.config.doorOrder = Array.from({ length: 24 }, (_, i) => i + 1);
        }
        if (typeof calendarData.config.isTestMode === 'undefined') {
            calendarData.config.isTestMode = false;
        }
        
        originalConfigData = JSON.parse(JSON.stringify(calendarData.config));
        
        populateConfigFields();
        populateDaySelector();
        populateDoorOrderEditor();
        
        if (restoredDay) {
            daySelector.value = restoredDay;
            handleDaySelection({ target: { value: restoredDay } }, true);
        }

        setupEventListeners();
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    function populateConfigFields() {
        configMainTitle.value = calendarData.config.mainTitle || '';
        configSubtitle.value = calendarData.config.subtitle || '';
        configLogoUrl.value = calendarData.config.logoUrl || '';
        configTestMode.checked = calendarData.config.isTestMode || false;
    }

    function populateDaySelector() {
        daySelector.innerHTML = '<option value="">-- Vælg en dag --</option>';
        for (let i = 1; i <= 24; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `Dag ${i}`;
            daySelector.appendChild(option);
        }
    }

    function populateDoorOrderEditor() {
        doorOrderContainer.innerHTML = '';
        calendarData.config.doorOrder.forEach(dayNumber => {
            const item = document.createElement('div');
            item.className = 'door-order-item';
            item.textContent = dayNumber;
            item.draggable = true;
            item.addEventListener('dragstart', () => item.classList.add('dragging'));
            item.addEventListener('dragend', () => item.classList.remove('dragging'));
            doorOrderContainer.appendChild(item);
        });
    }

    function setupEventListeners() {
        daySelector.addEventListener('change', (e) => handleDaySelection(e, false));
        generateButton.addEventListener('click', generateAndDownloadContentJs);
        previewButton.addEventListener('click', previewCurrentDay);
        undoButton.addEventListener('click', revertDayChanges);

        configFieldsContainer.addEventListener('input', markChange);
        editorFields.addEventListener('input', markChange);
        configTestMode.addEventListener('change', markChange);
        
        shuffleDoorsButton.addEventListener('click', () => {
            const order = calendarData.config.doorOrder;
            for (let i = order.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [order[i], order[j]] = [order[j], order[i]];
            }
            populateDoorOrderEditor(); // Refresh the UI
            markChange();
            alert('Lågernes rækkefølge er blevet blandet. Husk at gemme (Generer content.js) bagefter.');
        });

        addBlockButtons.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                const type = e.target.id.replace('add-', '');
                addBlock(type);
            }
        });

        emojiPickerBtn.addEventListener('click', () => {
            emojiPicker.style.display = emojiPicker.style.display === 'block' ? 'none' : 'block';
        });
        document.addEventListener('click', (event) => {
            if (!emojiPicker.contains(event.target) && event.target !== emojiPickerBtn && !emojiPickerBtn.contains(event.target)) {
                emojiPicker.style.display = 'none';
            }
        });
        emojiPicker.addEventListener('emoji-click', event => {
            dayEmoji.value = event.detail.unicode;
            markChange();
        });
        
        modalCloseButton.addEventListener('click', closeModal);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('is-visible')) closeModal();
        });

        contentBlocksContainer.addEventListener('dragover', e => {
            e.preventDefault();
            const draggingBlock = document.querySelector('.block.dragging');
            if (!draggingBlock) return;
            const afterElement = getDragAfterElement(contentBlocksContainer, e.clientY);
            contentBlocksContainer.insertBefore(draggingBlock, afterElement);
        });
        contentBlocksContainer.addEventListener('drop', e => {
            e.preventDefault();
            updateBlockNumbers();
            markChange();
        });

        doorOrderContainer.addEventListener('dragover', e => {
            e.preventDefault();
            const draggingItem = document.querySelector('.door-order-item.dragging');
            if (!draggingItem) return;
            const afterElement = getDragAfterElement(doorOrderContainer, e.clientY, '.door-order-item');
            doorOrderContainer.insertBefore(draggingItem, afterElement);
        });
        doorOrderContainer.addEventListener('drop', e => {
            e.preventDefault();
            // Elements are already reordered by dragover, just update the data
            const newOrder = [...doorOrderContainer.querySelectorAll('.door-order-item')].map(item => parseInt(item.textContent, 10));
            calendarData.config.doorOrder = newOrder;
            markChange();
        });
        window.addEventListener('beforeunload', (e) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        });

        // Global click listener to close color dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            const openDropdowns = document.querySelectorAll('.color-dropdown.is-visible');
            openDropdowns.forEach(dropdown => {
                const parentGroup = dropdown.closest('.format-btn-group');
                // Check if the click target is outside the dropdown and its parent button group
                if (!parentGroup || !parentGroup.contains(e.target)) {
                    dropdown.classList.remove('is-visible');
                }
            });
        });
    }

    function getDragAfterElement(container, y, selector = '.block') {
        const draggableElements = [...container.querySelectorAll(`${selector}:not(.dragging)`)];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    

    function handleDaySelection(e, bypassConfirm = false) {
        if (!bypassConfirm && hasUnsavedChanges) {
            if (!confirm("Du har ugemte ændringer. Er du sikker på, at du vil fortsætte uden at gemme? Dine ændringer vil gå tabt.")) {
                e.target.value = currentDay;
                return;
            }
        }
        
        currentDay = e.target.value;
        hasUnsavedChanges = false; 

        if (!currentDay) {
            editorFields.style.display = 'none';
            originalDayData = null;
            return;
        }

        const dayData = calendarData[currentDay] || { title: '', emoji: '', body: [] };
        originalDayData = JSON.parse(JSON.stringify(dayData));

        dayTitle.value = dayData.title;
        dayEmoji.value = dayData.emoji;
        renderContentBlocks(dayData.body);
        editorFields.style.display = 'block';
    }

    function renderContentBlocks(body) {
        contentBlocksContainer.innerHTML = '';
        if (!body || !Array.isArray(body)) return;
        body.forEach((block, index) => {
            const blockElement = createBlockElement(block, index);
            contentBlocksContainer.appendChild(blockElement);
        });
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    function updateBlockNumbers() {
        Array.from(contentBlocksContainer.children).forEach((child, i) => {
            child.setAttribute('data-index', i);
            child.querySelector('.block-title').textContent = `Blok #${i + 1}: ${blockTypeTranslations[child.dataset.type] || child.dataset.type.charAt(0).toUpperCase() + child.dataset.type.slice(1)}`;
            child.querySelectorAll('input[type="radio"]').forEach(radio => {
                radio.name = `correct-answer-${i}`;
            });
        });
    }

    function addBlock(type) {
        if (!currentDay) return;
        markChange();
        let newBlockData;
        switch (type) {
            case 'answer': case 'html': case 'refleksion':
                newBlockData = { type, value: '' }; break;
            case 'question':
                newBlockData = { type: 'question', value: { text: '', titleType: 'question' } }; break;
            case 'image':
                newBlockData = { type, value: 'assets/placeholder.png', alt: '' }; break;
            case 'video':
                newBlockData = { type, value: 'https://www.youtube.com/embed/...' }; break;
            case 'quiz':
                newBlockData = { type, value: { question: '', options: ['', ''], correctIndex: 0, explanation: '' } }; break;
            case 'custom-box':
                newBlockData = { type, value: { icon: '', title: 'Brugerdefineret Titel', content: '' } }; break;
            case 'citat':
                newBlockData = { type, value: { text: '', author: '' } }; break;
            default: return;
        }
        const index = contentBlocksContainer.children.length;
        const blockElement = createBlockElement(newBlockData, index);
        contentBlocksContainer.appendChild(blockElement);
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    function createFormattingToolbar() {
        return `
            <div class="formatting-toolbar">
                <button type="button" class="format-btn" data-command="bold" title="Fed"><b>B</b></button>
                <button type="button" class="format-btn" data-command="italic" title="Kursiv"><i>I</i></button>
                <button type="button" class="format-btn" data-command="underline" title="Understreget"><u>U</u></button>
                <button type="button" class="format-btn" data-command="strikeThrough" title="Gennemstreget"><s>S</s></button>
                <button type="button" class="format-btn" data-command="insertUnorderedList" title="Uordnet liste"><i data-lucide="list"></i></button>
                <button type="button" class="format-btn" data-command="insertOrderedList" title="Ordnet liste"><i data-lucide="list-ordered"></i></button>
                <button type="button" class="format-btn" data-command="justifyLeft" title="Venstrejuster"><i data-lucide="align-left"></i></button>
                <button type="button" class="format-btn" data-command="justifyCenter" title="Centrer"><i data-lucide="align-center"></i></button>
                <button type="button" class="format-btn" data-command="justifyRight" title="Højrejuster"><i data-lucide="align-right"></i></button>
                <div class="format-btn-group">
                    <button type="button" class="format-btn color-picker-btn" data-command="foreColor" title="Tekstfarve">
                        <i data-lucide="palette" class="color-picker-icon"></i>
                    </button>
                    <div class="color-dropdown">
                        <div class="color-swatch" data-color="#000000" style="background-color: #000000;"></div>
                        <div class="color-swatch" data-color="#FFFFFF" style="background-color: #FFFFFF; border: 1px solid #ccc;"></div>
                        <div class="color-swatch" data-color="#FF0000" style="background-color: #FF0000;"></div>
                        <div class="color-swatch" data-color="#008000" style="background-color: #008000;"></div>
                        <div class="color-swatch" data-color="#0000FF" style="background-color: #0000FF;"></div>
                        <div class="color-swatch" data-color="#FFD700" style="background-color: #FFD700;"></div>
                        <div class="color-swatch" data-color="#800080" style="background-color: #800080;"></div>
                        <div class="color-swatch" data-color="#FFA500" style="background-color: #FFA500;"></div>
                    </div>
                </div>
                <button type="button" class="format-btn" data-command="removeFormat" title="Fjern formatering"><i data-lucide="x-circle"></i></button>
            </div>
        `;
    }

    function formatDoc(command, value = null) {
        document.execCommand(command, false, value);
    }
    
    function createBlockElement(block, index) {
        const wrapper = document.createElement('div');
        wrapper.className = 'block';
        wrapper.setAttribute('data-index', index);
        wrapper.setAttribute('data-type', block.type);
        // Draggable attribute is now set dynamically by the drag handle
        let contentHtml = '';
        switch (block.type) {
            case 'question':
                // Gracefully handle old data format
                if (typeof block.value === 'string') {
                    block.value = { text: block.value, titleType: 'question' };
                }
                contentHtml = `
                    <label>Titel Type</label>
                    <div class="question-title-type-selector" onchange="markChange()">
                        <input type="radio" id="q_type_${index}_question" name="question_type_${index}" value="question" ${block.value.titleType === 'question' ? 'checked' : ''}>
                        <label for="q_type_${index}_question">Spørgsmål</label>
                        <input type="radio" id="q_type_${index}_principle" name="question_type_${index}" value="principle" ${block.value.titleType === 'principle' ? 'checked' : ''}>
                        <label for="q_type_${index}_principle">Princip</label>
                    </div>
                    <div style="margin-top: .5rem;"></div>
                    ${createFormattingToolbar()}
                    <div class="block-value wysiwyg-editor" contenteditable="true">${block.value.text}</div>
                `;
                break;
            case 'answer': case 'refleksion':
                contentHtml = `${createFormattingToolbar()}<div class="block-value wysiwyg-editor" contenteditable="true">${block.value}</div>`; break;
            case 'html':
                contentHtml = `<textarea class="block-value" rows="5">${block.value}</textarea>`; break;
            case 'image':
                contentHtml = `<label>Billed-URL</label><input type="text" class="block-value" value="${block.value}"><label style="margin-top: .5rem;">Alternativ tekst</label><input type="text" class="block-alt" value="${block.alt || ''}">`; break;
            case 'video':
                 contentHtml = `<label>YouTube Embed URL</label><input type="text" class="block-value" value="${block.value}">`; break;
            case 'quiz':
                const optionsHtml = block.value.options.map((option, i) => `
                    <div class="quiz-option">
                        <input type="radio" name="correct-answer-${index}" ${i === block.value.correctIndex ? 'checked' : ''}>
                        <input type="text" class="quiz-option-text" value="${option}">
                        <button type="button" class="btn-danger btn-remove-option" aria-label="Fjern svarmulighed" style="padding: 2px 8px; line-height: 1;">&times;</button>
                    </div>`).join('');
                contentHtml = `<label>Quiz-spørgsmål</label>${createFormattingToolbar()}<div class="quiz-question wysiwyg-editor" contenteditable="true">${block.value.question}</div><label style="margin-top: 1rem;">Svarmuligheder (vælg den korrekte)</label><div class="quiz-options-container">${optionsHtml}</div><button class="btn-secondary btn-add-option" style="margin-top: .5rem;">Tilføj svarmulighed</button><label style="margin-top: 1rem;">Forklaring efter svar</label>${createFormattingToolbar()}<div class="quiz-explanation wysiwyg-editor" contenteditable="true">${block.value.explanation}</div>`; break;
            case 'custom-box':
                const icons = ['info', 'help-circle', 'book-open', 'star', 'check-circle', 'x-circle', 'message-square', 'edit', 'award', 'gift', 'lightbulb', 'file-text', 'image', 'video', 'flag', 'list', 'map-pin', 'settings', 'thumbs-up', 'zap'];
                let iconGrid = `
                    <button type="button" class="icon-grid-item ${!block.value.icon ? 'selected' : ''}" data-icon-name="" title="Intet ikon">
                        <i data-lucide="ban"></i>
                    </button>
                `;
                iconGrid += icons.map(icon => `
                    <button type="button" class="icon-grid-item ${block.value.icon === icon ? 'selected' : ''}" data-icon-name="${icon}" title="${icon}">
                        <i data-lucide="${icon}"></i>
                    </button>
                `).join('');

                contentHtml = `<label>Ikon</label><div class="icon-grid-container">${iconGrid}</div><input type="hidden" class="custom-box-icon-hidden-input" value="${block.value.icon || ''}"><label style="margin-top: .5rem;">Titel</label><input type="text" class="custom-box-title" value="${block.value.title || ''}"><label style="margin-top: .5rem;">Indhold</label>${createFormattingToolbar()}<div class="custom-box-content wysiwyg-editor" contenteditable="true" style="width: 100%;">${block.value.content || ''}</div>`;
                break;
            case 'citat':
                contentHtml = `<label>Citat-tekst</label>${createFormattingToolbar()}<div class="quote-text wysiwyg-editor" contenteditable="true">${block.value.text || ''}</div><label style="margin-top: .5rem;">Forfatter</label><input type="text" class="quote-author" value="${block.value.author || ''}">`; break;
        }
        wrapper.innerHTML = `<div class="block-header"><span class="drag-handle"><i data-lucide="grip-vertical"></i></span><span class="block-title">Blok #${index + 1}: ${blockTypeTranslations[block.type] || block.type.charAt(0).toUpperCase() + block.type.slice(1)}</span><button class="btn-danger btn-remove-block">Fjern</button></div>${contentHtml}`;
        
        // --- Event Listeners for the block ---
        const dragHandle = wrapper.querySelector('.drag-handle');
        dragHandle.addEventListener('mousedown', () => {
            wrapper.setAttribute('draggable', 'true');
        });

        wrapper.addEventListener('dragstart', () => wrapper.classList.add('dragging'));
        
        wrapper.addEventListener('dragend', () => {
            wrapper.classList.remove('dragging');
            wrapper.removeAttribute('draggable');
        });

        wrapper.querySelector('.btn-remove-block').addEventListener('click', () => {
            if (confirm("Er du sikker på, at du vil slette denne blok?")) {
                const dayData = getCurrentDayDataFromForm();
                const indexToRemove = parseInt(wrapper.getAttribute('data-index'), 10);
                dayData.body.splice(indexToRemove, 1);
                
                // Opdater calendarData direkte, så ændringen er "live"
                calendarData[currentDay] = dayData;

                renderContentBlocks(dayData.body); // Gen-render for at opdatere DOM'en korrekt
                markChange();
            }
        });

        if (block.type === 'custom-box') {
            const iconContainer = wrapper.querySelector('.icon-grid-container');
            const hiddenInput = wrapper.querySelector('.custom-box-icon-hidden-input');
            
            iconContainer.addEventListener('click', e => {
                const button = e.target.closest('.icon-grid-item');
                if (!button) return;

                const selected = iconContainer.querySelector('.icon-grid-item.selected');
                if (selected) {
                    selected.classList.remove('selected');
                }

                button.classList.add('selected');
                hiddenInput.value = button.dataset.iconName;
                markChange();
            });
        }
        
        if (block.type === 'quiz') {
            const quizOptionsContainer = wrapper.querySelector('.quiz-options-container');

            // Event delegation for removing options
            quizOptionsContainer.addEventListener('click', (e) => {
                if (e.target.matches('.btn-remove-option')) {
                    if (quizOptionsContainer.children.length > 2) {
                        e.target.closest('.quiz-option').remove();
                        markChange();
                    } else {
                        alert('En quiz skal have mindst 2 svarmuligheder.');
                    }
                }
            });

            // Add new option
            wrapper.querySelector('.btn-add-option').addEventListener('click', (e) => {
                e.preventDefault();
                const newOption = document.createElement('div');
                newOption.className = 'quiz-option';
                newOption.innerHTML = `
                    <input type="radio" name="correct-answer-${index}">
                    <input type="text" class="quiz-option-text" value="">
                    <button type="button" class="btn-danger btn-remove-option" aria-label="Fjern svarmulighed" style="padding: 2px 8px; line-height: 1;">&times;</button>
                `;
                quizOptionsContainer.appendChild(newOption);
                markChange();
            });
        }

                        wrapper.querySelectorAll('.formatting-toolbar').forEach(toolbar => {

                            toolbar.addEventListener('click', (e) => {

                                const button = e.target.closest('.format-btn');

                                if (!button) return;

                

                                const editor = toolbar.nextElementSibling;

                                if (!(editor && editor.isContentEditable)) return;

                

                                editor.focus();

                

                                // Handle custom color picker

                                if (button.classList.contains('color-picker-btn')) {

                                    const colorDropdown = button.nextElementSibling; // Should be the color-dropdown

                                    if (colorDropdown) {

                                        // Ensure editor has focus before saving selection

                                        editor.focus();

                                        const selection = window.getSelection();

                                        if (selection.rangeCount > 0) {

                                            savedRange = selection.getRangeAt(0);

                                            currentEditor = editor;

                                        } else {

                                            savedRange = null;

                                            currentEditor = null;

                                        }

                

                                        // Close all other color dropdowns first

                                        document.querySelectorAll('.color-dropdown.is-visible').forEach(openDropdown => {

                                            if (openDropdown !== colorDropdown) {

                                                openDropdown.classList.remove('is-visible');

                                            }

                                        });

                                        // Toggle this dropdown

                                        colorDropdown.classList.toggle('is-visible');

                                    }

                                    e.stopPropagation(); // Prevent document click listener from immediately closing it again

                                    return; // Prevent further processing for color picker button click

                                } else {

                                    // Existing logic for other format buttons

                                    let value = null;

                                    if (button.dataset.valuePrompt) {

                                        value = prompt(button.dataset.valuePrompt);

                                        if (!value) return; // User cancelled prompt

                                    }

                                    formatDoc(button.dataset.command, value);

                                    markChange(); // Mark change for all other formatting actions

                                }

                            });

                

                                        // Add event listeners for color swatches within this toolbar's dropdown

                

                                        toolbar.querySelectorAll('.color-swatch').forEach(swatch => {

                

                                            swatch.addEventListener('click', (e) => {

                

                                                const color = swatch.dataset.color;

                

                                                const editor = toolbar.nextElementSibling; // This is the contenteditable div

                

                                                if (editor && editor.isContentEditable) {

                

                                                    // Restore selection just before applying color

                

                                                    if (savedRange && currentEditor === editor) { // Ensure it's the same editor

                

                                                        const selection = window.getSelection();

                

                                                        selection.removeAllRanges();

                

                                                        selection.addRange(savedRange);

                

                                                        currentEditor.focus(); // Re-focus after restoring

                

                                                    } else {

                

                                                        editor.focus(); // Fallback focus if no saved selection for this editor

                

                                                    }

                

                                                    

                

                                                    formatDoc('foreColor', color);

                

                                                    const paletteIcon = toolbar.querySelector('.color-picker-icon');

                

                                                    if (paletteIcon) {

                

                                                        paletteIcon.style.color = color;

                

                                                    }

                

                                                    markChange();

                

                                                }

                

                                                // Close the dropdown after color selection

                

                                                const colorDropdown = swatch.closest('.color-dropdown');

                

                                                if (colorDropdown) {

                

                                                    colorDropdown.classList.remove('is-visible');

                

                                                }

                

                                                e.stopPropagation(); // Prevent document click listener from immediately reopening

                

                                            });

                

                                        });

                

                                    });

        

        return wrapper;
    }

    function getCurrentDayDataFromForm() {
        if (!currentDay) return null;
        const newBody = [];
        const blocks = contentBlocksContainer.querySelectorAll('.block');

        for (const blockEl of blocks) {
            const type = blockEl.dataset.type;
            let newBlock;
            switch (type) {
                case 'question':
                    const checkedTitleTypeInput = blockEl.querySelector(`input[name="question_type_${blockEl.dataset.index}"]:checked`);
                    newBlock = {
                        type: 'question',
                        value: {
                            text: blockEl.querySelector('.block-value').innerHTML,
                            titleType: checkedTitleTypeInput ? checkedTitleTypeInput.value : 'question'
                        }
                    };
                    break;
                case 'answer': case 'refleksion':
                    newBlock = { type, value: blockEl.querySelector('.block-value').innerHTML }; break;
                case 'html':
                    newBlock = { type, value: blockEl.querySelector('.block-value').value }; break;
                case 'image':
                    newBlock = { type, value: blockEl.querySelector('.block-value').value, alt: blockEl.querySelector('.block-alt').value }; break;
                case 'video':
                     newBlock = { type, value: blockEl.querySelector('.block-value').value }; break;
                case 'quiz':
                    const options = Array.from(blockEl.querySelectorAll('.quiz-option-text')).map(input => input.value);
                    const correctRadio = blockEl.querySelector('input[type="radio"]:checked');
                    
                    if (!correctRadio) {
                        // Validation failed: a quiz is missing a correct answer.
                        return null; 
                    }

                    const allRadios = Array.from(blockEl.querySelectorAll('input[type="radio"]'));
                    const correctIndex = allRadios.indexOf(correctRadio);
                    
                    newBlock = { type, value: {
                        question: blockEl.querySelector('.quiz-question').innerHTML,
                        options,
                        correctIndex,
                        explanation: blockEl.querySelector('.quiz-explanation').innerHTML
                    } };
                    break;
                case 'custom-box':
                    newBlock = { type: 'custom-box', value: {
                        icon: blockEl.querySelector('.custom-box-icon-hidden-input').value,
                        title: blockEl.querySelector('.custom-box-title').value,
                        content: blockEl.querySelector('.custom-box-content').innerHTML,
                    }}; break;
                case 'citat':
                    newBlock = { type: 'citat', value: {
                        text: blockEl.querySelector('.quote-text').innerHTML,
                        author: blockEl.querySelector('.quote-author').value,
                    }}; break;
            }
            newBody.push(newBlock);
        }
        return { title: dayTitle.value, emoji: dayEmoji.value, body: newBody };
    }

    function revertDayChanges() {
        if (!originalDayData && !originalConfigData) {
            alert("Der er ingen ændringer at fortryde.");
            return;
        }
        if (confirm("Er du sikker på, at du vil fortryde alle ændringer (både generelle og for den valgte dag)?")) {
            calendarData.config = JSON.parse(JSON.stringify(originalConfigData));
            populateConfigFields();
            populateDoorOrderEditor();

            if (currentDay) {
                dayTitle.value = originalDayData.title;
                dayEmoji.value = originalDayData.emoji;
                renderContentBlocks(originalDayData.body);
            }
            hasUnsavedChanges = false;
            localStorage.removeItem('julekalenderEditorState');
        }
    }

    function generateAndDownloadContentJs() {
        calendarData.config.mainTitle = configMainTitle.value;
        calendarData.config.subtitle = configSubtitle.value;
        calendarData.config.logoUrl = configLogoUrl.value;
        calendarData.config.isTestMode = configTestMode.checked;

        if (currentDay) {
            const dayData = getCurrentDayDataFromForm();
            if (!dayData) {
                alert('Handlingen blev afbrudt: En quiz mangler et korrekt svar. Vælg venligst et korrekt svar for alle quizzer, før du gemmer.');
                return;
            }
            calendarData[currentDay] = dayData;
        }

        const jsString = `const calendarData = ${JSON.stringify(calendarData, null, 4)};`;
        hasUnsavedChanges = false;
        localStorage.removeItem('julekalenderEditorState');
        
        const blob = new Blob([jsString], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'content.js';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('Den nye `content.js` fil er blevet genereret og downloadet.');
    }

    function previewCurrentDay() {
        if (!currentDay) {
            alert('Vælg venligst en dag først for at teste den.');
            return;
        }
        const dayData = getCurrentDayDataFromForm();
        if (!dayData) {
            alert('Forhåndsvisning afbrudt: En quiz mangler et korrekt svar. Vælg venligst et korrekt svar for alle quizzer, før du tester.');
            return;
        }
        renderPreviewModal(dayData);
    }

    function renderPreviewModal(data) {
        modalTitle.innerHTML = `${data.emoji || ''} ${data.title}`;
        let contentHtml = '';
         data.body.forEach(block => {
            switch (block.type) {
                case 'question':
                    // Handle old and new data structures
                    const isOldFormat = typeof block.value === 'string';
                    const titleText = isOldFormat ? 'Spørgsmål/Princip' : (block.value.titleType === 'principle' ? 'Princip' : 'Spørgsmål');
                    const questionText = isOldFormat ? block.value : block.value.text;
                    contentHtml += `<div class="question-box"><p class="box-title"><i data-lucide="help-circle"></i> ${titleText}</p><p>${questionText}</p></div>`; 
                    break;
                case 'answer': contentHtml += `<div class="answer-box"><p class="box-title"><i data-lucide="message-square"></i> Svar</p><p>${block.value}</p></div>`; break;
                case 'html': contentHtml += `<div class="html-block">${block.value}</div>`; break;
                case 'image': contentHtml += `<div class="image-block"><img src="${block.value}" alt="${block.alt || ''}"></div>`; break;
                case 'video': contentHtml += `<div class="video-container"><iframe src="${block.value}" frameborder="0" allowfullscreen></iframe></div>`; break;
                case 'quiz':
                    const quizId = `quiz-preview-0`;
                    const encodedExplanation = encodeURIComponent(block.value.explanation);
                    contentHtml += `<div class="quiz-block" id="${quizId}" data-explanation="${encodedExplanation}"><p class="quiz-question">${block.value.question}</p><div class="quiz-options">${block.value.options.map((option, index) => `<button class="quiz-option" data-is-correct="${index === block.value.correctIndex}">${option}</button>`).join('')}</div><div class="quiz-feedback"></div></div>`;
                    break;
                case 'custom-box': 
                    const iconHtml = block.value.icon ? `<i data-lucide="${block.value.icon}"></i>` : '';
                    contentHtml += `<div class="question-box"><p class="box-title">${iconHtml} ${block.value.title || ''}</p><p>${block.value.content || ''}</p></div>`; 
                    break;
                case 'citat': contentHtml += `<div class="quote-block"><blockquote>${block.value.text || ''}</blockquote><cite>— ${block.value.author || ''}</cite></div>`; break;
                case 'refleksion': contentHtml += `<div class="question-box" style="border-left-color: #663399;"><p class="box-title"><i data-lucide="brain-circuit"></i> Til Refleksion</p><p>${block.value || ''}</p></div>`; break;
            }
        });
        modalContent.innerHTML = contentHtml;
        modalContent.querySelectorAll('.quiz-block').forEach(quizBlock => {
            quizBlock.querySelectorAll('.quiz-option').forEach(optionButton => {
                optionButton.addEventListener('click', () => { handleQuizAnswer(optionButton, optionButton.dataset.isCorrect === 'true'); });
            });
        });
        modal.classList.add('is-visible');
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    function handleQuizAnswer(buttonElement, isCorrect) {
        const quizBlock = buttonElement.closest('.quiz-block');
        const options = quizBlock.querySelectorAll('.quiz-option');
        const feedbackEl = quizBlock.querySelector('.quiz-feedback');
        const explanation = decodeURIComponent(quizBlock.dataset.explanation);
        options.forEach(option => { option.disabled = true; });
        buttonElement.classList.add(isCorrect ? 'correct' : 'incorrect');
        if (!isCorrect) {
            options.forEach(option => {
                if (option.dataset.isCorrect === 'true') option.classList.add('correct');
            });
        }
        feedbackEl.innerHTML = `<p class="quiz-explanation">${explanation}</p>`;
    }

    function closeModal() {
        modal.classList.remove('is-visible');
    }

    initializeEditor();
});