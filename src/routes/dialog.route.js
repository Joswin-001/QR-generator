'use strict';

const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');

const router = express.Router();

/**
 * Ensures the dialog comes to the foreground.
 * We include some C# code to find the window handle or use TopMost.
 * But FolderBrowserDialog doesn't have TopMost. We just rely on -STA and user expectation.
 */
function getPsPickerScript(type) {
    if (type === 'folder') {
        return `
Add-Type -AssemblyName System.Windows.Forms
$form = New-Object System.Windows.Forms.Form
$form.TopMost = $true
$form.ShowInTaskbar = $false
$form.WindowState = "Minimized"
$form.Show()

$dlg = New-Object System.Windows.Forms.FolderBrowserDialog
$dlg.Description = "Select a folder"
$dlg.ShowNewFolderButton = $true
$result = $dlg.ShowDialog($form)

if ($result -eq 'OK') {
    Write-Output $dlg.SelectedPath
}
$form.Dispose()
`;
    } else if (type === 'file') {
        return `
Add-Type -AssemblyName System.Windows.Forms
$form = New-Object System.Windows.Forms.Form
$form.TopMost = $true
$form.ShowInTaskbar = $false
$form.WindowState = "Minimized"
$form.Show()

$dlg = New-Object System.Windows.Forms.OpenFileDialog
$dlg.Title = "Select a JSON file"
$dlg.Filter = "JSON Files (*.json)|*.json|All Files (*.*)|*.*"
$result = $dlg.ShowDialog($form)

if ($result -eq 'OK') {
    Write-Output $dlg.FileName
}
$form.Dispose()
`;
    } else if (type === 'video') {
        return `
Add-Type -AssemblyName System.Windows.Forms
$form = New-Object System.Windows.Forms.Form
$form.TopMost = $true
$form.ShowInTaskbar = $false
$form.WindowState = "Minimized"
$form.Show()

$dlg = New-Object System.Windows.Forms.OpenFileDialog
$dlg.Title = "Select a Master Video"
$dlg.Filter = "Video Files (*.mp4;*.mkv;*.mov)|*.mp4;*.mkv;*.mov|All Files (*.*)|*.*"
$result = $dlg.ShowDialog($form)

if ($result -eq 'OK') {
    Write-Output $dlg.FileName
}
$form.Dispose()
`;
    }
    return '';
}

/**
 * GET /api/dialog/pick?type=file|folder|video
 */
router.get('/api/dialog/pick', (req, res) => {
    const { type } = req.query;

    const psScript = getPsPickerScript(type);
    if (!psScript) {
        return res.status(400).json({ error: 'Invalid type parameter. Use "file", "folder", or "video".' });
    }

    // Convert to UTF-16LE Base64 for PowerShell -EncodedCommand
    const buffer = Buffer.from(psScript, 'utf16le');
    const base64Script = buffer.toString('base64');

    const command = `powershell.exe -STA -NoProfile -EncodedCommand ${base64Script}`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error('[dialog.route] Error:', error);
            // It's possible the user just closed the dialog (which emits nothing and exits cleanly, 
            // but if there's a strict error we return 500)
            return res.status(500).json({ error: 'Failed to open dialog or dialog was cancelled.' });
        }

        const selectedPath = stdout.trim();
        res.json({ path: selectedPath });
    });
});

/**
 * POST /api/dialog/read-json
 * Reads a JSON file from an absolute path and returns its parsed structure.
 */
router.post('/api/dialog/read-json', express.json(), (req, res) => {
    const { filePath } = req.body;
    if (!filePath) return res.status(400).json({ error: 'Missing filePath.' });

    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        res.json(parsed);
    } catch (e) {
        res.status(500).json({ error: 'Could not read JSON file: ' + e.message });
    }
});

module.exports = router;
