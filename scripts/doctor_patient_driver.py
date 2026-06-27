#!/usr/bin/env python3
"""
Drive the local fake-doctor API directly with curl, using a separate AI as the
simulated patient.

The doctor app API matches the browser UI call:
  POST /api/chat
  {"messages": [{"id": "...", "role": "user" | "doctor", "content": "..."}]}

The response is JSON with:
  {"userMessage": {...}, "doctorMessage": {...}}

This script sends a patient message to the doctor API with curl, pipes each
doctor reply into a separate patient AI, then sends the AI patient's answer back
to the doctor API.

Examples:
  # One API call only, useful to verify the doctor endpoint without patient AI.
  python3 scripts/doctor_patient_driver.py --max-turns 1

  # Local patient AI through Ollama.
  python3 scripts/doctor_patient_driver.py \
    --patient-provider ollama \
    --patient-model llama3.2 \
    --max-turns 6

  # OpenAI-compatible patient AI.
  PATIENT_AI_API_KEY=... python3 scripts/doctor_patient_driver.py \
    --patient-provider openai-compatible \
    --patient-model gpt-4o-mini \
    --max-turns 6
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Literal
from uuid import uuid4

Role = Literal["user", "doctor"]

DOCTOR_ENDPOINT = "http://localhost:3000/api/chat"

DEFAULT_OPENING = (
    "I have been more tired than usual for a few weeks, and I have had this "
    "uncomfortable feeling in my upper chest that I thought might be indigestion. "
    "It has happened a few times now."
)

PATIENT_SYSTEM_PROMPT = """
You are Daniel Harper, a 46-year-old male warehouse supervisor.

You are answering a doctor. Use only standard English. Stay in character as a
normal patient. Do not mention that this is a test. Never state a diagnosis or
say what condition you think you have. If asked directly whether you have a
condition, say: "I do not know. No one has diagnosed me with that."

Answer only what the doctor asked. Do not volunteer all details at once. If the
doctor asks broad questions, give concise patient-level answers. If the doctor
asks specific questions, reveal the relevant fact.

Facts you may use:
- Main concern: unusual fatigue for about four weeks and intermittent discomfort
  that you initially thought was indigestion.
- The discomfort is pressure-like or heavy in the center or upper chest,
  sometimes spreading to the left shoulder or jaw.
- It often happens when walking quickly, climbing stairs, carrying boxes, or
  during stress at work.
- It usually improves after stopping and resting for several minutes.
- Antacids did not clearly help.
- Episodes usually last 5 to 10 minutes.
- Severity is about 5 or 6 out of 10.
- Sometimes there is mild shortness of breath and sweating during episodes.
- No fainting. No vomiting. No fever. No cough.
- You are not having the discomfort right now unless asked after exertion.
- Symptoms began about a month ago and are a little more frequent this week.
- You have high blood pressure and take lisinopril inconsistently.
- Borderline high cholesterol was mentioned at a work screening.
- No known diabetes. No known heart disease.
- No known drug allergies.
- Your father had a heart attack in his early fifties.
- Your mother has type 2 diabetes.
- Former smoker: about one pack per day for 15 years, quit six years ago.
- Drinks alcohol socially. No recreational drug use.
- Long work hours, poor sleep, little exercise, frequent takeout meals.
- Your spouse urged you to get checked after you looked pale and sweaty after
  climbing stairs.
