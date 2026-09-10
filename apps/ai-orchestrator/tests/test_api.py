"""The HTTP surface: the one process reachable from off-cluster.

test_events.py covers the logic these endpoints call. This covers the wiring:
whether a verified event actually reaches Temporal, what the pod reports when
Temporal does not, and which branches a real deployment can reach at all.
"""

from __future__ import annotations

import hashlib
import hmac
import json
from contextlib import asynccontextmanager
from dataclasses import replace

import httpx
import pytest
import pytest_asyncio
from temporalio.client import Client
from temporalio.service import RPCError, RPCStatusCode

from orchestrator import api
from orchestrator.settings import task_workflow_id

from conftest import TASK_QUEUE

SECRET = "test-webhook-secret"


# --------------------------------------------------------------------- helpers


def card_payload(
    card_id: str = "card-api-1",
    event: str = "card.created",
    list_name: str = "Spec",
    timestamp: str = "2026-09-10T00:00:00.000Z",
    user: dict | None = None,
) -> dict:
    """A kan delivery, shaped as `packages/api/src/utils/webhook.ts` sends it."""
    payload = {
        "event": event,
        "timestamp": timestamp,
        "data": {
            "board": {"id": "board-1", "name": "Example Project"},
            "card": {"publicId": card_id, "title": "a card", "listId": "list-1"},
            "list": {"name": list_name},
        },
    }
    if user is not None:
        payload["data"]["user"] = user
    return payload


def signed(payload: dict, secret: str = SECRET) -> tuple[bytes, dict[str, str]]:
    """Sign the exact bytes, as kan does — not a re-serialization of the parse."""
    body = json.dumps(payload).encode()
    signature = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return body, {"x-webhook-signature": signature, "content-type": "application/json"}


@asynccontextmanager
async def http(*, raise_app_exceptions: bool = True):
    """Drive the ASGI app directly."""
    transport = httpx.ASGITransport(app=api.app, raise_app_exceptions=raise_app_exceptions)
    async with httpx.AsyncClient(transport=transport, base_url="http://api.test") as client:
        yield client


class BrokenTemporal:
    """A client that connected once and whose server has since gone away."""

    status = RPCStatusCode.UNAVAILABLE

    def _boom(self):
        raise RPCError("connection refused", self.status, b"")

    @property
    def service_client(self):
        return self

    async def check_health(self, **_kwargs):
        self._boom()

    async def start_workflow(self, *_args, **_kwargs):
        self._boom()

    def get_workflow_handle(self, *_args, **_kwargs):
        return self

    async def query(self, *_args, **_kwargs):
        self._boom()

    async def signal(self, *_args, **_kwargs):
        self._boom()


class MissingWorkflow(BrokenTemporal):
    """The other RPC failure: the server is fine, the workflow is not there."""

    status = RPCStatusCode.NOT_FOUND


# -------------------------------------------------------------------- fixtures


@pytest_asyncio.fixture
async def wired(worker, monkeypatch):
    """Point the api module at the test server, with a known webhook secret."""
    monkeypatch.setattr(api, "_client", worker)
    monkeypatch.setattr(
        api,
        "_settings",
        replace(
            api._settings,
            task_queue=TASK_QUEUE,
            kan_webhook_secret=SECRET,
            kan_self_actor_id="",
        ),
    )
    return worker


@pytest.fixture
def offline(monkeypatch):
    """`api` wired to a Temporal that is unreachable."""
    monkeypatch.setattr(api, "_client", BrokenTemporal())
    monkeypatch.setattr(api, "_settings", replace(api._settings, kan_webhook_secret=SECRET))
    return api._client


async def _exists(client: Client, workflow_id: str) -> bool:
    try:
        await client.get_workflow_handle(workflow_id).describe()
        return True
    except RPCError:
        return False


# ----------------------------------------------------------------------- tests


class TestLifespan:
    """Which of `api.py`'s branches a running server can actually reach."""

    async def test_the_client_is_connected_before_the_app_serves_anything(self, monkeypatch):
        """`_temporal()`'s 503 is unreachable through a server, and here is why."""
        assert api.app.router.lifespan_context is api.lifespan

        monkeypatch.setattr(api, "_client", None)
        sentinel = object()

        async def fake_connect(*_args, **_kwargs):
            return sentinel

        monkeypatch.setattr(Client, "connect", fake_connect)

        async with api.lifespan(api.app):
            # Anything served from inside the yield sees a connected client.
            assert api._client is sentinel
            assert api._temporal() is sentinel

    async def test_a_failed_connection_stops_the_app_starting_rather_than_serving_503(
        self, monkeypatch
    ):
        """The other half: connect failure never becomes a 503, it aborts boot."""
        monkeypatch.setattr(api, "_client", None)

        async def refuse(*_args, **_kwargs):
            raise RPCError("connection refused", RPCStatusCode.UNAVAILABLE, b"")

        monkeypatch.setattr(Client, "connect", refuse)

        with pytest.raises(RPCError):
            async with api.lifespan(api.app):
                pytest.fail("the lifespan must not yield when connect fails")

        assert api._client is None

    async def test_the_503_branch_is_reachable_only_by_skipping_the_lifespan(self, monkeypatch):
        """Recorded so the branch is not mistaken for production coverage."""
        monkeypatch.setattr(api, "_client", None)
        monkeypatch.setattr(api, "_settings", replace(api._settings, kan_webhook_secret=SECRET))

        body, headers = signed(card_payload())
        async with http() as client:
            response = await client.post("/webhooks/board", content=body, headers=headers)

        assert response.status_code == 503
        assert response.json()["detail"] == "temporal client not ready"


