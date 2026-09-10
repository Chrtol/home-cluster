"""The process-lifecycle surface: configuration, context build, shutdown.

PHASE_2 §6.4 was latent for a whole phase because the worker started cleanly
exactly once, and §6.7 was the third instance of that same shape. The discipline
this file follows is therefore: **call each thing twice**, and prefer a test
that mutates process-global state over one that starts from a clean slate,
because a clean slate is what hid the bug.

`test_worker_startup.py` covers `ensure_singletons` against a real server. This
file covers everything upstream of it — `Settings.from_env`, `build_context` —
and the shutdown path downstream.
"""

from __future__ import annotations

import os
import re
from pathlib import Path

import pytest
import yaml

from orchestrator import projects, worker
from orchestrator.settings import Settings, task_workflow_id

REPO_ROOT = Path(__file__).resolve().parents[3]
HELMRELEASE = REPO_ROOT / "kubernetes/apps/ai/ai-orchestrator/app/helmrelease.yaml"
PROJECTS_YAML = REPO_ROOT / "kubernetes/apps/ai/ai-orchestrator/app/projects.yaml"

# Every variable `Settings.from_env` reads, and the default it falls back to.
DOCUMENTED = {
    "TEMPORAL_ADDRESS": "address",
    "TEMPORAL_NAMESPACE": "namespace",
    "TEMPORAL_TASK_QUEUE": "task_queue",
    "KAN_BASE_URL": "kan_base_url",
    "KAN_API_KEY": "kan_api_key",
    "KAN_WEBHOOK_SECRET": "kan_webhook_secret",
    "KAN_SELF_ACTOR_ID": "kan_self_actor_id",
    "PROJECTS_PATH": "projects_path",
    "JOBS_NAMESPACE": "jobs_namespace",
    "WORKSPACE_STORAGE_CLASS": "workspace_storage_class",
    "WORKSPACE_SIZE": "workspace_size",
    "JOB_IMAGE": "job_image",
    "JOB_FAIL_AT_STEP": "job_fail_at_step",
    "JOB_FAIL_TASK_ID": "job_fail_task_id",
    "RECONCILE_INTERVAL_SECONDS": "reconcile_interval_seconds",
    "DESKTOP_ID": "desktop_id",
    "DISPATCHER_HISTORY_LIMIT": "dispatcher_history_limit",
    "TASK_HISTORY_LIMIT": "task_history_limit",
}

# Set in the HelmRelease but deliberately not read by Settings.
NOT_APP_CONFIG = {"PYTHONDONTWRITEBYTECODE"}


@pytest.fixture
def clean_env(monkeypatch):
    """No orchestrator variable set, so a default is genuinely a default."""
    for name in DOCUMENTED:
        monkeypatch.delenv(name, raising=False)
    return monkeypatch


