import json
from unittest.mock import MagicMock

import pytest
import sendConfirmationEmail
from conftest import fake_table

PAYLOAD = {
    "registrationId": "reg-1",
    "email": "ama@bank.com",
    "fullName": "Ama Owusu",
    "registrationNumber": "SUMMIT-0001",
    "eventName": "Summit",
    "eventDate": "2026-10-05T09:00:00Z",
    "venue": "AccraICC",
}


def sns_event(message):
    return {"Records": [{"Sns": {"Message": json.dumps(message)}}]}


def _wire(monkeypatch):
    ses = MagicMock()
    table = fake_table()
    monkeypatch.setattr(sendConfirmationEmail, "_ses_client", lambda: ses)
    monkeypatch.setattr(sendConfirmationEmail, "registrations_table", lambda: table)
    monkeypatch.setattr(sendConfirmationEmail, "audit", lambda *a, **k: None)
    return ses, table


def test_sends_email_and_stamps_registration(monkeypatch):
    ses, table = _wire(monkeypatch)

    sendConfirmationEmail.handler(sns_event(PAYLOAD), None)

    ses.send_email.assert_called_once()
    kwargs = ses.send_email.call_args.kwargs
    assert kwargs["Destination"]["ToAddresses"] == ["ama@bank.com"]
    assert kwargs["FromEmailAddress"] == "noreply@example.com"
    html = kwargs["Content"]["Simple"]["Body"]["Html"]["Data"]
    assert "SUMMIT-0001" in html and "Ama Owusu" in html and "AccraICC" in html
    table.update_item.assert_called_once()
    assert "emailSentAt" in table.update_item.call_args.kwargs["UpdateExpression"]


def test_missing_event_date_renders_placeholder(monkeypatch):
    ses, _ = _wire(monkeypatch)

    sendConfirmationEmail.handler(sns_event({**PAYLOAD, "eventDate": None}), None)

    html = ses.send_email.call_args.kwargs["Content"]["Simple"]["Body"]["Text"]["Data"]
    assert "To be announced" in html


def test_unparseable_message_skipped_without_error(monkeypatch):
    ses, _ = _wire(monkeypatch)

    sendConfirmationEmail.handler({"Records": [{"Sns": {"Message": "not json"}}]}, None)

    ses.send_email.assert_not_called()


def test_message_without_email_skipped(monkeypatch):
    ses, _ = _wire(monkeypatch)

    sendConfirmationEmail.handler(sns_event({"registrationId": "reg-1"}), None)

    ses.send_email.assert_not_called()


def test_ses_failure_propagates_for_sns_retry(monkeypatch):
    ses, _ = _wire(monkeypatch)
    ses.send_email.side_effect = RuntimeError("MessageRejected")

    with pytest.raises(RuntimeError):
        sendConfirmationEmail.handler(sns_event(PAYLOAD), None)


def test_format_date_readable():
    assert sendConfirmationEmail.format_date("2026-10-05T09:00:00Z") == "Monday, 5 October 2026"
