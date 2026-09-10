"""`JobRunner`: the Kubernetes half of deduplication and fencing.

PHASE_2 §8's gate table records adopt-on-409 as "✅ deterministic names +
adopt-on-409". Only the first half was true. `conftest.FakeWorld.ensure_job`
appends a name and returns; it never raises a 409, so every branch below the
`except ApiException` in `JobRunner.ensure_job` had never executed in a test —
including the identity comparison that is the whole point of adopting.

Everything here fakes the Kubernetes *API calls* and keeps the real model
classes, so the objects asserted on are the objects a real API server would
receive. That matters for the central coupling: `create` writes the handoff
hash onto the Job's own metadata and the adopt path reads it back from there.
Annotate only the pod template and adoption mismatches every time, while a
fake-activity test stays green.
"""

from __future__ import annotations

import pytest
from kubernetes_asyncio.client.exceptions import ApiException
from temporalio.exceptions import ApplicationError

from orchestrator.activities import context as activity_context
from orchestrator.activities import kubernetes as k8s
from orchestrator.contracts import AttemptRef

NAMESPACE = "ai-jobs"


def attempt(handoff_hash: str = "hash-aaa", number: int = 1) -> AttemptRef:
    return AttemptRef(
        task_id="card-probe",
        board_id="board-1",
        handoff_hash=handoff_hash,
        attempt_number=number,
    )


def request(handoff_hash: str = "hash-aaa", **overrides) -> k8s.EnsureJobRequest:
    body = dict(
        attempt=attempt(handoff_hash),
        image="ghcr.io/chrtol/ai-orchestrator:test",
        base_commit="b" * 40,
        repository="chrtol/home-cluster",
    )
    body.update(overrides)
    return k8s.EnsureJobRequest(**body)


class FakeApi:
    """Records calls and replays scripted outcomes.

    A list of outcomes per method, consumed in order: an exception is raised,
    anything else is returned. Running out is an error rather than a repeat,
    so a test that makes an unexpected extra call fails loudly instead of
    quietly getting the previous answer again.
    """

    def __init__(self, **scripts):
        self.scripts = {name: list(values) for name, values in scripts.items()}
        self.calls: list[tuple] = []

    def _next(self, name, *args):
        self.calls.append((name, *args))
        queue = self.scripts.get(name)
        if not queue:
            raise AssertionError(f"unscripted call to {name}{args}")
        outcome = queue.pop(0)
        if isinstance(outcome, BaseException):
            raise outcome
        return outcome

    def names(self) -> list[str]:
        return [call[0] for call in self.calls]

    # --- batch ---
    async def create_namespaced_job(self, namespace, body):
        return self._next("create_job", namespace, body)

    async def read_namespaced_job(self, name, namespace):
        return self._next("read_job", name, namespace)

    async def delete_namespaced_job(self, name, namespace, body=None):
        return self._next("delete_job", name, namespace)

    # --- core ---
    async def list_namespaced_pod(self, namespace, label_selector=None):
        return self._next("list_pods", namespace, label_selector)

    async def read_namespaced_persistent_volume_claim(self, name, namespace):
        return self._next("read_pvc", name, namespace)

    async def create_namespaced_persistent_volume_claim(self, namespace, body):
        return self._next("create_pvc", namespace, body)


class Pod:
    """Just enough of V1Pod for `observe` and `_first_exit_code`."""

    def __init__(self, phase: str, exit_code: int | None = None):
        terminated = _Terminated(exit_code) if exit_code is not None else None
        state = _State(terminated)
        self.status = _PodStatus(phase, [_ContainerStatus(state)] if state else [])


class _Terminated:
    def __init__(self, exit_code):
        self.exit_code = exit_code


class _State:
    def __init__(self, terminated):
        self.terminated = terminated


class _ContainerStatus:
    def __init__(self, state):
        self.state = state


class _PodStatus:
    def __init__(self, phase, container_statuses):
        self.phase = phase
        self.container_statuses = container_statuses


class PodList:
    def __init__(self, pods):
        self.items = pods


