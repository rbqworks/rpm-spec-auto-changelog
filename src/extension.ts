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
		let version = '';
		let release = '';

		// Get the version and release from the SPEC file
		for (let i = 0; i < lines.length; i++) {
			if (lines[i].startsWith('Version:')) {
				version = lines[i].split(':')[1].trim();
			}
			if (lines[i].startsWith('Release:')) {
				release = lines[i].split(':')[1].trim();
			}
		}
		if (!version || !release) {
			vscode.window.showErrorMessage('Version or Release not found in the SPEC file!');
			return;
		}
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
		const changelog = `* ${currentDate} ${gitUserName} <${gitUserEmail}> - ${version}-${release}`;
		// Insert the changelog at the current cursor position with new line
		editor.edit((editBuilder) => {
			editBuilder.insert(editor.selection.active, changelog + '\n' + '- ');
		});
		// Show a message to the user
		vscode.window.showInformationMessage('Changelog generated!');
	});

	context.subscriptions.push(disposable);
}
