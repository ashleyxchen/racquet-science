import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.main import app
from app.database import Base, get_db


# Test database
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=True)
test_async_session_maker = async_sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)


async def override_get_db():
    async with test_async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture
async def setup_database():
    """Create tables before tests and drop after."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.mark.asyncio
async def test_create_session(setup_database):
    """Test creating a new session."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/sessions",
            json={
                "metadata": {"test": "data"}
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["id"] == 1
        assert data["status"] == "created"
        assert data["has_video"] is False
        assert data["metadata"]["test"] == "data"


@pytest.mark.asyncio
async def test_list_sessions(setup_database):
    """Test listing sessions."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Create a session first
        await client.post("/api/sessions", json={})

        # List sessions
        response = await client.get("/api/sessions")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["sessions"]) == 1


@pytest.mark.asyncio
async def test_get_session(setup_database):
    """Test getting a specific session."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Create a session
        create_response = await client.post("/api/sessions", json={})
        session_id = create_response.json()["id"]

        # Get session
        response = await client.get(f"/api/sessions/{session_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == session_id


@pytest.mark.asyncio
async def test_delete_session(setup_database):
    """Test deleting a session."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Create a session
        create_response = await client.post("/api/sessions", json={})
        session_id = create_response.json()["id"]

        # Delete session
        response = await client.delete(f"/api/sessions/{session_id}")
        assert response.status_code == 204

        # Verify it's gone
        get_response = await client.get(f"/api/sessions/{session_id}")
        assert get_response.status_code == 404
