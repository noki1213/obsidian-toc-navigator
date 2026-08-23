const { Plugin, SuggestModal, MarkdownView } = require('obsidian');

module.exports = class TOCNavigator extends Plugin {
	async onload() {
		// Add the command, which the user can bind to a hotkey
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

// The modal that shows the table of contents
class TOCModal extends SuggestModal {
	constructor(app, view) {
		super(app);
		this.view = view;
		this.setPlaceholder("見出しを検索・選択してください");
		
		// Create the area that holds the breadcrumbs
		this.breadcrumbEl = createDiv({ cls: "toc-breadcrumb" });
	}

	// Runs when the modal opens
	onOpen() {
		super.onOpen();

		// Tag the modal with its own class so CSS can control the height
		const modalEl = this.contentEl.closest('.modal');
		if (modalEl) {
			modalEl.addClass("toc-navigator-modal");
		}
		
		// Find the container holding the search box and insert the breadcrumbs right after it
		const inputContainer = this.inputEl.parentElement;
		if (inputContainer) {
			inputContainer.insertAdjacentElement('afterend', this.breadcrumbEl);
		}
		
		// Wait a tick for the view to lay out, then focus the current heading
		requestAnimationFrame(() => {
			const suggestions = this.getSuggestions("");
			const currentIndex = suggestions.findIndex(s => s.isCurrent);
			
			if (currentIndex !== -1 && this.chooser) {
				this.chooser.setSelectedItem(currentIndex);
				this.updateBreadcrumb(suggestions[currentIndex]);
			}
		});

		// Keep the breadcrumbs in sync with the selection
		const self = this;
		const originalSetSelectedItem = this.chooser.setSelectedItem;
		this.chooser.setSelectedItem = function(index, evt) {
			// Bail out if the index runs off either end of the list
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

	// Redraw the breadcrumbs
	updateBreadcrumb(selectedItem) {
		const cache = this.app.metadataCache.getFileCache(this.view.file);
		if (!cache || !cache.headings) return;

		const allHeadings = cache.headings;
		const breadcrumbs = [];
		
		// Walk up the parents of the selected heading
		let currentLevel = selectedItem.level;
		const selectedIndex = allHeadings.findIndex(h => h.position.start.offset === selectedItem.position.start.offset);
		
		for (let i = selectedIndex; i >= 0; i--) {
			if (allHeadings[i].level < currentLevel) {
				breadcrumbs.unshift(allHeadings[i].heading);
				currentLevel = allHeadings[i].level;
			}
			if (currentLevel === 1) break;
		}

		// For an H1 the trail is empty, so keep the area visible and show only the separator
		this.breadcrumbEl.setText(breadcrumbs.join(" 〉 ") + (breadcrumbs.length > 0 ? " 〉" : " 〉"));
		this.breadcrumbEl.style.display = "block";
	}

	// Build the list of headings to show
	getSuggestions(query) {
		const cache = this.app.metadataCache.getFileCache(this.view.file);
		if (!cache || !cache.headings) return [];

		const headings = cache.headings;
		const cursorLine = this.view.editor.getCursor().line;

		// Pick the single heading that sits just before the cursor
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

	// Render one row of the list
	renderSuggestion(item, el) {
		const container = el.createDiv({ cls: "toc-nav-item" });
		
		// Indent according to the heading level
		container.style.paddingLeft = `${(item.level - 1) * 20}px`;
		
		// Show the heading level (H1, H2, ...)
		container.createSpan({ text: `H${item.level} `, cls: "toc-level-prefix" });
		
		// Show the heading text
		container.createSpan({ text: item.heading });
		
		// Mark the row the cursor is currently in
		if (item.isCurrent) {
			container.addClass("is-current-heading");
		}
	}

	// Jump to the heading that was chosen
	onChooseSuggestion(item, evt) {
		this.view.editor.setCursor(item.position.start.line, 0);
		this.view.editor.scrollIntoView({
			from: { line: item.position.start.line, ch: 0 },
			to: { line: item.position.start.line, ch: 0 }
		}, true);
	}
}
