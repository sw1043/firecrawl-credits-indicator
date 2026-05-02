import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

let statusBarItem: vscode.StatusBarItem;
let intervalId: NodeJS.Timeout | undefined;

interface CreditsResult {
    auth: boolean;
    credits: number | null;
    error?: string;
}

interface Config {
    refresh_interval_seconds: number;
    low_credit_warning_threshold: number;
    low_credit_color_threshold: number;
}

const DEFAULT_CONFIG: Config = {
    refresh_interval_seconds: 60,
    low_credit_warning_threshold: 5.0,
    low_credit_color_threshold: 20.0,
};

function loadConfig(context: vscode.ExtensionContext): Config {
    const configPath = path.join(context.extensionPath, 'fw-indicator.yml');
    try {
        if (fs.existsSync(configPath)) {
            const fileContents = fs.readFileSync(configPath, 'utf8');
            const parsed = parseSimpleYaml(fileContents);
            return {
                refresh_interval_seconds: parseNumeric(parsed['refresh_interval_seconds']) ?? DEFAULT_CONFIG.refresh_interval_seconds,
                low_credit_warning_threshold: parseNumeric(parsed['low_credit_warning_threshold']) ?? DEFAULT_CONFIG.low_credit_warning_threshold,
                low_credit_color_threshold: parseNumeric(parsed['low_credit_color_threshold']) ?? DEFAULT_CONFIG.low_credit_color_threshold,
            };
        }
    } catch (e) {
        console.error('[Fireworks Credits] Failed to load fw-indicator.yml:', e);
        vscode.window.showWarningMessage(
            'Failed to load fw-indicator.yml. Using default settings.'
        );
    }
    return DEFAULT_CONFIG;
}

function parseSimpleYaml(content: string): Record<string, string | number> {
    const result: Record<string, string | number> = {};
    for (const rawLine of content.split('\n')) {
        const line = rawLine.split('#')[0].trim();
        if (!line) { continue; }
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) { continue; }
        const key = line.substring(0, colonIndex).trim();
        const rawValue = line.substring(colonIndex + 1).trim();
        // Try number first, fallback to string
        const num = parseFloat(rawValue);
        result[key] = isNaN(num) ? rawValue : num;
    }
    return result;
}

function parseNumeric(value: string | number | undefined): number | undefined {
    if (value === undefined) { return undefined; }
    if (typeof value === 'number') { return value; }
    const num = parseFloat(value);
    return isNaN(num) ? undefined : num;
}

function getPythonCommand(): string {
    return process.platform === 'win32' ? 'python' : 'python3';
}

function fetchCredits(context: vscode.ExtensionContext): Promise<CreditsResult | null> {
    return new Promise((resolve) => {
        const scriptPath = path.join(context.extensionPath, 'main.py');
        const pythonCmd = getPythonCommand();

        const proc = spawn(pythonCmd, [scriptPath], { shell: true });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data: Buffer) => {
            stdout += data.toString();
        });

        proc.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
        });

        proc.on('close', (code: number | null) => {
            if (code !== 0 || !stdout.trim()) {
                console.error('[Fireworks Credits] firectl error:', stderr || stdout);
                resolve(null);
                return;
            }
            try {
                const parsed: CreditsResult = JSON.parse(stdout.trim());
                resolve(parsed);
            } catch (e) {
                console.error('[Fireworks Credits] JSON parse error:', e);
                resolve(null);
            }
        });

        setTimeout(() => {
            if (!proc.killed) {
                proc.kill();
                console.warn('[Fireworks Credits] Timeout reached');
                resolve(null);
            }
        }, 15000);
    });
}

async function updateStatusBar(context: vscode.ExtensionContext, config: Config) {
    const data = await fetchCredits(context);

    if (!data) {
        statusBarItem.text = '$(error) Fireworks: Error';
        statusBarItem.tooltip = 'Failed to fetch credits. Check firectl installation or network.';
        statusBarItem.command = 'fireworksCredits.refresh';
        statusBarItem.color = '#FF6B6B';
        statusBarItem.show();
        return;
    }

    if (!data.auth) {
        statusBarItem.text = '$(account) Fireworks: Sign In';
        statusBarItem.tooltip = 'Not authenticated. Click to run firectl signin.';
        statusBarItem.command = 'fireworksCredits.signin';
        statusBarItem.color = '#FFD93D';
        statusBarItem.show();
        return;
    }

    if (data.error) {
        statusBarItem.text = '$(error) Fireworks: Error';
        statusBarItem.tooltip = data.error;
        statusBarItem.command = 'fireworksCredits.refresh';
        statusBarItem.color = '#FF6B6B';
        statusBarItem.show();
        return;
    }

    const credits = data.credits ?? 0;
    const { low_credit_warning_threshold, low_credit_color_threshold } = config;

    if (credits < low_credit_warning_threshold) {
        statusBarItem.color = '#FF6B6B';
    } else if (credits < low_credit_color_threshold) {
        statusBarItem.color = '#FFD93D';
    } else {
        statusBarItem.color = undefined;
    }

    statusBarItem.text = `$(flame) Fireworks: $${credits.toFixed(2)}`;
    statusBarItem.tooltip = 'Click to refresh credits now';
    statusBarItem.command = 'fireworksCredits.refresh';
    statusBarItem.show();
}

export function activate(context: vscode.ExtensionContext) {
    const config = loadConfig(context);

    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    context.subscriptions.push(statusBarItem);

    const refreshCmd = vscode.commands.registerCommand(
        'fireworksCredits.refresh',
        () => updateStatusBar(context, config)
    );
    context.subscriptions.push(refreshCmd);

    const signinCmd = vscode.commands.registerCommand(
        'fireworksCredits.signin',
        () => {
            const terminal = vscode.window.createTerminal('Fireworks Signin');
            terminal.sendText('firectl signin');
            terminal.show();
        }
    );
    context.subscriptions.push(signinCmd);

    const checkLowCredits = async () => {
        const data = await fetchCredits(context);
        if (
            data &&
            data.auth &&
            data.credits !== null &&
            data.credits < config.low_credit_warning_threshold
        ) {
            vscode.window.showWarningMessage(
                `Fireworks credits are running low: $${data.credits.toFixed(2)}`,
                'Refresh',
                'Dismiss'
            ).then(selection => {
                if (selection === 'Refresh') {
                    updateStatusBar(context, config);
                }
            });
        }
    };

    updateStatusBar(context, config);

    intervalId = setInterval(
        () => updateStatusBar(context, config),
        config.refresh_interval_seconds * 1000
    );

    const lowCreditInterval = setInterval(checkLowCredits, 300000);
    context.subscriptions.push({
        dispose: () => clearInterval(lowCreditInterval)
    } as vscode.Disposable);
}

export function deactivate() {
    if (intervalId) {
        clearInterval(intervalId);
    }
}
