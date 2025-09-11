import sys
from pathlib import Path

# Ensure the app package is importable when tests are run outside the Docker environment
root = Path(__file__).resolve().parents[1]
if str(root) not in sys.path:
    sys.path.insert(0, str(root))
