#!/usr/bin/env python3
"""
MCP Server for ToDoList App — Streamable HTTP transport, stateless mode.

Each request is authenticated via an API token:
  POST /mcp?token=<api_token>

Run: uvicorn mcp_server:app --host 127.0.0.1 --port 8086
"""

import os
import json
import httpx
import logging
import anyio

from mcp.server import Server
from mcp.server.streamable_http import StreamableHTTPServerTransport
from mcp import types
from starlette.requests import Request
from starlette.responses import JSONResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_URL = os.environ.get("TODO_BASE_URL", "http://127.0.0.1:8000")

# Cache MCP Server instances per token (tools are pure functions of the token)
_servers: dict[str, Server] = {}


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _get_or_create_server(api_token: str) -> Server:
    if api_token in _servers:
        return _servers[api_token]

    server = Server("todolist")

    @server.list_tools()
    async def list_tools() -> list[types.Tool]:
        return [
            types.Tool(
                name="list_todos",
                description="List all todos for the current user.",
                inputSchema={"type": "object", "properties": {}},
            ),
            types.Tool(
                name="create_todo",
                description=(
                    "Create a new todo item. "
                    "Infer due_date and remind_from from natural language if mentioned."
                ),
                inputSchema={
                    "type": "object",
                    "properties": {
                        "title": {"type": "string", "description": "Short, clear title."},
                        "description": {"type": "string", "description": "Additional context."},
                        "priority": {"type": "integer", "description": "0=normal, 1=high, 2=urgent.", "default": 0},
                        "due_date": {"type": "string", "description": "ISO-8601 date, e.g. '2026-04-15'."},
                        "remind_from": {"type": "string", "description": "ISO-8601 datetime, e.g. '2026-04-14T09:00:00'."},
                        "email_reminder_enabled": {"type": "boolean", "default": False},
                    },
                    "required": ["title"],
                },
            ),
            types.Tool(
                name="update_todo",
                description="Update fields of an existing todo. Only pass fields you want to change.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "todo_id": {"type": "integer"},
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "priority": {"type": "integer"},
                        "due_date": {"type": "string"},
                        "remind_from": {"type": "string"},
                        "email_reminder_enabled": {"type": "boolean"},
                        "done": {"type": "boolean"},
                    },
                    "required": ["todo_id"],
                },
            ),
            types.Tool(
                name="delete_todo",
                description="Permanently delete a todo by its ID.",
                inputSchema={
                    "type": "object",
                    "properties": {"todo_id": {"type": "integer"}},
                    "required": ["todo_id"],
                },
            ),
        ]

    @server.call_tool()
    async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:
        async with httpx.AsyncClient(timeout=10) as client:
            headers = _headers(api_token)

            if name == "list_todos":
                resp = await client.get(f"{BASE_URL}/api/todos", headers=headers)
                resp.raise_for_status()
                return [types.TextContent(type="text", text=json.dumps(resp.json(), ensure_ascii=False))]

            elif name == "create_todo":
                payload: dict = {
                    "title": arguments["title"],
                    "priority": arguments.get("priority", 0),
                    "done": False,
                    "email_reminder_enabled": arguments.get("email_reminder_enabled", False),
                }
                for field in ("description", "due_date", "remind_from"):
                    if arguments.get(field):
                        payload[field] = arguments[field]
                resp = await client.post(f"{BASE_URL}/api/todos", json=payload, headers=headers)
                resp.raise_for_status()
                return [types.TextContent(type="text", text=json.dumps(resp.json(), ensure_ascii=False))]

            elif name == "update_todo":
                todo_id = arguments["todo_id"]
                list_resp = await client.get(f"{BASE_URL}/api/todos", headers=headers)
                list_resp.raise_for_status()
                existing = next((t for t in list_resp.json() if t["id"] == todo_id), None)
                if not existing:
                    return [types.TextContent(type="text", text=f"Todo id={todo_id} not found")]
                for field in ("title", "description", "priority", "due_date", "remind_from",
                              "email_reminder_enabled", "done"):
                    if field in arguments:
                        existing[field] = arguments[field]
                resp = await client.put(f"{BASE_URL}/api/todos/{todo_id}", json=existing, headers=headers)
                resp.raise_for_status()
                return [types.TextContent(type="text", text=json.dumps(resp.json(), ensure_ascii=False))]

            elif name == "delete_todo":
                todo_id = arguments["todo_id"]
                resp = await client.delete(f"{BASE_URL}/api/todos/{todo_id}", headers=headers)
                resp.raise_for_status()
                return [types.TextContent(type="text", text=json.dumps({"success": True, "deleted_id": todo_id}))]

            else:
                return [types.TextContent(type="text", text=f"Unknown tool: {name}")]

    _servers[api_token] = server
    return server


class MCPApp:
    """Pure ASGI app — stateless Streamable HTTP transport, one transport per request."""

    async def __call__(self, scope, receive, send):
        if scope["type"] == "lifespan":
            await self._handle_lifespan(receive, send)
            return
        if scope["type"] != "http":
            return

        path = scope.get("path", "")
        if path == "/mcp":
            await self._handle_mcp(scope, receive, send)
        else:
            await JSONResponse({"error": "Not found"}, status_code=404)(scope, receive, send)

    async def _handle_lifespan(self, receive, send):
        while True:
            event = await receive()
            if event["type"] == "lifespan.startup":
                await send({"type": "lifespan.startup.complete"})
            elif event["type"] == "lifespan.shutdown":
                await send({"type": "lifespan.shutdown.complete"})
                return

    async def _handle_mcp(self, scope, receive, send):
        request = Request(scope, receive)
        api_token = request.query_params.get("token", "").strip()

        if not api_token:
            await JSONResponse({"error": "Missing token"}, status_code=401)(scope, receive, send)
            return

        # Validate token against the backend
        async with httpx.AsyncClient(timeout=5) as client:
            try:
                check = await client.get(f"{BASE_URL}/api/me/token", headers=_headers(api_token))
                if check.status_code != 200:
                    await JSONResponse({"error": "Invalid token"}, status_code=401)(scope, receive, send)
                    return
            except Exception:
                await JSONResponse({"error": "Backend unreachable"}, status_code=503)(scope, receive, send)
                return

        server = _get_or_create_server(api_token)
        transport = StreamableHTTPServerTransport(mcp_session_id=None, is_json_response_enabled=False)

        async def run_server(*, task_status=anyio.TASK_STATUS_IGNORED):
            async with transport.connect() as streams:
                read_stream, write_stream = streams
                task_status.started()
                await server.run(
                    read_stream,
                    write_stream,
                    server.create_initialization_options(),
                    stateless=True,
                )

        async with anyio.create_task_group() as tg:
            await tg.start(run_server)
            await transport.handle_request(scope, receive, send)
            await transport.terminate()
            tg.cancel_scope.cancel()


app = MCPApp()
