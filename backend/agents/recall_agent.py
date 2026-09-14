import os
import json
import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from backend.storage import storage
from backend.models import DraftMessage, Person

load_dotenv()

logger = logging.getLogger("realcare.recall_agent")

RECALL_AGENT_SYSTEM_PROMPT = """You are the RealCare Recall Agent, an empathetic companion assistant created for the AWS 'Agents for Humans' hackathon (Good Neighbor track).

Your purpose:
Help individuals maintain deep, authentic emotional bonds with family and friends they might have drifted from—especially loved ones navigating memory challenges (like dementia or mild cognitive impairment), where regular human connection is vital.

STRICT BOUNDARIES:
1. NEVER offer medical diagnostics, clinical assessments, or health monitoring opinions.
2. NEVER draft hollow generic templates (e.g. "Hey! Just checking in, hope all is well!").
3. ALWAYS anchor drafts in specific, authentic stored details (hobbies, pets, favorite places, routines).
4. For individuals with memory challenges, use grounding, sensory recollections (e.g. "I was picturing the sea breeze in Cornwall and having a cup of tea...") rather than interrogative memory quizzes ("Do you remember when...?").
5. Keep drafts concise, natural, and matching the person's preferred communication channel.
"""

def generate_personalized_text_local(person: Person) -> Dict[str, str]:
    """
    Intelligent local generator that crafts high-empathy, fact-grounded drafts.
    Used for local testing or when AWS Bedrock is in simulator mode.
    """
    facts = person.facts
    name = person.name.split()[0]
    channel = person.preferred_channel
    relationship = person.relationship.lower()

    if "grandmother" in relationship or "grandparent" in relationship or "dementia" in (person.notes or "").lower() or "memory" in (person.notes or "").lower():
        # Sensitive memory-grounded draft
        topic_fact = next((f.content for f in facts if f.category in ["interest", "topic"]), None)
        memory_fact = next((f.content for f in facts if f.category == "memory"), None)
        routine_fact = next((f.content for f in facts if f.category == "routine"), None)

        if topic_fact and "hydrangea" in topic_fact.lower():
            message = (
                f"Hi {name}, I was thinking about you this morning while making tea and wondered how your blue hydrangeas are doing in the sunshine. "
                f"I'd love to give you a call around 11:00 AM if you're free for a cup of tea."
            )
            reasoning = f"Referenced {name}'s beloved blue hydrangeas and aligned call time with her 11 AM tea routine, avoiding stressful memory quizzes."
        elif memory_fact:
            message = (
                f"Hi {name}, thinking of you warmly today. I was just remembering that wonderful afternoon we had by the water, "
                f"and it made me smile. Sending you love and looking forward to hearing your voice soon."
            )
            reasoning = f"Used warm sensory memory anchor from stored facts to foster connection without cognitive strain."
        else:
            message = (
                f"Hi {name}, sending you a big hug today. Thinking of you and would love to hear how your garden is blooming whenever you have a moment."
            )
            reasoning = f"Gentle, affirming greeting respecting {name}'s pace and interests."

    elif "brother" in relationship or "physician" in (person.notes or "").lower() or "doctor" in (person.notes or "").lower():
        # Busy sibling draft
        pet_fact = next((f.content for f in facts if "baxter" in f.content.lower() or "dog" in f.content.lower()), None)
        coffee_fact = next((f.content for f in facts if "coffee" in f.content.lower()), None)

        if pet_fact and coffee_fact:
            message = (
                f"Hey {name}! Hope you're surviving the hospital shifts. Give Baxter a belly rub for me — did he ever give up on stealing your socks? "
                f"Got some Ethiopian pour-over beans today that made me think of you. No need to text back if you're on call, just sending some love!"
            )
            reasoning = f"Referenced his rescue dog Baxter, the sock-chewing habit, and Ethiopian coffee beans. Included a 'no pressure' clause acknowledging his grueling ICU shifts."
        else:
            message = f"Hey {name}! Just wanted to check in and see how clinic's treating you this week. Sending you and Baxter good energy!"
            reasoning = f"Concise check-in suited for medical resident schedule."

    elif "uncle" in relationship:
        # Woodworking / hobby craft draft
        boat_fact = next((f.content for f in facts if "boat" in f.content.lower() or "sail" in f.content.lower()), None)
        garden_fact = next((f.content for f in facts if "tomato" in f.content.lower()), None)

        if boat_fact:
            message = (
                f"Hi Uncle {name}! How is the 1968 day-sailer coming along in the barn workshop? "
                f"Was thinking about the cedar whistles you taught me to carve when I was little. Would love to ring you this weekend to hear about the boat!"
            )
            reasoning = f"Directly referenced his 1968 sailboat restoration project and the cherished childhood memory of carving cedar whistles."
        else:
            message = f"Hi Uncle {name}, hope coastal Maine is treating you well! Would love to catch up on your woodworking projects soon."
            reasoning = f"Engaged his favorite craft topics."

    elif "friend" in relationship:
        # Long-distance friend
        art_fact = next((f.content for f in facts if "pottery" in f.content.lower() or "ceramic" in f.content.lower()), None)
        running_fact = next((f.content for f in facts if "half marathon" in f.content.lower() or "run" in f.content.lower()), None)

        if art_fact:
            message = (
                f"Hey {name}! How is the pottery wheel treating you in Chicago? Have you mastered centering the clay yet, or is it still flying off the wheel? 😄 "
                f"Miss you tons, let's do a FaceTime tea catch-up this Sunday!"
            )
            reasoning = f"Referenced her new Wicker Park pottery classes and learning to center clay, keeping distance from weakening the bond."
        else:
            message = f"Hey {name}! Miss you lots in Chicago. How has the new job and running training been going?"
            reasoning = f"Grounded in her recent city relocation and hobbies."

    else:
        # Default personalized
        fact_snippet = facts[0].content if facts else "recent conversations"
        message = (
            f"Hello {name}, I was recently reflecting on our conversations about {fact_snippet} and wanted to reach out. "
            f"Would love to hear how everything has been going with you."
        )
        reasoning = f"Personalized referencing {fact_snippet}."

    return {
        "message": message,
        "reasoning": reasoning,
        "channel": channel
    }


