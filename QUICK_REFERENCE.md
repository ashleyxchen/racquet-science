# Claude Code Agents - Quick Reference

## Setup Checklist

```bash
# 1. Copy files to your project
cp -r .claude/ /path/to/your/project/
cp CLAUDE.md /path/to/your/project/

# 2. Navigate to your project
cd /path/to/your/project

# 3. Start Claude Code
claude

# 4. Verify agents loaded
/agents
```

## Using Agents

### View Available Agents
```
/agents
```

### Explicit Invocation
```
Use the capacitor-react agent to implement BLE scanning

Use the arduino agent to add a battery level characteristic

Use the watchos agent to implement heart rate monitoring

Use the backend agent to create the sync endpoint

Use the architect agent to review the data flow design
```

### Automatic Delegation
Just describe what you need - Claude will pick the right agent:
```
Add accelerometer data to the Arduino BLE packets
```

### Chain Multiple Agents
```
First use the architect agent to design the recording schema,
then have the backend agent implement the database models,
and finally have the capacitor-react agent create the local storage service
```

## Agent Teams (Parallel Work)

### Enable First
Already enabled in `.claude/settings.json`, or:
```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

### Create a Team
```
Create an agent team for the BLE feature:
- One teammate for Arduino firmware (BLE service + IMU)
- One teammate for Capacitor BLE integration
- You coordinate and ensure compatibility
```

### Control Team
- `Shift+Up/Down` - Select teammate
- `Enter` - View teammate session
- `Escape` - Interrupt

## Your Agents

| Agent | Use For |
|-------|---------|
| `capacitor-react` | React, Capacitor, BLE plugin, UI |
| `watchos` | Swift, watchOS, Watch Connectivity |
| `arduino` | Arduino firmware, BLE peripheral |
| `backend` | FastAPI, database, REST API |
| `architect` | Data schema, sync protocol, integration |

## Common Workflows

### New Feature
```
1. "Use architect agent to design [feature] data flow"
2. "Create agent team to implement [feature]"
3. "Help me test the integration"
```

### Bug Fix
```
"Use the [component] agent to debug [issue]"
```

### Code Review
```
"Use the architect agent to review my changes for consistency"
```

## Tips

1. **Update CLAUDE.md** when you make decisions
2. **Be specific** with context when invoking agents
3. **Start with subagents** before trying agent teams
4. **Check `/agents`** to see what's available

## File Locations

```
your-project/
├── .claude/
│   ├── agents/           # Agent definitions
│   │   ├── capacitor-react.md
│   │   ├── watchos.md
│   │   ├── arduino.md
│   │   ├── backend.md
│   │   └── architect.md
│   └── settings.json     # Settings + env vars
└── CLAUDE.md             # Project context
```