class JobStatus:
    def __init__(self, active=0, succeeded=0, failed=0):
        self.active, self.succeeded, self.failed = active, succeeded, failed


class ExistingJob:
    def __init__(self, annotations: dict | None, active=0, succeeded=0, failed=0):
        self.metadata = _Meta(annotations)
        self.status = JobStatus(active, succeeded, failed)


class _Meta:
    def __init__(self, annotations):
        self.annotations = annotations


@pytest.fixture
def api(monkeypatch):
    """Swap the API surface, keep the real V1* model classes."""
    fake = FakeApi()

    class FakeApiClient:
        async def __aenter__(self_inner):
            return self_inner

        async def __aexit__(self_inner, *_exc):
            return False

    monkeypatch.setattr(k8s.client, "ApiClient", FakeApiClient)
    monkeypatch.setattr(k8s.client, "BatchV1Api", lambda _api: fake)
    monkeypatch.setattr(k8s.client, "CoreV1Api", lambda _api: fake)
    return fake


@pytest.fixture
def runner():
    return k8s.JobRunner(namespace=NAMESPACE, storage_class="csi-rbd-sc", workspace_size="5Gi")


def conflict() -> ApiException:
    return ApiException(status=409, reason="AlreadyExists")


class TestEnsureJobAdoption:
    """The gate row that read ✅ and had never run."""

    async def test_a_fresh_attempt_creates_the_job(self, api, runner):
        api.scripts["create_job"] = [None]

        name = await runner.ensure_job(request())

        assert name == attempt().job_name
        assert api.names() == ["create_job"], "a fresh create must not read anything back"

    async def test_the_hash_adoption_compares_is_the_one_create_writes(self, api, runner):
        """The coupling that makes adoption possible, asserted end to end.

        `ensure_job`'s adopt path reads `ANN_HASH` from the *Job's* metadata.
        If `_build_job` put the identity annotations only on the pod template —
        which is where they are also needed, and an easy place to leave them —
        every adoption would raise `JobIdentityMismatch` against a Job it
        created itself. No fake-activity test can see this.
        """
        api.scripts["create_job"] = [None]
        await runner.ensure_job(request("hash-aaa"))

        (_, _, created) = api.calls[0]
        assert created.metadata.annotations[k8s.ANN_HASH] == "hash-aaa"
        # Present on the template too, for anything reading the pod.
        assert created.spec.template.metadata.annotations[k8s.ANN_HASH] == "hash-aaa"

    async def test_a_restart_mid_attempt_adopts_instead_of_duplicating(self, api, runner):
        """Plan §8: a worker that dies after creating a Job must not start a second.

        Kubernetes' name uniqueness does the deduplication; the orchestrator's
        job is only to read the 409 correctly.
        """
        api.scripts["create_job"] = [conflict()]
        api.scripts["read_job"] = [ExistingJob({k8s.ANN_HASH: "hash-aaa"}, active=1)]

        name = await runner.ensure_job(request("hash-aaa"))

        assert name == attempt().job_name
        assert api.names() == ["create_job", "read_job"]

    async def test_adoption_refuses_a_job_left_over_from_another_revision(self, api, runner):
        """The check that makes adoption safe rather than merely convenient.

        Same card, same attempt number, different approved handoff — so the
        deterministic name collides with a Job doing *different* work. Adopting
        it would report the old revision's result against the new approval.
        """
        api.scripts["create_job"] = [conflict()]
        api.scripts["read_job"] = [ExistingJob({k8s.ANN_HASH: "hash-OLD"}, active=1)]

        with pytest.raises(ApplicationError) as caught:
            await runner.ensure_job(request("hash-NEW"))

        assert caught.value.type == "JobIdentityMismatch"
        # Retrying cannot help: the name will keep colliding with the same Job.
        assert caught.value.non_retryable is True
        assert "hash-OLD" in str(caught.value) and "hash-NEW" in str(caught.value)

    async def test_a_new_revision_gets_a_new_name_so_mismatch_is_defence_in_depth(self):
        """Why the identity check above almost never fires in production.

        `AttemptRef.slug` hashes `board:task:handoff_hash`, so approving a new
        revision changes the Job's *name*, not merely its annotation — there is
        no collision left to adopt, and the ordinary re-approval path never
        reaches the mismatch branch at all. What it actually guards is a 10-hex
        slug collision or a hand-made Job of the same name.

        Recorded because the two tests around it would otherwise read as
        evidence that production reaches that branch. It is the same shape as
        `api._temporal()`'s 503: real code, worth keeping, not on a live path.
        """
        assert attempt("hash-aaa").job_name != attempt("hash-NEW").job_name

        # A repair of the *same* handoff keeps the slug, so it shares the
        # workspace tree while still getting a distinct Job per attempt.
        assert attempt("hash-aaa", 2).workspace_name == attempt("hash-aaa", 1).workspace_name
        assert attempt("hash-aaa", 2).job_name != attempt("hash-aaa", 1).job_name

    async def test_a_job_with_no_annotations_at_all_is_not_adopted(self, api, runner):
        """A hand-made Job that happens to share the name is not ours."""
        api.scripts["create_job"] = [conflict()]
        api.scripts["read_job"] = [ExistingJob(None)]

        with pytest.raises(ApplicationError) as caught:
            await runner.ensure_job(request("hash-aaa"))

        assert caught.value.type == "JobIdentityMismatch"

    async def test_an_error_that_is_not_a_conflict_propagates(self, api, runner):
        """§6.5's counterweight: the handler must not treat every failure as adoption.

        A 403 from a missing RBAC Role — §6.1, which actually happened — must
        surface as an infrastructure fault, not be read as "already exists".
        """
        api.scripts["create_job"] = [ApiException(status=403, reason="Forbidden")]

        with pytest.raises(ApiException) as caught:
            await runner.ensure_job(request())

        assert caught.value.status == 403
        assert api.names() == ["create_job"], "must not try to adopt after a non-409"


