# Firecrawl: Fireworks AI Credits Monitor for VSCode

A VSCode extension that displays Fireworks AI credits in real-time on the Status Bar.

## Requirements

- Python must be available (`python` on Windows, `python3` on macOS/Linux)
- `firectl` CLI must be installed and registered in your `PATH`
- Authentication must be completed via `firectl signin`

## Features

- Displays current Fireworks AI credit balance on the right side of the Status Bar
- Auto-refresh every 60 seconds
- Manual refresh by clicking the Status Bar item
- Opens a terminal to run `firectl signin` when not authenticated
- Warning colors and popup notifications when credits fall below $5

## Configuration

Extension settings are managed via the `firecrawl.yml` file.

```yaml
# firecrawl.yml
refresh_interval_seconds: 60        # Status Bar refresh interval (seconds)
low_credit_warning_threshold: 5.0   # Threshold for popup warning (USD)
low_credit_color_threshold: 20.0    # Threshold for warning color on Status Bar (USD)
```

| Setting | Default | Description |
|---------|---------|-------------|
| `refresh_interval_seconds` | `60` | How often to refresh the credit display (seconds) |
| `low_credit_warning_threshold` | `5.0` | Triggers a popup notification when credits fall below this value |
| `low_credit_color_threshold` | `20.0` | Changes Status Bar color when credits fall below this value |

## Development

```bash
npm install
npm run compile
# Press F5 to launch the Extension Host for debugging
```

## Build

```bash
npm run compile
# or
npm run watch  # Auto-compile on file changes
```