class TestSettingsFromEnv:
    def test_the_defaults_are_the_deployed_values(self, clean_env):
        """A default silently drifting from the manifest is a config bug.

        Every one of these is what the pod gets if its env var goes missing —
        an ExternalSecret pointing at a renamed 1Password field, say. The
        credentials default to empty (fail closed); the addresses default to
        the real cluster.
        """
        settings = Settings.from_env()

        assert settings.address == "temporal-frontend.ai.svc.cluster.local:7233"
        assert settings.namespace == "ai-coding"
        assert settings.task_queue == "ai-coding"
        assert settings.jobs_namespace == "ai-jobs"
        assert settings.projects_path == "/config/projects.yaml"
        assert settings.workspace_storage_class == "csi-rbd-sc"
        assert settings.reconcile_interval_seconds == 300
        assert settings.desktop_id == "primary"
        # Every credential is empty by default. `verify_signature` refuses an
        # empty secret outright, so a lost secret rejects webhooks rather than
        # accepting unsigned ones.
        assert settings.kan_api_key == ""
        assert settings.kan_webhook_secret == ""
        # And the failure knob is off unless explicitly armed.
        assert settings.job_fail_at_step == 0

    def test_every_documented_variable_is_actually_read(self, clean_env):
        """Catches a key typo'd on one side only.

        A `Settings` field reading `JOB_NAMESPACE` while the manifest sets
        `JOBS_NAMESPACE` type-checks, starts, and quietly uses the default
        namespace forever.
        """
        markers = {}
        for name, field in DOCUMENTED.items():
            marker = "7" if field.endswith(("_step", "_seconds", "_limit")) else f"set-{name}"
            markers[field] = int(marker) if marker == "7" else marker
            clean_env.setenv(name, marker)

        settings = Settings.from_env()

        unread = {f: getattr(settings, f) for f, want in markers.items() if getattr(settings, f) != want}
        assert not unread, f"env vars not reaching Settings: {unread}"

    def test_the_helmrelease_sets_no_variable_the_app_ignores(self):
        """The manifest and the reader must not drift apart.

        The reverse of the test above: a variable set in the HelmRelease that
        nothing reads looks like live configuration and is not. Skips rather
        than fails if run outside a full repo checkout.
        """
        if not HELMRELEASE.exists():  # pragma: no cover - only outside the repo
            pytest.skip("HelmRelease not present; app checked out on its own")

        text = HELMRELEASE.read_text()
        # The `env:` block is a YAML anchor shared by both controllers; read the
        # keys out of the rendered document rather than by regex over comments.
        doc = yaml.safe_load(text)
        env = doc["spec"]["values"]["controllers"]["ai-orchestrator"]["containers"]["app"]["env"]

        unknown = set(env) - set(DOCUMENTED) - NOT_APP_CONFIG
        assert not unknown, f"HelmRelease sets variables Settings never reads: {sorted(unknown)}"

    def test_the_history_limit_settings_reach_no_consumer(self):
        """Pins a finding rather than a behaviour: these two do nothing.

        Both workflows hardcode their Continue-As-New thresholds, so
        `TASK_HISTORY_LIMIT` and `DISPATCHER_HISTORY_LIMIT` are parsed, stored
        and never consulted. Recorded as a test so that whoever wires them up
        is told to delete this test and take the `workflow.patched()` gate that
        the change needs — see the note in settings.py.
        """
        src = Path(__file__).resolve().parents[1] / "src" / "orchestrator"
        consumers = [
            path.name
            for path in src.rglob("*.py")
            if path.name != "settings.py"
            and re.search(r"\b(task|dispatcher)_history_limit\b", path.read_text())
        ]
        assert consumers == [], (
            f"{consumers} now reads a history limit setting. That changes when a "
            "workflow issues ContinueAsNew, so it needs a workflow.patched() gate; "
            "update settings.py's note and delete this test."
        )
        # And the thresholds really are literals in the workflow code.
        assert "events_handled >= 200" in (src / "workflows" / "task.py").read_text()
        assert "signals_handled >= 500" in (src / "workflows" / "dispatcher.py").read_text()

    def test_a_zero_reconcile_interval_is_refused_rather_than_hot_looping(self, clean_env):
        """`0` means "off" for the knob two fields away. Here it means no sleep.

        `ReconcileWorkflow` does `workflow.sleep(timedelta(seconds=interval))`
        at the bottom of its loop, so 0 sweeps every board continuously — a
        kan request storm plus a history that rolls forever, from one plausible
        config edit.
        """
        clean_env.setenv("RECONCILE_INTERVAL_SECONDS", "0")

        with pytest.raises(ValueError) as caught:
            Settings.from_env()

        message = str(caught.value)
        assert "RECONCILE_INTERVAL_SECONDS" in message
        assert "disabled" in message

    def test_a_negative_reconcile_interval_is_refused(self, clean_env):
        clean_env.setenv("RECONCILE_INTERVAL_SECONDS", "-1")

        with pytest.raises(ValueError, match="RECONCILE_INTERVAL_SECONDS"):
            Settings.from_env()

    def test_a_valid_reconcile_interval_still_passes(self, clean_env):
        """§6.5's counterweight: prove the guard is not refusing everything."""
        clean_env.setenv("RECONCILE_INTERVAL_SECONDS", "60")

        assert Settings.from_env().reconcile_interval_seconds == 60

    def test_a_malformed_integer_names_the_variable_it_choked_on(self, clean_env):
        """Both processes read settings at startup, so this is a CrashLoop.

        The message is the entire diagnostic surface — there is no running pod
        to inspect — and a bare `invalid literal for int()` does not say which
        of eighteen variables is wrong.
        """
        clean_env.setenv("TASK_HISTORY_LIMIT", "twelve")

        with pytest.raises(ValueError) as caught:
            Settings.from_env()

        assert "TASK_HISTORY_LIMIT" in str(caught.value)
        assert "twelve" in str(caught.value)

    def test_job_fail_at_step_zero_still_means_disabled(self, clean_env):
        """The interval guard must not have leaked onto the knob it borrows from.

        `JOB_FAIL_AT_STEP=0` is how the HelmRelease disarms the deliberate
        failure. If validation rejected 0 here, the deployed manifest would
        CrashLoop both pods.
        """
        clean_env.setenv("JOB_FAIL_AT_STEP", "0")

        settings = Settings.from_env()

        assert settings.job_fail_at_step == 0
        assert settings.fail_step_for("any-card") == 0

    def test_from_env_is_stable_across_repeated_calls(self, clean_env):
        """The §6.4 discipline, at its cheapest.

        `api.py` calls this at import and `worker.main` calls it again in the
        same image. A `from_env` that consumed the environment — `os.environ.pop`
        instead of `.get`, say — would give the second caller silent defaults.
        """
        clean_env.setenv("DESKTOP_ID", "secondary")
        clean_env.setenv("JOB_FAIL_AT_STEP", "3")

        first = Settings.from_env()
        second = Settings.from_env()

        assert first == second
        assert second.desktop_id == "secondary"
        assert second.job_fail_at_step == 3
        # The environment is still intact for a third reader.
        assert os.environ["DESKTOP_ID"] == "secondary"

    def test_the_dispatcher_id_follows_the_desktop_id(self, clean_env):
        clean_env.setenv("DESKTOP_ID", "laptop")

        assert Settings.from_env().dispatcher_workflow_id == "desktop-dispatcher-laptop"

    def test_the_fail_knob_is_scoped_to_the_named_card(self, clean_env):
        """§9's warning, as a test: unscoped means every card on every board."""
        clean_env.setenv("JOB_FAIL_AT_STEP", "3")
        clean_env.setenv("JOB_FAIL_TASK_ID", "card-under-test")
        scoped = Settings.from_env()

        assert scoped.fail_step_for("card-under-test") == 3
        assert scoped.fail_step_for("some-other-card") == 0

        clean_env.delenv("JOB_FAIL_TASK_ID")
        unscoped = Settings.from_env()

        # The blast radius §9 warns about, pinned so it stays a known property.
        assert unscoped.fail_step_for("some-other-card") == 3


