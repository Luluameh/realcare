import os
import sys
import subprocess
from pathlib import Path
from dotenv import load_dotenv

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent

def main():
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))

    # Determine Python executable
    venv_python = BASE_DIR / ".venv" / "Scripts" / "python.exe"
    python_exe = str(venv_python) if venv_python.exists() else sys.executable

    import socket

    def is_port_in_use(h: str, p: int) -> bool:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            return s.connect_ex((h, p)) == 0

    if is_port_in_use(host, port):
        print(f"\n⚠️  Port {port} is already in use!")
        print(f"👉 The RealCare server is likely already running at http://{host}:{port}")
        print("   If you want to run on a different port, set PORT=8001 in .env or your terminal.\n")
        return

    print("\n=======================================================")
    print("  🌿 RealCare - AI Caregiver & Recall Agent (AWS Hackathon)")
    print(f"  🚀 Server starting on: http://{host}:{port}")
    print("  💡 Press Ctrl+C to stop")
    print("=======================================================\n")

    cmd = [
        python_exe,
        "-m",
        "uvicorn",
        "backend.main:app",
        "--host",
        host,
        "--port",
        str(port),
        "--reload"
    ]
    
    subprocess.run(cmd)

if __name__ == "__main__":
    main()
