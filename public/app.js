/**
 * REFS - Recipe Extraction For Shorts
 * Frontend Application Logic
 */

// DOM Elements
const elements = {
    form: document.getElementById('extract-form'),
    urlInput: document.getElementById('video-url'),
    submitBtn: document.getElementById('submit-btn'),
    loadingSection: document.getElementById('loading-section'),
    errorSection: document.getElementById('error-section'),
    errorMessage: document.getElementById('error-message'),
    tryAgainBtn: document.getElementById('try-again-btn'),
    recipeSection: document.getElementById('recipe-section'),
    recipeTitle: document.getElementById('recipe-title'),
    recipeDescription: document.getElementById('recipe-description'),
    recipeMeta: document.getElementById('recipe-meta'),
    ingredientsList: document.getElementById('ingredients-list'),
    instructionsList: document.getElementById('instructions-list'),
    notesSection: document.getElementById('notes-section'),
    notesList: document.getElementById('notes-list'),
    copyBtn: document.getElementById('copy-btn'),
    newRecipeBtn: document.getElementById('new-recipe-btn'),
    recentSection: document.getElementById('recent-section'),
    recentRecipes: document.getElementById('recent-recipes')
};

// Current recipe data (for copy functionality)
let currentRecipe = null;
let currentUrl = null;

/**
 * Initialize event listeners
 */
function init() {
    elements.form.addEventListener('submit', handleSubmit);
    elements.tryAgainBtn.addEventListener('click', resetToInput);
    elements.newRecipeBtn.addEventListener('click', resetToInput);
    elements.copyBtn.addEventListener('click', copyRecipe);

    // Load recent recipes on page load
    loadRecentRecipes();
}

/**
 * Handle form submission
 * @param {Event} event 
 */
async function handleSubmit(event) {
    event.preventDefault();

    const url = elements.urlInput.value.trim();

    if (!url) {
        showError('Please enter a video URL');
        return;
    }

    // Show loading state
    showLoading();

    try {
        const response = await fetch('/api/extract', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to extract recipe');
        }

        currentRecipe = data.recipe;
        currentUrl = data.url || url;
        displayRecipe(data.recipe);

        // Refresh recent recipes in background
        loadRecentRecipes();

    } catch (error) {
        console.error('Error:', error);
        showError(error.message);
    }
}

/**
 * Display the extracted recipe
 * @param {Object} recipe 
 */
