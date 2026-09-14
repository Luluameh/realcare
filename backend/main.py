import os
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.models import Person, Fact, DraftMessage, FamilyMemberCheckin, CareNotification
from backend.storage import storage
from backend.agents.recall_agent import recall_agent

app = FastAPI(
    title="RealCare API",
    description="Backend service for RealCare - Proactive Family Care & Empathetic Recall Companion",
    version="1.0.0"
)

# Enable CORS for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"


# --- Request Bodies ---

class CreatePersonRequest(BaseModel):
    name: str
    relationship: str
    avatar_color: Optional[str] = "#4f46e5"
    preferred_channel: Optional[str] = "SMS"
    checkin_frequency_days: int = 7
    last_contact_date: str
    notes: Optional[str] = None
    initial_fact: Optional[str] = None


class AddFactRequest(BaseModel):
    category: str = "interest"
    content: str


class ApproveDraftRequest(BaseModel):
    edited_message: Optional[str] = None


class AddFamilyCheckinRequest(BaseModel):
    member_name: str
    relationship: str
    last_contact_date: str
    contact_type: str
    summary_note: str


class TestNotificationRequest(BaseModel):
    title: Optional[str] = "RealCare Alert: Eleanor Vance Overdue"
    message: Optional[str] = "Eleanor Vance has not been contacted in 5 days. Consider calling around 11 AM for tea."
    urgency: Optional[str] = "high"
    channel: Optional[str] = "Web Push & SMS"
    person_id: Optional[str] = "eleanor-vance"
    person_name: Optional[str] = "Eleanor Vance"


# --- API Routes ---

@app.get("/api/health")
def health_check():
    is_live = recall_agent.is_live_bedrock()
    return {
        "status": "healthy",
        "app": "RealCare",
        "is_live_bedrock": is_live,
        "mode_label": "Live (Amazon Bedrock)" if is_live else "Local Simulator",
        "model_id": recall_agent.bedrock_model_id if is_live else "local-simulator",
        "region": recall_agent.aws_region
    }


@app.get("/api/circle")
def get_circle():
    people = storage.get_all_people()
    return [p.to_dict_with_status() for p in people]


@app.post("/api/circle")
def create_person(req: CreatePersonRequest):
    person_id = req.name.lower().replace(" ", "-")
    facts = []
    if req.initial_fact:
        facts.append(Fact(category="topic", content=req.initial_fact))
    
    person = Person(
        id=person_id,
        name=req.name,
        relationship=req.relationship,
        avatar_color=req.avatar_color or "#4f46e5",
        preferred_channel=req.preferred_channel or "SMS",
        checkin_frequency_days=req.checkin_frequency_days,
        last_contact_date=req.last_contact_date,
        notes=req.notes,
        facts=facts
    )
    saved = storage.add_person(person)
    return saved.to_dict_with_status()


