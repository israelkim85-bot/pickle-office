#!/usr/bin/env python3
"""민수 AI 오피스 — pickle-office Firestore 초기 시드.

REST API(API 키)로 rooms / agents / messages(첫 인사) / _system 을 채운다.
여러 번 실행해도 같은 결과가 되도록 고정 문서 ID에는 PATCH(덮어쓰기)를 쓴다.
사용: python3 seed_firestore.py
"""
import json
import urllib.request
import urllib.error
import datetime

KEY = "AIzaSyAc9O77pmZkBmoThTysqMiknd-cDG-QRIs"
PROJECT = "pickle-office"
BASE = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"

now = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def call(method, path, body=None):
    url = f"{BASE}{path}{'&' if '?' in path else '?'}key={KEY}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")


def s(v):
    return {"stringValue": v}


def b(v):
    return {"booleanValue": v}


def i(v):
    return {"integerValue": str(v)}


def arr(v):
    return {"arrayValue": {"values": [{"stringValue": x} for x in v]}}


def ts(v=now):
    return {"timestampValue": v}


ROOMS = {
    "lobby": {
        "name": s("대회의실"),
        "emoji": s("🏛️"),
        "description": s("공모전 · 프로젝트"),
        "members": arr(["pickle", "muse", "muse3", "musech", "keyring", "buoy"]),
        "isPrivate": b(False),
        "createdAt": ts(),
        "createdBy": s("pickle"),
        "order": i(1),
    },
    "command": {
        "name": s("지휘실"),
        "emoji": s("🩵"),
        "description": s("실무 지휘 · 즉시 실행"),
        "members": arr(["pickle", "muse", "muse3", "musech", "keyring", "buoy"]),
        "isPrivate": b(False),
        "createdAt": ts(),
        "createdBy": s("pickle"),
        "order": i(2),
    },
    "lounge": {
        "name": s("라운지"),
        "emoji": s("☕"),
        "description": s("잡담 · 아이디어"),
        "members": arr(["pickle", "muse", "muse3", "musech", "keyring", "buoy"]),
        "isPrivate": b(False),
        "createdAt": ts(),
        "createdBy": s("pickle"),
        "order": i(3),
    },
}

AGENTS = {
    "pickle": ("솜찬대디", "민수님 전용 비서 · 사역·일상 총괄", True, "🧡", "#fbe6cd", 1,
               ["사역 문서", "영상 제작", "일상 자동화"]),
    "muse": ("뮤즈", "PC 오케스트레이션 총괄", False, "🖥️", "#e6e9f7", 2,
             ["오케스트레이션", "옵시디언", "자동화"]),
    "muse3": ("뮤즈 3호기", "스톡·이모티콘·블로그 채널", False, "📱", "#e4ecf8", 3,
              ["스톡 이미지", "이모티콘", "블로그"]),
    "musech": ("뮤즈 CH", "콘텐츠·채널 운영", False, "💠", "#e2f2f4", 4,
               ["콘텐츠", "채널 운영"]),
    "keyring": ("키링", "설문·기프티콘·주문/배송", False, "🔑", "#f7ebe4", 5,
                ["설문", "기프티콘", "주문·배송"]),
    "buoy": ("부이", "재정·지원금·출석체크", False, "🛟", "#e9f0e6", 6,
             ["가계부", "지원금", "출석체크"]),
}

GREETING = (
    "대장님! 솜찬대디 출근했습니다 🧡\n"
    "대회의실·지휘실·라운지 문 다 열어 뒀어요. "
    "지시는 아래 입력창에 한 줄로 주시면 바로 움직이겠습니다!"
)


def main():
    for rid, fields in ROOMS.items():
        code, res = call("PATCH", f"/rooms/{rid}", {"fields": fields})
        print(f"rooms/{rid}: {code}")

    for aid, (name, role, online, emoji, color, order, caps) in AGENTS.items():
        fields = {
            "displayName": s(name),
            "role": s(role),
            "online": b(online),
            "emoji": s(emoji),
            "color": s(color),
            "order": i(order),
            "capabilities": arr(caps),
            "lastSeenAt": ts(),
        }
        code, res = call("PATCH", f"/agents/{aid}", {"fields": fields})
        print(f"agents/{aid}: {code}")

    # 첫 인사는 이미 있으면 중복 생성하지 않는다
    code, res = call("GET", "/messages?pageSize=300&mask.fieldPaths=agent&mask.fieldPaths=text")
    existing = res.get("documents", []) if isinstance(res, dict) else []
    already = any(
        (d.get("fields", {}).get("text", {}).get("stringValue", "") or "").startswith("대장님! 솜찬대디 출근했습니다")
        for d in existing
    )
    if already:
        print(f"messages: 첫 인사 이미 있음 ({len(existing)}건 확인)")
    else:
        msg = {
            "fields": {
                "roomId": s("lobby"),
                "agent": s("pickle"),
                "author": s("솜찬대디"),
                "text": s(GREETING),
                "type": s("text"),
                "createdAt": ts(),
            }
        }
        code, res = call("POST", "/messages", msg)
        print(f"messages(첫 인사): {code} -> {res.get('name', res)}")

    config = {
        "fields": {
            "schemaVersion": i(1),
            "updatedAt": ts(),
            "notes": s("민수 AI 오피스 시드 — rooms/agents/messages/memos 공용 스키마 v1"),
        }
    }
    code, _ = call("PATCH", "/_system/config", config)
    print(f"_system/config: {code}")

    for coll in ("rooms", "agents", "messages"):
        code, res = call("GET", f"/{coll}")
        print(f"확인 {coll}: {code}, {len(res.get('documents', []))}건")


if __name__ == "__main__":
    main()