class CheckinDraftOutput(BaseModel):
    message: str = Field(description="The warm, personalized check-in message text.")
    reasoning: str = Field(description="Empathetic explanation of why these memories and routines were chosen.")
    channel: str = Field(default="Phone Call", description="Recommended contact channel, e.g. Phone Call or SMS.")


class RecallAgentService:
    def __init__(self):
        self.use_mock = os.getenv("USE_MOCK_AGENT", "true").lower() == "true"
        self.bedrock_model_id = os.getenv("BEDROCK_MODEL_ID", "anthropic.claude-haiku-4-5-20251001-v1:0")
        self.fallback_model_id = os.getenv("BEDROCK_FALLBACK_MODEL_ID", "anthropic.claude-sonnet-4-6")
        self.aws_region = os.getenv("AWS_REGION", "us-east-1")
        self.aws_access_key_id = os.getenv("AWS_ACCESS_KEY_ID")
        self.aws_secret_access_key = os.getenv("AWS_SECRET_ACCESS_KEY")
        self.aws_session_token = os.getenv("AWS_SESSION_TOKEN")  # optional, for temp credentials
        self.agent = None
        self.active_model_id = None  # tracks which model is actually live
        self._init_strands_agent()

    def _build_agent(self, model_id: str):
        """Attempts to create a Strands Agent with the given Bedrock model ID."""
        import boto3
        from strands import Agent
        from strands.models.bedrock import BedrockModel

        # Build boto3 session — explicitly pass credentials from .env if available.
        # This ensures python-dotenv loaded values are forwarded to boto3,
        # which otherwise only reads from ~/.aws/credentials or system env.
        session_kwargs = {"region_name": self.aws_region}
        if self.aws_access_key_id and self.aws_secret_access_key:
            session_kwargs["aws_access_key_id"] = self.aws_access_key_id
            session_kwargs["aws_secret_access_key"] = self.aws_secret_access_key
            if self.aws_session_token:
                session_kwargs["aws_session_token"] = self.aws_session_token
            logger.info("Using IAM credentials from .env for boto3 session.")
        boto_session = boto3.Session(**session_kwargs)

        bedrock_model = BedrockModel(
            model_id=model_id,
            boto_session=boto_session,
        )
        agent = Agent(
            model=bedrock_model,
            system_prompt=RECALL_AGENT_SYSTEM_PROMPT,
            tools=self.agent_tools
        )
        return agent

    def _init_strands_agent(self):
        """Initializes the Strands Agent with primary model, falling back gracefully."""
        try:
            from strands import Agent, tool

            @tool
            def get_overdue_contacts() -> str:
                """Returns a summary of all contacts who are overdue for connection."""
                overdue = storage.get_overdue_people()
                items = []
                for p in overdue:
                    items.append({
                        "id": p.id,
                        "name": p.name,
                        "relationship": p.relationship,
                        "days_overdue": p.days_overdue,
                        "frequency_days": p.checkin_frequency_days,
                        "preferred_channel": p.preferred_channel
                    })
                return json.dumps(items)

            @tool
            def fetch_person_context(person_id: str) -> str:
                """Retrieves all memory anchors, routines, notes, and facts for a given person."""
                person = storage.get_person(person_id)
                if not person:
                    return json.dumps({"error": f"Person with ID {person_id} not found."})
                return json.dumps({
                    "id": person.id,
                    "name": person.name,
                    "relationship": person.relationship,
                    "notes": person.notes,
                    "preferred_channel": person.preferred_channel,
                    "facts": [f.model_dump() for f in person.facts]
                })

            self.agent_tools = [get_overdue_contacts, fetch_person_context]

            if not self.use_mock:
                # Try primary model first
                try:
                    self.agent = self._build_agent(self.bedrock_model_id)
                    self.active_model_id = self.bedrock_model_id
                    logger.info("✅ Strands Agent live on Bedrock: %s", self.bedrock_model_id)
                except Exception as e:
                    logger.warning("⚠️  Primary model %s unavailable (%s), trying fallback...", self.bedrock_model_id, e)
                    # Try fallback model
                    try:
                        self.agent = self._build_agent(self.fallback_model_id)
                        self.active_model_id = self.fallback_model_id
                        logger.info("✅ Strands Agent live on Bedrock (fallback): %s", self.fallback_model_id)
                    except Exception as e2:
                        logger.warning("⚠️  Fallback model also unavailable (%s). Using local simulator.", e2)
                        self.agent = None
                        self.active_model_id = None
            else:
                self.agent = None
                self.active_model_id = None
                logger.info("Strands Recall Agent running in high-fidelity simulator mode.")
        except Exception as e:
            logger.warning("Could not initialize strands agent package: %s", e)
            self.agent = None
            self.active_model_id = None

    def is_live_bedrock(self) -> bool:
        return self.agent is not None and not self.use_mock

    def get_mode_label(self) -> str:
        """Returns a human-readable label for the current agent mode."""
        if self.is_live_bedrock():
            return f"live_bedrock:{self.active_model_id}"
        return "simulator"

    def scan_circle(self) -> Dict[str, Any]:
        """Scans the circle and identifies all overdue contacts."""
        all_people = storage.get_all_people()
        overdue_people = storage.get_overdue_people()
        return {
            "total_contacts": len(all_people),
            "overdue_count": len(overdue_people),
            "overdue_contacts": [p.to_dict_with_status() for p in overdue_people],
            "mode": self.get_mode_label()
        }

    def draft_checkin(self, person_id: str) -> Optional[DraftMessage]:
        """Generates a personalized draft for an overdue person using stored facts."""
        person = storage.get_person(person_id)
        if not person:
            return None

        draft_content = None

        # Check if live Bedrock Strands agent is available
        if self.is_live_bedrock():
            try:
                prompt = (
                    f"Please craft a warm, empathetic check-in message for {person.name} ({person.relationship}). "
                    f"Use tool fetch_person_context('{person.id}') to look up their stored memories and routines. "
                    f"Anchor the message in specific details and avoid stressful memory tests or generic cliches."
                )
                result = self.agent(prompt, structured_output_model=CheckinDraftOutput)
                if result and result.structured_output:
                    draft_content = {
                        "message": result.structured_output.message,
                        "reasoning": result.structured_output.reasoning,
                        "channel": result.structured_output.channel or person.preferred_channel
                    }
                elif result and result.message:
                    draft_content = {
                        "message": str(result.message),
                        "reasoning": f"Generated by live Strands Agent on Amazon Bedrock ({self.bedrock_model_id})",
                        "channel": person.preferred_channel
                    }
            except Exception as ex:
                err_str = str(ex)
                if "503" in err_str or "capacity" in err_str.lower() or "UNAVAILABLE" in err_str:
                    logger.warning("🔄 Bedrock capacity error for %s, auto-switching to local simulator: %s", self.active_model_id, ex)
                else:
                    logger.warning("Error invoking live Strands Agent on Bedrock: %s. Using local fallback.", ex)
                draft_content = None

        # Fallback to rich local generator if not connected to live Bedrock
        if not draft_content:
            draft_content = generate_personalized_text_local(person)
        
        draft = DraftMessage(
            person_id=person.id,
            person_name=person.name,
            message=draft_content["message"],
            reasoning=draft_content["reasoning"],
            channel=draft_content["channel"],
            status="pending"
        )
        
        # Save to draft store
        saved_draft = storage.save_draft(draft)
        return saved_draft

    def approve_draft(self, draft_id: str, edited_message: Optional[str] = None) -> Optional[DraftMessage]:
        """Approves and simulates sending the draft message."""
        return storage.update_draft_status(draft_id, "sent", edited_message)

    def reject_draft(self, draft_id: str) -> Optional[DraftMessage]:
        """Rejects the draft."""
        return storage.update_draft_status(draft_id, "rejected")


recall_agent = RecallAgentService()