class TestHealthAndReadiness:
    async def test_liveness_stays_green_while_every_webhook_is_dropped(self, offline):
        """The pod calls itself healthy while losing events. Deliberate."""
        body, headers = signed(card_payload())
        async with http() as client:
            health = await client.get("/healthz")
            webhook = await client.post("/webhooks/board", content=body, headers=headers)

        assert health.status_code == 200
        assert health.json() == {"status": "ok"}
        # Same request, same moment: the pod calls itself healthy while losing
        # an event kan will never send again.
        assert webhook.status_code == 503

    async def test_readiness_goes_red_when_temporal_is_unreachable(self, offline):
        """The signal liveness deliberately does not carry."""
        async with http() as client:
            response = await client.get("/readyz")

        assert response.status_code == 503
        assert response.json()["detail"] == "temporal unavailable"

    async def test_readiness_is_green_against_a_live_server(self, wired):
        async with http() as client:
            response = await client.get("/readyz")

        assert response.status_code == 200
        assert response.json() == {"status": "ready"}

    async def test_readiness_is_green_with_no_worker_polling(self, env, monkeypatch):
        """A readiness probe that also failed on a worker outage would be wrong."""
        monkeypatch.setattr(api, "_client", env.client)

        async with http() as client:
            response = await client.get("/readyz")

        assert response.status_code == 200
        assert response.json() == {"status": "ready"}


class TestBoardWebhook:
    async def test_a_signed_delivery_reaches_the_card_workflow(self, wired):
        payload = card_payload(card_id="card-deliver")
        workflow_id = task_workflow_id("card-deliver")

        # The assertion below means nothing unless the workflow is absent
        # first. A leftover run from another test would satisfy every check.
        assert not await _exists(wired, workflow_id)

        body, headers = signed(payload)
        async with http() as client:
            response = await client.post("/webhooks/board", content=body, headers=headers)

        assert response.status_code == 202
        status = await wired.get_workflow_handle(workflow_id).query("status")
        assert status["card_id"] == "card-deliver"
        assert status["board"] == "Example Project"
        # The signal was not merely accepted — it was applied.
        assert status["events_handled"] == 1

    async def test_a_second_delivery_signals_the_running_workflow(self, wired):
        """Call it twice: the second delivery must signal, not fail."""
        workflow_id = task_workflow_id("card-twice")
        first_body, first_headers = signed(card_payload(card_id="card-twice"))
        second_body, second_headers = signed(
            card_payload(card_id="card-twice", timestamp="2026-09-10T00:00:01.000Z")
        )

        async with http() as client:
            first = await client.post("/webhooks/board", content=first_body, headers=first_headers)
            second = await client.post(
                "/webhooks/board", content=second_body, headers=second_headers
            )

        assert (first.status_code, second.status_code) == (202, 202)
        status = await wired.get_workflow_handle(workflow_id).query("status")
        # One workflow, both events. A second *run* would report 1.
        assert status["events_handled"] == 2

    async def test_a_redelivery_of_the_same_event_is_accepted_and_ignored(self, wired):
        """Byte-identical redelivery: 202 at the edge, deduped in the workflow."""
        workflow_id = task_workflow_id("card-dupe")
        body, headers = signed(card_payload(card_id="card-dupe"))

        async with http() as client:
            first = await client.post("/webhooks/board", content=body, headers=headers)
            second = await client.post("/webhooks/board", content=body, headers=headers)

        assert (first.status_code, second.status_code) == (202, 202)
        status = await wired.get_workflow_handle(workflow_id).query("status")
        assert status["events_handled"] == 1

    async def test_an_unsigned_delivery_is_rejected_and_starts_nothing(self, wired):
        workflow_id = task_workflow_id("card-unsigned")
        body = json.dumps(card_payload(card_id="card-unsigned")).encode()

        async with http() as client:
            response = await client.post(
                "/webhooks/board", content=body, headers={"content-type": "application/json"}
            )

        assert response.status_code == 400
        # The rejection has to happen before Temporal is touched, or an
        # unauthenticated caller could mint a workflow per request.
        assert not await _exists(wired, workflow_id)

    async def test_a_wrong_signature_is_rejected_and_starts_nothing(self, wired):
        workflow_id = task_workflow_id("card-badsig")
        body, headers = signed(card_payload(card_id="card-badsig"), secret="not-the-secret")

        async with http() as client:
            response = await client.post("/webhooks/board", content=body, headers=headers)

        assert response.status_code == 400
        assert not await _exists(wired, workflow_id)

    async def test_a_missing_secret_rejects_every_delivery(self, wired, monkeypatch):
        """Fail closed."""
        monkeypatch.setattr(api, "_settings", replace(api._settings, kan_webhook_secret=""))
        workflow_id = task_workflow_id("card-nosecret")
        # Correctly signed for the secret the deployment *should* have.
        body, headers = signed(card_payload(card_id="card-nosecret"))

        async with http() as client:
            response = await client.post("/webhooks/board", content=body, headers=headers)

        assert response.status_code == 400
        assert not await _exists(wired, workflow_id)

    async def test_the_orchestrators_own_writes_are_dropped_without_starting_a_workflow(
        self, wired, monkeypatch
    ):
        """The loop guard, at the edge."""
        monkeypatch.setattr(api, "_settings", replace(api._settings, kan_self_actor_id="self-1"))
        workflow_id = task_workflow_id("card-selfloop")
        body, headers = signed(
            card_payload(card_id="card-selfloop", user={"id": "self-1", "name": "orchestrator"})
        )

        async with http() as client:
            response = await client.post("/webhooks/board", content=body, headers=headers)

        assert response.status_code == 204
        assert not await _exists(wired, workflow_id)

    async def test_a_human_event_still_passes_while_the_marker_is_configured(
        self, wired, monkeypatch
    ):
        """Prove the filter above is not simply dropping everything."""
        monkeypatch.setattr(api, "_settings", replace(api._settings, kan_self_actor_id="self-1"))
        workflow_id = task_workflow_id("card-human")
        body, headers = signed(
            card_payload(card_id="card-human", user={"id": "human-9", "name": "Christian"})
        )

        async with http() as client:
            response = await client.post("/webhooks/board", content=body, headers=headers)

        assert response.status_code == 202
        assert await _exists(wired, workflow_id)

    async def test_an_unknown_event_kind_is_rejected_rather_than_crashing(self, wired):
        body, headers = signed(card_payload(event="card.archived"))

        async with http() as client:
            response = await client.post("/webhooks/board", content=body, headers=headers)

        assert response.status_code == 400

    async def test_temporal_being_down_is_a_5xx_not_a_4xx(self, offline):
        """A 4xx would tell kan the delivery was bad. It was ours that was bad."""
        body, headers = signed(card_payload())

        async with http() as client:
            response = await client.post("/webhooks/board", content=body, headers=headers)

        assert response.status_code == 503


