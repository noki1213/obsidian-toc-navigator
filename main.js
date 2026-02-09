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
		
		const textEl = container.createSpan({ text: item.heading });
		
		// Mark it if it's the current position
		if (item.isCurrent) {
			container.addClass("is-current-heading");
			container.createSpan({ text: " ●", cls: "current-marker" });
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
