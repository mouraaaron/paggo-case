import os, json
from openai import OpenAI
from database import get_db
from services.state_machine import can_transition

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SYSTEM_PROMPT = """You are a support triage assistant for Paggo.
You help support leaders understand and act on support tickets.
You can look up ticket details, update ticket status, assign tickets, and classify tickets.
Always confirm before taking write actions. Be concise.
Call one tool at a time. Wait for the result before calling another."""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_ticket",
            "description": "Retrieve full details of a support ticket",
            "parameters": {
                "type": "object",
                "properties": {
                    "ticket_id": {"type": "string", "description": "The ticket ID"}
                },
                "required": ["ticket_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_tickets",
            "description": "List tickets with optional filters",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {"type": "string"},
                    "priority": {"type": "string"},
                    "customer_segment": {"type": "string"},
                    "limit": {"type": "integer", "default": 10}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_ticket_status",
            "description": "Change the status of a ticket (follows state machine rules)",
            "parameters": {
                "type": "object",
                "properties": {
                    "ticket_id": {"type": "string"},
                    "new_status": {"type": "string"},
                    "reason": {"type": "string"}
                },
                "required": ["ticket_id", "new_status"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "assign_ticket",
            "description": "Assign a ticket to an agent",
            "parameters": {
                "type": "object",
                "properties": {
                    "ticket_id": {"type": "string"},
                    "agent_name": {"type": "string"}
                },
                "required": ["ticket_id", "agent_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "classify_ticket",
            "description": "Set priority and/or category of a ticket",
            "parameters": {
                "type": "object",
                "properties": {
                    "ticket_id": {"type": "string"},
                    "priority": {"type": "string"},
                    "category": {"type": "string"}
                },
                "required": ["ticket_id"]
            }
        }
    }
]

WRITE_TOOLS = {"update_ticket_status", "assign_ticket", "classify_ticket"}


def _execute_tool(name: str, args: dict) -> str:
    try:
        db = get_db()
        if name == "get_ticket":
            result = db.table("tickets").select("*").eq("ticket_id", args["ticket_id"]).single().execute()
            return json.dumps(result.data)
        elif name == "list_tickets":
            query = db.table("tickets").select("ticket_id,subject,status,priority,customer_name,customer_segment,risk_score")
            if args.get("status"):
                query = query.eq("status", args["status"])
            if args.get("priority"):
                query = query.eq("priority", args["priority"])
            if args.get("customer_segment"):
                query = query.eq("customer_segment", args["customer_segment"])
            query = query.limit(args.get("limit", 10))
            result = query.execute()
            return json.dumps(result.data)
        elif name == "update_ticket_status":
            ticket = db.table("tickets").select("status").eq("ticket_id", args["ticket_id"]).single().execute()
            current = ticket.data["status"]
            ok, msg = can_transition(current, args["new_status"])
            if not ok:
                return json.dumps({"error": msg})
            db.table("tickets").update({"status": args["new_status"]}).eq("ticket_id", args["ticket_id"]).execute()
            db.table("audit_log").insert({
                "ticket_id": args["ticket_id"],
                "action": "STATUS_CHANGE",
                "actor": "AI Agent",
                "source": "AGENT",
                "old_value": current,
                "new_value": args["new_status"],
                "reason": args.get("reason")
            }).execute()
            return json.dumps({"success": True, "new_status": args["new_status"]})
        elif name == "assign_ticket":
            db.table("tickets").update({"assigned_to": args["agent_name"]}).eq("ticket_id", args["ticket_id"]).execute()
            db.table("audit_log").insert({
                "ticket_id": args["ticket_id"],
                "action": "ASSIGNED",
                "actor": "AI Agent",
                "source": "AGENT",
                "new_value": args["agent_name"]
            }).execute()
            return json.dumps({"success": True, "assigned_to": args["agent_name"]})
        elif name == "classify_ticket":
            update = {}
            if args.get("priority"):
                update["priority"] = args["priority"]
            if args.get("category"):
                update["category"] = args["category"]
            if update:
                db.table("tickets").update(update).eq("ticket_id", args["ticket_id"]).execute()
                db.table("audit_log").insert({
                    "ticket_id": args["ticket_id"],
                    "action": "CLASSIFIED",
                    "actor": "AI Agent",
                    "source": "AGENT",
                    "new_value": json.dumps(update)
                }).execute()
            return json.dumps({"success": True, **update})
        return json.dumps({"error": "unknown tool"})
    except Exception as e:
        return json.dumps({"error": str(e)})


def run_agent(
    conversation_history: list[dict],
    user_message: str,
    confirmed_tool_call: dict | None = None
) -> dict:
    """
    Run one turn of the agent.

    Returns:
    {
        "reply": str,                          # assistant text reply
        "pending_action": dict | None,         # if agent wants to call a write tool, pause and ask user
        "updated_history": list[dict]          # full history to send back next turn
    }

    confirmed_tool_call: if the frontend confirmed a pending write action,
    pass {"name": "...", "args": {...}} here to execute it immediately.
    """
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(conversation_history)

    if confirmed_tool_call:
        if confirmed_tool_call["name"] not in WRITE_TOOLS:
            return {
                "reply": "Invalid confirmed action.",
                "pending_action": None,
                "updated_history": conversation_history
            }
        result = _execute_tool(confirmed_tool_call["name"], confirmed_tool_call["args"])
        messages.append({
            "role": "assistant",
            "tool_calls": [{
                "id": confirmed_tool_call.get("tool_call_id", "confirmed"),
                "type": "function",
                "function": {
                    "name": confirmed_tool_call["name"],
                    "arguments": json.dumps(confirmed_tool_call["args"])
                }
            }]
        })
        messages.append({
            "role": "tool",
            "tool_call_id": confirmed_tool_call.get("tool_call_id", "confirmed"),
            "content": result
        })
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            tools=TOOLS
        )
        reply = response.choices[0].message.content or ""
        messages.append({"role": "assistant", "content": reply})
        return {"reply": reply, "pending_action": None, "updated_history": messages[1:]}

    messages.append({"role": "user", "content": user_message})

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        tools=TOOLS
    )

    choice = response.choices[0]
    msg = choice.message

    if msg.tool_calls:
        tool_call = msg.tool_calls[0]
        name = tool_call.function.name
        try:
            args = json.loads(tool_call.function.arguments)
        except json.JSONDecodeError:
            return {
                "reply": "I encountered an error parsing the tool call. Please try again.",
                "pending_action": None,
                "updated_history": conversation_history
            }

        if name in WRITE_TOOLS:
            return {
                "reply": f"I'd like to call **{name}** with: {json.dumps(args, indent=2)}. Shall I proceed?",
                "pending_action": {"name": name, "args": args, "tool_call_id": tool_call.id},
                "updated_history": messages[1:]
            }

        result = _execute_tool(name, args)
        messages.append({"role": "assistant", "tool_calls": [{"id": tool_call.id, "type": "function", "function": {"name": name, "arguments": tool_call.function.arguments}}]})
        messages.append({"role": "tool", "tool_call_id": tool_call.id, "content": result})

        followup = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            tools=TOOLS
        )
        reply = followup.choices[0].message.content or ""
        messages.append({"role": "assistant", "content": reply})
        return {"reply": reply, "pending_action": None, "updated_history": messages[1:]}

    reply = msg.content or ""
    messages.append({"role": "assistant", "content": reply})
    return {"reply": reply, "pending_action": None, "updated_history": messages[1:]}
