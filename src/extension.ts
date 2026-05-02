import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

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
    const configPath = path.join(context.extensionPath, 'firecrawl.yml');
    try {
        if (fs.existsSync(configPath)) {
            const fileContents = fs.readFileSync(configPath, 'utf8');
            const parsed = yaml.load(fileContents) as Partial<Config>;
            return {
                refresh_interval_seconds: parsed.refresh_interval_seconds ?? DEFAULT_CONFIG.refresh_interval_seconds,
                low_credit_warning_threshold: parsed.low_credit_warning_threshold ?? DEFAULT_CONFIG.low_credit_warning_threshold,
                low_credit_color_threshold: parsed.low_credit_color_threshold ?? DEFAULT_CONFIG.low_credit_color_threshold,
            };
        }
    } catch (e) {
        console.error('[Firecrawl Credits] Failed to load firecrawl.yml:', e);
        vscode.window.showWarningMessage(
            'Failed to load firecrawl.yml. Using default settings.'
        );
    }
    return DEFAULT_CONFIG;
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
                console.error('[Firecrawl Credits] firectl error:', stderr || stdout);
                resolve(null);
                return;
            }
            try {
                const parsed: CreditsResult = JSON.parse(stdout.trim());
                resolve(parsed);
            } catch (e) {
                console.error('[Firecrawl Credits] JSON parse error:', e);
                resolve(null);
            }
        });

        setTimeout(() => {
            if (!proc.killed) {
                proc.kill();
                console.warn('[Firecrawl Credits] Timeout reached');
                resolve(null);
            }
        }, 15000);
    });
}

async function updateStatusBar(context: vscode.ExtensionContext, config: Config) {
    const data = await fetchCredits(context);

    if (!data) {
        statusBarItem.text = '$(error) Firecrawl: Error';
        statusBarItem.tooltip = 'Failed to fetch credits. Check firectl installation or network.';
        statusBarItem.command = 'firecrawlCredits.refresh';
        statusBarItem.color = '#FF6B6B';
        statusBarItem.show();
        return;
    }

    if (!data.auth) {
        statusBarItem.text = '$(account) Firecrawl: Sign In';
        statusBarItem.tooltip = 'Not authenticated. Click to run firectl signin.';
        statusBarItem.command = 'firecrawlCredits.signin';
        statusBarItem.color = '#FFD93D';
        statusBarItem.show();
        return;
    }

    if (data.error) {
        statusBarItem.text = '$(error) Firecrawl: Error';
        statusBarItem.tooltip = data.error;
        statusBarItem.command = 'firecrawlCredits.refresh';
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

    statusBarItem.text = `$(flame) Firecrawl: $${credits.toFixed(2)}`;
    statusBarItem.tooltip = 'Click to refresh credits now';
    statusBarItem.command = 'firecrawlCredits.refresh';
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
        'firecrawlCredits.refresh',
        () => updateStatusBar(context, config)
    );
    context.subscriptions.push(refreshCmd);

    const signinCmd = vscode.commands.registerCommand(
        'firecrawlCredits.signin',
        () => {
            const terminal = vscode.window.createTerminal('Firecrawl Signin');
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
                `Firecrawl credits are running low: $${data.credits.toFixed(2)}`,
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