@app.get("/api/circle/{person_id}")
def get_person(person_id: str):
    person = storage.get_person(person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    return person.to_dict_with_status()


@app.post("/api/circle/{person_id}/facts")
def add_fact(person_id: str, req: AddFactRequest):
    fact = Fact(category=req.category, content=req.content)
    updated = storage.add_fact_to_person(person_id, fact)
    if not updated:
        raise HTTPException(status_code=404, detail="Person not found")
    return updated.to_dict_with_status()


@app.post("/api/circle/{person_id}/contact")
def record_contact(person_id: str):
    updated = storage.record_contact(person_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Person not found")
    return updated.to_dict_with_status()


@app.post("/api/circle/reset")
def reset_demo_data():
    """Reset all data back to original seed data for clean demo restarts."""
    storage.reset_to_seed()
    return {"status": "success", "message": "Reset all circle, draft, and family records to initial seed data."}


# --- Agent Routes ---

@app.get("/api/agent/scan")
def agent_scan():
    """Strands Recall Agent scans circle and surfaces overdue contacts."""
    return recall_agent.scan_circle()


@app.post("/api/agent/draft/{person_id}")
def agent_draft_message(person_id: str):
    """Strands Recall Agent generates a deeply personalized check-in message using stored facts."""
    draft = recall_agent.draft_checkin(person_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Person not found")
    return draft.model_dump()


@app.get("/api/drafts")
def get_drafts(status: Optional[str] = None):
    drafts = storage.get_drafts(status=status)
    return [d.model_dump() for d in drafts]


@app.post("/api/drafts/{draft_id}/approve")
def approve_draft(draft_id: str, req: Optional[ApproveDraftRequest] = None):
    edited_msg = req.edited_message if req else None
    approved = recall_agent.approve_draft(draft_id, edited_msg)
    if not approved:
        raise HTTPException(status_code=404, detail="Draft not found")
    return {
        "status": "sent",
        "message": "Message approved and simulated send complete. Contact timer has been reset!",
        "draft": approved.model_dump()
    }


@app.post("/api/drafts/{draft_id}/reject")
def reject_draft(draft_id: str):
    rejected = recall_agent.reject_draft(draft_id)
    if not rejected:
        raise HTTPException(status_code=404, detail="Draft not found")
    return {"status": "rejected", "draft": rejected.model_dump()}


# --- Family View Routes ---

@app.get("/api/family-view/{loved_one_id}")
def get_family_view(loved_one_id: str):
    loved_one = storage.get_person(loved_one_id)
    checkins = storage.get_family_checkins(loved_one_id)
    return {
        "loved_one": loved_one.to_dict_with_status() if loved_one else None,
        "checkins": [c.model_dump() for c in checkins]
    }


@app.post("/api/family-view/{loved_one_id}")
def add_family_checkin(loved_one_id: str, req: AddFamilyCheckinRequest):
    checkin = FamilyMemberCheckin(
        loved_one_id=loved_one_id,
        member_name=req.member_name,
        relationship=req.relationship,
        last_contact_date=req.last_contact_date,
        contact_type=req.contact_type,
        summary_note=req.summary_note
    )
    saved = storage.add_family_checkin(checkin)
    return saved.model_dump()


# --- Caregiver Notification Routes ---

@app.get("/api/notifications")
def get_notifications():
    """Retrieve all active care alerts, overdue reminders, and family touchpoint notices."""
    notifs = storage.get_notifications()
    unread_count = sum(1 for n in notifs if not n.is_read)
    return {
        "notifications": [n.model_dump() for n in notifs],
        "unread_count": unread_count,
        "total_count": len(notifs)
    }


@app.post("/api/notifications/{notif_id}/read")
def mark_notification_read(notif_id: str):
    """Marks a specific care notification as read."""
    updated = storage.mark_notification_read(notif_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Notification not found")
    return updated.model_dump()


@app.post("/api/notifications/read-all")
def mark_all_notifications_read():
    """Marks all notifications as read."""
    updated_list = storage.mark_all_notifications_read()
    return {"status": "success", "count": len(updated_list)}


@app.delete("/api/notifications/{notif_id}")
def dismiss_notification(notif_id: str):
    """Dismisses / removes a notification."""
    dismissed = storage.dismiss_notification(notif_id)
    return {"status": "success", "dismissed": dismissed}


@app.post("/api/notifications/test")
def trigger_test_notification(req: TestNotificationRequest):
    """
    Triggers a live test care alert to demonstrate multi-channel dispatch
    (Browser Web Push, SMS, WhatsApp simulation, and in-app Notification Center).
    """
    new_notif = CareNotification(
        person_id=req.person_id or "eleanor-vance",
        person_name=req.person_name or "Eleanor Vance",
        title=req.title or "RealCare Alert: Eleanor Vance Overdue",
        message=req.message or "Eleanor Vance has not been contacted in 5 days. Consider calling around 11 AM for tea.",
        urgency=req.urgency or "high",
        channel=req.channel or "Web Push & SMS",
        action_type="draft"
    )
    saved = storage.add_notification(new_notif)
    return {
        "status": "dispatched",
        "notification": saved.model_dump(),
        "channels_dispatched": ["Web Push Notification", "In-App Care Drawer", "SMS Gateway Simulation"]
    }


# --- Static UI Mount ---

if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

    @app.get("/style.css")
    def serve_style_css():
        return FileResponse(str(FRONTEND_DIR / "style.css"), media_type="text/css")

    @app.get("/app.js")
    def serve_app_js():
        return FileResponse(str(FRONTEND_DIR / "app.js"), media_type="application/javascript")

    @app.get("/")
    def serve_frontend_index():
        return FileResponse(str(FRONTEND_DIR / "index.html"))

