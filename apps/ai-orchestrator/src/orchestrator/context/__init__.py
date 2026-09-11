"""Assembly of the read-only package a coding attempt is given.

The Job runs in a namespace with a default-deny NetworkPolicy, so it cannot
fetch anything: whatever it is going to know has to be written down before its
pod is scheduled. This package builds that, and the manifest beside it records
where every item came from and why it was chosen.

Nothing here does I/O. Memini is called by the Activity, the ConfigMap is
written by the Kubernetes Activity; these modules turn inputs into bytes so the
selection and truncation rules can be tested without a cluster.
"""
