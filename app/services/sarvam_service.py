import os
import httpx
import logging
from typing import Optional, Dict, Any
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)
SARVAM_BASE_URL = "https://api.sarvam.ai"

class SarvamService:
    def __init__(self, api_key: Optional[str] = None):
        self._api_key = api_key
        self.base_url = SARVAM_BASE_URL

    @property
    def api_key(self) -> str:
        return (self._api_key or os.getenv("SARVAM_API_KEY", "")).strip()

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def text_to_speech(
        self,
        text: str,
        target_language_code: str = "hi-IN",
        speaker: str = "priya",
        pace: float = 1.0,
        model: str = "bulbul:v3"
    ) -> Dict[str, Any]:
        """
        Synthesize speech from text using Sarvam Bulbul:v1.
        Returns a dict with audio_base64 and metadata.
        """
        if not self.is_configured:
            return {
                "success": False,
                "audio_base64": None,
                "provider": "sarvam",
                "message": "SARVAM_API_KEY not configured. Falling back to browser speech synthesis."
            }

        headers = {
            "api-subscription-key": self.api_key.strip(),
            "Content-Type": "application/json"
        }
        
        payload = {
            "inputs": [text],
            "target_language_code": target_language_code,
            "speaker": speaker,
            "pitch": 0,
            "pace": pace,
            "loudness": 1.5,
            "speech_sample_rate": 16000,
            "enable_preprocessing": True,
            "model": model
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(f"{self.base_url}/text-to-speech", json=payload, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    audios = data.get("audios", [])
                    audio_base64 = audios[0] if audios else None
                    return {
                        "success": True,
                        "audio_base64": audio_base64,
                        "audio_format": "audio/wav",
                        "provider": "sarvam",
                        "speaker": speaker,
                        "language": target_language_code
                    }
                else:
                    logger.error(f"Sarvam TTS Error ({res.status_code}): {res.text}")
                    return {
                        "success": False,
                        "audio_base64": None,
                        "provider": "sarvam",
                        "error": f"Sarvam API error: {res.status_code}",
                        "details": res.text
                    }
        except Exception as e:
            logger.exception("Error calling Sarvam TTS")
            return {
                "success": False,
                "audio_base64": None,
                "provider": "sarvam",
                "error": str(e)
            }

    async def speech_to_text(
        self,
        audio_bytes: bytes,
        filename: str = "audio.wav",
        language_code: str = "hi-IN",
        model: str = "saarika:v1"
    ) -> Dict[str, Any]:
        """
        Transcribe audio bytes using Sarvam Saarika:v1.
        """
        if not self.is_configured:
            return {
                "success": False,
                "transcript": "",
                "provider": "sarvam",
                "message": "SARVAM_API_KEY not configured."
            }

        headers = {
            "api-subscription-key": self.api_key.strip()
        }

        files = {
            "file": (filename, audio_bytes, "audio/wav")
        }
        data = {
            "model": model,
            "language_code": language_code
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(f"{self.base_url}/speech-to-text", files=files, data=data, headers=headers)
                if res.status_code == 200:
                    resp_data = res.json()
                    return {
                        "success": True,
                        "transcript": resp_data.get("transcript", ""),
                        "provider": "sarvam",
                        "language": language_code
                    }
                else:
                    logger.error(f"Sarvam STT Error ({res.status_code}): {res.text}")
                    return {
                        "success": False,
                        "transcript": "",
                        "provider": "sarvam",
                        "error": f"Sarvam STT error: {res.status_code}",
                        "details": res.text
                    }
        except Exception as e:
            logger.exception("Error calling Sarvam STT")
            return {
                "success": False,
                "transcript": "",
                "provider": "sarvam",
                "error": str(e)
            }

    async def translate(
        self,
        input_text: str,
        source_language_code: str = "en-IN",
        target_language_code: str = "hi-IN",
        mode: str = "formal"
    ) -> Dict[str, Any]:
        """
        Translate text using Sarvam Mayura:v1.
        """
        if not self.is_configured:
            return {
                "success": False,
                "translated_text": input_text,
                "provider": "sarvam",
                "message": "SARVAM_API_KEY not configured."
            }

        headers = {
            "api-subscription-key": self.api_key.strip(),
            "Content-Type": "application/json"
        }

        payload = {
            "input": input_text,
            "source_language_code": source_language_code,
            "target_language_code": target_language_code,
            "speaker_gender": "Female",
            "mode": mode,
            "model": "mayura:v1"
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(f"{self.base_url}/translate", json=payload, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    return {
                        "success": True,
                        "translated_text": data.get("translated_text", input_text),
                        "provider": "sarvam"
                    }
                else:
                    logger.error(f"Sarvam Translate Error ({res.status_code}): {res.text}")
                    return {
                        "success": False,
                        "translated_text": input_text,
                        "error": f"Status {res.status_code}"
                    }
        except Exception as e:
            logger.exception("Error calling Sarvam Translate")
            return {
                "success": False,
                "translated_text": input_text,
                "error": str(e)
            }

sarvam_client = SarvamService()
