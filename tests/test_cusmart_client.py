from __future__ import annotations

import io
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from cu_energy.cusmart import CusmartApiError, CusmartClient  # noqa: E402


class FakeResponse:
    def __init__(self, payload: object) -> None:
        self._body = io.BytesIO(json.dumps(payload).encode("utf-8"))

    def __enter__(self) -> "FakeResponse":
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def read(self) -> bytes:
        return self._body.read()


class CusmartClientTests(unittest.TestCase):
    def make_client(self) -> CusmartClient:
        return CusmartClient(
            min_request_interval_seconds=0,
            max_attempts=1,
            _sleep=lambda _: None,
        )

    @patch("cu_energy.cusmart.urlopen")
    def test_building_query_and_payload(self, mocked_urlopen: object) -> None:
        mocked_urlopen.return_value = FakeResponse({"data": [{"id": 46}]})
        client = self.make_client()

        payload = client.building_energy_info(35)

        self.assertEqual(payload["data"][0]["id"], 46)
        request = mocked_urlopen.call_args.args[0]
        self.assertEqual(
            request.full_url,
            "https://ls.ene.cusmart.chula.ac.th/web-api/api/v1/"
            "building/energy_info?faculty_id=35",
        )

    @patch("cu_energy.cusmart.urlopen")
    def test_rejects_unexpected_response_shape(self, mocked_urlopen: object) -> None:
        mocked_urlopen.return_value = FakeResponse({"message": "not data"})
        client = self.make_client()

        with self.assertRaises(CusmartApiError):
            client.faculty_energy_info()

    def test_rejects_invalid_ids_and_profile_options(self) -> None:
        client = self.make_client()

        with self.assertRaises(ValueError):
            client.building_energy_info(0)
        with self.assertRaises(ValueError):
            client.node_usage_profile(metric="unknown")

    @patch("cu_energy.cusmart.urlopen")
    def test_frontend_master_data_route(self, mocked_urlopen: object) -> None:
        mocked_urlopen.return_value = FakeResponse({"data": [{"id": 35}]})
        client = self.make_client()

        payload = client.faculties()

        self.assertEqual(payload["data"][0]["id"], 35)
        request = mocked_urlopen.call_args.args[0]
        self.assertTrue(request.full_url.endswith("/faculty"))

    @patch("cu_energy.cusmart.urlopen")
    def test_wraps_structure_tree_array(self, mocked_urlopen: object) -> None:
        mocked_urlopen.return_value = FakeResponse([{"id": 1, "nodes": []}])
        client = self.make_client()

        payload = client.structure_nodes()

        self.assertEqual(payload["data"][0]["id"], 1)
        self.assertEqual(payload["_source_shape"], "array")


if __name__ == "__main__":
    unittest.main()
