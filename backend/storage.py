import json
import os
import shutil
from datetime import date, datetime
from pathlib import Path
from typing import List, Optional
from backend.models import Person, Fact, DraftMessage, FamilyMemberCheckin, CareNotification

DATA_DIR = Path(__file__).resolve().parent / "data"
CIRCLE_SEED = DATA_DIR / "circle_seed.json"
CIRCLE_FILE = DATA_DIR / "circle_current.json"
FAMILY_SEED = DATA_DIR / "family_seed.json"
FAMILY_FILE = DATA_DIR / "family_current.json"
DRAFTS_FILE = DATA_DIR / "drafts_current.json"
NOTIFS_FILE = DATA_DIR / "notifications_current.json"


class StorageManager:
    def __init__(self):
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        self._init_files()

    def _init_files(self):
        if not CIRCLE_FILE.exists() and CIRCLE_SEED.exists():
            shutil.copyfile(CIRCLE_SEED, CIRCLE_FILE)
        if not FAMILY_FILE.exists() and FAMILY_SEED.exists():
            shutil.copyfile(FAMILY_SEED, FAMILY_FILE)
        if not DRAFTS_FILE.exists():
            with open(DRAFTS_FILE, "w", encoding="utf-8") as f:
                json.dump([], f, indent=2)
        if not NOTIFS_FILE.exists():
            self._init_default_notifications()

    def _init_default_notifications(self):
        seed_notifs = [
            {
                "id": "notif-eleanor-01",
                "person_id": "eleanor-vance",
                "person_name": "Eleanor Vance",
                "title": "Care Alert: Eleanor Vance Overdue",
                "message": "It has been 5 days since Eleanor's last contact (target: 4 days). Eleanor responds best to warm reminiscing about her blue hydrangeas around 11 AM tea.",
                "urgency": "high",
                "channel": "Web Push & SMS",
                "created_at": datetime.now().isoformat(),
                "is_read": False,
                "action_type": "draft"
            },
            {
                "id": "notif-marcus-02",
                "person_id": "marcus-vance",
                "person_name": "Marcus Vance",
                "title": "Gentle Check-in: Marcus Vance",
                "message": "Marcus is finishing his pediatric ICU rotation. A brief 'no-pressure' text message would help him recharge.",
                "urgency": "medium",
                "channel": "Web Push",
                "created_at": datetime.now().isoformat(),
                "is_read": False,
                "action_type": "draft"
            },
            {
                "id": "notif-family-03",
                "person_id": "eleanor-vance",
                "person_name": "Eleanor Vance",
                "title": "Family Alignment: Maya Vance",
                "message": "Maya visited Eleanor this morning, watered the blue hydrangeas, and noted Eleanor was smiling and in high spirits.",
                "urgency": "info",
                "channel": "Family Circle Feed",
                "created_at": datetime.now().isoformat(),
                "is_read": True,
                "action_type": "view_family"
            }
        ]
        with open(NOTIFS_FILE, "w", encoding="utf-8") as f:
            json.dump(seed_notifs, f, indent=2)

    def reset_to_seed(self):
        """Reset current working data back to seed state (handy for demos)."""
        if CIRCLE_SEED.exists():
            shutil.copyfile(CIRCLE_SEED, CIRCLE_FILE)
        if FAMILY_SEED.exists():
            shutil.copyfile(FAMILY_SEED, FAMILY_FILE)
        with open(DRAFTS_FILE, "w", encoding="utf-8") as f:
            json.dump([], f, indent=2)
        self._init_default_notifications()

    def get_all_people(self) -> List[Person]:
        if not CIRCLE_FILE.exists():
            self._init_files()
        try:
            with open(CIRCLE_FILE, "r", encoding="utf-8") as f:
                raw_list = json.load(f)
            return [Person(**item) for item in raw_list]
        except Exception:
            return []

    def _save_all_people(self, people: List[Person]):
        with open(CIRCLE_FILE, "w", encoding="utf-8") as f:
            json.dump([p.model_dump() for p in people], f, indent=2)

    def get_person(self, person_id: str) -> Optional[Person]:
        people = self.get_all_people()
        for p in people:
            if p.id == person_id:
                return p
        return None

    def add_person(self, person: Person) -> Person:
        people = self.get_all_people()
        # Remove existing with same id if any
        people = [p for p in people if p.id != person.id]
        people.append(person)
        self._save_all_people(people)
        return person

    def update_person(self, person_id: str, updates: dict) -> Optional[Person]:
        people = self.get_all_people()
        target = None
        for i, p in enumerate(people):
            if p.id == person_id:
                p_dict = p.model_dump()
                p_dict.update(updates)
                target = Person(**p_dict)
                people[i] = target
                break
        if target:
            self._save_all_people(people)
        return target

    def add_fact_to_person(self, person_id: str, fact: Fact) -> Optional[Person]:
        people = self.get_all_people()
        target = None
        for i, p in enumerate(people):
            if p.id == person_id:
                p.facts.append(fact)
                target = p
                people[i] = p
                break
        if target:
            self._save_all_people(people)
        return target

    def record_contact(self, person_id: str, contact_date_str: Optional[str] = None) -> Optional[Person]:
        if not contact_date_str:
            contact_date_str = date.today().isoformat()
        return self.update_person(person_id, {"last_contact_date": contact_date_str})

    def get_overdue_people(self) -> List[Person]:
        people = self.get_all_people()
        return [p for p in people if p.is_overdue]

    # --- Draft Messages ---

    def get_drafts(self, status: Optional[str] = None) -> List[DraftMessage]:
        if not DRAFTS_FILE.exists():
            return []
        try:
            with open(DRAFTS_FILE, "r", encoding="utf-8") as f:
                raw_list = json.load(f)
            drafts = [DraftMessage(**item) for item in raw_list]
            if status:
                return [d for d in drafts if d.status == status]
            return drafts
        except Exception:
            return []

    def _save_drafts(self, drafts: List[DraftMessage]):
        with open(DRAFTS_FILE, "w", encoding="utf-8") as f:
            json.dump([d.model_dump() for d in drafts], f, indent=2)

    def save_draft(self, draft: DraftMessage) -> DraftMessage:
        drafts = self.get_drafts()
        # Replace if id exists, else prepend
        drafts = [d for d in drafts if d.id != draft.id]
        drafts.insert(0, draft)
        self._save_drafts(drafts)
        return draft

    def update_draft_status(self, draft_id: str, status: str, edited_message: Optional[str] = None) -> Optional[DraftMessage]:
        drafts = self.get_drafts()
        target = None
        for i, d in enumerate(drafts):
            if d.id == draft_id:
                d.status = status
                if edited_message is not None:
                    d.message = edited_message
                if status == "sent":
                    d.sent_at = datetime.now().isoformat()
                    # Also update person last_contact_date
                    self.record_contact(d.person_id)
                target = d
                drafts[i] = d
                break
        if target:
            self._save_drafts(drafts)
        return target

    # --- Shared Family View ---

    def get_family_checkins(self, loved_one_id: str = "eleanor-vance") -> List[FamilyMemberCheckin]:
        if not FAMILY_FILE.exists():
            self._init_files()
        try:
            with open(FAMILY_FILE, "r", encoding="utf-8") as f:
                raw_list = json.load(f)
            items = [FamilyMemberCheckin(**item) for item in raw_list if item.get("loved_one_id") == loved_one_id]
            # sort by last_contact_date descending
            items.sort(key=lambda x: x.last_contact_date, reverse=True)
            return items
        except Exception:
            return []

    def add_family_checkin(self, checkin: FamilyMemberCheckin) -> FamilyMemberCheckin:
        raw_list = []
        if FAMILY_FILE.exists():
            with open(FAMILY_FILE, "r", encoding="utf-8") as f:
                raw_list = json.load(f)
        raw_list.append(checkin.model_dump())
        with open(FAMILY_FILE, "w", encoding="utf-8") as f:
            json.dump(raw_list, f, indent=2)
        return checkin

    # --- RealCare Notification Management ---

    def get_notifications(self) -> List[CareNotification]:
        if not NOTIFS_FILE.exists():
            self._init_default_notifications()
        try:
            with open(NOTIFS_FILE, "r", encoding="utf-8") as f:
                raw_list = json.load(f)
            notifs = [CareNotification(**item) for item in raw_list]
            # Ensure overdue contacts from circle also have notifications
            overdue = self.get_overdue_people()
            existing_person_ids = {n.person_id for n in notifs if n.person_id}
            changed = False
            for p in overdue:
                if p.id not in existing_person_ids:
                    new_n = CareNotification(
                        person_id=p.id,
                        person_name=p.name,
                        title=f"Care Alert: {p.name} is Overdue",
                        message=f"{p.name} ({p.relationship}) is {p.days_overdue} day(s) overdue for connection (target: every {p.checkin_frequency_days} days).",
                        urgency="high" if p.days_overdue > 3 else "medium",
                        channel="Web Push & SMS",
                        action_type="draft"
                    )
                    notifs.insert(0, new_n)
                    changed = True
            if changed:
                self._save_notifications(notifs)
            return notifs
        except Exception:
            return []

    def _save_notifications(self, notifs: List[CareNotification]):
        with open(NOTIFS_FILE, "w", encoding="utf-8") as f:
            json.dump([n.model_dump() for n in notifs], f, indent=2)

    def mark_notification_read(self, notif_id: str) -> Optional[CareNotification]:
        notifs = self.get_notifications()
        target = None
        for n in notifs:
            if n.id == notif_id:
                n.is_read = True
                target = n
                break
        if target:
            self._save_notifications(notifs)
        return target

    def mark_all_notifications_read(self) -> List[CareNotification]:
        notifs = self.get_notifications()
        for n in notifs:
            n.is_read = True
        self._save_notifications(notifs)
        return notifs

    def add_notification(self, notif: CareNotification) -> CareNotification:
        notifs = self.get_notifications()
        notifs.insert(0, notif)
        self._save_notifications(notifs)
        return notif

    def dismiss_notification(self, notif_id: str) -> bool:
        notifs = self.get_notifications()
        new_list = [n for n in notifs if n.id != notif_id]
        if len(new_list) != len(notifs):
            self._save_notifications(new_list)
            return True
        return False


# Global storage singleton
storage = StorageManager()