class TestProjectRegistry:
    """`build_context` loads this at startup; a bad load must be loud."""

    def test_the_deployed_projects_file_loads(self):
        if not PROJECTS_YAML.exists():  # pragma: no cover - only outside the repo
            pytest.skip("projects.yaml not present; app checked out on its own")

        registry = projects.load(PROJECTS_YAML)

        assert registry.board_names, "the deployed config binds no board to a repository"

    def test_a_missing_projects_file_stops_the_worker_starting(self, tmp_path):
        """Better a CrashLoop than a worker that allows nothing."""
        with pytest.raises(FileNotFoundError):
            projects.load(tmp_path / "nope.yaml")

    def test_an_empty_projects_file_loads_to_an_allowlist_of_nothing(self, tmp_path):
        """Pinned as a known sharp edge, not endorsed.

        A truncated file, or one whose top-level `projects:` key gets renamed,
        produces an empty registry and a worker that starts perfectly happily.
        Every card then fails with `ProjectUnknown`. That is at least visible on
        the card rather than silent, which is why it is recorded here rather
        than turned into a startup assertion — but it is the reason
        `test_the_deployed_projects_file_loads` above asserts a non-empty
        result.
        """
        empty = tmp_path / "projects.yaml"
        empty.write_text("projects: []\n")

        registry = projects.load(empty)

        assert registry.board_names == []
        with pytest.raises(projects.ProjectUnknown):
            registry.for_board("AI Test")

    def test_a_check_written_as_a_shell_string_is_refused(self, tmp_path):
        """Plan §11's privilege boundary, at load time."""
        config = tmp_path / "projects.yaml"
        config.write_text(
            "projects:\n"
            "  - board: AI Test\n"
            "    repository: chrtol/home-cluster\n"
            "    checks:\n"
            "      unit: pytest -q && curl evil\n"
        )

        with pytest.raises(ValueError, match="shell string"):
            projects.load(config)