function displayRecipe(recipe) {
    // Hide other sections
    hideAllSections();

    // Set title and description
    elements.recipeTitle.textContent = recipe.title || 'Untitled Recipe';
    elements.recipeDescription.textContent = recipe.description || '';

    // Build meta information
    elements.recipeMeta.innerHTML = '';
    const metaItems = [
        { icon: '⏱️', value: recipe.prepTime, label: 'Prep' },
        { icon: '🍳', value: recipe.cookTime, label: 'Cook' },
        { icon: '⏰', value: recipe.totalTime, label: 'Total' },
        { icon: '🍽️', value: recipe.servings, label: 'Servings' },
        { icon: '📊', value: recipe.difficulty, label: '' }
    ];

    metaItems.forEach(item => {
        if (item.value) {
            const metaEl = document.createElement('div');
            metaEl.className = 'meta-item';
            metaEl.innerHTML = `<span>${item.icon}</span> ${item.label ? item.label + ': ' : ''}${item.value}`;
            elements.recipeMeta.appendChild(metaEl);
        }
    });

    // Build ingredients list
    elements.ingredientsList.innerHTML = '';
    if (recipe.ingredients && recipe.ingredients.length > 0) {
        recipe.ingredients.forEach(ingredient => {
            const li = document.createElement('li');

            // Format amount and unit
            let amountText = '';
            if (ingredient.amount) {
                amountText = ingredient.amount;
                if (ingredient.unit) {
                    amountText += ' ' + ingredient.unit;
                }
            }

            li.innerHTML = `
                <span class="ingredient-amount">${amountText}</span>
                <span class="ingredient-name">${ingredient.item || ingredient.name || ''}</span>
                ${ingredient.notes ? `<span class="ingredient-notes">(${ingredient.notes})</span>` : ''}
            `;

            elements.ingredientsList.appendChild(li);
        });
    }

    // Build instructions list
    elements.instructionsList.innerHTML = '';
    if (recipe.instructions && recipe.instructions.length > 0) {
        recipe.instructions.forEach(instruction => {
            const li = document.createElement('li');
            const text = typeof instruction === 'string' ? instruction : instruction.instruction;
            const tip = typeof instruction === 'object' ? instruction.tip : null;

            li.innerHTML = `
                <div class="instruction-content">
                    <p class="instruction-text">${text}</p>
                    ${tip ? `<p class="instruction-tip">💡 ${tip}</p>` : ''}
                </div>
            `;

            elements.instructionsList.appendChild(li);
        });
    }

    // Build notes list
    if (recipe.notes && recipe.notes.length > 0) {
        elements.notesList.innerHTML = '';
        recipe.notes.forEach(note => {
            const li = document.createElement('li');
            li.innerHTML = `<span>💡</span> ${note}`;
            elements.notesList.appendChild(li);
        });
        elements.notesSection.classList.remove('hidden');
    } else {
        elements.notesSection.classList.add('hidden');
    }

    // Show recipe section
    elements.recipeSection.classList.remove('hidden');

    // Scroll to recipe
    elements.recipeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Copy recipe to clipboard as formatted text
 */
async function copyRecipe() {
    if (!currentRecipe) return;

    let text = `${currentRecipe.title}\n`;
    text += '='.repeat(currentRecipe.title.length) + '\n\n';

    if (currentRecipe.description) {
        text += `${currentRecipe.description}\n\n`;
    }

    // Meta info
    const metaInfo = [];
    if (currentRecipe.prepTime) metaInfo.push(`Prep: ${currentRecipe.prepTime}`);
    if (currentRecipe.cookTime) metaInfo.push(`Cook: ${currentRecipe.cookTime}`);
    if (currentRecipe.totalTime) metaInfo.push(`Total: ${currentRecipe.totalTime}`);
    if (currentRecipe.servings) metaInfo.push(`Servings: ${currentRecipe.servings}`);
    if (metaInfo.length > 0) {
        text += metaInfo.join(' | ') + '\n\n';
    }

    // Ingredients
    text += 'INGREDIENTS\n';
    text += '-'.repeat(11) + '\n';
    if (currentRecipe.ingredients) {
        currentRecipe.ingredients.forEach(ing => {
            let line = '';
            if (ing.amount) {
                line += ing.amount;
                if (ing.unit) line += ' ' + ing.unit;
                line += ' ';
            }
            line += ing.item || ing.name || '';
            if (ing.notes) line += ` (${ing.notes})`;
            text += `• ${line}\n`;
        });
    }
    text += '\n';

    // Instructions
    text += 'INSTRUCTIONS\n';
    text += '-'.repeat(12) + '\n';
    if (currentRecipe.instructions) {
        currentRecipe.instructions.forEach((inst, index) => {
            const instruction = typeof inst === 'string' ? inst : inst.instruction;
            text += `${index + 1}. ${instruction}\n`;
            if (typeof inst === 'object' && inst.tip) {
                text += `   Tip: ${inst.tip}\n`;
            }
        });
    }

    // Notes
    if (currentRecipe.notes && currentRecipe.notes.length > 0) {
        text += '\nNOTES\n';
        text += '-'.repeat(5) + '\n';
        currentRecipe.notes.forEach(note => {
            text += `• ${note}\n`;
        });
    }

    try {
        await navigator.clipboard.writeText(text);

        // Visual feedback
        const originalText = elements.copyBtn.innerHTML;
        elements.copyBtn.innerHTML = '<span>✓</span> Copied!';
        elements.copyBtn.style.borderColor = 'var(--success)';

        setTimeout(() => {
            elements.copyBtn.innerHTML = originalText;
            elements.copyBtn.style.borderColor = '';
        }, 2000);

    } catch (err) {
        console.error('Failed to copy:', err);
    }
}

/**
 * Show loading state
 */
function showLoading() {
    hideAllSections();
    elements.submitBtn.disabled = true;
    elements.loadingSection.classList.remove('hidden');
}

/**
 * Show error state
 * @param {string} message 
 */
function showError(message) {
    hideAllSections();
    elements.submitBtn.disabled = false;
    elements.errorMessage.textContent = message;
    elements.errorSection.classList.remove('hidden');
}

/**
 * Hide all result sections
 */
function hideAllSections() {
    elements.loadingSection.classList.add('hidden');
    elements.errorSection.classList.add('hidden');
    elements.recipeSection.classList.add('hidden');
}

/**
 * Reset to initial input state
 */
function resetToInput() {
    hideAllSections();
    elements.submitBtn.disabled = false;
    elements.urlInput.value = '';
    elements.urlInput.focus();
    currentRecipe = null;
    currentUrl = null;

    // Reload recent recipes and show section
    loadRecentRecipes();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Load and display recent recipes from the server
 */
async function loadRecentRecipes() {
    try {
        const response = await fetch('/api/recent');
        const data = await response.json();

        if (data.success && data.recipes && data.recipes.length > 0) {
            displayRecentRecipes(data.recipes);
            elements.recentSection.classList.remove('hidden');
        } else {
            elements.recentSection.classList.add('hidden');
        }
    } catch (error) {
        console.error('Failed to load recent recipes:', error);
        elements.recentSection.classList.add('hidden');
    }
}

/**
 * Display recent recipes in the grid
 * @param {Array} recipes 
 */
function displayRecentRecipes(recipes) {
    elements.recentRecipes.innerHTML = '';

    recipes.forEach(entry => {
        const item = document.createElement('div');
        item.className = 'recent-recipe-item';

        item.innerHTML = `
            <div class="recent-recipe-info">
                <h4 class="recent-recipe-title">${entry.title}</h4>
                <p class="recent-recipe-desc">${entry.description || 'No description available'}</p>
            </div>
            <div class="recent-recipe-actions">
                <button class="recent-btn recent-btn-view" data-recipe-id="${entry.id}">
                    📖 View Recipe
                </button>
                <a href="${entry.url}" target="_blank" rel="noopener" class="recent-btn recent-btn-watch">
                    ▶️ Watch Short
                </a>
                <button class="recent-btn recent-btn-extract" data-url="${entry.url}">
                    🔄 Extract Again
                </button>
            </div>
        `;

        // Add event listeners
        const viewBtn = item.querySelector('.recent-btn-view');
        const extractBtn = item.querySelector('.recent-btn-extract');

        viewBtn.addEventListener('click', () => {
            currentRecipe = entry.recipe;
            currentUrl = entry.url;
            displayRecipe(entry.recipe);
        });

        extractBtn.addEventListener('click', () => {
            elements.urlInput.value = entry.url;
            elements.urlInput.focus();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        elements.recentRecipes.appendChild(item);
    });
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', init);

