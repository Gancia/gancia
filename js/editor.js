/**
 * Julekalender Editor - Refactored Edition
 *
 * This script provides all functionality for the Christmas calendar editor page.
 * It has been refactored into a modular structure to improve readability,
 * maintainability, and separation of concerns. Each module has a specific
 * responsibility, and they are initialized and connected by the main App object.
 */
document.addEventListener('DOMContentLoaded', () => {

    /**
     * Main application object. Initializes and orchestrates all other modules.
     */
    const App = {
        init() {
            // Initialize all modules
            const initialData = this.getInitialData();
            State.init(initialData);
            DOM.cacheElements();
            
            // The order of initialization matters
            ConfigManager.init();
            DayEditor.init();
            UI.init();
            Toolbar.init();

            // Restore state from a previous session, if any
            const restoredDay = State.loadFromLocalStorage();
            if (restoredDay) {
                DOM.daySelector.value = restoredDay;
                DayEditor.handleSelection(restoredDay, true); // bypass confirm
            }
            
            // console.log("Julekalender Editor Initialized Successfully.");
        },

        /**
         * Safely gets calendar data from the global scope or creates a default
         * structure if it's missing.
         * @returns {object} The calendar data object.
         */
        getInitialData() {
            if (typeof calendarData !== 'undefined' && Object.keys(calendarData).length > 0) {
                // Ensure config defaults are present
                calendarData.config = calendarData.config || {};
                calendarData.config.doorOrder = calendarData.config.doorOrder && calendarData.config.doorOrder.length === 24 ? calendarData.config.doorOrder : Array.from({ length: 24 }, (_, i) => i + 1);
                calendarData.config.isTestMode = calendarData.config.isTestMode || false;
                return calendarData;
            }
            alert("Fejl: 'content.js' kunne ikke indlæses. Opretter en tom kalender.");
            return {
                config: { mainTitle: "Ny Kalender", subtitle: "Beskrivelse...", logoUrl: "assets/logo.png", isTestMode: false, doorOrder: Array.from({ length: 24 }, (_, i) => i + 1) },
                ...Object.fromEntries(Array.from({ length: 24 }, (_, i) => [i + 1, { title: `Dag ${i+1}`, emoji: '', body: [] }]))
            };
        }
    };

    /**
     * Caches all necessary DOM elements to avoid repeated queries.
     */
    const DOM = {
        cacheElements() {
            this.configMainTitle = document.getElementById('config-main-title');
            this.configSubtitle = document.getElementById('config-subtitle');
            this.configLogoUrl = document.getElementById('config-logo-url');
            this.shuffleDoors = document.getElementById('shuffle-doors');
            this.configTestMode = document.getElementById('config-test-mode');
            this.doorOrderContainer = document.getElementById('door-order-container');
            this.daySelector = document.getElementById('day-selector');
            this.editorFields = document.getElementById('editor-fields');
            this.dayTitle = document.getElementById('day-title');
            this.dayEmoji = document.getElementById('day-emoji');
            this.contentBlocksContainer = document.getElementById('content-blocks');
            this.generateJson = document.getElementById('generate-json');
            this.previewDoor = document.getElementById('preview-door');
            this.revertAllButton = document.getElementById('revert-all-button');
            this.revertDayButton = document.getElementById('revert-day-button');
            this.emojiPickerBtn = document.getElementById('emoji-picker-btn');
            this.modal = document.getElementById('modal');
            this.modalTitle = document.getElementById('modal-title');
            this.modalContent = document.getElementById('modal-content');
            this.modalCloseButton = document.getElementById('modal-close-button');
            
            this.configFieldsContainer = document.querySelector('.editor-container > div');
            this.addBlockButtons = document.querySelector('.add-block-buttons');
            this.emojiPicker = document.querySelector('emoji-picker');
        }
    };

    /**
     * Manages all application state, including data, changes, and local storage persistence.
     */
    const State = {
        init(initialData) {
            this.data = initialData;
            this.currentDay = null;
            this.originalDayData = null;
            this.originalConfigData = JSON.parse(JSON.stringify(this.data.config));
            this.hasUnsavedChanges = false;
            this.savedRange = null; // For WYSIWYG selection
            this.currentEditor = null; // For WYSIWYG selection
        },

        markChange() {
            this.hasUnsavedChanges = true;
            this.debouncedSave();
        },

        setCurrentDay(day) {
            this.currentDay = day;
            this.hasUnsavedChanges = false; // Reset on day change
            if (day) {
                const dayData = this.data[day] || { title: '', emoji: '', body: [] };
                this.originalDayData = JSON.parse(JSON.stringify(dayData));
            } else {
                this.originalDayData = null;
            }
        },

        debouncedSave: (() => {
            let timeout;
            return () => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    if (!State.hasUnsavedChanges) return;
                    
                    const dayData = State.currentDay ? DayEditor.getDataFromForm() : null;
                    if (State.currentDay && dayData === null) {
                        console.warn("Autosave skipped due to invalid form data.");
                        return; // Don't save if form is invalid (e.g., quiz missing answer)
                    }

                    const stateToSave = {
                        config: ConfigManager.getDataFromForm(),
                        currentDay: State.currentDay,
                        dayData: dayData
                    };
                    localStorage.setItem('julekalenderEditorState', JSON.stringify(stateToSave));
                }, 1000);
            };
        })(),

        loadFromLocalStorage() {
            const savedStateJSON = localStorage.getItem('julekalenderEditorState');
            if (!savedStateJSON) return null;

            if (confirm("Du har ugemte ændringer fra en tidligere session. Vil du gendanne dem?")) {
                const savedState = JSON.parse(savedStateJSON);
                this.data.config = savedState.config;
                if (savedState.currentDay && savedState.dayData) {
                    this.data[savedState.currentDay] = savedState.dayData;
                }
                this.hasUnsavedChanges = true;
                alert("Ændringerne er blevet gendannet.");
                return savedState.currentDay;
            }
            localStorage.removeItem('julekalenderEditorState');
            return null;
        }
    };
    
    /**
     * Manages global configuration settings like title, logo, and door order.
     */
    const ConfigManager = {
        init() {
            this.populateFields();
            this.populateDoorOrder();
            this.setupEventListeners();
        },

        setupEventListeners() {
            DOM.configFieldsContainer.addEventListener('input', () => State.markChange());
            DOM.configTestMode.addEventListener('change', () => State.markChange());
            DOM.shuffleDoors.addEventListener('click', () => this.shuffleDoors());

            DOM.doorOrderContainer.addEventListener('dragover', e => {
                e.preventDefault();
                const draggingItem = DOM.doorOrderContainer.querySelector('.dragging');
                if (!draggingItem) return;
                const afterElement = UI.getDragAfterElement(DOM.doorOrderContainer, e.clientY, '.door-order-item');
                DOM.doorOrderContainer.insertBefore(draggingItem, afterElement);
            });

            DOM.doorOrderContainer.addEventListener('drop', e => {
                e.preventDefault();
                const newOrder = [...DOM.doorOrderContainer.querySelectorAll('.door-order-item')].map(item => parseInt(item.textContent, 10));
                State.data.config.doorOrder = newOrder;
                State.markChange();
            });
        },

        populateFields() {
            const { config } = State.data;
            DOM.configMainTitle.value = config.mainTitle || '';
            DOM.configSubtitle.value = config.subtitle || '';
            DOM.configLogoUrl.value = config.logoUrl || '';
            DOM.configTestMode.checked = config.isTestMode || false;
        },

        populateDoorOrder() {
            DOM.doorOrderContainer.innerHTML = '';
            State.data.config.doorOrder.forEach(dayNumber => {
                const item = document.createElement('div');
                item.className = 'door-order-item';
                item.textContent = dayNumber;
                item.draggable = true;
                item.addEventListener('dragstart', () => item.classList.add('dragging'));
                item.addEventListener('dragend', () => item.classList.remove('dragging'));
                DOM.doorOrderContainer.appendChild(item);
            });
        },
        
        getDataFromForm() {
            return {
                mainTitle: DOM.configMainTitle.value,
                subtitle: DOM.configSubtitle.value,
                logoUrl: DOM.configLogoUrl.value,
                isTestMode: DOM.configTestMode.checked,
                doorOrder: State.data.config.doorOrder
            };
        },

        shuffleDoors() {
            let order = State.data.config.doorOrder;
            for (let i = order.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [order[i], order[j]] = [order[j], order[i]];
            }
            this.populateDoorOrder();
            State.markChange();
            alert('Lågernes rækkefølge er blevet blandet.');
        }
    };

    /**
     * Manages editing a specific day's title, emoji, and content blocks.
     */
    const DayEditor = {
        init() {
            this.populateSelector();
            this.setupEventListeners();
        },
        
        setupEventListeners() {
            DOM.daySelector.addEventListener('change', e => this.handleSelection(e.target.value, false));
            DOM.editorFields.addEventListener('input', () => State.markChange());
            DOM.addBlockButtons.addEventListener('click', e => {
                if (e.target.tagName === 'BUTTON' && e.target.id.startsWith('add-')) {
                    BlockManager.addBlock(e.target.id.replace('add-', ''));
                }
            });

            DOM.contentBlocksContainer.addEventListener('dragover', e => {
                e.preventDefault();
                const draggingBlock = DOM.contentBlocksContainer.querySelector('.dragging');
                if (!draggingBlock) return;
                const afterElement = UI.getDragAfterElement(DOM.contentBlocksContainer, e.clientY);
                DOM.contentBlocksContainer.insertBefore(draggingBlock, afterElement);
            });

            DOM.contentBlocksContainer.addEventListener('drop', e => {
                e.preventDefault();
                BlockManager.updateBlockNumbers();
                State.markChange();
            });
        },

        populateSelector() {
            DOM.daySelector.innerHTML = '<option value="">-- Vælg en dag --</option>';
            for (let i = 1; i <= 24; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = `Dag ${i}`;
                DOM.daySelector.appendChild(option);
            }
        },

        handleSelection(day, bypassConfirm = false) {
            if (!bypassConfirm && State.hasUnsavedChanges) {
                if (!confirm("Du har ugemte ændringer. Vil du fortsætte uden at gemme?")) {
                    DOM.daySelector.value = State.currentDay; // Revert selection
                    return;
                }
            }

            State.setCurrentDay(day);

            if (!day) {
                DOM.editorFields.style.display = 'none';
                return;
            }
            
            this.populateForm();
            DOM.editorFields.style.display = 'block';
        },

        populateForm() {
            const dayData = State.data[State.currentDay];
            DOM.dayTitle.value = dayData.title;
            DOM.dayEmoji.value = dayData.emoji;
            BlockManager.render(dayData.body);
        },

        getDataFromForm() {
            if (!State.currentDay) return null;
            const body = BlockManager.getDataFromDOM();
            if (body === null) return null; // Propagate validation failure
            return {
                title: DOM.dayTitle.value,
                emoji: DOM.dayEmoji.value,
                body: body
            };
        }
    };

    /**
     * Handles creating, rendering, and parsing content blocks.
     */
    const BlockManager = {
        translations: { question: 'Spørgsmål', answer: 'Svar', html: 'HTML', image: 'Billede', video: 'Video', quiz: 'Quiz', 'custom-box': 'Brugerdefineret Boks', citat: 'Citat', refleksion: 'Refleksion' },
        
        render(body) {
            DOM.contentBlocksContainer.innerHTML = '';
            if (!body || !Array.isArray(body)) return;
            body.forEach((block, index) => {
                const blockEl = this.createBlockElement(block, index);
                DOM.contentBlocksContainer.appendChild(blockEl);
            });
            UI.lucideCreateIcons();
        },

        addBlock(type) {
            if (!State.currentDay) return;
            let newBlockData;
            switch (type) {
                case 'answer': case 'html': case 'refleksion': newBlockData = { type, value: '' }; break;
                case 'question': newBlockData = { type, value: { text: '', titleType: 'question' } }; break;
                case 'image': newBlockData = { type, value: 'assets/placeholder.png', alt: '' }; break;
                case 'video': newBlockData = { type, value: 'https://www.youtube.com/embed/...' }; break;
                case 'quiz': newBlockData = { type, value: { question: '', options: ['', ''], correctIndex: null, explanation: '' } }; break;
                case 'custom-box': newBlockData = { type, value: { icon: '', title: 'Brugerdefineret Titel', content: '' } }; break;
                case 'citat': newBlockData = { type, value: { text: '', author: '' } }; break;
                default: return;
            }
            const index = DOM.contentBlocksContainer.children.length;
            const blockEl = this.createBlockElement(newBlockData, index);
            DOM.contentBlocksContainer.appendChild(blockEl);
            UI.lucideCreateIcons();
            State.markChange();
        },

        updateBlockNumbers() {
            Array.from(DOM.contentBlocksContainer.children).forEach((child, i) => {
                child.dataset.index = i;
                child.querySelector('.block-title').textContent = `Blok #${i + 1}: ${this.translations[child.dataset.type] || child.dataset.type}`;
                child.querySelectorAll('input[name^="correct-answer-"]').forEach(radio => {
                    radio.name = `correct-answer-${i}`;
                });
            });
        },

        createBlockElement(block, index) {
            const wrapper = document.createElement('div');
            wrapper.className = 'block';
            wrapper.dataset.index = index;
            wrapper.dataset.type = block.type;
            
            const title = this.translations[block.type] || block.type;
            let contentHtml = '';
            // Logic for generating the inner HTML of each block type
            switch (block.type) {
                case 'question':
                    if (typeof block.value === 'string') block.value = { text: block.value, titleType: 'question' };
                    contentHtml = `<label>Titel Type</label><div class="question-title-type-selector"><input type="radio" id="q_type_${index}_question" name="question_type_${index}" value="question" ${block.value.titleType === 'question' ? 'checked' : ''}><label for="q_type_${index}_question">Spørgsmål</label><input type="radio" id="q_type_${index}_principle" name="question_type_${index}" value="principle" ${block.value.titleType === 'principle' ? 'checked' : ''}><label for="q_type_${index}_principle">Princip</label></div><div style="margin-top: .5rem;"></div>${Toolbar.createHTML()}<div class="block-value wysiwyg-editor" contenteditable="true">${block.value.text}</div>`;
                    break;
                case 'answer': case 'refleksion':
                    contentHtml = `${Toolbar.createHTML()}<div class="block-value wysiwyg-editor" contenteditable="true">${block.value}</div>`;
                    break;
                case 'html':
                    contentHtml = `<textarea class="block-value" rows="5">${block.value}</textarea>`;
                    break;
                case 'image':
                    contentHtml = `<label>Billed-URL</label><input type="text" class="block-value" value="${block.value}"><label style="margin-top: .5rem;">Alternativ tekst</label><input type="text" class="block-alt" value="${block.alt || ''}">`;
                    break;
                case 'video':
                     contentHtml = `<label>YouTube Embed URL</label><input type="text" class="block-value" value="${block.value}">`; break;
                case 'quiz':
                    const optionsHtml = block.value.options.map((option, i) => `<div class="quiz-option"><input type="radio" name="correct-answer-${index}" ${i === block.value.correctIndex ? 'checked' : ''}><input type="text" class="quiz-option-text" value="${option}"><button type="button" class="btn-danger btn-remove-option" aria-label="Fjern svarmulighed">&times;</button></div>`).join('');
                    contentHtml = `<label>Quiz-spørgsmål</label>${Toolbar.createHTML()}<div class="quiz-question wysiwyg-editor" contenteditable="true">${block.value.question}</div><label>Svarmuligheder (vælg den korrekte)</label><div class="quiz-options-container">${optionsHtml}</div><button class="btn-secondary btn-add-option">Tilføj svarmulighed</button><label>Forklaring efter svar</label>${Toolbar.createHTML()}<div class="quiz-explanation wysiwyg-editor" contenteditable="true">${block.value.explanation}</div>`; break;
                case 'custom-box':
                    const icons = ['info', 'help-circle', 'book-open', 'star', 'check-circle', 'x-circle', 'message-square', 'edit', 'award', 'gift', 'lightbulb'];
                    let iconGrid = `<button type="button" class="icon-grid-item ${!block.value.icon ? 'selected' : ''}" data-icon-name="" title="Intet ikon"><i data-lucide="ban"></i></button>`;
                    iconGrid += icons.map(icon => `<button type="button" class="icon-grid-item ${block.value.icon === icon ? 'selected' : ''}" data-icon-name="${icon}" title="${icon}"><i data-lucide="${icon}"></i></button>`).join('');
                    contentHtml = `<label>Ikon</label><div class="icon-grid-container">${iconGrid}</div><input type="hidden" class="custom-box-icon-hidden-input" value="${block.value.icon || ''}"><label>Titel</label><input type="text" class="custom-box-title" value="${block.value.title || ''}"><label>Indhold</label>${Toolbar.createHTML()}<div class="custom-box-content wysiwyg-editor" contenteditable="true">${block.value.content || ''}</div>`;
                    break;
                case 'citat':
                    contentHtml = `<label>Citat-tekst</label>${Toolbar.createHTML()}<div class="quote-text wysiwyg-editor" contenteditable="true">${block.value.text || ''}</div><label>Forfatter</label><input type="text" class="quote-author" value="${block.value.author || ''}">`; break;
            }

            wrapper.innerHTML = `<div class="block-header"><span class="drag-handle"><i data-lucide="grip-vertical"></i></span><span class="block-title">Blok #${index + 1}: ${title}</span><button class="btn-danger btn-remove-block">Fjern</button></div>${contentHtml}`;
            this.setupBlockEventListeners(wrapper, block.type, index);
            return wrapper;
        },
        
        setupBlockEventListeners(wrapper, type, index) {
            const dragHandle = wrapper.querySelector('.drag-handle');
            dragHandle.addEventListener('mousedown', () => wrapper.setAttribute('draggable', 'true'));
            wrapper.addEventListener('dragstart', () => wrapper.classList.add('dragging'));
            wrapper.addEventListener('dragend', () => {
                wrapper.classList.remove('dragging');
                wrapper.removeAttribute('draggable');
            });

            wrapper.querySelector('.btn-remove-block').addEventListener('click', () => {
                if (confirm("Er du sikker på, at du vil slette denne blok?")) {
                    wrapper.remove();
                    this.updateBlockNumbers();
                    State.markChange();
                }
            });

            // Type-specific event listeners
            if (type === 'quiz') {
                const optionsContainer = wrapper.querySelector('.quiz-options-container');
                optionsContainer.addEventListener('click', e => {
                    if (e.target.classList.contains('btn-remove-option')) {
                        if (optionsContainer.children.length > 2) {
                            e.target.closest('.quiz-option').remove();
                            State.markChange();
                        } else {
                            alert('En quiz skal have mindst 2 svarmuligheder.');
                        }
                    }
                });
                wrapper.querySelector('.btn-add-option').addEventListener('click', () => {
                    const newOptionDiv = document.createElement('div');
                    newOptionDiv.className = 'quiz-option';

                    const newRadio = document.createElement('input');
                    newRadio.type = 'radio';
                    newRadio.name = `correct-answer-${index}`;

                    const newTextInput = document.createElement('input');
                    newTextInput.type = 'text';
                    newTextInput.className = 'quiz-option-text';

                    const newRemoveBtn = document.createElement('button');
                    newRemoveBtn.type = 'button';
                    newRemoveBtn.className = 'btn-danger btn-remove-option';
                    newRemoveBtn.setAttribute('aria-label', 'Fjern svarmulighed');
                    newRemoveBtn.innerHTML = '&times;';

                    newOptionDiv.appendChild(newRadio);
                    newOptionDiv.appendChild(newTextInput);
                    newOptionDiv.appendChild(newRemoveBtn);
                    optionsContainer.appendChild(newOptionDiv);
                    State.markChange();
                });
            }
             if (type === 'custom-box') {
                const iconContainer = wrapper.querySelector('.icon-grid-container');
                iconContainer.addEventListener('click', e => {
                    const button = e.target.closest('.icon-grid-item');
                    if (!button) return;
                    iconContainer.querySelector('.selected')?.classList.remove('selected');
                    button.classList.add('selected');
                    wrapper.querySelector('.custom-box-icon-hidden-input').value = button.dataset.iconName;
                    State.markChange();
                });
            }
        },

        getDataFromDOM() {
            const newBody = [];
            const blockElements = DOM.contentBlocksContainer.querySelectorAll('.block');
            for (const blockEl of blockElements) {
                const type = blockEl.dataset.type;
                let newBlock;
                switch (type) {
                    case 'question': newBlock = { type, value: { text: blockEl.querySelector('.block-value').innerHTML, titleType: blockEl.querySelector(`input[name^="question_type_"]:checked`).value } }; break;
                    case 'answer': case 'refleksion': newBlock = { type, value: blockEl.querySelector('.block-value').innerHTML }; break;
                    case 'html': newBlock = { type, value: blockEl.querySelector('.block-value').value }; break;
                    case 'image': newBlock = { type, value: blockEl.querySelector('.block-value').value, alt: blockEl.querySelector('.block-alt').value }; break;
                    case 'video': newBlock = { type, value: blockEl.querySelector('.block-value').value }; break;
                    case 'quiz':
                        const options = Array.from(blockEl.querySelectorAll('.quiz-option-text')).map(input => input.value);
                        const correctRadio = blockEl.querySelector('input[name^="correct-answer-"]:checked');
                        if (!correctRadio) { alert('Handlingen blev afbrudt: En quiz mangler et korrekt svar.'); return null; }
                        const correctIndex = Array.from(blockEl.querySelectorAll('input[name^="correct-answer-"]')).indexOf(correctRadio);
                        newBlock = { type, value: { question: blockEl.querySelector('.quiz-question').innerHTML, options, correctIndex, explanation: blockEl.querySelector('.quiz-explanation').innerHTML } };
                        break;
                    case 'custom-box': newBlock = { type: 'custom-box', value: { icon: blockEl.querySelector('.custom-box-icon-hidden-input').value, title: blockEl.querySelector('.custom-box-title').value, content: blockEl.querySelector('.custom-box-content').innerHTML }}; break;
                    case 'citat': newBlock = { type: 'citat', value: { text: blockEl.querySelector('.quote-text').innerHTML, author: blockEl.querySelector('.quote-author').value }}; break;
                }
                newBody.push(newBlock);
            }
            return newBody;
        }
    };

    /**
     * Manages general UI elements like modals, previews, and global event listeners.
     */
    const UI = {
        init() {
            this.setupEventListeners();
            this.lucideCreateIcons();
        },
        setupEventListeners() {
            DOM.generateJson.addEventListener('click', () => this.generateAndDownload());
            DOM.previewDoor.addEventListener('click', () => this.previewCurrentDay());
            DOM.revertAllButton.addEventListener('click', () => this.revertAll());
            DOM.revertDayButton.addEventListener('click', () => this.revertDay());
            DOM.modalCloseButton.addEventListener('click', () => this.closeModal());
            document.addEventListener('keydown', e => { if (e.key === 'Escape') this.closeModal(); });
            window.addEventListener('beforeunload', e => { if (State.hasUnsavedChanges) { e.preventDefault(); e.returnValue = ''; } });
            
            DOM.emojiPickerBtn.addEventListener('click', () => DOM.emojiPicker.style.display = DOM.emojiPicker.style.display === 'block' ? 'none' : 'block');
            DOM.emojiPicker.addEventListener('emoji-click', e => { DOM.dayEmoji.value = e.detail.unicode; State.markChange(); });
            document.addEventListener('click', e => {
                if (!DOM.emojiPicker.contains(e.target) && !DOM.emojiPickerBtn.contains(e.target)) DOM.emojiPicker.style.display = 'none';
            });
        },
        
        generateAndDownload() {
            State.data.config = ConfigManager.getDataFromForm();
            if (State.currentDay) {
                const dayData = DayEditor.getDataFromForm();
                if (dayData === null) return; // Validation failed
                State.data[State.currentDay] = dayData;
            }

            const jsString = `const calendarData = ${JSON.stringify(State.data, null, 4)};`;
            State.hasUnsavedChanges = false;
            localStorage.removeItem('julekalenderEditorState');
            
            const blob = new Blob([jsString], { type: 'application/javascript' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'content.js';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
            alert('Den nye `content.js` fil er blevet genereret og downloadet.');
        },

        previewCurrentDay() {
            if (!State.currentDay) { alert('Vælg en dag for at teste den.'); return; }
            const dayData = DayEditor.getDataFromForm();
            if (dayData === null) return;
            this.renderPreviewModal(dayData);
        },

        renderPreviewModal(data) {
            DOM.modalTitle.innerHTML = `${data.emoji || ''} ${data.title}`;
            let contentHtml = '';
            data.body.forEach(block => {
                // Generate HTML for preview based on block type
                 switch (block.type) {
                    case 'question':
                        const titleText = block.value.titleType === 'principle' ? 'Princip' : 'Spørgsmål';
                        contentHtml += `<div class="question-box"><p class="box-title"><i data-lucide="help-circle"></i> ${titleText}</p><p>${block.value.text}</p></div>`; 
                        break;
                    case 'answer': contentHtml += `<div class="answer-box"><p class="box-title"><i data-lucide="message-square"></i> Svar</p><p>${block.value}</p></div>`; break;
                    case 'html': contentHtml += `<div class="html-block">${block.value}</div>`; break;
                    case 'image': contentHtml += `<div class="image-block"><img src="${block.value}" alt="${block.alt || ''}"></div>`; break;
                    case 'video': contentHtml += `<div class="video-container"><iframe src="${block.value}" frameborder="0" allowfullscreen></iframe></div>`; break;
                    case 'quiz':
                        const quizId = `quiz-preview-${Math.random()}`;
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
            DOM.modalContent.innerHTML = contentHtml;
            DOM.modalContent.querySelectorAll('.quiz-block').forEach(quizBlock => {
                quizBlock.querySelectorAll('.quiz-option').forEach(button => {
                    button.addEventListener('click', () => {
                        const isCorrect = button.dataset.isCorrect === 'true';
                        const parentBlock = button.closest('.quiz-block');
                        parentBlock.querySelectorAll('.quiz-option').forEach(btn => {
                            btn.disabled = true;
                            if (btn.dataset.isCorrect === 'true') btn.classList.add('correct');
                        });
                        button.classList.add(isCorrect ? 'correct' : 'incorrect');
                        parentBlock.querySelector('.quiz-feedback').innerHTML = `<div class="quiz-explanation">${decodeURIComponent(parentBlock.dataset.explanation)}</div>`;
                    }, { once: true });
                });
            });
            DOM.modal.classList.add('is-visible');
            this.lucideCreateIcons();
        },

        closeModal() { DOM.modal.classList.remove('is-visible'); },

        revertDay() {
            if (!State.currentDay || !State.originalDayData) { alert("Vælg en dag for at fortryde."); return; }
            if (confirm("Er du sikker på, at du vil fortryde ændringer for denne dag?")) {
                State.data[State.currentDay] = JSON.parse(JSON.stringify(State.originalDayData));
                DayEditor.populateForm();
                State.markChange();
            }
        },

        revertAll() {
            if (!State.originalConfigData) { alert("Ingen generelle indstillinger at fortryde."); return; }
            if (confirm("Er du sikker på, at du vil fortryde alle generelle indstillinger?")) {
                State.data.config = JSON.parse(JSON.stringify(State.originalConfigData));
                ConfigManager.populateFields();
                ConfigManager.populateDoorOrder();
                State.markChange();
            }
        },
        
        getDragAfterElement: (container, y, selector = '.block') => {
            const draggableElements = [...container.querySelectorAll(`${selector}:not(.dragging)`)];
            return draggableElements.reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                return (offset < 0 && offset > closest.offset) ? { offset, element: child } : closest;
            }, { offset: Number.NEGATIVE_INFINITY }).element;
        },

        lucideCreateIcons: () => { if (typeof lucide !== 'undefined') lucide.createIcons(); }
    };

    /**
     * Manages the WYSIWYG formatting toolbar.
     */
    const Toolbar = {
        init() {
            // Use event delegation on the document for toolbar clicks
            document.addEventListener('click', e => {
                const button = e.target.closest('.format-btn');
                if (button) this.handleButtonClick(button);
                
                const swatch = e.target.closest('.color-swatch');
                if (swatch) this.handleColorSwatchClick(swatch);
            });
        },

        createHTML() {
            return `
            <div class="formatting-toolbar">
                <button type="button" class="format-btn" data-command="bold" title="Fed"><b>B</b></button>
                <button type="button" class="format-btn" data-command="italic" title="Kursiv"><i>I</i></button>
                <button type="button" class="format-btn" data-command="underline" title="Understreget"><u>U</u></button>
                <button type="button" class="format-btn" data-command="insertUnorderedList" title="Uordnet liste"><i data-lucide="list"></i></button>
                <button type="button" class="format-btn" data-command="insertOrderedList" title="Ordnet liste"><i data-lucide="list-ordered"></i></button>
                <div class="format-btn-group">
                    <button type="button" class="format-btn color-picker-btn" title="Tekstfarve"><i data-lucide="palette"></i></button>
                    <div class="color-dropdown">
                        <div class="color-swatch" data-color="#000000" style="background-color: #000000;"></div>
                        <div class="color-swatch" data-color="#FF0000" style="background-color: #FF0000;"></div>
                        <div class="color-swatch" data-color="#0000FF" style="background-color: #0000FF;"></div>
                        <div class="color-swatch" data-color="#FFFFFF" style="background-color: #FFFFFF; border: 1px solid #ccc;"></div>
                    </div>
                </div>
                <button type="button" class="format-btn" data-command="removeFormat" title="Fjern formatering"><i data-lucide="x-circle"></i></button>
            </div>`;
        },

        handleButtonClick(button) {
            const editor = button.closest('.block').querySelector('.wysiwyg-editor');
            if (!editor) return;
            editor.focus();

            if (button.classList.contains('color-picker-btn')) {
                const dropdown = button.nextElementSibling;
                const selection = window.getSelection();
                if (selection.rangeCount > 0) State.savedRange = selection.getRangeAt(0);
                State.currentEditor = editor;
                dropdown.classList.toggle('is-visible');
                return;
            }

            document.execCommand(button.dataset.command, false, null);
            State.markChange();
        },
        
        handleColorSwatchClick(swatch) {
            const color = swatch.dataset.color;
            if (State.currentEditor && State.savedRange) {
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(State.savedRange);
                State.currentEditor.focus();
                document.execCommand('foreColor', false, color);
                State.markChange();
            }
            swatch.closest('.color-dropdown').classList.remove('is-visible');
        }
    };

    // Entry point
    App.init();
});