// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { execSync } from 'child_process';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('RPM Spec Auto Changelog is now active, use the command "RPM Spec: Generate Changelog" to generate a changelog!');

	const disposable = vscode.commands.registerCommand('rpm-spec-auto-changelog.generateChangelog', () => {
		// We need to get the active text editor
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active text editor found!');
			return;
		}
		/* We need to get the text from the active text editor
		 * Specifically, we only need these text lines from the SPEC file:
		 * - Version
		 * - Release
		 *
		 * We also need to get the current date in this format: Mon Mar 10 2025
		 * And current git user name and email
		 */
		const text = editor.document.getText();
		const lines = text.split('\n');

		// Collect macro definitions
		const macros: Record<string, string> = {};
		for (const line of lines) {
			const m = line.match(/^%(?:global|define)\s+(\w+)\s+(.*)$/);
			if (m) {
				const [, name, val] = m;
				macros[name] = val.trim();
			}
		}

		// Recursively expand macros
		function expandMacros(str: string): string {
			return str.replace(/%\{([^}]+)\}/g, (_, name) => {
				const val = macros[name];
				return val !== undefined ? expandMacros(val) : _;
			});
		}

		// Find and expand Version/Release/Epoch
		let versionTemplate = '';
		let releaseTemplate = '';
		let epochTemplate = '';
		for (const line of lines) {
			if (line.startsWith('Version:')) {
				versionTemplate = line.split(':')[1].trim();
			}
			if (line.startsWith('Release:')) {
				releaseTemplate = line.split(':')[1].trim();
			}
			if (line.startsWith('Epoch:')) {
				epochTemplate = line.split(':')[1].trim();
			}
		}

		const version = versionTemplate ? expandMacros(versionTemplate) : '';
		const release = releaseTemplate ? expandMacros(releaseTemplate) : '';
		const epoch = epochTemplate ? expandMacros(epochTemplate) : '';

		if (!version || !release) {
			vscode.window.showErrorMessage('Version or Release not found in the SPEC file!');
			return;
		}

		// Build changelog entry with optional epoch
		const epochPrefix = epoch ? `${epoch}:` : '';
		// Get the current date
		const currentDate = new Date().toDateString();
		// Get the current git user name and email
		let gitUserName: string;
		let gitUserEmail: string;
		try {
			gitUserName = execSync('git config --get user.name', { encoding: 'utf8' }).trim();
			gitUserEmail = execSync('git config --get user.email', { encoding: 'utf8' }).trim();
		} catch (error) {
			vscode.window.showErrorMessage('Failed to retrieve git user configuration.');
			return;
		}
		// Generate the changelog
		const changelog = `* ${currentDate} ${gitUserName} <${gitUserEmail}> - ${epochPrefix}${version}-${release}`;
		// Insert the changelog at the current cursor position with new line
		editor.edit((editBuilder) => {
			editBuilder.insert(editor.selection.active, changelog + '\n' + '- ');
		});
		// Show a message to the user
		vscode.window.showInformationMessage('Changelog generated!');
	});

	context.subscriptions.push(disposable);

	const bumpDisposable = vscode.commands.registerCommand('rpm-spec-auto-changelog.bumpReleaseNumber', () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active text editor found!');
			return;
		}

		const doc = editor.document;
		const text = doc.getText();
		const lines = text.split('\n');

		// Collect macro definitions
		const macros: Record<string, string> = {};
		for (const line of lines) {
			const m = line.match(/^%(?:global|define)\s+(\w+)\s+(.*)$/);
			if (m) {
				const [, name, val] = m;
				macros[name] = val.trim();
			}
		}

		// Recursively expand macros
		function expandMacros(str: string): string {
			return str.replace(/%\{([^}]+)\}/g, (_, name) => {
				const val = macros[name];
				return val !== undefined ? expandMacros(val) : _;
			});
		}

		// Find the Version: line
		let releaseLineIndex = -1;
		let releaseTemplate = '';
		for (let i = 0; i < lines.length; i++) {
			if (lines[i].startsWith('Release:')) {
				releaseLineIndex = i;
				releaseTemplate = lines[i].split(':')[1].trim();
				break;
			}
		}
		if (releaseLineIndex < 0) {
			vscode.window.showErrorMessage('Release not found in the SPEC file!');
			return;
		}

		// Expand and bump
		const expanded = expandMacros(releaseTemplate);
		const n = parseInt(expanded, 10);
		if (isNaN(n)) {
			vscode.window.showErrorMessage(`Cannot bump non-integer release "${expanded}"`);
			return;
		}
		const bumped = (n + 1).toString();

		// Replace the Version: line with bumped value
		const lineRange = doc.lineAt(releaseLineIndex).range;
		const newLine = `Release: ${bumped}`;
		editor.edit((editBuilder) => {
			editBuilder.replace(lineRange, newLine);
		});

		vscode.window.showInformationMessage(`Version bumped to ${bumped}`);
	});

	context.subscriptions.push(bumpDisposable);
}