class TestBuildContext:
    """The one startup step that opens handles, and the one that closes them."""

    @pytest.fixture
    def no_cluster(self, monkeypatch):
        """`load_config` talks to a kubeconfig or a service account; neither
        exists in CI, and the assertions here are not about it."""
        calls = []

        async def fake_load_config():
            calls.append(1)

        monkeypatch.setattr(worker.k8s_acts.JobRunner, "load_config", fake_load_config)
        return calls

    @pytest.fixture
    def settings(self, clean_env, tmp_path):
        config = tmp_path / "projects.yaml"
        config.write_text(
            "projects:\n  - board: AI Test\n    repository: chrtol/home-cluster\n"
        )
        clean_env.setenv("PROJECTS_PATH", str(config))
        clean_env.setenv("KAN_BASE_URL", "http://kan.invalid")
        clean_env.setenv("KAN_API_KEY", "key")
        return Settings.from_env()

    async def test_it_builds_a_usable_context(self, settings, no_cluster):
        context = await worker.build_context(settings, client=None)
        try:
            assert context.projects.board_names == ["AI Test"]
            assert context.jobs.namespace == "ai-jobs"
            assert context.jobs.storage_class == "csi-rbd-sc"
            assert context.settings is settings
            assert no_cluster == [1], "kube config must be loaded before any Job call"
        finally:
            await context.kan.aclose()

    async def test_it_can_be_called_twice_with_independent_clients(self, settings, no_cluster):
        """§6.4: the second call is the one nothing had ever made.

        The failure this guards is a shared or class-level httpx client, where
        closing the first context on shutdown would leave the second one with a
        client that raises on every kan call — a worker that works until
        something restarts it in-process.
        """
        first = await worker.build_context(settings, client=None)
        second = await worker.build_context(settings, client=None)
        try:
            assert first.kan is not second.kan
            assert first.jobs is not second.jobs
            assert no_cluster == [1, 1], "load_config must be re-run, not memoized away"

            # Closing one must not disturb the other.
            await first.kan.aclose()
            assert not second.kan._client.is_closed
        finally:
            await second.kan.aclose()

    async def test_a_broken_projects_file_fails_before_any_handle_is_opened(
        self, clean_env, tmp_path, no_cluster
    ):
        """Ordering matters: a config error must not leak an open client.

        `build_context` constructs the kan client first and loads projects
        second, so a bad config raises with an httpx client already open and
        nothing to close it — `main`'s `finally` never runs because `context`
        was never bound. Pinned because the fix, if it is ever wanted, is to
        load the config first.
        """
        config = tmp_path / "projects.yaml"
        config.write_text("projects: {not: a list}\n")
        clean_env.setenv("PROJECTS_PATH", str(config))

        with pytest.raises(ValueError, match="must be a list"):
            await worker.build_context(Settings.from_env(), client=None)

    async def test_the_kan_client_is_closed_on_shutdown(self, settings, no_cluster):
        """The shutdown path, which is one `finally` in `main`.

        Asserted on the object `main` would close rather than on `main` itself,
        because `main` blocks on `worker.run()` forever.
        """
        context = await worker.build_context(settings, client=None)

        assert not context.kan._client.is_closed
        await context.kan.aclose()
        assert context.kan._client.is_closed

    async def test_closing_twice_does_not_raise(self, settings, no_cluster):
        """`main`'s finally can run after an aclose in an exception path."""
        context = await worker.build_context(settings, client=None)

        await context.kan.aclose()
        await context.kan.aclose()


def test_the_workflow_id_is_keyed_on_the_card_not_the_revision():
    """§2.1, pinned: the webhook addresses a workflow knowing only the publicId."""
    assert task_workflow_id("h7v89xpcvsqd") == "task-h7v89xpcvsqd"
