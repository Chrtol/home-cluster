"""Retrieval of reviewed lessons for a coding attempt.

The coding Job never holds a memory credential. The orchestrator queries
Memini, applies the review and supersession rules here, and copies the survivors
into the attempt's read-only package -- so what an attempt can read is decided
by the trusted layer rather than by the attempt.
"""
