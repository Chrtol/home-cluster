"""FastAPI process: the board webhook and the operator/shift endpoints.

Separate process, same image, per plan §7. Only `POST /webhooks/board` is routed
from outside the cluster; everything else is ClusterIP-only and reached by
port-forward until Phase 3 gives the shift endpoints a real authentication
story.

The webhook's authentication *is* the HMAC signature. There is no session, no
bearer token and no forward auth on that path, because kan cannot present any of
them — `sendWebhookToUrl` sets exactly three headers and none of them is an
Authorization header.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import FastAPI, HTTPException, Request, Response
from pydantic import BaseModel, Field
from temporalio.client import Client
from temporalio.contrib.pydantic import pydantic_data_converter
from temporalio.service import RPCError

from .board.events import WebhookRejected, loads_payload, normalize, verify_signature
from .contracts import ShiftLease
from .settings import Settings, task_workflow_id
from .workflows.task import TaskState, TaskWorkflow

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("orchestrator.api")

_settings = Settings.from_env()
_client: Client | None = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Connect to Temporal, and nothing else.

    This process runs no Activities, so it needs no kan client, no project
    registry and no Kubernetes client — it verifies a signature, normalizes an
    event and hands it to Temporal. Keeping it that way matters: this is the one
    pod reachable from off-cluster, and it holds no Kubernetes credential and
    creates nothing.
    """
    global _client
    _client = await Client.connect(
        _settings.address,
        namespace=_settings.namespace,
        data_converter=pydantic_data_converter,
    )
    log.info("api ready")
    yield


app = FastAPI(title="ai-orchestrator", lifespan=lifespan)


def _temporal() -> Client:
    if _client is None:
        raise HTTPException(status_code=503, detail="temporal client not ready")
    return _client


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/webhooks/board")
async def board_webhook(request: Request) -> Response:
    """Verify, normalize and durably deliver one kan event.

    Returns 202 only once Temporal has accepted the signal. Plan §8 requires a
    retryable failure when Temporal is unavailable — though with kan that is a
    courtesy rather than a recovery mechanism, since it never retries. The
    reconciliation sweep is what actually recovers a dropped event, so a 5xx
    here means "lost until the next sweep", not "lost forever".
    """
    body = await request.body()

    try:
        verify_signature(
            body, request.headers.get("x-webhook-signature"), _settings.kan_webhook_secret
        )
        event = normalize(loads_payload(body))
    except WebhookRejected as exc:
        # 400, not 401: kan does not act on the status, and a signature failure
        # is not something a retry would fix.
        log.warning("rejected webhook: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Defence in depth for plan §8's loop rule. The state machine is already
    # structurally loop-free — the orchestrator never writes 'Ready for local',
    # the only stage that triggers a dispatch — but if the orchestrator is given
    # its own kan user, its own writes stop round-tripping at all.
    if _settings.kan_self_actor_id and event.actor and event.actor.id == _settings.kan_self_actor_id:
        return Response(status_code=204)

    try:
        await _temporal().start_workflow(
            TaskWorkflow.run,
            TaskState(card_id=event.card_id, board_id=event.board_id, board_name=event.board_name),
            id=task_workflow_id(event.card_id),
            task_queue=_settings.task_queue,
            memo={
                "dispatcher_id": _settings.dispatcher_workflow_id,
                "job_image": _settings.job_image,
            },
            # Start-or-signal: the card's workflow may not exist yet, and the
            # first event about a card is usually card.created.
            start_signal="board_event",
            start_signal_args=[event],
        )
    except RPCError as exc:
        log.error("failed to deliver %s: %s", event.event_key, exc)
        raise HTTPException(status_code=503, detail="temporal unavailable") from exc

    return Response(status_code=202)


@app.get("/tasks/{card_id}")
async def get_task(card_id: str) -> dict[str, Any]:
    handle = _temporal().get_workflow_handle(task_workflow_id(card_id))
    try:
        return await handle.query("status")
    except RPCError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/dispatcher")
async def get_dispatcher() -> dict[str, Any]:
    handle = _temporal().get_workflow_handle(_settings.dispatcher_workflow_id)
    try:
        return await handle.query("status")
    except RPCError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


class StartShift(BaseModel):
    actor: str
    minutes: int = Field(default=480, ge=1, le=1440)


@app.post("/shifts/start")
async def start_shift(body: StartShift) -> dict[str, str]:
    """Authorize a bounded desktop window.

    Phase 2 mints the lease so the dispatcher can be exercised end to end.
    Phase 3 replaces the caller with the PowerShell launcher and gives this
    endpoint a real authenticated identity; `actor` is not yet verified.
    """
    now = datetime.now(timezone.utc)
    shift_id = f"shift-{int(now.timestamp())}"
    lease = ShiftLease(
        shift_id=shift_id,
        actor=body.actor,
        started_at=now.isoformat(timespec="seconds"),
        hard_end=(now + timedelta(minutes=body.minutes)).isoformat(timespec="seconds"),
        heartbeat_at=now.isoformat(timespec="seconds"),
    )
    handle = _temporal().get_workflow_handle(_settings.dispatcher_workflow_id)
    await handle.signal("shift_start", lease)
    return {"shift_id": shift_id, "hard_end": lease.hard_end}


@app.post("/shifts/{shift_id}/heartbeat")
async def heartbeat(shift_id: str) -> dict[str, str]:
    handle = _temporal().get_workflow_handle(_settings.dispatcher_workflow_id)
    await handle.signal(
        "shift_heartbeat", args=[shift_id, datetime.now(timezone.utc).isoformat(timespec="seconds")]
    )
    return {"shift_id": shift_id}


@app.post("/shifts/{shift_id}/stop")
async def stop_shift(shift_id: str) -> dict[str, str]:
    handle = _temporal().get_workflow_handle(_settings.dispatcher_workflow_id)
    await handle.signal("shift_stop", shift_id)
    return {"shift_id": shift_id, "status": "stopping"}
