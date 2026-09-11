// Route Rakshak - In-DOM Smooth City Selector
// Eliminates browser GPU popup glitches / black rectangular blink on Windows Chrome

(function() {
    function setupCustomSelect(selectId) {
        const select = document.getElementById(selectId);
        if (!select || select.dataset.customSelectInitialized) return;
        select.dataset.customSelectInitialized = 'true';

        // Hide the native select but keep it in the DOM for forms/logic
        select.style.display = 'none';

        // Create the wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'custom-select-wrapper';
        wrapper.id = selectId + '_customWrapper';

        // Create the trigger button
        const trigger = document.createElement('div');
        trigger.className = 'custom-select-trigger';
        trigger.tabIndex = 0;
        trigger.setAttribute('role', 'combobox');
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');

        const labelSpan = document.createElement('span');
        labelSpan.className = 'custom-select-label';
        labelSpan.textContent = select.options[select.selectedIndex]?.text || '-- Select Location --';

        const arrowSpan = document.createElement('span');
        arrowSpan.className = 'custom-select-arrow';
        arrowSpan.innerHTML = '&#9662;';

        trigger.appendChild(labelSpan);
        trigger.appendChild(arrowSpan);
        wrapper.appendChild(trigger);

        // Create the dropdown menu
        const dropdown = document.createElement('div');
        dropdown.className = 'custom-select-dropdown';

        // Search box
        const searchBox = document.createElement('div');
        searchBox.className = 'custom-select-search-box';
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'custom-select-search-input';
        searchInput.placeholder = '🔍 Search city or state...';
        searchInput.autocomplete = 'off';
        searchBox.appendChild(searchInput);
        dropdown.appendChild(searchBox);

        // Options list container
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'custom-select-options';
        dropdown.appendChild(optionsContainer);

        wrapper.appendChild(dropdown);
        select.parentNode.insertBefore(wrapper, select.nextSibling);

        // Rebuild options from select element
        function rebuildOptions() {
            optionsContainer.innerHTML = '';
            const query = (searchInput.value || '').trim().toLowerCase();
            let totalMatchCount = 0;

            // Handle children (both direct options and optgroups)
            Array.from(select.children).forEach(child => {
                if (child.tagName === 'OPTGROUP') {
                    const groupLabel = child.label;
                    const childOptions = Array.from(child.children);
                    const matchingOptions = childOptions.filter(opt => {
                        if (!query) return true;
                        return opt.text.toLowerCase().includes(query) || groupLabel.toLowerCase().includes(query);
                    });

                    if (matchingOptions.length > 0) {
                        const header = document.createElement('div');
                        header.className = 'custom-select-group-header';
                        header.textContent = groupLabel;
                        optionsContainer.appendChild(header);

                        matchingOptions.forEach(opt => {
                            totalMatchCount++;
                            const optDiv = createOptionElement(opt);
                            optionsContainer.appendChild(optDiv);
                        });
                    }
                } else if (child.tagName === 'OPTION') {
                    if (!query || child.text.toLowerCase().includes(query)) {
                        totalMatchCount++;
                        const optDiv = createOptionElement(child);
                        optionsContainer.appendChild(optDiv);
                    }
                }
            });

            if (totalMatchCount === 0) {
                const noResult = document.createElement('div');
                noResult.className = 'custom-select-no-results';
                noResult.textContent = 'No matching cities found';
                optionsContainer.appendChild(noResult);
            }
        }

        function createOptionElement(opt) {
            const optDiv = document.createElement('div');
            optDiv.className = 'custom-select-option';
            if (select.value === opt.value) {
                optDiv.classList.add('selected');
            }
            optDiv.textContent = opt.text;
            optDiv.dataset.value = opt.value;

            optDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                selectOption(opt.value, opt.text);
            });

            return optDiv;
        }

        function selectOption(val, text) {
            select.value = val;
            labelSpan.textContent = text;
            closeDropdown();
            // Dispatch change event to trigger existing app logic
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }

        function updateDisplayFromSelect() {
            const selectedOpt = select.options[select.selectedIndex];
            labelSpan.textContent = selectedOpt ? selectedOpt.text : '-- Select Location --';
            optionsContainer.querySelectorAll('.custom-select-option').forEach(el => {
                if (el.dataset.value === select.value) {
                    el.classList.add('selected');
                } else {
                    el.classList.remove('selected');
                }
            });
        }

        function openDropdown() {
            // Close any other open dropdowns first
            document.querySelectorAll('.custom-select-wrapper.open').forEach(w => {
                if (w !== wrapper) {
                    w.classList.remove('open');
                    w.querySelector('.custom-select-trigger')?.setAttribute('aria-expanded', 'false');
                }
            });

            wrapper.classList.add('open');
            trigger.setAttribute('aria-expanded', 'true');
            searchInput.value = '';
            rebuildOptions();
            setTimeout(() => searchInput.focus(), 50);
        }

        function closeDropdown() {
            wrapper.classList.remove('open');
            trigger.setAttribute('aria-expanded', 'false');
        }

        function toggleDropdown(e) {
            e.stopPropagation();
            if (wrapper.classList.contains('open')) {
                closeDropdown();
            } else {
                openDropdown();
            }
        }

        trigger.addEventListener('click', toggleDropdown);

        trigger.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                e.preventDefault();
                openDropdown();
            }
        });

        searchInput.addEventListener('input', () => {
            rebuildOptions();
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeDropdown();
                trigger.focus();
            } else if (e.key === 'Enter') {
                const firstOption = optionsContainer.querySelector('.custom-select-option');
                if (firstOption) {
                    selectOption(firstOption.dataset.value, firstOption.textContent);
                }
            }
        });

        // Global click to dismiss
        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) {
                closeDropdown();
            }
        });

        // Hook value property setter on select so programmatic changes update the UI
        try {
            const originalValueDescriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
            Object.defineProperty(select, 'value', {
                get() {
                    return originalValueDescriptor.get.call(this);
                },
                set(val) {
                    originalValueDescriptor.set.call(this, val);
                    updateDisplayFromSelect();
                },
                configurable: true
            });
        } catch (e) {
            console.warn('Could not override select value property:', e);
        }

        // Observer for mutations (when options are loaded or modified asynchronously)
        const observer = new MutationObserver(() => {
            rebuildOptions();
            updateDisplayFromSelect();
        });
        observer.observe(select, { childList: true, subtree: true, attributes: true });

        // Initial build
        rebuildOptions();
        updateDisplayFromSelect();
    }

    window.initCustomCityDropdowns = function() {
        setupCustomSelect('originSelect');
        setupCustomSelect('destSelect');
    };

    // Auto-init when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', window.initCustomCityDropdowns);
    } else {
        setTimeout(window.initCustomCityDropdowns, 100);
    }
})();
