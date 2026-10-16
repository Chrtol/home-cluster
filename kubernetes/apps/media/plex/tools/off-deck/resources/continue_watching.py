"""Remove already-watched episodes from Continue Watching once a later episode
of the same show has been watched.

Plex Web restores its server-side play queue on open and reports the queue's
selected episode as paused. If the window was closed right after pressing next,
that is still the previous, already-watched episode, which gets a fresh resume
point and jumps back into Continue Watching.
"""
from plexapi.server import PlexServer

plex = PlexServer()

for ep in plex.continueWatching():
    if ep.type != "episode" or not ep.viewCount:
        continue
    position = (ep.seasonNumber or 0, ep.index or 0)
    if any(
        e.viewCount and (e.seasonNumber or 0, e.index or 0) > position
        for e in ep.show().episodes()
    ):
        print(f"Removing {ep.grandparentTitle} {ep.seasonEpisode}")
        ep.removeFromContinueWatching()
