const { Plugin, SuggestModal, MarkdownView } = require('obsidian');

module.exports = class TOCNavigator extends Plugin {
	async onload() {
		// Add a command (a feature that can be bound to a shortcut key)
		this.addCommand({
			id: 'open-toc-navigator',
			name: 'Open TOC Navigator',
			callback: () => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (view) {
					new TOCModal(this.app, view).open();
				}
			}
		});
	}
};

// Configuration for the screen (modal) that displays the table of contents
class TOCModal extends SuggestModal {
	constructor(app, view) {
		super(app);
		this.view = view;
		this.setPlaceholder("見出しを検索・選択してください");
		
		// Create the area for displaying the breadcrumb list
		this.breadcrumbEl = createDiv({ cls: "toc-breadcrumb" });
	}

	// Logic run when the modal opens
	onOpen() {
		super.onOpen();

		// Add a dedicated class to the modal itself so its height can be adjusted via CSS
		const modalEl = this.contentEl.closest('.modal');
		if (modalEl) {
			modalEl.addClass("toc-navigator-modal");
		}
		
		// Find the container holding the search box and insert the breadcrumb list right after it
		const inputContainer = this.inputEl.parentElement;
		if (inputContainer) {
			inputContainer.insertAdjacentElement('afterend', this.breadcrumbEl);
		}
		
		// Wait a moment for the screen to finish rendering, then focus the current position
		requestAnimationFrame(() => {
			const suggestions = this.getSuggestions("");
			const currentIndex = suggestions.findIndex(s => s.isCurrent);
			
			if (currentIndex !== -1 && this.chooser) {
				this.chooser.setSelectedItem(currentIndex);
				this.updateBreadcrumb(suggestions[currentIndex]);
			}
		});

		// Mechanism that updates the breadcrumb list when the selection changes
		const self = this;
		const originalSetSelectedItem = this.chooser.setSelectedItem;
		this.chooser.setSelectedItem = function(index, evt) {
			// Stop if the index is negative (above the top) or out of range (below the bottom)
			if (index < 0 || index >= self.getSuggestions(self.inputEl.value).length) {
				return;
			}
			originalSetSelectedItem.apply(this, [index, evt]);
			const suggestions = self.getSuggestions(self.inputEl.value);
			if (suggestions[index]) {
				self.updateBreadcrumb(suggestions[index]);
			}
		};
	}

	// Update the breadcrumb list
	updateBreadcrumb(selectedItem) {
		const cache = this.app.metadataCache.getFileCache(this.view.file);
		if (!cache || !cache.headings) return;

		const allHeadings = cache.headings;
		const breadcrumbs = [];
		
		// Trace the parent hierarchy of the selected heading
		let currentLevel = selectedItem.level;
		const selectedIndex = allHeadings.findIndex(h => h.position.start.offset === selectedItem.position.start.offset);
		
		for (let i = selectedIndex; i >= 0; i--) {
			if (allHeadings[i].level < currentLevel) {
				breadcrumbs.unshift(allHeadings[i].heading);
				currentLevel = allHeadings[i].level;
			}
			if (currentLevel === 1) break;
		}

		if (breadcrumbs.length > 0) {
			this.breadcrumbEl.setText(breadcrumbs.join(" 〉 ") + " 〉");
			this.breadcrumbEl.style.display = "block";
		} else {
			this.breadcrumbEl.style.display = "none";
		}
	}

	// Build the list to display (the heading list)
	getSuggestions(query) {
		const cache = this.app.metadataCache.getFileCache(this.view.file);
		if (!cache || !cache.headings) return [];

		const headings = cache.headings;
		const cursorLine = this.view.editor.getCursor().line;

		// Identify the single heading immediately before the cursor position
		let currentHeadingIndex = -1;
		for (let i = 0; i < headings.length; i++) {
			if (headings[i].position.start.line <= cursorLine) {
				currentHeadingIndex = i;
			} else {
				break;
			}
		}

		return headings.map((h, index) => {
			return {
				...h,
				isCurrent: index === currentHeadingIndex
			};
		}).filter(h => h.heading.toLowerCase().includes(query.toLowerCase()));
	}

	// Build the list's appearance
	renderSuggestion(item, el) {
		const container = el.createDiv({ cls: "toc-nav-item" });
		
		// Create indentation that matches the heading's level
		container.style.paddingLeft = `${(item.level - 1) * 20}px`;
		
		// Display the heading level (H1, H2, ...)
		container.createSpan({ text: `H${item.level} `, cls: "toc-level-prefix" });
		
		// Display the heading's text
		container.createSpan({ text: item.heading });
		
		// Mark it if it's the current position
		if (item.isCurrent) {
			container.addClass("is-current-heading");
		}
	}

	// Action on selection (jump to that location)
	onChooseSuggestion(item, evt) {
		this.view.editor.setCursor(item.position.start.line, 0);
		this.view.editor.scrollIntoView({
			from: { line: item.position.start.line, ch: 0 },
			to: { line: item.position.start.line, ch: 0 }
		}, true);
	}
}
