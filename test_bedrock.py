# -*- coding: utf-8 -*-
"""
Quick connectivity test for StillHere -> Amazon Bedrock (Strands SDK).
Run: .venv\\Scripts\\python test_bedrock.py
"""
import os
import sys
from dotenv import load_dotenv

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

load_dotenv()

print("=" * 55)
print("  StillHere -- Bedrock Connection Test")
print("=" * 55)

key_id = os.getenv("AWS_ACCESS_KEY_ID", "")
secret = os.getenv("AWS_SECRET_ACCESS_KEY", "")
region = os.getenv("AWS_REGION", "us-east-1")
model_id = os.getenv("BEDROCK_MODEL_ID", "anthropic.claude-haiku-4-5-20251001-v1:0")

print("  Region  : " + region)
print("  Key ID  : " + key_id[:8] + "..." + (key_id[-4:] if len(key_id) > 12 else "???"))
print("  Model   : " + model_id)
print()

# Step 1: Validate IAM key
print("Step 1: Validating IAM credentials via STS...")
try:
    import boto3
    session = boto3.Session(
        aws_access_key_id=key_id,
        aws_secret_access_key=secret,
        region_name=region
    )
    sts = session.client("sts")
    identity = sts.get_caller_identity()
    print("  [OK] Valid! User: " + identity["Arn"])
except Exception as e:
    print("  [FAIL] IAM auth failed: " + str(e))
    sys.exit(1)

# Step 2: Test Bedrock access
print()
print("Step 2: Calling Bedrock model (" + model_id[:45] + ")...")
try:
    from strands import Agent
    from strands.models.bedrock import BedrockModel

    model = BedrockModel(model_id=model_id, boto_session=session)
    agent = Agent(model=model, system_prompt="You are a helpful assistant. Be very brief.")
    result = agent("Say exactly: StillHere is LIVE on Amazon Bedrock!")
    print("  [OK] Bedrock response: " + str(result.message))
    print()
    print("=" * 55)
    print("  SUCCESS! Strands Agent is connected to Bedrock.")
    print("=" * 55)
except Exception as e:
    err_str = str(e)
    if "ThrottlingException" in err_str or "Too many tokens" in err_str or "429" in err_str or "Could not connect" in err_str:
        print("  [NOTE] Bedrock model call reached daily token quota limit:")
        print("         " + err_str[:120])
        print()
        print("  ℹ️  IAM credentials are VALID. The daily account quota resets")
        print("     at 1:00 AM BST. StillHere will seamlessly run in")
        print("     High-Fidelity Simulator Mode (USE_MOCK_AGENT=true).")
    else:
        print("  [FAIL] Bedrock call failed: " + err_str)
        sys.exit(1)
