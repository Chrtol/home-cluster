"""Kubernetes activities: workspace, Job lifecycle, and fencing.

Two rules from the plan are enforced structurally here rather than by
convention:

* **Deterministic names** (§8). A Job is named from the attempt identity, not
  from a Temporal run ID, so a worker that restarts after creating a Job
  recreates the same name, collides, and adopts the existing Job instead of
  starting a second one. Kubernetes' uniqueness constraint does the
  deduplication; the orchestrator only has to not fight it.
* **Fencing** (§8, §12). `confirm_terminated` refuses to certify a Job whose
  pods are in `Unknown` — a partitioned node is not proof that the writer
  stopped. The dispatcher will hold the slot rather than admit a second writer.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from kubernetes_asyncio import client, config
from kubernetes_asyncio.client.exceptions import ApiException
from temporalio import activity
from temporalio.exceptions import ApplicationError

from ..contracts import AttemptRef, JobState
from . import context

log = logging.getLogger("orchestrator.activities.kubernetes")

# Identity carried on every object this orchestrator creates. `handoff-hash` is
# what an adoption check compares, so a Job created for a different approved
# revision can never be mistaken for a resumable one.
ANN_TASK = "orchestrator.ai/task-id"
ANN_BOARD = "orchestrator.ai/board-id"
ANN_HASH = "orchestrator.ai/handoff-hash"
ANN_COMMIT = "orchestrator.ai/base-commit"
ANN_ATTEMPT = "orchestrator.ai/attempt"
LABEL_MANAGED = "orchestrator.ai/managed"

# Phases in which a pod is definitely no longer writing. `Unknown` is
# deliberately absent.
TERMINAL_PHASES = frozenset({"Succeeded", "Failed"})


@dataclass(frozen=True)
class EnsureJobRequest:
    attempt: AttemptRef
    image: str
    base_commit: str
    repository: str
    # Wall-clock bound for the attempt, mapped onto activeDeadlineSeconds so the
    # bound survives the orchestrator being down.
    deadline_seconds: int = 3600
    # Phase 2 only: makes the dummy worker fail at a chosen step so the repair
    # path can be exercised on demand (plan §13 Phase 2).
    fail_at_step: int = 0
    steps: int = 6


class JobRunner:
    """Namespace-scoped Job/pod/PVC operations."""

    def __init__(self, namespace: str, storage_class: str, workspace_size: str) -> None:
        self.namespace = namespace
        self.storage_class = storage_class
        self.workspace_size = workspace_size

    @staticmethod
    async def load_config() -> None:
        try:
            config.load_incluster_config()
        except config.ConfigException:
            await config.load_kube_config()

    async def ensure_workspace(self, attempt: AttemptRef) -> str:
        """Create the task's workspace PVC if it is not already there.

        One PVC per task rather than per attempt: repairs work the same tree,
        and a new approved revision produces a new slug and so a new claim.
        """
        name = attempt.workspace_name
        async with client.ApiClient() as api:
            core = client.CoreV1Api(api)
            try:
                await core.read_namespaced_persistent_volume_claim(name, self.namespace)
                return name
            except ApiException as exc:
                if exc.status != 404:
                    raise

            claim = client.V1PersistentVolumeClaim(
                metadata=client.V1ObjectMeta(
                    name=name,
                    labels={LABEL_MANAGED: "true"},
                    annotations={ANN_TASK: attempt.task_id, ANN_HASH: attempt.handoff_hash},
                ),
                spec=client.V1PersistentVolumeClaimSpec(
                    access_modes=["ReadWriteOnce"],
                    storage_class_name=self.storage_class,
                    resources=client.V1ResourceRequirements(
                        requests={"storage": self.workspace_size}
                    ),
                ),
            )
            try:
                await core.create_namespaced_persistent_volume_claim(self.namespace, claim)
            except ApiException as exc:
                if exc.status != 409:  # created concurrently; that is the desired state
                    raise
        return name

    def _build_job(self, request: EnsureJobRequest) -> client.V1Job:
        attempt = request.attempt
        annotations = {
            ANN_TASK: attempt.task_id,
            ANN_BOARD: attempt.board_id,
            ANN_HASH: attempt.handoff_hash,
            ANN_COMMIT: request.base_commit,
            ANN_ATTEMPT: str(attempt.attempt_number),
        }

        container = client.V1Container(
            name="attempt",
            image=request.image,
            command=["python", "-m", "orchestrator.job.dummy_worker"],
            env=[
                client.V1EnvVar(name="WORKSPACE", value="/workspace"),
                client.V1EnvVar(name="ATTEMPT_ID", value=attempt.job_name),
                client.V1EnvVar(name="TASK_ID", value=attempt.task_id),
                client.V1EnvVar(name="BASE_COMMIT", value=request.base_commit),
                client.V1EnvVar(name="REPOSITORY", value=request.repository),
                client.V1EnvVar(name="STEPS", value=str(request.steps)),
                client.V1EnvVar(name="FAIL_AT_STEP", value=str(request.fail_at_step)),
                client.V1EnvVar(name="PYTHONDONTWRITEBYTECODE", value="1"),
            ],
            volume_mounts=[
                client.V1VolumeMount(name="workspace", mount_path="/workspace"),
                client.V1VolumeMount(name="tmp", mount_path="/tmp"),
            ],
            security_context=client.V1SecurityContext(
                allow_privilege_escalation=False,
                read_only_root_filesystem=True,
                capabilities=client.V1Capabilities(drop=["ALL"]),
            ),
            resources=client.V1ResourceRequirements(
                # No CPU limit, per plan §6, on the Job as well as the server.
                requests={"cpu": "50m", "memory": "128Mi"},
                limits={"memory": "512Mi"},
            ),
        )

        pod_spec = client.V1PodSpec(
            restart_policy="Never",
            automount_service_account_token=False,
            security_context=client.V1PodSecurityContext(
                run_as_non_root=True,
                run_as_user=1000,
                run_as_group=1000,
                fs_group=1000,
                seccomp_profile=client.V1SeccompProfile(type="RuntimeDefault"),
            ),
            containers=[container],
            volumes=[
                client.V1Volume(
                    name="workspace",
                    persistent_volume_claim=client.V1PersistentVolumeClaimVolumeSource(
                        claim_name=attempt.workspace_name
                    ),
                ),
                client.V1Volume(name="tmp", empty_dir=client.V1EmptyDirVolumeSource()),
            ],
        )

        return client.V1Job(
            metadata=client.V1ObjectMeta(
                name=attempt.job_name,
                labels={LABEL_MANAGED: "true"},
                annotations=annotations,
            ),
            spec=client.V1JobSpec(
                # The workflow owns the repair policy (plan §7), so Kubernetes
                # must never retry an attempt behind its back.
                backoff_limit=0,
                active_deadline_seconds=request.deadline_seconds,
                # No TTL: plan §12 keeps Job evidence until collection succeeds.
                template=client.V1PodTemplateSpec(
                    metadata=client.V1ObjectMeta(
                        labels={LABEL_MANAGED: "true"}, annotations=annotations
                    ),
                    spec=pod_spec,
                ),
            ),
        )

    async def ensure_job(self, request: EnsureJobRequest) -> str:
        """Create the attempt's Job, or adopt the identical one already there."""
        job = self._build_job(request)
        name = request.attempt.job_name
        async with client.ApiClient() as api:
            batch = client.BatchV1Api(api)
            try:
                await batch.create_namespaced_job(self.namespace, job)
                log.info("created job %s", name)
                return name
            except ApiException as exc:
                if exc.status != 409:
                    raise

            existing = await batch.read_namespaced_job(name, self.namespace)
            found = (existing.metadata.annotations or {}).get(ANN_HASH)
            if found != request.attempt.handoff_hash:
                raise ApplicationError(
                    f"job {name} exists for handoff {found!r}, "
                    f"expected {request.attempt.handoff_hash!r}",
                    type="JobIdentityMismatch",
                    non_retryable=True,
                )
            log.info("adopted existing job %s", name)
            return name

    async def observe(self, name: str) -> JobState:
        async with client.ApiClient() as api:
            batch = client.BatchV1Api(api)
            core = client.CoreV1Api(api)
            try:
                job = await batch.read_namespaced_job(name, self.namespace)
            except ApiException as exc:
                if exc.status == 404:
                    # Gone means nothing is running under this name; that is a
                    # legitimately fenced state.
                    return JobState(name=name, exists=False, terminated=True)
                raise

            pods = await core.list_namespaced_pod(
                self.namespace, label_selector=f"job-name={name}"
            )
            phases = [p.status.phase or "Unknown" for p in pods.items]
            exit_code = _first_exit_code(pods.items)

            status = job.status
            return JobState(
                name=name,
                exists=True,
                active=status.active or 0,
                succeeded=status.succeeded or 0,
                failed=status.failed or 0,
                terminated=bool(phases) and all(p in TERMINAL_PHASES for p in phases),
                pod_phases=phases,
                exit_code=exit_code,
            )

    async def stop(self, name: str) -> None:
        """Ask for termination. Confirmation is a separate, later question."""
        async with client.ApiClient() as api:
            batch = client.BatchV1Api(api)
            try:
                await batch.delete_namespaced_job(
                    name,
                    self.namespace,
                    body=client.V1DeleteOptions(propagation_policy="Foreground"),
                )
            except ApiException as exc:
                if exc.status != 404:
                    raise


def _first_exit_code(pods: list) -> int | None:
    for pod in pods:
        for status in (pod.status.container_statuses or []):
            terminated = status.state.terminated if status.state else None
            if terminated is not None:
                return terminated.exit_code
    return None


@activity.defn
async def ensure_workspace(attempt: AttemptRef) -> str:
    return await context.current().jobs.ensure_workspace(attempt)


@activity.defn
async def ensure_job(request: EnsureJobRequest) -> str:
    return await context.current().jobs.ensure_job(request)


@activity.defn
async def observe_job(name: str) -> JobState:
    return await context.current().jobs.observe(name)


@activity.defn
async def stop_job(name: str) -> None:
    await context.current().jobs.stop(name)


@activity.defn
async def confirm_terminated(name: str) -> bool:
    """Is it safe to let another writer touch this workspace?

    True only when the Job is gone, or every one of its pods reached a terminal
    phase. A pod reporting `Unknown` — the node stopped answering — returns
    False, so the dispatcher keeps holding the slot instead of admitting a
    second writer to a volume the first may still own.
    """
    state = await context.current().jobs.observe(name)
    if not state.exists:
        return True
    if state.active:
        return False
    return state.terminated
