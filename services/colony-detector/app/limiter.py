"""In-process rate limiting and request throttling for colony detection endpoints (SEC-04).

Provides a thread-safe token bucket rate limiter to protect the computationally expensive
YOLO inference service from abuse, runaway loops, and denial-of-service traffic.
Configurable via environment variables with sensible defaults for student laboratory use.
"""

import math
import os
import threading
import time
from typing import Callable, Dict, List, Optional, Set, Tuple, Union

from fastapi import Request
import logging

logger = logging.getLogger("colony_api.limiter")

# Default Rate Limit Policy (SEC-04)
# 10 requests per 60 seconds with burst capacity of 10
DEFAULT_RATE_LIMIT_REQUESTS = 10
DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 60
DEFAULT_RATE_LIMIT_BURST = 10


def get_client_ip(
    request: Request,
    trusted_proxies: Optional[Union[List[str], Set[str]]] = None,
) -> str:
    """Safely extracts client IP address for request rate limiting.

    To prevent IP spoofing attacks, X-Forwarded-For is ONLY inspected when:
    1. trusted_proxies is explicitly configured, AND
    2. The direct connection client IP is verified to be in trusted_proxies.

    Otherwise, strictly falls back to the direct socket connection host (request.client.host).
    """
    direct_ip = request.client.host if request.client and request.client.host else "127.0.0.1"

    if not trusted_proxies:
        return direct_ip

    trusted_set = set(trusted_proxies) if not isinstance(trusted_proxies, set) else trusted_proxies

    if direct_ip in trusted_set:
        xff = request.headers.get("x-forwarded-for")
        if xff:
            # X-Forwarded-For: client, proxy1, proxy2
            # Traverse right-to-left to find first untrusted hop
            hops = [ip.strip() for ip in xff.split(",") if ip.strip()]
            if hops:
                for hop in reversed(hops):
                    if hop not in trusted_set:
                        return hop
                return hops[0]

    return direct_ip


class TokenBucketLimiter:
    """Thread-safe in-memory Token Bucket rate limiter for FastAPI microservice (SEC-04).

    Implements a token bucket algorithm with configurable capacity (burst limit),
    continuous replenishment rate, and exact Retry-After calculation.
    """

    def __init__(
        self,
        requests: int = DEFAULT_RATE_LIMIT_REQUESTS,
        window_seconds: int = DEFAULT_RATE_LIMIT_WINDOW_SECONDS,
        burst: Optional[int] = None,
        enabled: bool = True,
        trusted_proxies: Optional[Union[List[str], Set[str]]] = None,
        time_func: Optional[Callable[[], float]] = None,
    ):
        self.requests = max(1, requests)
        self.window_seconds = max(1, window_seconds)
        self.capacity = float(burst if burst is not None and burst > 0 else self.requests)
        self.rate = float(self.requests) / float(self.window_seconds)
        self.enabled = enabled
        self.trusted_proxies: Set[str] = set(trusted_proxies) if trusted_proxies else set()
        self.time_func = time_func or time.monotonic
        self._buckets: Dict[str, Tuple[float, float]] = {}  # ip -> (tokens, last_refill_timestamp)
        self._lock = threading.Lock()

    def check_rate_limit(self, client_id: str) -> Tuple[bool, int]:
        """Evaluates whether an incoming request from client_id is allowed.

        Returns:
            Tuple[bool, int]: (allowed, retry_after_seconds)
            If allowed: (True, 0)
            If rejected: (False, retry_after_seconds)
        """
        if not self.enabled:
            return True, 0

        now = self.time_func()

        with self._lock:
            # Housekeeping: prune old buckets if dictionary exceeds 2000 active IPs
            if len(self._buckets) > 2000:
                self._prune_expired_locked(now)

            if client_id in self._buckets:
                tokens, last_refill = self._buckets[client_id]
                elapsed = max(0.0, now - last_refill)
                tokens = min(self.capacity, tokens + (elapsed * self.rate))
            else:
                tokens = self.capacity
                last_refill = now

            if tokens >= 1.0:
                tokens -= 1.0
                self._buckets[client_id] = (tokens, now)
                return True, 0
            else:
                deficit = 1.0 - tokens
                retry_after = max(1, math.ceil(deficit / self.rate))
                self._buckets[client_id] = (tokens, now)
                return False, retry_after

    def reset(self) -> None:
        """Clears all rate-limiting state. Useful for test isolation."""
        with self._lock:
            self._buckets.clear()

    def get_tokens(self, client_id: str) -> float:
        """Returns the current token balance for client_id without consuming tokens."""
        now = self.time_func()
        with self._lock:
            if client_id not in self._buckets:
                return self.capacity
            tokens, last_refill = self._buckets[client_id]
            elapsed = max(0.0, now - last_refill)
            return min(self.capacity, tokens + (elapsed * self.rate))

    def _prune_expired_locked(self, now: float) -> None:
        """Evicts stale client records that have fully recharged and remained idle."""
        eviction_threshold = now - (self.window_seconds * 2)
        stale_keys = [
            k
            for k, (tokens, last_refill) in self._buckets.items()
            if last_refill < eviction_threshold and tokens >= self.capacity - 1e-4
        ]
        for k in stale_keys:
            del self._buckets[k]


def create_rate_limiter_from_env() -> TokenBucketLimiter:
    """Creates a configured TokenBucketLimiter instance from environment variables."""
    requests_str = os.getenv("COLONY_RATE_LIMIT_REQUESTS", str(DEFAULT_RATE_LIMIT_REQUESTS))
    window_str = os.getenv("COLONY_RATE_LIMIT_WINDOW_SECONDS", str(DEFAULT_RATE_LIMIT_WINDOW_SECONDS))
    burst_str = os.getenv("COLONY_RATE_LIMIT_BURST", "")
    enabled_str = os.getenv("COLONY_RATE_LIMIT_ENABLED", "true").lower()
    proxies_str = os.getenv("COLONY_TRUSTED_PROXIES", "")

    try:
        requests = int(requests_str)
    except ValueError:
        logger.warning(
            f"Invalid COLONY_RATE_LIMIT_REQUESTS '{requests_str}'; defaulting to {DEFAULT_RATE_LIMIT_REQUESTS}"
        )
        requests = DEFAULT_RATE_LIMIT_REQUESTS

    try:
        window_seconds = int(window_str)
    except ValueError:
        logger.warning(
            f"Invalid COLONY_RATE_LIMIT_WINDOW_SECONDS '{window_str}'; defaulting to {DEFAULT_RATE_LIMIT_WINDOW_SECONDS}"
        )
        window_seconds = DEFAULT_RATE_LIMIT_WINDOW_SECONDS

    burst: Optional[int] = None
    if burst_str.strip():
        try:
            burst = int(burst_str.strip())
        except ValueError:
            logger.warning(
                f"Invalid COLONY_RATE_LIMIT_BURST '{burst_str}'; defaulting to requests ({requests})"
            )
            burst = requests

    enabled = enabled_str in ("1", "true", "yes", "on")
    trusted_proxies = [p.strip() for p in proxies_str.split(",") if p.strip()]

    logger.info(
        f"[RateLimiter] Initialized: enabled={enabled}, requests={requests}, "
        f"window={window_seconds}s, burst={burst or requests}, "
        f"trusted_proxies={trusted_proxies}"
    )

    return TokenBucketLimiter(
        requests=requests,
        window_seconds=window_seconds,
        burst=burst,
        enabled=enabled,
        trusted_proxies=trusted_proxies,
    )
