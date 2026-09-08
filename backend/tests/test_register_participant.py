import json

import registerParticipant
from conftest import fake_table

BASE_EVENT = {
    "httpMethod": "POST",
    "pathParameters": {"eventId": "evt-123"},
    "requestContext": {"authorizer": {"claims": {}}},
    "body": json.dumps({
        "fullName": "Ama Owusu",
        "organisation": "National Bank",
        "email": "ama@bank.com",
        "phone": "0201234567",
    }),
}

OPEN_EVENT = {"eventId": "evt-123", "name": "Summit", "registrationOpen": True}


def _wire(monkeypatch, events_table, registrations_table):
    monkeypatch.setattr(registerParticipant, "events_table", lambda: events_table)
    monkeypatch.setattr(registerParticipant, "registrations_table", lambda: registrations_table)
    monkeypatch.setattr(registerParticipant, "audit", lambda *a, **k: None)


def test_returns_200_with_registration_number(monkeypatch):
    _wire(monkeypatch,
          fake_table(get_item={"Item": OPEN_EVENT}),
          fake_table(query={"Items": []}, put_item={}))

    res = registerParticipant.handler(BASE_EVENT, None)
    assert res["statusCode"] == 200
    body = json.loads(res["body"])
    assert body["registrationNumber"]
    assert body["registrationId"]


def test_returns_400_when_registration_closed(monkeypatch):
    _wire(monkeypatch,
          fake_table(get_item={"Item": {**OPEN_EVENT, "registrationOpen": False}}),
          fake_table())

    res = registerParticipant.handler(BASE_EVENT, None)
    assert res["statusCode"] == 400
    assert "closed" in json.loads(res["body"])["error"].lower()


def test_returns_409_on_duplicate_email(monkeypatch):
    _wire(monkeypatch,
          fake_table(get_item={"Item": OPEN_EVENT}),
          fake_table(query={"Items": [{"registrationId": "existing"}]}))

    res = registerParticipant.handler(BASE_EVENT, None)
    assert res["statusCode"] == 409


def test_returns_404_when_event_missing(monkeypatch):
    _wire(monkeypatch, fake_table(get_item={}), fake_table())

    res = registerParticipant.handler(BASE_EVENT, None)
    assert res["statusCode"] == 404


def test_returns_400_when_fullname_missing(monkeypatch):
    res = registerParticipant.handler({
        **BASE_EVENT,
        "body": json.dumps({"organisation": "Bank", "email": "x@x.com"}),
    }, None)
    assert res["statusCode"] == 400


def test_returns_400_when_email_invalid(monkeypatch):
    res = registerParticipant.handler({
        **BASE_EVENT,
        "body": json.dumps({"fullName": "Ama", "organisation": "Bank", "email": "not-an-email"}),
    }, None)
    assert res["statusCode"] == 400


def test_options_preflight():
    res = registerParticipant.handler({"httpMethod": "OPTIONS"}, None)
    assert res["statusCode"] == 200
