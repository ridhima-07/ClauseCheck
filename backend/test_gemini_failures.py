import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import httpx
from fastapi import HTTPException
from google.genai import errors

from backend import main
from backend.schemas import Analysis


class GeminiFailureTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.pages = [
            {"page_number": 1, "text": "This is a test agreement."}
        ]
        self.fake_client = Mock()
        self.generate = AsyncMock()
        self.fake_client.aio.models.generate_content = self.generate

        patcher = patch.object(main, "client", self.fake_client)
        patcher.start()
        self.addCleanup(patcher.stop)

    async def test_failures(self):
        cases = [
            ("Timeout", httpx.ReadTimeout("Test timeout"), 504),
            ("Connection failure", httpx.ConnectError("Test connection"), 502),
            ("Unexpected error", RuntimeError("Test error"), 502),
        ]

        for code in (408, 504, 429, 500, 503, 403):
            expected = (
                504 if code in (408, 504)
                else 503 if code == 429 or code >= 500
                else 502
            )
            error = errors.APIError(
                code,
                {"error": {"code": code, "message": "Test error"}},
            )
            cases.append((f"Gemini error {code}", error, expected))

        for label, error, expected in cases:
            with self.subTest(case=label):
                self.generate.reset_mock()
                self.generate.side_effect = error

                with self.assertRaises(HTTPException) as caught:
                    await main.analysis(self.pages)

                self.assertEqual(caught.exception.status_code, expected)
                self.generate.assert_awaited_once()
                print(f"PASS: {label} → {expected}")

    async def test_unusable_response(self):
        for parsed in (None, {"unexpected": "data"}):
            with self.subTest(parsed=parsed):
                self.generate.reset_mock()
                self.generate.return_value = SimpleNamespace(parsed=parsed)

                with self.assertRaises(HTTPException) as caught:
                    await main.analysis(self.pages)

                self.assertEqual(caught.exception.status_code, 502)
                self.assertIn("unusable", caught.exception.detail)
                self.generate.assert_awaited_once()

    async def test_success(self):
        expected = Analysis(
            document_type="Test agreement",
            summary="Test analysis.",
            findings=[],
        )
        self.generate.return_value = SimpleNamespace(parsed=expected)

        result = await main.analysis(self.pages)

        self.assertIs(result, expected)
        self.generate.assert_awaited_once()


if __name__ == "__main__":
    unittest.main(verbosity=2)