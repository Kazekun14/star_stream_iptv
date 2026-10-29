#!/usr/bin/env python3
import requests
import sys
import time
import secrets
import string
import random
import urllib.parse

BASE_URL = "http://127.0.0.1:8100"
USERNAME = "admin"
PASSWORD = "admin"

ALNUM = string.ascii_uppercase + string.digits


def gen_channel_key() -> str:
    return "".join(secrets.choice(ALNUM) for _ in range(8))


def gen_channel_number() -> int:
    return random.randint(1000, 9999)


def die(msg: str):
    print(f"[ERROR] {msg}")
    sys.exit(1)


def ok(msg: str):
    print(f"[OK] {msg}")


def must_json(r: requests.Response):
    try:
        return r.json()
    except Exception:
        die(f"Non-JSON response ({r.status_code}): {r.text[:800]!r}")


def req_json(method: str, url: str, session: requests.Session, **kwargs):
    r = session.request(method, url, timeout=5, **kwargs)
    data = must_json(r) if r.text else None
    return r, data


def assert_ok_200(r, data, label):
    if r.status_code != 200:
        die(f"{label} failed ({r.status_code}): {r.text!r}")
    if not (data or {}).get("ok"):
        die(f"{label} not ok: {data}")


def main():
    session = requests.Session()

    # ==============================================================
    # 1) Health
    # ==============================================================
    r = session.get(f"{BASE_URL}/health", timeout=5)
    if r.status_code != 200:
        die(f"/health failed ({r.status_code}): {r.text!r}")
    ok("/health")

    # ==============================================================
    # 2) Login
    # ==============================================================
    r, data = req_json(
        "POST",
        f"{BASE_URL}/auth/login",
        session,
        json={"username": USERNAME, "password": PASSWORD},
    )
    if r.status_code != 200 or not data.get("ok"):
        die(f"login failed: {data}")

    if "admin_sid" not in session.cookies:
        die("admin_sid cookie not set")

    ok("Login successful")
    print("admin_sid =", session.cookies.get("admin_sid"))

    # ==============================================================
    # 3) /auth/me
    # ==============================================================
    r, data = req_json("GET", f"{BASE_URL}/auth/me", session)
    assert_ok_200(r, data, "/auth/me")
    print("admin =", data.get("admin"))

    # ==============================================================
    # 4) LIVE CATEGORIES (STABLE)
    # ==============================================================
    cat_name = f"Starstream-{int(time.time())}"

    r, data = req_json(
        "POST",
        f"{BASE_URL}/live/categories",
        session,
        json={"category": cat_name},
     )
    if r.status_code != 201:
        die(f"create category failed: {r.text}")

    cat_id = data.get("id")
    ok("live category created")
    print("category_id =", cat_id)

    r, data = req_json("GET", f"{BASE_URL}/live/categories/{cat_id}", session)
    assert_ok_200(r, data, "get category")

    # ==============================================================
    # 5) LIVE CHANNELS (STABLE)
    # ==============================================================
    ch_key = gen_channel_key()
    ch_number = gen_channel_number()
    ch_name = f"Channel-{ch_number}"

    r, data = req_json(
        "POST",
        f"{BASE_URL}/live/channels",
        session,
        json={
            "channel_key": ch_key,
            "name": ch_name,
            "number": ch_number,
            "category_id": cat_id,
            "source_uri": "udp://239.0.0.1:1234",
            "enabled": 1,
        },
    )

    if r.status_code != 201:
        die(f"create channel failed: {r.text}")

    ch_id = data.get("id")
    ok("live channel created")
    print("channel_id =", ch_id)

    # ==============================================================
    # 6) LIVE PACKAGES CRUD + PAGINATION
    # ==============================================================
    pkg_name = f"Package-{int(time.time())}"

    # Create
    r, data = req_json(
        "POST",
        f"{BASE_URL}/live/packages",
        session,
        json={"name": pkg_name, "status": "active"},
    )
    if r.status_code != 201:
        die(f"create live package failed ({r.status_code}): {r.text}")

    pkg_id = data.get("id")
    ok("live package created")
    print("package_id =", pkg_id)

    # List
    r, data = req_json(
        "GET",
        f"{BASE_URL}/live/packages?limit=50&offset=0",
        session,
    )
    assert_ok_200(r, data, "list live packages")
    if not any(i["id"] == pkg_id for i in data.get("items", [])):
        die("package not found in list")
    ok("live packages listed")

    # Get
    r, data = req_json(
        "GET",
        f"{BASE_URL}/live/packages/{pkg_id}",
        session,
    )
    assert_ok_200(r, data, "get live package")
    if data["item"]["name"] != pkg_name:
        die("package name mismatch")
    ok("live package fetched")

    # Update
    r, data = req_json(
        "PUT",
        f"{BASE_URL}/live/packages/{pkg_id}",
        session,
        json={"name": pkg_name + "-Updated", "status": "disabled"},
    )
    assert_ok_200(r, data, "update live package")
    ok("live package updated")

    # Pagination
    r, data = req_json(
        "GET",
        f"{BASE_URL}/live/packages?limit=1&offset=0",
        session,
    )
    assert_ok_200(r, data, "packages pagination")
    ok("packages pagination works")

    # Delete package
    r, data = req_json(
        "DELETE",
        f"{BASE_URL}/live/packages/{pkg_id}",
        session,
    )
    assert_ok_200(r, data, "delete live package")
    ok("live package deleted")

    # ==============================================================
    # Cleanup
    # ==============================================================
    req_json("DELETE", f"{BASE_URL}/live/channels/{ch_id}", session)
    req_json("DELETE", f"{BASE_URL}/live/categories/{cat_id}", session)

    # ==============================================================
    # Logout
    # ==============================================================
    r, data = req_json("POST", f"{BASE_URL}/auth/logout", session)
    assert_ok_200(r, data, "logout")
    ok("Logout successful")

    print("\nALL TESTS PASSED")


if __name__ == "__main__":
    main()
