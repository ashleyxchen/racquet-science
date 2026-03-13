# Claude Code Multi-Agent Setup Guide

## Your Project: Sensor Recording App

A Capacitor-based app that records and displays IMU/sensor data from:
- **Apple Watch** (via Watch Connectivity)
- **Arduino Uno** (via BLE using `@capacitor-community/bluetooth-le`)

With a **FastAPI backend** for data persistence and sync.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Structure](#project-structure)
3. [Setting Up Agents (Subagents)](#setting-up-agents-subagents)
4. [Setting Up Agent Teams (Experimental)](#setting-up-agent-teams-experimental)
5. [The CLAUDE.md File](#the-claudemd-file)
6. [How to Use Your Agents](#how-to-use-your-agents)
7. [Workflow Recommendations](#workflow-recommendations)

---

## Prerequisites

### 1. Install Claude Code

```bash
# macOS/Linux
npm install -g @anthropic-ai/claude-code

# Or with Homebrew (macOS)
brew install claude-code

# Windows
winget install Anthropic.ClaudeCode
```

### 2. Authenticate

```bash
claude
# Follow prompts to log in with your Claude account
```

### 3. Verify Installation

```bash
claude --version
```

---

## Project Structure

Your project should look something like this:

```
your-project/
├── .claude/                      # Claude Code configuration
│   ├── agents/                   # Your custom agents live here
│   │   ├── capacitor-react.md
│   │   ├── watchos.md
│   │   ├── arduino.md
│   │   ├── backend.md
│   │   └── architect.md
│   └── settings.json             # Project-specific settings
├── CLAUDE.md                     # Project context for Claude
├── src/                          # Your Capacitor/React app
├── ios/                          # Native iOS project
├── backend/                      # FastAPI backend
├── arduino/                      # Arduino firmware
└── watchos/                      # watchOS app (if separate)
```

---

## Setting Up Agents (Subagents)

Subagents are specialized AI assistants that Claude can delegate tasks to. Each runs in its own context window with custom instructions.

### Step 1: Create the agents directory

```bash
cd your-project
mkdir -p .claude/agents
```

### Step 2: Create agent files

Copy each of the agent files from this package into `.claude/agents/`:

- `capacitor-react.md` - Handles React/Capacitor/BLE code
- `watchos.md` - Handles Swift/watchOS code
- `arduino.md` - Handles Arduino firmware
- `backend.md` - Handles FastAPI backend
- `architect.md` - Handles cross-cutting concerns and data flow

### Step 3: Verify agents are loaded

```bash
claude
# Then type:
/agents
```

You should see your custom agents listed alongside the built-in ones.

---

## Setting Up Agent Teams (Experimental)

Agent Teams allow multiple Claude instances to work **in parallel** on different parts of your project. This is more advanced and uses more tokens, but powerful for complex tasks.

### Enable Agent Teams

**Option A: Environment Variable**

```bash
# Add to your shell profile (.bashrc, .zshrc, etc.)
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

**Option B: Settings File**

Create or edit `.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

### Using Agent Teams

Once enabled, you can ask Claude to create a team:

```
Create an agent team to work on the BLE connection feature:
- One teammate for the React/Capacitor BLE integration
- One teammate for the Arduino firmware BLE service
- You coordinate and ensure they're compatible
```

Claude will spawn separate sessions that communicate with each other.

---

## The CLAUDE.md File

The `CLAUDE.md` file in your project root gives Claude essential context about your project. This is loaded automatically every session.

Create `CLAUDE.md` in your project root with the content from the provided template.

### Key Sections to Include:

1. **Project Overview** - What you're building
2. **Architecture** - How components connect
3. **Tech Stack** - Specific versions and libraries
4. **Code Conventions** - Your preferences
5. **Current Status** - What's done, what's in progress

---

## How to Use Your Agents

### Automatic Delegation

Claude will automatically use agents when appropriate based on their descriptions. Just ask naturally:

```
"Add a new BLE characteristic to send accelerometer data from the Arduino"
```

Claude may invoke the `arduino` agent automatically.

### Explicit Invocation

You can explicitly request an agent:

```
"Use the watchos agent to implement heart rate monitoring on the Watch"

"Have the architect agent review the data flow between Watch and Arduino"

"Ask the backend agent to create an endpoint for syncing sensor data"
```

### Chaining Agents

For complex tasks, chain multiple agents:

```
"First use the architect agent to design the data schema for IMU readings, 
then have the backend agent implement the FastAPI endpoints, 
and finally have the capacitor-react agent create the sync service"
```

---

## Workflow Recommendations

### For New Features

1. **Start with the Architect** - Design the data flow first
   ```
   "Use the architect agent to design how accelerometer data flows from Arduino → iOS → Backend"
   ```

2. **Implement in Parallel** - Use agent teams or sequential agents
   ```
   "Create an agent team:
   - Arduino teammate: implement BLE characteristic for accel data
   - Capacitor teammate: implement BLE subscription and local storage
   - Backend teammate: implement POST /sensor-data endpoint"
   ```

3. **Integration Testing** - Come back to main conversation
   ```
   "Help me test the end-to-end flow of accelerometer data"
   ```

### For Bug Fixes

Use the specific agent for the component with the bug:

```
"Use the capacitor-react agent to debug why BLE notifications stop after 30 seconds"
```

### For Code Reviews

```
"Use the architect agent to review my PR for the data sync feature"
```

---

## Tips for Success

### 1. Keep CLAUDE.md Updated

When you make architectural decisions, update CLAUDE.md so all agents stay informed.

### 2. Be Specific with Context

When invoking agents, provide relevant context:

```
"Use the arduino agent to add a timestamp to each IMU packet. 
The current packet format is: [accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z]"
```

### 3. Use Agent Teams for Parallel Work

Agent teams shine when:
- Tasks are independent (different files/components)
- You want multiple perspectives (architecture review)
- Speed matters (parallel implementation)

### 4. Use Subagents for Sequential Work

Regular subagents are better when:
- Tasks depend on each other
- You need tight coordination
- Token cost is a concern

### 5. Start Simple

Begin with subagents before trying agent teams. Get comfortable with:
1. The `/agents` command
2. Explicit invocation ("Use the X agent to...")
3. Reviewing agent output

Then graduate to agent teams for more complex workflows.

---

## Troubleshooting

### Agents Not Appearing

```bash
# Check agent files exist
ls -la .claude/agents/

# Restart Claude Code session
claude --resume
```

### Agent Teams Not Working

1. Verify the environment variable is set:
   ```bash
   echo $CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS
   # Should output: 1
   ```

2. Check settings.json syntax is valid JSON

### Agent Giving Wrong Tech Stack Advice

Update the agent's `.md` file with more specific instructions about your tech choices.

---

## Next Steps

1. Copy all the agent files to `.claude/agents/`
2. Create your `CLAUDE.md` from the template
3. Start Claude Code: `claude`
4. Run `/agents` to verify setup
5. Try: "Use the architect agent to review my project structure"

Happy building! 🚀
