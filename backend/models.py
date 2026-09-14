from datetime import datetime, date
from typing import List, Optional
from pydantic import BaseModel, Field
import uuid


class Fact(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    category: str = "interest"  # "memory", "interest", "life_update", "routine", "preference"
    content: str
    date_added: Optional[str] = None


class Person(BaseModel):
    id: str
    name: str
    relationship: str
    avatar_color: str = "#4f46e5"
    preferred_channel: str = "SMS"  # "SMS", "Phone Call", "In-Person Visit"
    checkin_frequency_days: int = 7
    last_contact_date: str  # YYYY-MM-DD
    notes: Optional[str] = None
    facts: List[Fact] = Field(default_factory=list)

    @property
    def days_since_contact(self) -> int:
        try:
            contact_dt = datetime.strptime(self.last_contact_date, "%Y-%m-%d").date()
            today = date.today()
            return max(0, (today - contact_dt).days)
        except Exception:
            return 0

    @property
    def is_overdue(self) -> bool:
        return self.days_since_contact > self.checkin_frequency_days

    @property
    def days_overdue(self) -> int:
        if self.is_overdue:
            return self.days_since_contact - self.checkin_frequency_days
        return 0

    def to_dict_with_status(self) -> dict:
        data = self.model_dump()
        data["days_since_contact"] = self.days_since_contact
        data["is_overdue"] = self.is_overdue
        data["days_overdue"] = self.days_overdue
        return data


class DraftMessage(BaseModel):
    id: str = Field(default_factory=lambda: f"draft-{str(uuid.uuid4())[:8]}")
    person_id: str
    person_name: str
    message: str
    reasoning: str
    status: str = "pending"  # "pending", "approved", "rejected", "sent"
    channel: str = "SMS"
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    sent_at: Optional[str] = None


class FamilyMemberCheckin(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    loved_one_id: str
    member_name: str
    relationship: str
    last_contact_date: str
    contact_type: str  # "Video Call", "Visit", "Phone", "Message"
    summary_note: str

    @property
    def days_since_contact(self) -> int:
        try:
            contact_dt = datetime.strptime(self.last_contact_date, "%Y-%m-%d").date()
            return max(0, (date.today() - contact_dt).days)
        except Exception:
            return 0


class CareNotification(BaseModel):
    id: str = Field(default_factory=lambda: f"notif-{str(uuid.uuid4())[:8]}")
    person_id: Optional[str] = None
    person_name: Optional[str] = None
    title: str
    message: str
    urgency: str = "medium"  # "high", "medium", "info"
    channel: str = "Web Push"  # "Web Push", "SMS", "WhatsApp", "Email"
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    is_read: bool = False
    action_type: str = "draft"  # "draft", "view_family", "contact"