class TestJobShape:
    """Properties of the built Job that other guarantees depend on."""

    async def test_kubernetes_never_retries_an_attempt_behind_the_workflow(self, api, runner):
        api.scripts["create_job"] = [None]
        await runner.ensure_job(request())

        job = api.calls[0][2]
        # Plan §7: the workflow owns the repair policy. A backoffLimit above 0
        # would silently re-run an attempt the workflow already reported on.
        assert job.spec.backoff_limit == 0
        assert job.spec.template.spec.restart_policy == "Never"

    async def test_the_job_sets_no_ttl(self, api, runner):
        """Plan §12: evidence is retained until collection succeeds.

        A `ttlSecondsAfterFinished` here would recreate §6.7 from inside the
        orchestrator — the very bug just fixed, where a collected Job became
        indistinguishable from an interrupted one.
        """
        api.scripts["create_job"] = [None]
        await runner.ensure_job(request())

        assert api.calls[0][2].spec.ttl_seconds_after_finished is None

    async def test_the_attempt_carries_no_kubernetes_credential(self, api, runner):
        api.scripts["create_job"] = [None]
        await runner.ensure_job(request())

        assert api.calls[0][2].spec.template.spec.automount_service_account_token is False

    async def test_repairs_reuse_the_task_workspace_not_a_per_attempt_one(self, api, runner):
        """One PVC per task: a repair works the tree the first attempt left."""
        api.scripts["create_job"] = [None, None]
        first = attempt("hash-aaa", number=1)
        second = attempt("hash-aaa", number=2)

        await runner.ensure_job(request("hash-aaa", attempt=first))
        await runner.ensure_job(request("hash-aaa", attempt=second))

        claims = [
            call[2].spec.template.spec.volumes[0].persistent_volume_claim.claim_name
            for call in api.calls
        ]
        assert claims[0] == claims[1] == first.workspace_name
        # But the Jobs themselves are distinct, or attempt 2 would adopt attempt 1.
        assert api.calls[0][2].metadata.name != api.calls[1][2].metadata.name

    async def test_the_failure_knob_reaches_the_container(self, api, runner):
        api.scripts["create_job"] = [None]
        await runner.ensure_job(request(fail_at_step=3))

        env = {v.name: v.value for v in api.calls[0][2].spec.template.spec.containers[0].env}
        assert env["FAIL_AT_STEP"] == "3"

    async def test_the_knob_is_off_unless_asked_for(self, api, runner):
        api.scripts["create_job"] = [None]
        await runner.ensure_job(request())

        env = {v.name: v.value for v in api.calls[0][2].spec.template.spec.containers[0].env}
        assert env["FAIL_AT_STEP"] == "0"


