import os
import sys

# Add parent directory to sys.path so project modules (main, config, database, etc.) can be imported
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from main import app

# Export app for Vercel ASGI serverless handler
__all__ = ["app"]
