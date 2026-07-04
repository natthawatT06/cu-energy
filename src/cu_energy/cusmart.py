"""Small, rate-limited client for CU Smart's public dashboard endpoints."""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Mapping
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


DEFAULT_BASE_URL = "https://ls.ene.cusmart.chula.ac.th/web-api/api/v1"
ALLOWED_PROFILE_GAPS = {"default"}
ALLOWED_PROFILE_METRICS = {"energy", "power", "peak"}


class CusmartApiError(RuntimeError):
    """Raised when a CU Smart request or response is unusable."""


@dataclass
class CusmartClient:
    """Read frontend JSON data without automating authentication."""

    base_url: str = DEFAULT_BASE_URL
    timeout_seconds: float = 30.0
    min_request_interval_seconds: float = 0.5
    max_attempts: int = 3
    user_agent: str = "CU-EnergyBrain-PoC/0.1 (read-only research collector)"
    _clock: Callable[[], float] = field(default=time.monotonic, repr=False)
    _sleep: Callable[[float], None] = field(default=time.sleep, repr=False)
    _last_request_at: float | None = field(default=None, init=False, repr=False)

    def faculties(self) -> Mapping[str, Any]:
        return self._get_json("/faculty")

    def faculty_energy(self) -> Mapping[str, Any]:
        return self._get_json("/faculty/energy")

    def faculty_energy_info(self) -> Mapping[str, Any]:
        return self._get_json("/faculty/energy_info")

    def faculty_eui(self) -> Mapping[str, Any]:
        return self._get_json("/faculty/eui")

    def building_type_eui(self) -> Mapping[str, Any]:
        return self._get_json("/building/type/eui")

    def structure_nodes(self) -> Mapping[str, Any]:
        return self._get_json("/structure/nodes", allow_top_level_list=True)

    def node_energy_info(self, node_id: int = 1) -> Mapping[str, Any]:
        self._validate_positive_id("node_id", node_id)
        return self._get_json(f"/node/{node_id}/energy_info")

    def building_energy(self, faculty_id: int) -> Mapping[str, Any]:
        self._validate_positive_id("faculty_id", faculty_id)
        return self._get_json("/building/energy", {"faculty_id": faculty_id})

    def building_energy_info(self, faculty_id: int) -> Mapping[str, Any]:
        self._validate_positive_id("faculty_id", faculty_id)
        return self._get_json("/building/energy_info", {"faculty_id": faculty_id})

    def building_eui(self, faculty_id: int) -> Mapping[str, Any]:
        self._validate_positive_id("faculty_id", faculty_id)
        return self._get_json("/building/eui", {"faculty_id": faculty_id})

    def node_usage_profile(
        self,
        node_id: int = 1,
        gap: str = "default",
        metric: str = "energy",
    ) -> Mapping[str, Any]:
        self._validate_positive_id("node_id", node_id)
        self._validate_profile_options(gap, metric)
        return self._get_json(f"/node/{node_id}/usage_profile/{gap}/{metric}")

    def faculty_usage_profiles(
        self, gap: str = "default", metric: str = "energy"
    ) -> Mapping[str, Any]:
        self._validate_profile_options(gap, metric)
        return self._get_json(f"/faculty/usage_profile/{gap}/{metric}")

    def node_generation_profile(
        self,
        node_id: int = 1,
        gap: str = "default",
        metric: str = "energy",
    ) -> Mapping[str, Any]:
        self._validate_positive_id("node_id", node_id)
        self._validate_profile_options(gap, metric)
        return self._get_json(f"/node/{node_id}/generate_profile/{gap}/{metric}")

    def faculty_generation_profiles(
        self, gap: str = "default", metric: str = "energy"
    ) -> Mapping[str, Any]:
        self._validate_profile_options(gap, metric)
        return self._get_json(f"/faculty/generate_profile/{gap}/{metric}")

    def building_usage_profiles(
        self,
        faculty_id: int,
        gap: str = "default",
        metric: str = "energy",
    ) -> Mapping[str, Any]:
        self._validate_positive_id("faculty_id", faculty_id)
        self._validate_profile_options(gap, metric)
        return self._get_json(
            f"/building/usage_profile/{gap}/{metric}",
            {"faculty_id": faculty_id},
        )

    def _get_json(
        self,
        path: str,
        query: Mapping[str, str | int] | None = None,
        *,
        allow_top_level_list: bool = False,
    ) -> Mapping[str, Any]:
        url = self._build_url(path, query)
        last_error: Exception | None = None

        for attempt in range(1, self.max_attempts + 1):
            self._respect_rate_limit()
            request = Request(
                url,
                headers={"Accept": "application/json", "User-Agent": self.user_agent},
                method="GET",
            )
            self._last_request_at = self._clock()

            try:
                with urlopen(request, timeout=self.timeout_seconds) as response:
                    payload = json.loads(response.read().decode("utf-8"))
                if allow_top_level_list and isinstance(payload, list):
                    return {"data": payload, "_source_shape": "array"}
                if not isinstance(payload, dict) or "data" not in payload:
                    raise CusmartApiError(
                        f"Unexpected CU Smart response shape from {url}"
                    )
                return payload
            except HTTPError as exc:
                last_error = exc
                if exc.code in {401, 403}:
                    raise CusmartApiError(
                        f"Endpoint requires authorization (HTTP {exc.code}): {url}"
                    ) from exc
                if exc.code != 429 and exc.code < 500:
                    raise CusmartApiError(
                        f"CU Smart returned HTTP {exc.code}: {url}"
                    ) from exc
            except (URLError, TimeoutError, json.JSONDecodeError) as exc:
                last_error = exc

            if attempt < self.max_attempts:
                self._sleep(0.75 * (2 ** (attempt - 1)))

        raise CusmartApiError(
            f"CU Smart request failed after {self.max_attempts} attempts: {url}"
        ) from last_error

    def _build_url(
        self, path: str, query: Mapping[str, str | int] | None = None
    ) -> str:
        if not path.startswith("/"):
            raise ValueError("path must start with '/'")
        url = f"{self.base_url.rstrip('/')}{path}"
        return f"{url}?{urlencode(query)}" if query else url

    def _respect_rate_limit(self) -> None:
        if self._last_request_at is None:
            return
        elapsed = self._clock() - self._last_request_at
        remaining = self.min_request_interval_seconds - elapsed
        if remaining > 0:
            self._sleep(remaining)

    @staticmethod
    def _validate_positive_id(name: str, value: int) -> None:
        if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
            raise ValueError(f"{name} must be a positive integer")

    @staticmethod
    def _validate_profile_options(gap: str, metric: str) -> None:
        if gap not in ALLOWED_PROFILE_GAPS:
            raise ValueError(f"Unsupported profile gap: {gap}")
        if metric not in ALLOWED_PROFILE_METRICS:
            raise ValueError(f"Unsupported profile metric: {metric}")
