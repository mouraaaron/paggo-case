import os, json
from datetime import datetime, timezone
from openai import OpenAI
from database import get_db
from services.state_machine import can_transition

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SYSTEM_PROMPT = """You are a support triage assistant for Paggo.
You help support leaders understand and act on support tickets.

Available actions:
- list_tickets: query tickets with rich filters (segment, status, category, no_reply, date range, sort)
- get_ticket: fetch full details of one ticket
- update_ticket_status: change ticket status following state machine rules
- assign_ticket: assign or reassign a ticket to an agent
- classify_ticket: set priority and/or category
- close_ticket: close a ticket with a required reason (RESOLVED_FIXED, RESOLVED_INFO, DUPLICATE, NOT_REPRODUCIBLE, WONT_FIX, CUSTOMER_NO_RESPONSE)
- merge_tickets: merge a duplicate ticket into a primary ticket (same customer only)
- draft_reply: generate a personalized reply draft for the leader to review before sending

Rules:
- Always show a preview and ask for confirmation before executing write actions.
- For queries affecting multiple tickets (e.g. "escalate all ENT tickets unanswered for 4h"), first list the tickets, confirm the plan, then act.
- Never invent ticket IDs, customer names, or facts about bugs you don't have.
- If data is missing, say so and ask.
- Reply in the same language the leader uses (usually Portuguese).
- Call one tool at a time. Wait for the result before calling another."""

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
            "description": (
                "List tickets with optional filters. Use no_reply=true to find tickets "
                "with no agent response yet. Use sort_by='created_at' + sort_desc=false "
                "to get oldest first."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "status":           {"type": "string", "description": "e.g. NEW, IN_PROGRESS, ESCALATED"},
                    "priority":         {"type": "string", "description": "LOW, MEDIUM, HIGH, URGENT"},
                    "customer_segment": {"type": "string", "description": "SMB, MID, ENT"},
                    "assigned_to":      {"type": "string", "description": "agent name, or 'unassigned' to filter unassigned"},
                    "category":         {"type": "string", "description": "BILLING, BUG, FEATURE_REQUEST, HOW_TO, CHURN_SIGNAL, OTHER"},
                    "no_reply":         {"type": "boolean", "description": "If true, return only tickets with no reply yet (last_reply_at IS NULL)"},
                    "created_after":    {"type": "string", "description": "ISO date string, e.g. 2026-01-15"},
                    "created_before":   {"type": "string", "description": "ISO date string, e.g. 2026-03-31"},
                    "sort_by":          {"type": "string", "description": "Field to sort by: risk_score (default), created_at, last_reply_at"},
                    "sort_desc":        {"type": "boolean", "description": "Sort descending (default true). Pass false for oldest-first."},
                    "limit":            {"type": "integer", "description": "Max results, default 10, max 50"}
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
    },
    {
        "type": "function",
        "function": {
            "name": "close_ticket",
            "description": "Close a ticket with a required close reason. Valid reasons: RESOLVED_FIXED, RESOLVED_INFO, DUPLICATE, NOT_REPRODUCIBLE, WONT_FIX, CUSTOMER_NO_RESPONSE. Ticket must be in RESOLVED status to close.",
            "parameters": {
                "type": "object",
                "properties": {
                    "ticket_id":    {"type": "string"},
                    "close_reason": {
                        "type": "string",
                        "enum": ["RESOLVED_FIXED", "RESOLVED_INFO", "DUPLICATE",
                                 "NOT_REPRODUCIBLE", "WONT_FIX", "CUSTOMER_NO_RESPONSE"]
                    }
                },
                "required": ["ticket_id", "close_reason"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "merge_tickets",
            "description": "Merge a duplicate ticket into a primary ticket. Both tickets must belong to the same customer. The secondary ticket is closed as DUPLICATE; its replies are moved to the primary.",
            "parameters": {
                "type": "object",
                "properties": {
                    "primary_ticket_id":   {"type": "string", "description": "The ticket to keep"},
                    "secondary_ticket_id": {"type": "string", "description": "The duplicate ticket to close"}
                },
                "required": ["primary_ticket_id", "secondary_ticket_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "draft_reply",
            "description": (
                "Generate a personalized reply draft for a ticket based on its real content, "
                "customer segment, plan, and conversation history. "
                "The draft will be shown to the leader for review before sending. "
                "Use this whenever the leader wants to reply to a ticket."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "ticket_id": {"type": "string", "description": "The ticket to draft a reply for"}
                },
                "required": ["ticket_id"]
            }
        }
    },
]

WRITE_TOOLS = {"update_ticket_status", "assign_ticket", "classify_ticket",
               "close_ticket", "merge_tickets", "draft_reply"}

VALID_CLOSE_REASONS = {
    "RESOLVED_FIXED", "RESOLVED_INFO", "DUPLICATE",
    "NOT_REPRODUCIBLE", "WONT_FIX", "CUSTOMER_NO_RESPONSE"
}


SEGMENT_TONE = {
    "ENT":  "formal and professional, using polite language appropriate for enterprise clients",
    "MID":  "professional and clear, balancing warmth with efficiency",
    "SMB":  "direct and friendly, keeping the response concise",
    None:   "professional and helpful",
}


def _generate_draft(ticket: dict, replies: list[dict]) -> str:
    """Generate a reply draft using GPT-4o-mini based on ticket context."""
    segment = ticket.get("customer_segment")
    tone = SEGMENT_TONE.get(segment, SEGMENT_TONE[None])

    history_lines = []
    for r in replies[-5:]:  # last 5 replies for context
        history_lines.append(f"[{r['author']}]: {r['body']}")
    history_text = "\n".join(history_lines) if history_lines else "(no previous replies)"

    prompt = (
        f"You are a support agent at Paggo. Write a reply to the following support ticket.\n\n"
        f"Customer: {ticket.get('customer_name')} ({segment or 'unknown segment'}, "
        f"{ticket.get('plan', 'unknown plan')} plan)\n"
        f"Open tickets from this customer: {ticket.get('previous_open_tickets_for_customer', 0)}\n"
        f"Subject: {ticket.get('subject')}\n"
        f"Original message: {ticket.get('body_preview')}\n\n"
        f"Recent conversation:\n{history_text}\n\n"
        f"Write a reply in Portuguese. Tone: {tone}. "
        f"Use the real context of the ticket — do not use generic templates. "
        f"Do not invent facts about bugs or resolutions you don't know. "
        f"Keep it under 150 words."
    )

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
    )
    return response.choices[0].message.content.strip()


def _execute_tool(name: str, args: dict) -> str:
    try:
        db = get_db()
        if name == "get_ticket":
            result = db.table("tickets").select("*").eq("ticket_id", args["ticket_id"]).single().execute()
            return json.dumps(result.data)
        elif name == "list_tickets":
            query = db.table("tickets").select(
                "ticket_id,subject,status,priority,customer_name,customer_segment,"
                "assigned_to,category,risk_score,created_at,last_reply_at,triage_flags"
            )
            if args.get("status"):
                query = query.eq("status", args["status"])
            if args.get("priority"):
                query = query.eq("priority", args["priority"])
            if args.get("customer_segment"):
                query = query.eq("customer_segment", args["customer_segment"])
            if args.get("assigned_to"):
                if args["assigned_to"] == "unassigned":
                    query = query.is_("assigned_to", None)
                else:
                    query = query.eq("assigned_to", args["assigned_to"])
            if args.get("category"):
                query = query.eq("category", args["category"])
            if args.get("no_reply"):
                query = query.is_("last_reply_at", None)
            if args.get("created_after"):
                query = query.gte("created_at", args["created_after"])
            if args.get("created_before"):
                date_part = args["created_before"].split("T")[0] if "T" in args["created_before"] else args["created_before"]
                query = query.lte("created_at", f"{date_part}T23:59:59.999999")
            sort_field = args.get("sort_by", "risk_score")
            sort_desc = args.get("sort_desc", True)
            limit = min(int(args.get("limit", 10)), 50)
            query = query.order(sort_field, desc=sort_desc).limit(limit)
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
        elif name == "close_ticket":
            if args["close_reason"] not in VALID_CLOSE_REASONS:
                return json.dumps({"error": f"Invalid close_reason '{args['close_reason']}'. Must be one of {sorted(VALID_CLOSE_REASONS)}"})
            ticket = db.table("tickets").select("status").eq("ticket_id", args["ticket_id"]).single().execute()
            current = ticket.data["status"]
            ok, msg = can_transition(current, "CLOSED")
            if not ok:
                return json.dumps({"error": msg})
            db.table("tickets").update({
                "status": "CLOSED",
                "close_reason": args["close_reason"],
            }).eq("ticket_id", args["ticket_id"]).execute()
            db.table("audit_log").insert({
                "ticket_id": args["ticket_id"],
                "action": "CLOSED",
                "actor": "AI Agent",
                "source": "AGENT",
                "old_value": current,
                "new_value": "CLOSED",
                "reason": args["close_reason"],
            }).execute()
            return json.dumps({"success": True, "close_reason": args["close_reason"]})

        elif name == "merge_tickets":
            primary = db.table("tickets").select("ticket_id,customer_id,status").eq("ticket_id", args["primary_ticket_id"]).execute()
            secondary = db.table("tickets").select("ticket_id,customer_id,status").eq("ticket_id", args["secondary_ticket_id"]).execute()
            if not primary.data or not secondary.data:
                return json.dumps({"error": "One or both tickets not found"})
            if primary.data[0]["customer_id"] != secondary.data[0]["customer_id"]:
                return json.dumps({"error": "Cannot merge tickets from different customers"})
            secondary_status = secondary.data[0]["status"]
            db.table("ticket_replies").update({"ticket_id": args["primary_ticket_id"]}).eq("ticket_id", args["secondary_ticket_id"]).execute()
            db.table("tickets").update({
                "status": "CLOSED",
                "merged_into": args["primary_ticket_id"],
                "close_reason": "DUPLICATE",
            }).eq("ticket_id", args["secondary_ticket_id"]).execute()
            db.table("audit_log").insert({
                "ticket_id": args["primary_ticket_id"],
                "action": "MERGED",
                "actor": "AI Agent",
                "source": "AGENT",
                "new_value": args["secondary_ticket_id"],
            }).execute()
            db.table("audit_log").insert({
                "ticket_id": args["secondary_ticket_id"],
                "action": "MERGED_INTO",
                "actor": "AI Agent",
                "source": "AGENT",
                "old_value": secondary_status,
                "new_value": args["primary_ticket_id"],
            }).execute()
            return json.dumps({"success": True, "primary": args["primary_ticket_id"], "merged": args["secondary_ticket_id"]})

        elif name == "draft_reply":
            # Confirmation path: draft_body already provided, send it
            if args.get("draft_body"):
                db.table("ticket_replies").insert({
                    "ticket_id": args["ticket_id"],
                    "body": args["draft_body"],
                    "author": "AI Agent",
                    "source": "AGENT",
                    "is_draft": False,
                }).execute()
                db.table("tickets").update({
                    "last_reply_by": "AGENT",
                    "last_reply_at": datetime.now(timezone.utc).isoformat(),
                }).eq("ticket_id", args["ticket_id"]).execute()
                db.table("audit_log").insert({
                    "ticket_id": args["ticket_id"],
                    "action": "REPLY_ADDED",
                    "actor": "AI Agent",
                    "source": "AGENT",
                    "new_value": args["draft_body"][:200],
                }).execute()
                return json.dumps({"success": True, "draft_body": args["draft_body"]})
            # Generation path: fetch context, generate draft, return (caller shows preview)
            ticket_result = db.table("tickets").select("*").eq("ticket_id", args["ticket_id"]).single().execute()
            replies_result = db.table("ticket_replies").select("author,body").eq("ticket_id", args["ticket_id"]).order("created_at", desc=False).execute()
            draft = _generate_draft(ticket_result.data, replies_result.data)
            return json.dumps({"draft_body": draft, "ticket_id": args["ticket_id"]})

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
            if name == "draft_reply":
                # Generate draft first, then show for review
                gen_result = _execute_tool("draft_reply", args)
                try:
                    gen_data = json.loads(gen_result)
                except json.JSONDecodeError:
                    gen_data = {}
                if gen_data.get("error"):
                    return {
                        "reply": f"Não consegui gerar o rascunho: {gen_data['error']}",
                        "pending_action": None,
                        "updated_history": messages[1:],
                    }
                draft_body = gen_data.get("draft_body", "")
                if not draft_body:
                    return {
                        "reply": "Não consegui gerar um rascunho para este ticket. Verifique se o ticket_id está correto.",
                        "pending_action": None,
                        "updated_history": messages[1:],
                    }
                args["draft_body"] = draft_body
                return {
                    "reply": (
                        f"Rascunho gerado para **{args['ticket_id']}**:\n\n"
                        f"---\n{draft_body}\n---\n\n"
                        f"Enviar esta resposta?"
                    ),
                    "pending_action": {"name": "draft_reply", "args": args, "tool_call_id": tool_call.id},
                    "updated_history": messages[1:],
                }
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
