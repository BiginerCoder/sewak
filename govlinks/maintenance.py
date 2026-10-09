"""Scheduled jobs. Run from cron or any scheduler; they are safe to repeat.

    python3 maintenance.py refresh          recompute ranking evidence and link states for every link (daily, or hourly at scale)
    python3 maintenance.py check-links      health-check every link: allowlist, robots.txt, redirects, soft 404s (weekly)
    python3 maintenance.py discover <id>    read one portal's front page and add candidate links (manual or monthly)

check-links and discover only ever touch hosts on the allowlist (allowed_domains) and honour robots.txt.
"""
import sys

from govlinks.db import connect
from govlinks.fetcher import Fetcher
from govlinks.recommender import Classifier, refresh


def main(argv):
    if not argv or argv[0] not in ("refresh", "check-links", "discover"):
        print(__doc__)
        return 2
    conn = connect()
    if argv[0] == "refresh":
        changes = refresh(conn)
        print(f"state changes: {len(changes)}")
        for link_id, old, new, reason in changes:
            print(f"  link {link_id}: {old} -> {new} ({reason})")
    elif argv[0] == "check-links":
        res = Fetcher(conn).check_all()
        ok = sum(1 for r in res if r.get("ok"))
        skipped = sum(1 for r in res if r.get("skipped"))
        inconclusive = sum(1 for r in res if r.get("inconclusive"))
        print(f"checked {len(res) - skipped}: ok={ok} inconclusive={inconclusive} skipped={skipped}")
        print("run `refresh` next so failed checks can mark links stale")
    else:
        out = Fetcher(conn).discover_links(int(argv[1]), Classifier(conn))
        print(out["error"] or f"added {len(out['added'])} candidate links")
        for a in out["added"]:
            print(f"  {a['category']}: {a['url']}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