class TestObserve:
    async def test_a_collected_job_reports_gone_not_failed(self, api, runner):
        """The input side of §6.7.

        `observe` returns early with `failed=0`, which is correct — nothing
        observed a failure. Distinguishing the two is the workflow's job, and
        this pins that `observe` does not invent an outcome.
        """
        api.scripts["read_job"] = [ApiException(status=404, reason="NotFound")]

        state = await runner.observe("ai-deadbeef-a1")

        assert state.exists is False
        assert state.terminated is True
        assert state.failed == 0 and state.succeeded == 0
        assert api.names() == ["read_job"], "must not list pods for a job that is gone"

    async def test_a_running_job_reports_active(self, api, runner):
        api.scripts["read_job"] = [ExistingJob({}, active=1)]
        api.scripts["list_pods"] = [PodList([Pod("Running")])]

        state = await runner.observe("ai-deadbeef-a1")

        assert state.exists is True
        assert state.active == 1
        assert state.terminated is False

    async def test_a_failed_job_carries_the_exit_code(self, api, runner):
        """§7f's exit 17 is how the board explains a deliberate failure."""
        api.scripts["read_job"] = [ExistingJob({}, failed=1)]
        api.scripts["list_pods"] = [PodList([Pod("Failed", exit_code=17)])]

        state = await runner.observe("ai-deadbeef-a1")

        assert state.failed == 1
        assert state.terminated is True
        assert state.exit_code == 17

    async def test_a_job_whose_pod_is_unknown_is_not_terminated(self, api, runner):
        """A partitioned node is not proof that the writer stopped."""
        api.scripts["read_job"] = [ExistingJob({}, active=1)]
        api.scripts["list_pods"] = [PodList([Pod("Unknown")])]

        state = await runner.observe("ai-deadbeef-a1")

        assert state.pod_phases == ["Unknown"]
        assert state.terminated is False

    async def test_a_non_404_read_error_propagates(self, api, runner):
        api.scripts["read_job"] = [ApiException(status=500, reason="ServerError")]

        with pytest.raises(ApiException):
            await runner.observe("ai-deadbeef-a1")


