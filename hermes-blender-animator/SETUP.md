# Setup on your Mac (Hermes + Blender)

I could not run these on your machine. Run them yourself, in order. Facts below come from the Blender MCP README at the time of writing; re-read it before running anything.

## 1. Prerequisites
- Blender 3.0 or newer (use the latest stable)
- `uv` installed via its official installer (not `pip install uv`)

## 2. Install the Blender MCP bridge (manual route, recommended)
The README also offers a `curl ... | sh` one-liner. Piping a remote script into your shell runs unreviewed code, so prefer the manual route:

```bash
uvx mcp-for-blender install-addon
```
Then Blender: Edit, Preferences, Add-ons, enable "Interface: MCP for Blender". In the 3D viewport press `N`, open the "MCP for Blender" tab, click "Start MCP Server" if not running.

Security: the addon socket has no authentication or encryption. Keep it on localhost. Set `BLENDER_MCP_SAFE_MODE=1` to have scripts checked before they run.

## 3. Register the MCP server in Hermes
Exact syntax not verified (docs unreachable from my environment). Check:
```bash
hermes mcp --help
```
Expected equivalent of this client config:
```json
{ "mcpServers": { "blender": { "command": "uvx", "args": ["mcp-for-blender"] } } }
```
If Hermes reports `spawn uvx ENOENT`, use the absolute path from `which uvx`.

## 4. Install the skill
Copy this folder to the Hermes skills directory (Linux/macOS/WSL2 base is `~/.hermes`):
```bash
mkdir -p ~/.hermes/skills
cp -R hermes-blender-animator ~/.hermes/skills/blender-animator
mkdir -p ~/.hermes/skills/blender-animator/references/notes
```
Then in Hermes: `/skills` should list `blender-animator`. Invoke with `/blender-animator`.

## 5. Acceptance test
1. Open Blender with a default cube, server started.
2. In Hermes: `/blender-animator get the scene info and tell me the Blender version and fps`.
3. Pass: it reports Cube, Camera, Light and the real version.
4. Then: `animate the cube bouncing 3 times over 2 seconds with squash and stretch`. Pass: keyframes exist (check the Timeline), motion plays with Space, and the agent verified with a viewport preview.
5. Then: `learn how to retarget a BVH to a rig and save a note`. Pass: a file appears in `references/notes/` with a source URL and version.
