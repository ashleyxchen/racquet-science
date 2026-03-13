#!/usr/bin/env python3
"""
Quick test script to verify the backend setup is working.
Run this after installing requirements.txt
"""

import asyncio
import sys


async def test_imports():
    """Test that all required modules can be imported."""
    try:
        print("Testing imports...")
        from app.main import app
        from app.database import init_db
        from app.models import Session, SensorSample
        from app.schemas import SessionCreate, SessionResponse
        print("✓ All imports successful")
        return True
    except Exception as e:
        print(f"✗ Import failed: {e}")
        return False


async def test_database():
    """Test database initialization."""
    try:
        print("\nTesting database...")
        from app.database import init_db, engine

        # Initialize database
        await init_db()
        print("✓ Database initialized successfully")

        # Close engine
        await engine.dispose()
        return True
    except Exception as e:
        print(f"✗ Database test failed: {e}")
        return False


async def main():
    """Run all tests."""
    print("=" * 50)
    print("Backend Setup Test")
    print("=" * 50)

    tests = [
        test_imports(),
        test_database(),
    ]

    results = await asyncio.gather(*tests)

    print("\n" + "=" * 50)
    if all(results):
        print("✓ All tests passed! Backend is ready to use.")
        print("\nTo start the server, run:")
        print("  uvicorn app.main:app --reload")
        print("\nOr use the convenience script:")
        print("  ./run.sh")
        return 0
    else:
        print("✗ Some tests failed. Please check the errors above.")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