class TestFencing:
    """PHASE_2 §8's third ⚠️ row: fencing beyond the happy path.

    `confirm_terminated` is what stands between a partitioned node and two
    writers on one RWO volume. Every branch, not just the one where the pod
    exited cleanly.
    """

    @pytest.fixture(autouse=True)
    def installed(self, runner, monkeypatch):
        context = activity_context.Context(
            kan=None, projects=None, settings=None, jobs=runner
        )
        monkeypatch.setattr(activity_context, "_context", context)

    async def test_a_gone_job_is_fenced(self, api, runner):
        api.scripts["read_job"] = [ApiException(status=404, reason="NotFound")]

        assert await k8s.confirm_terminated("ai-deadbeef-a1") is True

    async def test_a_cleanly_exited_job_is_fenced(self, api, runner):
        api.scripts["read_job"] = [ExistingJob({}, succeeded=1)]
        api.scripts["list_pods"] = [PodList([Pod("Succeeded", exit_code=0)])]

        assert await k8s.confirm_terminated("ai-deadbeef-a1") is True

    async def test_a_running_job_is_not_fenced(self, api, runner):
        api.scripts["read_job"] = [ExistingJob({}, active=1)]
        api.scripts["list_pods"] = [PodList([Pod("Running")])]

        assert await k8s.confirm_terminated("ai-deadbeef-a1") is False

    async def test_a_pod_on_a_partitioned_node_is_not_fenced(self, api, runner):
        """The case the whole mechanism exists for.

        `Unknown` means the kubelet stopped answering, not that the process
        stopped. Certifying it would let the dispatcher admit a second writer
        to a volume the first may still be holding. The dispatcher's response
        is to keep the slot held — `test_dispatcher.test_unfenced_release_holds_the_slot`
        is the other half of this.
        """
        api.scripts["read_job"] = [ExistingJob({}, active=0)]
        api.scripts["list_pods"] = [PodList([Pod("Unknown")])]

        assert await k8s.confirm_terminated("ai-deadbeef-a1") is False

    async def test_one_unknown_pod_among_finished_ones_still_blocks_the_fence(self, api, runner):
        """`all()`, not `any()`. A single unaccounted pod is enough."""
        api.scripts["read_job"] = [ExistingJob({}, active=0)]
        api.scripts["list_pods"] = [
            PodList([Pod("Succeeded", exit_code=0), Pod("Unknown")])
        ]

        assert await k8s.confirm_terminated("ai-deadbeef-a1") is False

    async def test_a_job_with_no_pods_yet_is_not_fenced(self, api, runner):
        """`terminated` requires evidence, and no pods is no evidence.

        A Job whose pod has not been created yet reports `active=0` with an
        empty phase list. Reading that as terminated would fence an attempt
        that is about to start running.
        """
        api.scripts["read_job"] = [ExistingJob({}, active=0)]
        api.scripts["list_pods"] = [PodList([])]

        assert await k8s.confirm_terminated("ai-deadbeef-a1") is False


class TestEnsureWorkspace:
    async def test_an_existing_claim_is_reused(self, api, runner):
        api.scripts["read_pvc"] = [object()]

        name = await runner.ensure_workspace(attempt())

        assert name == attempt().workspace_name
        assert api.names() == ["read_pvc"], "must not recreate a claim that exists"

    async def test_a_missing_claim_is_created(self, api, runner):
        api.scripts["read_pvc"] = [ApiException(status=404, reason="NotFound")]
        api.scripts["create_pvc"] = [None]

        await runner.ensure_workspace(attempt())

        claim = api.calls[1][2]
        assert claim.spec.storage_class_name == "csi-rbd-sc"
        assert claim.spec.resources.requests == {"storage": "5Gi"}
        assert claim.metadata.annotations[k8s.ANN_HASH] == "hash-aaa"

    async def test_a_concurrent_creation_is_the_desired_state(self, api, runner):
        """Two workers racing the same claim is success, not failure."""
        api.scripts["read_pvc"] = [ApiException(status=404, reason="NotFound")]
        api.scripts["create_pvc"] = [conflict()]

        assert await runner.ensure_workspace(attempt()) == attempt().workspace_name

    async def test_a_forbidden_read_propagates(self, api, runner):
        """§6.1: a missing RBAC Role must not look like a missing claim."""
        api.scripts["read_pvc"] = [ApiException(status=403, reason="Forbidden")]

        with pytest.raises(ApiException) as caught:
            await runner.ensure_workspace(attempt())

        assert caught.value.status == 403


class TestStop:
    async def test_stop_deletes_with_foreground_propagation(self, api, runner):
        """Foreground, so the delete does not return before the pods are going."""
        api.scripts["delete_job"] = [None]

        await runner.stop("ai-deadbeef-a1")

        assert api.names() == ["delete_job"]

    async def test_stopping_an_already_gone_job_is_not_an_error(self, api, runner):
        """Stop is called on paths that may race collection or a previous stop."""
        api.scripts["delete_job"] = [ApiException(status=404, reason="NotFound")]

        await runner.stop("ai-deadbeef-a1")

    async def test_a_forbidden_delete_propagates(self, api, runner):
        api.scripts["delete_job"] = [ApiException(status=403, reason="Forbidden")]

        with pytest.raises(ApiException):
            await runner.stop("ai-deadbeef-a1")
