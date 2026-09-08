import json

import listEvents
from conftest import fake_table


def test_returns_sorted_events(monkeypatch):
    monkeypatch.setattr(listEvents, "events_table", lambda: fake_table(scan={
        "Items": [
            {"eventId": "1", "name": "Summit A", "createdAt": "2026-01-01T00:00:00Z"},
            {"eventId": "2", "name": "Summit B", "createdAt": "2026-06-01T00:00:00Z"},
        ],
    }))

    res = listEvents.handler({"httpMethod": "GET"}, None)
    assert res["statusCode"] == 200
    body = json.loads(res["body"])
    assert len(body) == 2
    # Most recent first
    assert body[0]["eventId"] == "2"


def test_returns_empty_array(monkeypatch):
    monkeypatch.setattr(listEvents, "events_table", lambda: fake_table(scan={"Items": []}))

    res = listEvents.handler({"httpMethod": "GET"}, None)
    assert res["statusCode"] == 200
    assert json.loads(res["body"]) == []


def test_returns_500_on_dynamodb_error(monkeypatch):
    table = fake_table()
    table.scan.side_effect = Exception("DynamoDB unavailable")
    monkeypatch.setattr(listEvents, "events_table", lambda: table)

    res = listEvents.handler({"httpMethod": "GET"}, None)
    assert res["statusCode"] == 500


def test_options_preflight():
    res = listEvents.handler({"httpMethod": "OPTIONS"}, None)
    assert res["statusCode"] == 200