class TestOperatorEndpoints:
    """`/tasks`, `/dispatcher`, `/shifts/*` — ClusterIP-only, human-facing."""

    async def test_a_missing_workflow_is_404(self, wired):
        async with http() as client:
            response = await client.get("/tasks/no-such-card")

        assert response.status_code == 404

    async def test_temporal_being_down_is_not_reported_as_a_missing_card(self, offline):
        """Regression: this used to 404."""
        async with http() as client:
            task = await client.get("/tasks/card-1")
            dispatcher = await client.get("/dispatcher")

        assert task.status_code == 503
        assert dispatcher.status_code == 503

    async def test_a_missing_dispatcher_is_still_404(self, monkeypatch):
        """Prove the 503 above is not simply "everything is 503"."""
        monkeypatch.setattr(api, "_client", MissingWorkflow())

        async with http() as client:
            task = await client.get("/tasks/card-1")
            dispatcher = await client.get("/dispatcher")

        assert task.status_code == 404
        assert dispatcher.status_code == 404

    async def test_opening_a_shift_while_temporal_is_down_reports_503_not_500(self, offline):
        """These three used to catch nothing at all."""
        async with http(raise_app_exceptions=False) as client:
            start = await client.post("/shifts/start", json={"actor": "christian"})
            beat = await client.post("/shifts/shift-1/heartbeat")
            stop = await client.post("/shifts/shift-1/stop")

        assert [start.status_code, beat.status_code, stop.status_code] == [503, 503, 503]

    async def test_a_shift_can_be_opened_heartbeaten_and_stopped(self, wired):
        """The happy path, end to end through the real dispatcher."""
        from orchestrator.workflows.dispatcher import DesktopDispatcherWorkflow, DispatcherState

        dispatcher_id = api._settings.dispatcher_workflow_id
        await wired.start_workflow(
            DesktopDispatcherWorkflow.run,
            DispatcherState(desktop_id=api._settings.desktop_id),
            id=dispatcher_id,
            task_queue=TASK_QUEUE,
        )

        async with http() as client:
            before = await client.get("/dispatcher")
            start = await client.post("/shifts/start", json={"actor": "christian", "minutes": 60})
            shift_id = start.json()["shift_id"]
            beat = await client.post(f"/shifts/{shift_id}/heartbeat")
            after = await client.get("/dispatcher")
            stop = await client.post(f"/shifts/{shift_id}/stop")

        assert before.json()["shift_id"] in (None, "")
        assert start.status_code == 200
        assert beat.status_code == 200
        assert stop.status_code == 200
        # The signal reached the workflow, not just the endpoint.
        assert after.json()["shift_id"] == shift_id

    async def test_a_shift_longer_than_a_day_is_refused_by_the_schema(self, wired):
        async with http() as client:
            response = await client.post("/shifts/start", json={"actor": "x", "minutes": 4321})

        assert response.status_code == 422
