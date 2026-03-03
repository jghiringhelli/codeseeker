# Python: JWT authentication decorator pattern
# Paradigm: Decorator / functional wrapping, Flask middleware
import functools
import jwt
from flask import request, jsonify, g
from datetime import datetime, timedelta, timezone
from typing import Callable, Any

SECRET_KEY = "change-me-in-production"
ALGORITHM = "HS256"


def create_access_token(user_id: str, roles: list[str], expires_minutes: int = 60) -> str:
    """Issue a signed JWT bearer token with user_id, roles, and expiry."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "roles": roles,
        "iat": now,
        "exp": now + timedelta(minutes=expires_minutes),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def login_required(func: Callable) -> Callable:
    """Decorator: require a valid Bearer JWT token in the Authorization header."""
    @functools.wraps(func)
    def decorated(*args: Any, **kwargs: Any) -> Any:
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing Bearer token"}), 401

        token = auth_header[7:]
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            g.current_user = payload
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token signature"}), 401

        return func(*args, **kwargs)

    return decorated


def require_role(role: str) -> Callable:
    """Decorator factory: restrict route access to users with a specific role."""
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapped(*args: Any, **kwargs: Any) -> Any:
            user = getattr(g, "current_user", None)
            if user is None or role not in user.get("roles", []):
                return jsonify({"error": f"Role '{role}' required"}), 403
            return func(*args, **kwargs)
        return wrapped
    return decorator


# Usage example (not executed in tests):
# @app.route("/admin")
# @login_required
# @require_role("admin")
# def admin_dashboard():
#     return jsonify({"user": g.current_user})