- Tone: polite, clear, practical, slightly worried, not dramatic.
""".strip()

FINAL_HINTS = (
    "emergency department",
    "urgent care",
    "same-day evaluation",
    "call 911",
    "call emergency services",
    "diagnosis",
    "assessment",
    "recommendation",
)


@dataclass
class ChatTurn:
    role: Role
    content: str


class DriverError(RuntimeError):
    """Raised when the curl/API driver cannot continue."""


def log(message: str) -> None:
    print(message, flush=True)


def normalize_text(value: str) -> str:
    return "\n".join(line.rstrip() for line in value.strip().splitlines()).strip()


def compact_json(value: object) -> str:
    return json.dumps(value, separators=(",", ":"), ensure_ascii=False)


def doctor_prompt_for_patient(doctor_message: dict) -> str:
    """Build the text sent to the patient AI from a doctor API message."""

    parts: list[str] = []
    content = doctor_message.get("content") or doctor_message.get("question") or ""
    if content:
        parts.append(str(content))

    options = doctor_message.get("answerOptions")
    if isinstance(options, list) and options:
        parts.append(
            "Answer options offered by the doctor:\n"
            + "\n".join(f"- {option}" for option in options)
        )

    free_text_prompt = doctor_message.get("freeTextPrompt")
    if free_text_prompt:
        parts.append("Free-text prompt: " + str(free_text_prompt))

    return normalize_text("\n\n".join(parts))


def is_finalish(doctor_text: str) -> bool:
    lower = doctor_text.lower()
    return any(hint in lower for hint in FINAL_HINTS)


class DoctorCurlClient:
    def __init__(
        self, *, endpoint: str, curl_bin: str, timeout_seconds: int, print_curl: bool
    ) -> None:
        self.endpoint = endpoint
        self.curl_bin = curl_bin
        self.timeout_seconds = timeout_seconds
        self.print_curl = print_curl
        self.messages: list[dict] = []

    def send_patient_message(self, content: str) -> dict:
        pending_user = {
            "id": f"patient-{uuid4()}",
            "role": "user",
            "content": content,
        }
        payload = {"messages": [*self.messages, pending_user]}
        response = self._post(payload)

        user_message = response.get("userMessage", pending_user)
        doctor_message = response.get("doctorMessage")
        if not isinstance(doctor_message, dict):
            raise DriverError(f"Doctor API response missing doctorMessage: {response}")

        self.messages = [*self.messages, user_message, doctor_message]
        return doctor_message

    def _post(self, payload: dict) -> dict:
        command = [
            self.curl_bin,
            "-sS",
            "--max-time",
            str(self.timeout_seconds),
            "-X",
            "POST",
            self.endpoint,
            "-H",
            "Content-Type: application/json",
            "--data-binary",
            "@-",
        ]
        body = compact_json(payload)
        if self.print_curl:
            printable = " ".join(command).replace("@-", repr(body))
            log(f"curl: {printable}")

        started = time.monotonic()
        proc = subprocess.run(
            command,
            input=body,
            text=True,
            capture_output=True,
            timeout=self.timeout_seconds + 10,
            check=False,
        )
        elapsed = time.monotonic() - started
        if proc.returncode != 0:
            raise DriverError(
                f"curl failed after {elapsed:.1f}s with exit {proc.returncode}\n"
                f"stderr: {proc.stderr}\nstdout: {proc.stdout[:2000]}"
            )

        try:
            return json.loads(proc.stdout)
        except json.JSONDecodeError as exc:
            raise DriverError(
                f"Doctor API did not return JSON: {proc.stdout[:2000]}"
            ) from exc


class PatientAI:
    def __init__(
        self,
        *,
        provider: str,
        model: str,
        base_url: str | None,
        api_key: str | None,
        timeout_seconds: int,
    ) -> None:
        self.provider = provider
        self.model = model
        self.base_url = (base_url or "").rstrip("/")
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds

    def reply(self, transcript: list[ChatTurn], doctor_message: dict) -> str:
        if self.provider == "ollama":
            return self._ollama_reply(transcript, doctor_message)
        if self.provider == "openai-compatible":
            return self._openai_compatible_reply(transcript, doctor_message)
        raise DriverError(f"Unsupported patient AI provider: {self.provider}")

    def _messages(
        self, transcript: list[ChatTurn], doctor_message: dict
    ) -> list[dict[str, str]]:
        messages = [{"role": "system", "content": PATIENT_SYSTEM_PROMPT}]
        for turn in transcript[-12:]:
            role = "assistant" if turn.role == "user" else "user"
            speaker = "Patient" if turn.role == "user" else "Doctor"
            messages.append({"role": role, "content": f"{speaker}: {turn.content}"})

        doctor_text = doctor_prompt_for_patient(doctor_message)
        messages.append(
            {
                "role": "user",
                "content": (
                    "Doctor: "
                    + doctor_text
                    + "\n\nRespond as Daniel Harper. Give only the patient's next message. "
                    + "Use standard English. Do not include analysis."
                ),
            }
        )
        return messages

    def _post_json(self, url: str, payload: dict, headers: dict[str, str]) -> dict:
        data = json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(url, data=data, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(
                request, timeout=self.timeout_seconds
            ) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            raise DriverError(f"Patient AI HTTP {exc.code}: {body}") from exc
        except urllib.error.URLError as exc:
            raise DriverError(f"Patient AI request failed: {exc}") from exc

    def _openai_compatible_reply(
        self, transcript: list[ChatTurn], doctor_message: dict
    ) -> str:
        base_url = self.base_url or os.environ.get(
            "PATIENT_AI_BASE_URL", "https://api.openai.com/v1"
        )
        api_key = (
            self.api_key
            or os.environ.get("PATIENT_AI_API_KEY")
            or os.environ.get("OPENAI_API_KEY")
        )
        if not api_key:
            raise DriverError(
                "Missing patient AI API key. Set PATIENT_AI_API_KEY or OPENAI_API_KEY, "
                "or use --patient-provider ollama."
            )
        payload = {
            "model": self.model,
            "messages": self._messages(transcript, doctor_message),
            "temperature": 0.4,
        }
        data = self._post_json(
            f"{base_url}/chat/completions",
            payload,
            {"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
        )
        try:
            return normalize_text(data["choices"][0]["message"]["content"])
        except (KeyError, IndexError, TypeError) as exc:
            raise DriverError(f"Unexpected OpenAI-compatible response: {data}") from exc

    def _ollama_reply(self, transcript: list[ChatTurn], doctor_message: dict) -> str:
        base_url = self.base_url or os.environ.get(
            "OLLAMA_BASE_URL", "http://localhost:11434"
        )
        payload = {
            "model": self.model,
            "messages": self._messages(transcript, doctor_message),
            "stream": False,
            "options": {"temperature": 0.4},
        }
        data = self._post_json(
            f"{base_url}/api/chat", payload, {"Content-Type": "application/json"}
        )
        try:
            return normalize_text(data["message"]["content"])
        except (KeyError, TypeError) as exc:
            raise DriverError(f"Unexpected Ollama response: {data}") from exc


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--doctor-endpoint", default=DOCTOR_ENDPOINT, help="doctor API endpoint"
    )
    parser.add_argument("--curl-bin", default="curl", help="curl executable")
    parser.add_argument(
        "--curl-timeout",
        type=int,
        default=600,
        help="seconds curl may wait for doctor API",
    )
    parser.add_argument(
        "--print-curl", action="store_true", help="print each curl command"
    )
    parser.add_argument(
        "--initial-message", default=DEFAULT_OPENING, help="first patient message"
    )
    parser.add_argument(
        "--max-turns", type=int, default=8, help="maximum doctor responses to process"
    )
    parser.add_argument(
        "--stop-on-final",
        action="store_true",
        help="stop after final-ish doctor guidance",
    )
    parser.add_argument(
        "--patient-provider",
        choices=("ollama", "openai-compatible"),
        default=os.environ.get("PATIENT_AI_PROVIDER", "ollama"),
        help="AI provider used for patient replies",
    )
    parser.add_argument(
        "--patient-model",
        default=os.environ.get("PATIENT_AI_MODEL", "llama3.2"),
        help="patient AI model",
    )
    parser.add_argument(
        "--patient-base-url",
        default=os.environ.get("PATIENT_AI_BASE_URL"),
        help="patient AI base URL",
    )
    parser.add_argument(
        "--patient-api-key",
        default=os.environ.get("PATIENT_AI_API_KEY"),
        help="patient AI API key",
    )
    parser.add_argument(
        "--patient-timeout",
        type=int,
        default=180,
        help="seconds to wait for patient AI",
    )
    parser.add_argument(
        "--show-doctor-json", action="store_true", help="print full doctorMessage JSON"
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    doctor = DoctorCurlClient(
        endpoint=args.doctor_endpoint,
        curl_bin=args.curl_bin,
        timeout_seconds=args.curl_timeout,
        print_curl=args.print_curl,
    )
    patient_ai = PatientAI(
        provider=args.patient_provider,
        model=args.patient_model,
        base_url=args.patient_base_url,
        api_key=args.patient_api_key,
        timeout_seconds=args.patient_timeout,
    )
    transcript: list[ChatTurn] = []

    try:
        patient_text = normalize_text(args.initial_message)
        for turn_number in range(1, args.max_turns + 1):
            log(f"\nPatient -> Doctor [{turn_number}]: {patient_text}")
            transcript.append(ChatTurn("user", patient_text))

            doctor_message = doctor.send_patient_message(patient_text)
            doctor_text = doctor_prompt_for_patient(doctor_message)
            if args.show_doctor_json:
                log(
                    "Doctor JSON: "
                    + json.dumps(doctor_message, indent=2, ensure_ascii=False)
                )
            log(f"Doctor -> Patient [{turn_number}]: {doctor_text}")
            transcript.append(ChatTurn("doctor", doctor_text))

            if turn_number >= args.max_turns:
                break
            if args.stop_on_final and is_finalish(doctor_text):
                log("\nStopping because the doctor response looked final or urgent.")
                break

            patient_text = patient_ai.reply(transcript, doctor_message)
            if not patient_text:
                raise DriverError("Patient AI returned an empty reply.")
            log(f"Patient AI answer [{turn_number}]: {patient_text}")

        log("\nTranscript:")
        for turn in transcript:
            speaker = "Patient" if turn.role == "user" else "Doctor"
            log(f"{speaker}: {turn.content}")
        return 0
    except (DriverError, subprocess.TimeoutExpired) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
